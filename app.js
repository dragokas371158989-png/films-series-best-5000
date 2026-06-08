const INDEX_URL = "data/index.json";
const PAGE_SIZE = 40;
const MIN_VOTES_FOR_TOP = 300;

const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyYzIyNGQ4YzcwMmRkYTIzNjA4MzhhY2UxY2M2OWYyMiIsIm5iZiI6MTc4MDc1MjI0OC44MDE5OTk4LCJzdWIiOiI2YTI0MWY3ODliOWVkZGRjMTUzODU4MTIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.NLC1CjRTfRJpOpZ2mlXZRSpFuWI2zHDFT6IEQnlD4IM";

const INITIAL_CHUNKS = 2;
const BACKGROUND_RENDER_EVERY = 12;
const BACKGROUND_PAUSE_MS = 80;
const FILTER_DEBOUNCE_MS = 180;
const HOME_SECTION_LIMIT = 12;

let allMovies = [];
let filtered = [];
let currentPage = 1;
let currentTab = "all";
let currentAnimeSection = "";
let selectedMovie = null;
let filterTimer = null;
let isBackgroundLoading = false;

const chunkCache = new Map();
const $ = (id) => document.getElementById(id);

const favKey = "gkm_favorites";
const historyKey = "gkm_history";

function loadSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function titleOf(m) {
  return m.ru || m.en || m.title || m.name || "Без названия";
}

function getYear(m) {
  return String(m.year || "").trim();
}

function getRating(m) {
  return Number(m.rating || 0);
}

function getVotes(m) {
  return Number(m.votes || 0);
}

function getGenres(m) {
  return Array.isArray(m.genres) ? m.genres.filter(Boolean) : [];
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function queryOf(m) {
  return encodeURIComponent(titleOf(m));
}

function rankOf(m) {
  const r = getRating(m);

  if (r >= 9) return { rank: "S", label: "S-класс" };
  if (r >= 8) return { rank: "A", label: "A-класс" };
  if (r >= 7) return { rank: "B", label: "B-класс" };
  if (r >= 6) return { rank: "C", label: "C-класс" };

  return { rank: "D", label: "D-класс" };
}

function scoreSmart(m) {
  const rating = getRating(m);
  const votes = getVotes(m);
  const year = Number(getYear(m) || 0);

  if (votes < 30) return -1;

  const voteBonus = Math.min(votes, 50000) / 50000 * 4;
  const yearBonus = year >= 2010 ? 0.4 : 0;

  return rating * 10 + voteBonus + yearBonus;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[ch]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ===== РУССКИЕ ОПИСАНИЯ ===== */

function isMostlyEnglish(text) {
  const s = String(text || "").trim();
  if (!s) return false;

  const latin = (s.match(/[a-zA-Z]/g) || []).length;
  const cyrillic = (s.match(/[а-яА-ЯёЁ]/g) || []).length;

  return latin > cyrillic * 2 && latin > 20;
}

function isRussianText(text) {
  const s = String(text || "").trim();
  if (!s) return false;

  const cyrillic = (s.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latin = (s.match(/[a-zA-Z]/g) || []).length;

  return cyrillic > 40 && cyrillic >= latin;
}

function overviewOf(m) {
  const candidates = [
    m.overview_ru,
    m.ruOverview,
    m.description_ru,
    m.descriptionRu,
    m.description,
    m.overview
  ];

  const found = candidates.find(x => String(x || "").trim());

  if (!found) return "Описание на русском пока не добавлено.";

  if (isMostlyEnglish(found)) {
    return "Описание на русском пока не добавлено.";
  }

  return found;
}

function cleanDescription(text) {
  return String(text || "")
    .replace(/\[.*?\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/Источник:.*/gi, "")
    .replace(/Описание:.*/gi, "")
    .trim();
}

function russianDescriptionCacheKey(m) {
  return "gkm_ru_description_" + String(m.id || titleOf(m));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      cache: "force-cache",
      signal: controller.signal
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Не удалось получить описание:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hasTmdbToken() {
  return (
    TMDB_TOKEN &&
    TMDB_TOKEN !== "ВСТАВЬ_СЮДА_СВОЙ_TMDB_BEARER_TOKEN" &&
    TMDB_TOKEN.length > 30
  );
}

function tmdbHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json"
    }
  };
}

function tmdbTypeOf(m, resultType = "") {
  if (resultType === "movie" || resultType === "tv") return resultType;

  const type = normalize(m.type);
  const genres = getGenres(m).map(normalize).join(" ");

  if (type.includes("сериал")) return "tv";
  if (type.includes("фильм")) return "movie";
  if (genres.includes("мульт")) return "movie";

  return "movie";
}

async function findRussianDescriptionFromTmdb(m) {
  if (!hasTmdbToken()) return "";

  const titleCandidates = [
    m.ru,
    m.en,
    m.title,
    m.name,
    titleOf(m)
  ].filter(Boolean);

  const uniqueTitles = [...new Set(titleCandidates.map(x => String(x).trim()).filter(Boolean))];

  for (const title of uniqueTitles) {
    const searchUrl =
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&language=ru-RU&page=1`;

    const searchData = await fetchJsonWithTimeout(searchUrl, tmdbHeaders());

    if (!searchData || !Array.isArray(searchData.results) || !searchData.results.length) {
      continue;
    }

    let results = searchData.results.filter(r => r.media_type === "movie" || r.media_type === "tv");

    const type = normalize(m.type);

    if (type.includes("сериал")) {
      results = results.filter(r => r.media_type === "tv");
    }

    const best = results[0];
    if (!best || !best.id) continue;

    let overview = cleanDescription(best.overview);

    if (isRussianText(overview)) {
      return overview;
    }

    const mediaType = tmdbTypeOf(m, best.media_type);
    const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${best.id}?language=ru-RU`;
    const detail = await fetchJsonWithTimeout(detailUrl, tmdbHeaders());

    if (detail) {
      overview = cleanDescription(detail.overview);

      if (isRussianText(overview)) {
        return overview;
      }
    }
  }

  return "";
}

async function findRussianAnimeDescriptionFromShikimori(m) {
  if (!isAnimeItem(m)) return "";

  const searchTitle = m.en || m.ru || m.title || m.name || titleOf(m);
  const searchUrl = `https://shikimori.one/api/animes?search=${encodeURIComponent(searchTitle)}&limit=1`;
  const searchData = await fetchJsonWithTimeout(searchUrl);

  if (!Array.isArray(searchData) || !searchData.length || !searchData[0].id) {
    return "";
  }

  const animeId = searchData[0].id;
  const detailUrl = `https://shikimori.one/api/animes/${animeId}`;
  const detail = await fetchJsonWithTimeout(detailUrl);

  if (!detail) return "";

  const candidates = [
    detail.description,
    detail.description_html
  ];

  for (const item of candidates) {
    const cleaned = cleanDescription(item);

    if (isRussianText(cleaned)) {
      return cleaned;
    }
  }

  return "";
}

async function findRussianDescription(m) {
  const cacheKey = russianDescriptionCacheKey(m);
  const cached = localStorage.getItem(cacheKey);

  if (cached && isRussianText(cached)) {
    return cached;
  }

  let ruDescription = "";

  if (isAnimeItem(m)) {
    ruDescription = await findRussianAnimeDescriptionFromShikimori(m);
  }

  if (!ruDescription) {
    ruDescription = await findRussianDescriptionFromTmdb(m);
  }

  if (ruDescription && isRussianText(ruDescription)) {
    localStorage.setItem(cacheKey, ruDescription);
    return ruDescription;
  }

  return "";
}

async function loadRussianDescriptionIntoDialog(m) {
  const placeholder = "Описание на русском пока не добавлено.";
  const currentText = overviewOf(m);

  if (currentText && currentText !== placeholder) return;

  const detailOverview = $("detailOverview");
  if (!detailOverview) return;

  detailOverview.textContent = "Ищу описание на русском...";

  const ruDescription = await findRussianDescription(m);

  if (!selectedMovie || String(selectedMovie.id) !== String(m.id)) return;

  if (ruDescription) {
    m.overview_ru = ruDescription;
    detailOverview.textContent = ruDescription;
  } else {
    detailOverview.textContent = placeholder;
  }
}

/* ===== АНИМЕ ===== */

const ANIME_SECTIONS = [
  { id: "isekai", name: "Исекай", keys: ["исекай", "isekai", "попадан", "попаданец", "перерождение", "reincarnation", "другой мир", "parallel world"] },
  { id: "shounen", name: "Сёнэн", keys: ["сёнэн", "shounen", "shonen"] },
  { id: "seinen", name: "Сэйнэн", keys: ["сэйнэн", "seinen"] },
  { id: "shoujo", name: "Сёдзё", keys: ["сёдзё", "shoujo", "shojo"] },
  { id: "josei", name: "Дзёсэй", keys: ["дзёсэй", "josei"] },
  { id: "fantasy", name: "Фэнтези", keys: ["фэнтези", "fantasy"] },
  { id: "action", name: "Экшен", keys: ["экшен", "action", "боевик", "приключения", "adventure"] },
  { id: "romance", name: "Романтика", keys: ["романтика", "romance", "любов"] },
  { id: "school", name: "Школа", keys: ["школа", "school"] },
  { id: "magic", name: "Магия", keys: ["магия", "magic", "mahou", "волшеб", "волшебник", "волшебница"] },
  { id: "demons", name: "Демоны", keys: ["демон", "демоны", "demons", "demon"] },
  { id: "vampire", name: "Вампиры", keys: ["вампир", "вампиры", "vampire"] },
  { id: "mecha", name: "Меха", keys: ["меха", "mecha", "робот", "robot"] },
  { id: "harem", name: "Гарем", keys: ["гарем", "harem"] },
  { id: "slice", name: "Повседневность", keys: ["повседневность", "slice of life"] },
  { id: "sport", name: "Спорт", keys: ["спорт", "sports"] },
  { id: "comedy", name: "Комедия", keys: ["комедия", "comedy"] },
  { id: "drama", name: "Драма", keys: ["драма", "drama"] },
  { id: "detective", name: "Детектив", keys: ["детектив", "detective", "mystery", "тайна", "загад"] },
  { id: "horror", name: "Ужасы", keys: ["ужасы", "horror"] },
  { id: "supernatural", name: "Сверхъестественное", keys: ["сверхъестественное", "supernatural"] },
  { id: "psychological", name: "Психология", keys: ["психолог", "psychological"] },
  { id: "martial", name: "Боевые искусства", keys: ["боевые искусства", "martial arts"] },
  { id: "military", name: "Военное", keys: ["военное", "military"] },
  { id: "samurai", name: "Самураи", keys: ["самурай", "самураи", "samurai"] },
  { id: "music", name: "Музыка", keys: ["музыка", "music", "idol", "айдол"] },
  { id: "game", name: "Игры", keys: ["игра", "игры", "game", "video game", "strategy game"] }
];

function isAnimeItem(m) {
  const type = normalize(m.type);
  const source = normalize(m.source || m.category || m.provider || m.kind);
  const genres = getGenres(m).map(normalize);

  const text = normalize([
    m.ru,
    m.en,
    m.title,
    m.name,
    m.originalTitle,
    m.type,
    m.kind,
    m.status,
    m.source,
    m.category,
    m.provider,
    m.overview,
    ...getGenres(m)
  ].join(" "));

  const hasAnimeWord = text.includes("аниме") || text.includes("anime");

  const hasAnimeSource =
    source.includes("anime") ||
    source.includes("аниме") ||
    source.includes("shikimori") ||
    source.includes("myanimelist") ||
    source.includes("anilist");

  const hasAnimeId = Boolean(
    m.mal_id ||
    m.malId ||
    m.anilist_id ||
    m.anilistId ||
    m.shikimori_id ||
    m.shikimoriId
  );

  const hasAnimeType = [
    "аниме",
    "ova",
    "ona",
    "tv",
    "tv anime",
    "special",
    "спешл"
  ].includes(type);

  const hasAnimeGenre = genres.some(g => g.includes("аниме") || g.includes("anime"));

  return m.isAnime === true || hasAnimeWord || hasAnimeSource || hasAnimeId || hasAnimeType || hasAnimeGenre;
}

function animeSectionMatch(m, sectionId) {
  if (!sectionId) return true;

  const section = ANIME_SECTIONS.find(s => s.id === sectionId);
  if (!section) return true;

  const text = normalize([
    m.ru,
    m.en,
    m.title,
    m.name,
    m.type,
    m.status,
    overviewOf(m),
    ...getGenres(m)
  ].join(" "));

  return section.keys.some(k => text.includes(normalize(k)));
}

function injectAnimeSectionsStyle() {
  if (document.getElementById("animeSectionsStyle")) return;

  const style = document.createElement("style");
  style.id = "animeSectionsStyle";
  style.textContent = `
    #animeSectionsPanel {
      display: none;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px 22px 16px;
      border-bottom: 1px solid rgba(130, 70, 255, 0.45);
    }

    .anime-section-btn {
      border: 1px solid rgba(0, 220, 255, 0.6);
      background: linear-gradient(180deg, #4d22d8, #24106f);
      color: white;
      border-radius: 12px;
      padding: 10px 16px;
      cursor: pointer;
      box-shadow: 0 0 14px rgba(119, 0, 255, 0.35);
      font-weight: 700;
      transition: .15s ease;
    }

    .anime-section-btn:hover {
      border-color: #20e7ff;
      box-shadow: 0 0 18px rgba(32, 231, 255, 0.45);
      transform: translateY(-1px);
    }

    .anime-section-btn.active {
      background: linear-gradient(180deg, #00d4ff, #5b21ff);
      color: #020617;
      border-color: #5cf4ff;
    }
  `;
  document.head.appendChild(style);
}

function createAnimeSectionsPanel() {
  if (document.getElementById("animeSectionsPanel")) return;

  injectAnimeSectionsStyle();

  const tabs = document.querySelector(".tabs") || document.querySelector("nav");
  if (!tabs) return;

  const panel = document.createElement("div");
  panel.id = "animeSectionsPanel";
  panel.innerHTML = `
    <button class="anime-section-btn active" data-anime-section="">Все аниме</button>
    ${ANIME_SECTIONS.map(s => `<button class="anime-section-btn" data-anime-section="${s.id}">${s.name}</button>`).join("")}
  `;

  tabs.insertAdjacentElement("afterend", panel);

  panel.querySelectorAll(".anime-section-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      panel.querySelectorAll(".anime-section-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentAnimeSection = btn.dataset.animeSection || "";
      currentTab = "anime";

      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      const animeTab = document.querySelector('.tab[data-tab="anime"]');
      if (animeTab) animeTab.classList.add("active");

      applyFilters();
    });
  });
}

function syncAnimePanel() {
  createAnimeSectionsPanel();

  const panel = document.getElementById("animeSectionsPanel");
  if (!panel) return;

  panel.style.display = currentTab === "anime" ? "flex" : "none";

  panel.querySelectorAll(".anime-section-btn").forEach(btn => {
    btn.classList.toggle("active", (btn.dataset.animeSection || "") === currentAnimeSection);
  });
}

/* ===== ЗАГРУЗКА БАЗЫ ===== */

async function loadData() {
  const status = $("statusText");
  if (status) status.textContent = "Загрузка базы...";

  allMovies = [];
  filtered = [];
  currentPage = 1;
  chunkCache.clear();

  try {
    const indexRes = await fetch(INDEX_URL + "?v=" + Date.now(), { cache: "no-store" });

    if (indexRes.ok) {
      const index = await indexRes.json();
      const chunks = Array.isArray(index.chunks) ? index.chunks : [];

      if (chunks.length) {
        await loadChunkedDataFast(index);
        return;
      }
    }
  } catch (e) {
    console.warn("data/index.json не загрузился, пробую movies_updates.json", e);
  }

  const res = await fetch("movies_updates.json?v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить movies_updates.json");

  const data = await res.json();
  allMovies = data.movies || data.items || [];

  if (status) {
    status.textContent = `База: ${allMovies.length} записей · версия ${data.version || "?"} · ${data.generatedAt || ""}`;
  }

  fillFilters();
  applyFilters();
}

async function loadChunkedDataFast(index) {
  const status = $("statusText");
  const chunks = Array.isArray(index.chunks) ? index.chunks : [];
  const movies = [];

  const firstChunks = chunks.slice(0, INITIAL_CHUNKS);
  const restChunks = chunks.slice(INITIAL_CHUNKS);

  for (const chunk of firstChunks) {
    const partMovies = await fetchChunkMovies(chunk);
    movies.push(...partMovies);
  }

  allMovies = movies;

  if (status) {
    status.textContent = `База грузится: ${allMovies.length} записей из ${chunks.length} чанков · версия ${index.version || "?"}`;
  }

  fillFilters();
  applyFilters();

  if (restChunks.length) {
    loadRemainingChunksInBackground(index, restChunks, movies).catch(showError);
  } else if (status) {
    status.textContent = `База: ${allMovies.length} записей · версия ${index.version || "?"} · ${index.generatedAt || ""}`;
  }
}

async function loadRemainingChunksInBackground(index, chunks, movies) {
  const status = $("statusText");
  isBackgroundLoading = true;

  let loadedChunksCount = INITIAL_CHUNKS;

  for (const chunk of chunks) {
    const partMovies = await fetchChunkMovies(chunk);
    movies.push(...partMovies);
    loadedChunksCount++;

    if (status) {
      status.textContent = `База грузится: ${movies.length} записей · чанков ${loadedChunksCount}/${INITIAL_CHUNKS + chunks.length}`;
    }

    if (loadedChunksCount % BACKGROUND_RENDER_EVERY === 0) {
      allMovies = movies;
      applyFilters();
      await sleep(BACKGROUND_PAUSE_MS);
    }
  }

  allMovies = movies;
  isBackgroundLoading = false;

  if (status) {
    status.textContent = `База: ${allMovies.length} записей · версия ${index.version || "?"} · ${index.generatedAt || ""}`;
  }

  fillFilters();
  applyFilters();
}

async function fetchChunkMovies(chunk) {
  const url = chunk.file || chunk.url;
  if (!url) return [];

  let part = chunkCache.get(url);

  if (!part) {
    const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return [];
    part = await res.json();
    chunkCache.set(url, part);
  }

  if (Array.isArray(part.movies)) return part.movies;
  if (Array.isArray(part.items)) return part.items;
  if (Array.isArray(part)) return part;

  return [];
}

/* ===== ФИЛЬТРЫ ===== */

function fillFilters() {
  const yearFilter = $("yearFilter");
  const genreFilter = $("genreFilter");

  if (!yearFilter || !genreFilter) return;

  const currentYear = yearFilter.value;
  const currentGenre = genreFilter.value;

  const years = [...new Set(allMovies.map(getYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));

  const genres = [...new Set(allMovies.flatMap(getGenres))]
    .sort((a, b) => a.localeCompare(b, "ru"));

  yearFilter.innerHTML =
    `<option value="">Все годы</option>` +
    years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join("");

  genreFilter.innerHTML =
    `<option value="">Все жанры</option>` +
    genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");

  if (currentYear) yearFilter.value = currentYear;
  if (currentGenre) genreFilter.value = currentGenre;
}

function applyFilters() {
  syncAnimePanel();

  const searchInput = $("searchInput");
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");
  const sortFilter = $("sortFilter");

  const q = normalize(searchInput ? searchInput.value : "");
  const type = typeFilter ? typeFilter.value : "";
  const genre = genreFilter ? genreFilter.value : "";
  const year = yearFilter ? yearFilter.value : "";
  const minRating = Number(ratingFilter ? ratingFilter.value || 0 : 0);
  const sort = sortFilter ? sortFilter.value : "smart";

  let list = [...allMovies];

  if (currentTab === "movies") list = list.filter(m => m.type === "Фильм");
  if (currentTab === "series") list = list.filter(m => m.type === "Сериал");

  if (currentTab === "cartoons") {
    list = list.filter(m =>
      getGenres(m).some(g => normalize(g).includes("мульт")) &&
      !isAnimeItem(m)
    );
  }

  if (currentTab === "anime") {
    list = list.filter(m => isAnimeItem(m));
    list = list.filter(m => animeSectionMatch(m, currentAnimeSection));
  }

  if (currentTab === "top") list = list.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP).slice(0, 250);
  if (currentTab === "new") list = list.filter(m => Number(getYear(m)) >= 2024);
  if (currentTab === "popular") list = list.filter(m => getVotes(m) >= 1000);

  if (currentTab === "fav") {
    const fav = loadSet(favKey);
    list = list.filter(m => fav.has(String(m.id)));
  }

  if (currentTab === "history") {
    const hist = [...loadSet(historyKey)];
    const map = new Map(allMovies.map(m => [String(m.id), m]));
    list = hist.map(id => map.get(id)).filter(Boolean);
  }

  if (currentTab === "random") {
    list = shuffle(list).slice(0, 200);
  }

  if (q) {
    list = list.filter(m => {
      const hay = normalize([
        m.ru,
        m.en,
        m.year,
        m.type,
        m.status,
        overviewOf(m),
        ...getGenres(m)
      ].join(" "));

      return hay.includes(q);
    });
  }

  if (type) list = list.filter(m => m.type === type);
  if (genre) list = list.filter(m => getGenres(m).includes(genre));
  if (year) list = list.filter(m => getYear(m) === year);
  if (minRating) list = list.filter(m => getRating(m) >= minRating);

  list = sortList(list, sort);

  filtered = list;
  currentPage = 1;
  render();
}

function sortList(list, sort) {
  const a = [...list];

  if (sort === "rating") {
    a.sort((x, y) => getRating(y) - getRating(x));
  } else if (sort === "votes") {
    a.sort((x, y) => getVotes(y) - getVotes(x));
  } else if (sort === "year") {
    a.sort((x, y) => Number(getYear(y) || 0) - Number(getYear(x) || 0));
  } else if (sort === "title") {
    a.sort((x, y) => titleOf(x).localeCompare(titleOf(y), "ru"));
  } else {
    a.sort((x, y) => scoreSmart(y) - scoreSmart(x));
  }

  return a;
}

function hasActiveFilters() {
  const searchInput = $("searchInput");
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");

  return Boolean(
    normalize(searchInput ? searchInput.value : "") ||
    (typeFilter && typeFilter.value) ||
    (genreFilter && genreFilter.value) ||
    (yearFilter && yearFilter.value) ||
    Number(ratingFilter ? ratingFilter.value || 0 : 0)
  );
}

/* ===== РЕНДЕР ===== */

function render() {
  if (currentTab === "all" && !hasActiveFilters()) {
    renderHomeSections();
    return;
  }

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const countText = $("countText");
  const grid = $("grid");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const pageText = $("pageText");

  if (countText) countText.textContent = `Найдено: ${filtered.length} · Страница ${currentPage} из ${pages}`;
  if (grid) grid.innerHTML = pageItems.map(cardHtml).join("");

  bindCardClicks();

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= pages;
  if (pageText) pageText.textContent = `${currentPage} / ${pages}`;
}

function bindCardClicks(root = document) {
  root.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", (e) => {
      const favBtn = e.target.closest(".card-fav-btn");

      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();

        const id = favBtn.getAttribute("data-fav-id");
        toggleCardFavorite(id, favBtn);
        return;
      }

      const id = card.getAttribute("data-id");
      const movie = allMovies.find(m => String(m.id) === id);
      if (movie) openDetails(movie);
    });
  });
}

/* ===== ГЛАВНАЯ ===== */

function renderHomeSections() {
  injectHomeStyle();

  const anime = allMovies
    .filter(isAnimeItem)
    .sort((a, b) => scoreSmart(b) - scoreSmart(a))
    .slice(0, HOME_SECTION_LIMIT);

  const movies = allMovies
    .filter(m => m.type === "Фильм")
    .sort((a, b) => scoreSmart(b) - scoreSmart(a))
    .slice(0, HOME_SECTION_LIMIT);

  const series = allMovies
    .filter(m => m.type === "Сериал")
    .sort((a, b) => scoreSmart(b) - scoreSmart(a))
    .slice(0, HOME_SECTION_LIMIT);

  const cartoons = allMovies
    .filter(m => getGenres(m).some(g => normalize(g).includes("мульт")) && !isAnimeItem(m))
    .sort((a, b) => scoreSmart(b) - scoreSmart(a))
    .slice(0, HOME_SECTION_LIMIT);

  const newItems = allMovies
    .filter(m => Number(getYear(m)) >= 2024)
    .sort((a, b) => Number(getYear(b) || 0) - Number(getYear(a) || 0))
    .slice(0, HOME_SECTION_LIMIT);

  const popular = allMovies
    .filter(m => getVotes(m) >= 1000)
    .sort((a, b) => getVotes(b) - getVotes(a))
    .slice(0, HOME_SECTION_LIMIT);

  const top = allMovies
    .filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP)
    .sort((a, b) => getRating(b) - getRating(a))
    .slice(0, HOME_SECTION_LIMIT);

  const countText = $("countText");
  const grid = $("grid");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const pageText = $("pageText");

  if (countText) {
    countText.textContent = `ГОЛУБЬ Каталог Мира · всего записей: ${allMovies.length}`;
  }

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>ГОЛУБЬ Каталог Мира</h2>
          <p>Фильмы, сериалы, мультфильмы и аниме в одном месте.</p>
        </div>
        <button id="whatToWatchBtn" class="what-watch-main-btn" type="button">🎲 Что посмотреть?</button>
      </section>

      ${homeSectionHtml("🔥 Популярное", popular, "popular")}
      ${homeSectionHtml("⭐ Лучший рейтинг", top, "top")}
      ${homeSectionHtml("🆕 Новинки", newItems, "new")}
      ${homeSectionHtml("🐉 Аниме", anime, "anime")}
      ${homeSectionHtml("🎬 Фильмы", movies, "movies")}
      ${homeSectionHtml("📺 Сериалы", series, "series")}
      ${homeSectionHtml("🧸 Мультфильмы", cartoons, "cartoons")}
    `;
  }

  bindCardClicks();

  document.querySelectorAll("[data-open-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.openTab;
      const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);

      if (tab) {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        tab.classList.add("active");
      }

      currentTab = tabName;
      currentAnimeSection = "";
      applyFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  const whatBtn = document.getElementById("whatToWatchBtn");
  if (whatBtn) {
    whatBtn.addEventListener("click", openWhatToWatch);
  }

  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  if (pageText) pageText.textContent = "Главная";
}

function homeSectionHtml(title, items, tabName) {
  if (!items.length) return "";

  return `
    <section class="home-section">
      <div class="home-section-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="home-more-btn" data-open-tab="${escapeAttr(tabName)}" type="button">Смотреть все</button>
      </div>
      <div class="home-row">
        ${items.map(cardHtml).join("")}
      </div>
    </section>
  `;
}

/* ===== СТИЛИ ===== */

function injectHomeStyle() {
  if (document.getElementById("homeStyle")) return;

  const style = document.createElement("style");
  style.id = "homeStyle";
  style.textContent = `
    .home-hero {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      padding: 22px;
      border: 1px solid rgba(0, 220, 255, 0.35);
      border-radius: 20px;
      background:
        radial-gradient(circle at top left, rgba(0, 220, 255, 0.18), transparent 35%),
        linear-gradient(135deg, rgba(91, 33, 255, 0.42), rgba(2, 6, 23, 0.96));
      box-shadow: 0 0 28px rgba(91, 33, 255, 0.25);
    }

    .home-hero h2 {
      margin: 0 0 8px;
      font-size: 28px;
    }

    .home-hero p {
      margin: 0;
      opacity: .82;
    }

    .what-watch-main-btn {
      border: 1px solid rgba(0, 220, 255, 0.7);
      background: linear-gradient(180deg, #00d4ff, #5b21ff);
      color: white;
      border-radius: 14px;
      padding: 13px 18px;
      cursor: pointer;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 0 22px rgba(0, 220, 255, 0.3);
    }

    .home-section {
      grid-column: 1 / -1;
      margin-top: 10px;
    }

    .home-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 6px 0 14px;
    }

    .home-section-head h3 {
      margin: 0;
      font-size: 22px;
    }

    .home-more-btn {
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.8);
      color: white;
      border-radius: 12px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .home-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 16px;
    }

    .poster-wrap {
      position: relative;
    }

    .card-fav-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 5;
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.78);
      color: white;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
      box-shadow: 0 0 14px rgba(0, 0, 0, 0.35);
      transition: .15s ease;
    }

    .card-fav-btn:hover {
      transform: scale(1.08);
      border-color: rgba(255, 80, 150, 0.95);
      box-shadow: 0 0 18px rgba(255, 80, 150, 0.45);
    }

    .card-fav-btn.active {
      background: linear-gradient(180deg, #ff2f7d, #6d28d9);
      border-color: rgba(255, 255, 255, 0.7);
    }

    .what-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .what-dialog {
      width: min(720px, 100%);
      max-height: 90vh;
      overflow: auto;
      border-radius: 22px;
      border: 1px solid rgba(0, 220, 255, .45);
      background: #020617;
      color: white;
      box-shadow: 0 0 35px rgba(91, 33, 255, .45);
      padding: 18px;
    }

    .what-dialog-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .what-dialog-head h3 {
      margin: 0;
      font-size: 22px;
    }

    .what-close-btn {
      border: 0;
      background: rgba(255,255,255,.1);
      color: white;
      border-radius: 10px;
      padding: 8px 11px;
      cursor: pointer;
      font-size: 18px;
    }

    .mood-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .mood-btn {
      border: 1px solid rgba(0, 220, 255, .35);
      background: linear-gradient(180deg, #24106f, #0f172a);
      color: white;
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
      font-weight: 700;
    }

    .mood-btn:hover {
      border-color: #20e7ff;
    }

    .what-result {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 14px;
    }

    .mobile-filters-toggle {
      display: none;
      width: calc(100% - 32px);
      margin: 12px 16px;
      border: 1px solid rgba(0, 220, 255, 0.7);
      background: linear-gradient(180deg, #00d4ff, #5b21ff);
      color: white;
      border-radius: 14px;
      padding: 13px 16px;
      cursor: pointer;
      font-weight: 900;
      font-size: 15px;
      box-shadow: 0 0 20px rgba(0, 220, 255, 0.25);
    }

    @media (max-width: 700px) {
      .home-hero {
        flex-direction: column;
        align-items: stretch;
        padding: 18px;
      }

      .home-hero h2 {
        font-size: 23px;
      }

      .what-watch-main-btn {
        width: 100%;
      }

      .home-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .home-section-head h3 {
        font-size: 18px;
      }

      .home-more-btn {
        padding: 7px 10px;
        font-size: 13px;
      }

      .card-title {
        font-size: 13px;
      }

      .meta {
        font-size: 12px;
      }

      .card-fav-btn {
        width: 32px;
        height: 32px;
        font-size: 16px;
        top: 6px;
        right: 6px;
      }

      .mobile-filters-toggle {
        display: block;
      }

      .filters.mobile-collapsed,
      .controls.mobile-collapsed,
      .filter-panel.mobile-collapsed,
      .search-panel.mobile-collapsed,
      #filtersPanel.mobile-collapsed {
        display: none !important;
      }

      .filters.mobile-open,
      .controls.mobile-open,
      .filter-panel.mobile-open,
      .search-panel.mobile-open,
      #filtersPanel.mobile-open {
        display: grid !important;
        grid-template-columns: 1fr;
        gap: 10px;
        padding: 12px 16px;
      }

      .filters.mobile-open input,
      .filters.mobile-open select,
      .controls.mobile-open input,
      .controls.mobile-open select,
      .filter-panel.mobile-open input,
      .filter-panel.mobile-open select,
      .search-panel.mobile-open input,
      .search-panel.mobile-open select,
      #filtersPanel.mobile-open input,
      #filtersPanel.mobile-open select {
        width: 100%;
        min-height: 42px;
        font-size: 15px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* ===== КАРТОЧКИ ===== */

function cardHtml(m) {
  injectHomeStyle();

  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));

  const poster = m.poster
    ? `<img loading="lazy" src="${escapeAttr(m.poster)}" alt="${escapeAttr(titleOf(m))}">`
    : `<div class="no-poster">Нет постера</div>`;

  const genres = getGenres(m).slice(0, 3).join(" · ");

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">
        <button
          class="card-fav-btn ${isFav ? "active" : ""}"
          data-fav-id="${escapeAttr(m.id)}"
          title="${isFav ? "Убрать из избранного" : "Добавить в избранное"}"
          type="button"
        >
          ${isFav ? "❤️" : "🤍"}
        </button>
        ${poster}
      </div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(m.year || "—")} · ${escapeHtml(m.type || "—")}</p>
        <p class="meta">${escapeHtml(genres)}</p>
        <span class="rating rank-${rankOf(m).rank.toLowerCase()}">
          ${rankOf(m).rank}-класс · ${getRating(m).toFixed(1)}
        </span>
      </div>
    </article>
  `;
}

function toggleCardFavorite(id, btn) {
  if (!id) return;

  const fav = loadSet(favKey);
  const key = String(id);

  if (fav.has(key)) {
    fav.delete(key);

    if (btn) {
      btn.classList.remove("active");
      btn.textContent = "🤍";
      btn.title = "Добавить в избранное";
    }
  } else {
    fav.add(key);

    if (btn) {
      btn.classList.add("active");
      btn.textContent = "❤️";
      btn.title = "Убрать из избранного";
    }
  }

  saveSet(favKey, fav);

  if (currentTab === "fav") {
    applyFilters();
  }
}

/* ===== ЧТО ПОСМОТРЕТЬ ===== */

function openWhatToWatch() {
  injectHomeStyle();

  const old = document.getElementById("whatDialogBackdrop");
  if (old) old.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "whatDialogBackdrop";
  backdrop.className = "what-dialog-backdrop";

  backdrop.innerHTML = `
    <div class="what-dialog">
      <div class="what-dialog-head">
        <h3>🎲 Что посмотреть?</h3>
        <button class="what-close-btn" id="whatCloseBtn" type="button">×</button>
      </div>

      <div class="mood-grid">
        <button class="mood-btn" data-mood="action" type="button">🔥 Хочу мясо</button>
        <button class="mood-btn" data-mood="comedy" type="button">😂 Хочу поржать</button>
        <button class="mood-btn" data-mood="romance" type="button">💘 Хочу романтику</button>
        <button class="mood-btn" data-mood="magic" type="button">✨ Хочу магию</button>
        <button class="mood-btn" data-mood="anime" type="button">🐉 Хочу аниме</button>
        <button class="mood-btn" data-mood="top" type="button">⭐ Хочу топовое</button>
        <button class="mood-btn" data-mood="new" type="button">🆕 Хочу новое</button>
        <button class="mood-btn" data-mood="random" type="button">🎯 Дай случайное</button>
      </div>

      <div id="whatResult" class="what-result"></div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeBtn = document.getElementById("whatCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => backdrop.remove());

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) backdrop.remove();
  });

  backdrop.querySelectorAll(".mood-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      renderMoodResult(btn.dataset.mood);
    });
  });

  renderMoodResult("top");
}

function renderMoodResult(mood) {
  const result = document.getElementById("whatResult");
  if (!result) return;

  let list = [...allMovies];

  if (mood === "action") {
    list = list.filter(m => {
      const text = normalize([m.ru, m.en, overviewOf(m), ...getGenres(m)].join(" "));
      return text.includes("боевик") || text.includes("экшен") || text.includes("action") || text.includes("приключ");
    });
  }

  if (mood === "comedy") {
    list = list.filter(m => {
      const text = normalize([m.ru, m.en, overviewOf(m), ...getGenres(m)].join(" "));
      return text.includes("комедия") || text.includes("comedy");
    });
  }

  if (mood === "romance") {
    list = list.filter(m => {
      const text = normalize([m.ru, m.en, overviewOf(m), ...getGenres(m)].join(" "));
      return text.includes("романтика") || text.includes("romance") || text.includes("любов");
    });
  }

  if (mood === "magic") {
    list = list.filter(m => {
      const text = normalize([m.ru, m.en, overviewOf(m), ...getGenres(m)].join(" "));
      return text.includes("магия") || text.includes("magic") || text.includes("фэнтези") || text.includes("fantasy");
    });
  }

  if (mood === "anime") {
    list = list.filter(isAnimeItem);
  }

  if (mood === "top") {
    list = list.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP);
  }

  if (mood === "new") {
    list = list.filter(m => Number(getYear(m)) >= 2024);
  }

  list = list
    .filter(m => getRating(m) > 0)
    .sort((a, b) => scoreSmart(b) - scoreSmart(a));

  if (mood === "random") {
    list = shuffle(allMovies).slice(0, 8);
  } else {
    list = shuffle(list.slice(0, 80)).slice(0, 8);
  }

  if (!list.length) {
    result.innerHTML = `<p>Ничего не нашёл под это настроение. Попробуй другой вариант.</p>`;
    return;
  }

  result.innerHTML = list.map(cardHtml).join("");
  bindCardClicks(result);
}

/* ===== ДЕТАЛИ ===== */

function openDetails(m) {
  selectedMovie = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  const arr = [String(m.id), ...hist].slice(0, 300);
  localStorage.setItem(historyKey, JSON.stringify(arr));

  if ($("detailTitle")) $("detailTitle").textContent = titleOf(m);

  if ($("detailMeta")) {
    $("detailMeta").textContent =
      `${m.year || "—"} · ${m.type || "—"} · рейтинг ${getRating(m).toFixed(1)} · голосов ${m.votes || 0}`;
  }

  if ($("detailGenres")) $("detailGenres").textContent = getGenres(m).join(" · ");

  if ($("detailOverview")) {
    $("detailOverview").textContent = overviewOf(m);
    loadRussianDescriptionIntoDialog(m);
  }

  if ($("detailPoster")) {
    $("detailPoster").src = m.poster || "";
    $("detailPoster").style.display = m.poster ? "block" : "none";
  }

  const q = queryOf(m);
  const isAnime = isAnimeItem(m);

  const animeLinksBlock = document.getElementById("animeLinksBlock");
  const catalogLinksBlock = document.getElementById("catalogLinksBlock");

  if (animeLinksBlock) animeLinksBlock.style.display = isAnime ? "block" : "none";
  if (catalogLinksBlock) catalogLinksBlock.style.display = isAnime ? "none" : "block";

  if ($("kinopoiskLink")) $("kinopoiskLink").href = `https://www.kinopoisk.ru/index.php?kp_query=${q}`;
  if ($("youtubeLink")) $("youtubeLink").href = `https://www.youtube.com/results?search_query=${q}+трейлер`;
  if ($("vkLink")) $("vkLink").href = `https://vk.com/video?q=${q}`;
  if ($("rutubeLink")) $("rutubeLink").href = `https://rutube.ru/search/?query=${q}`;

  if ($("shikimoriLink")) $("shikimoriLink").href = `https://shikimori.one/animes?search=${q}`;
  if ($("malLink")) $("malLink").href = `https://myanimelist.net/anime.php?q=${q}`;
  if ($("anilistLink")) $("anilistLink").href = `https://anilist.co/search/anime?search=${q}`;
  if ($("animePlanetLink")) $("animePlanetLink").href = `https://www.anime-planet.com/anime/all?name=${q}`;
  if ($("anidbLink")) $("anidbLink").href = `https://anidb.net/anime/?adb.search=${q}`;

  updateFavBtn();

  if ($("detailsDialog")) {
    $("detailsDialog").showModal();
  }
}

function updateFavBtn() {
  const favBtn = $("favBtn");
  if (!favBtn) return;

  const fav = loadSet(favKey);
  const yes = selectedMovie && fav.has(String(selectedMovie.id));
  favBtn.textContent = yes ? "Убрать из избранного" : "В избранное";
}

function toggleFav() {
  if (!selectedMovie) return;

  const fav = loadSet(favKey);
  const id = String(selectedMovie.id);

  if (fav.has(id)) fav.delete(id);
  else fav.add(id);

  saveSet(favKey, fav);
  updateFavBtn();

  if (currentTab === "fav") applyFilters();
}

/* ===== МОБИЛЬНЫЕ ФИЛЬТРЫ ===== */

function findFiltersPanel() {
  return (
    document.querySelector(".filters") ||
    document.querySelector(".controls") ||
    document.querySelector(".filter-panel") ||
    document.querySelector(".search-panel") ||
    document.getElementById("filtersPanel")
  );
}

function setupMobileFilters() {
  injectHomeStyle();

  const panel = findFiltersPanel();
  if (!panel) return;

  if (document.getElementById("mobileFiltersToggle")) return;

  const btn = document.createElement("button");
  btn.id = "mobileFiltersToggle";
  btn.className = "mobile-filters-toggle";
  btn.type = "button";
  btn.textContent = "☰ Фильтры";

  panel.insertAdjacentElement("beforebegin", btn);

  function closeOnMobile() {
    if (window.innerWidth <= 700) {
      panel.classList.add("mobile-collapsed");
      panel.classList.remove("mobile-open");
      btn.textContent = "☰ Фильтры";
    } else {
      panel.classList.remove("mobile-collapsed");
      panel.classList.remove("mobile-open");
      btn.textContent = "☰ Фильтры";
    }
  }

  btn.addEventListener("click", () => {
    const isOpen = panel.classList.contains("mobile-open");

    if (isOpen) {
      panel.classList.remove("mobile-open");
      panel.classList.add("mobile-collapsed");
      btn.textContent = "☰ Фильтры";
    } else {
      panel.classList.remove("mobile-collapsed");
      panel.classList.add("mobile-open");
      btn.textContent = "✕ Скрыть фильтры";
    }
  });

  window.addEventListener("resize", closeOnMobile);
  closeOnMobile();
}

/* ===== СБРОС И СОБЫТИЯ ===== */

function resetFilters() {
  if ($("searchInput")) $("searchInput").value = "";
  if ($("typeFilter")) $("typeFilter").value = "";
  if ($("genreFilter")) $("genreFilter").value = "";
  if ($("yearFilter")) $("yearFilter").value = "";
  if ($("ratingFilter")) $("ratingFilter").value = "0";
  if ($("sortFilter")) $("sortFilter").value = "smart";

  currentTab = "all";
  currentAnimeSection = "";

  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  const allTab = document.querySelector('.tab[data-tab="all"]');
  if (allTab) allTab.classList.add("active");

  applyFilters();
}

function scheduleApplyFilters() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    applyFilters();
  }, FILTER_DEBOUNCE_MS);
}

function setupEvents() {
  setupMobileFilters();

  [
    "searchInput",
    "typeFilter",
    "genreFilter",
    "yearFilter",
    "ratingFilter",
    "sortFilter"
  ].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("input", scheduleApplyFilters);
    el.addEventListener("change", scheduleApplyFilters);
  });

  const resetBtn = $("resetFiltersBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      currentTab = btn.dataset.tab;

      if (currentTab !== "anime") {
        currentAnimeSection = "";
      }

      applyFilters();
    });
  });

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

      if (currentPage < pages) {
        currentPage++;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if ($("closeDialog")) {
    $("closeDialog").addEventListener("click", () => $("detailsDialog").close());
  }

  if ($("favBtn")) {
    $("favBtn").addEventListener("click", toggleFav);
  }

  if ($("reloadBtn")) {
    $("reloadBtn").addEventListener("click", () => loadData().catch(showError));
  }

  if ($("themeBtn")) {
    $("themeBtn").addEventListener("click", () => {
      document.body.classList.toggle("light");
      localStorage.setItem("gkm_theme", document.body.classList.contains("light") ? "light" : "dark");
    });
  }

  if (localStorage.getItem("gkm_theme") === "light") {
    document.body.classList.add("light");
  }
}

function showError(e) {
  console.error(e);

  if ($("statusText")) {
    $("statusText").textContent = "Ошибка: " + e.message;
  }

  if ($("grid")) {
    $("grid").innerHTML =
      `<div class="card"><div class="card-body">Не удалось загрузить базу. Проверь data/index.json или movies_updates.json.</div></div>`;
  }
}

setupEvents();
loadData().catch(showError);
