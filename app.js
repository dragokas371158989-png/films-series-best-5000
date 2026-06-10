// FIX: OPM season matching by year, prevents Season 1 card from showing Season 3 players.
const INDEX_URL = "data/index.json";
const PAGE_SIZE = 40;
const MIN_VOTES_FOR_TOP = 300;
const PLAYER_API_URL = "https://divine-wildflower-20ef.dragokas371158989.workers.dev";

const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyYzIyNGQ4YzcwMmRkYTIzNjA4MzhhY2UxY2M2OWYyMiIsIm5iZiI6MTc4MDc1MjI0OC44MDE5OTk4LCJzdWIiOiI2YTI0MWY3ODliOWVkZGRjMTUzODU4MTIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.NLC1CjRTfRJpOpZ2mlXZRSpFuWI2zHDFT6IEQnlD4IM";

const INITIAL_CHUNKS = 2;
const BACKGROUND_RENDER_EVERY = 999999;
const BACKGROUND_PAUSE_MS = 20;
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
  const rawTitle = m.ru || m.en || m.title || m.name || "Без названия";
  return translateKnownTitle(rawTitle);
}

function translateKnownTitle(title) {
  const raw = String(title || "").trim();
  const norm = raw.toLowerCase().replace(/[‐‑‒–—―-]/g, "-").replace(/\s+/g, " ").trim();

  const RU_TITLE_MAP = {
    "attack on titan": "Атака титанов",
    "shingeki no kyojin": "Атака титанов",
    "one piece": "Ван-Пис",
    "onepiece": "Ван-Пис",
    "naruto": "Наруто",
    "naruto shippuden": "Наруто: Ураганные хроники",
    "fullmetal alchemist: brotherhood": "Стальной алхимик: Братство",
    "fullmetal alchemist brotherhood": "Стальной алхимик: Братство",
    "one-punch man": "Ванпанчмен",
    "one punch man": "Ванпанчмен",
    "demon slayer": "Истребитель демонов",
    "kimetsu no yaiba": "Истребитель демонов",
    "jujutsu kaisen": "Магическая битва",
    "death note": "Тетрадь смерти",
    "bleach": "Блич",
    "hunter x hunter": "Охотник х Охотник",
    "dragon ball": "Драконий жемчуг",
    "dragon ball z": "Драконий жемчуг Z",
    "dragon ball super": "Драконий жемчуг Супер",
    "my hero academia": "Моя геройская академия",
    "boku no hero academia": "Моя геройская академия",
    "tokyo ghoul": "Токийский гуль",
    "chainsaw man": "Человек-бензопила",
    "black clover": "Чёрный клевер",
    "fairy tail": "Хвост Феи",
    "sword art online": "Мастера меча онлайн",
    "solo leveling": "Поднятие уровня в одиночку",
    "blue lock": "Синяя тюрьма: Блю Лок",
    "spy x family": "Семья шпиона",
    "vinland saga": "Сага о Винланде",
    "berserk": "Берсерк",
    "cowboy bebop": "Ковбой Бибоп",
    "neon genesis evangelion": "Евангелион",
    "code geass": "Код Гиас",
    "steins;gate": "Врата Штейна",
    "mob psycho 100": "Моб Психо 100",
    "haikyu!!": "Волейбол!!",
    "haikyuu!!": "Волейбол!!",
    "kuroko's basketball": "Баскетбол Куроко",
    "the seven deadly sins": "Семь смертных грехов",
    "nanatsu no taizai": "Семь смертных грехов",
    "dr. stone": "Доктор Стоун",
    "fire force": "Пламенная бригада пожарных",
    "the promised neverland": "Обещанный Неверленд",
    "made in abyss": "Созданный в Бездне",
    "re:zero": "Re:Zero. Жизнь с нуля в альтернативном мире",
    "re zero": "Re:Zero. Жизнь с нуля в альтернативном мире",
    "mushoku tensei": "Реинкарнация безработного",
    "overlord": "Повелитель",
    "that time i got reincarnated as a slime": "О моём перерождении в слизь",
    "tensei shitara slime datta ken": "О моём перерождении в слизь",
    "konosuba": "Этот замечательный мир!",
    "gintama": "Гинтама",
    "jojo's bizarre adventure": "Невероятные приключения ДжоДжо",
    "jojos bizarre adventure": "Невероятные приключения ДжоДжо",
    "parasyte": "Паразит",
    "akira": "Акира",
    "spirited away": "Унесённые призраками",
    "howl's moving castle": "Ходячий замок",
    "princess mononoke": "Принцесса Мононоке",
    "your name.": "Твоё имя",
    "your name": "Твоё имя",
    "a silent voice": "Форма голоса",
    "weathering with you": "Дитя погоды",
    "suzume": "Судзумэ, закрывающая двери",
    "the witch and the beast": "Ведьма и чудовище",
    "witch hat atelier": "Ателье колдовских колпаков",
    "atelier of witch hat": "Ателье колдовских колпаков",
    "game of thrones": "Игра престолов",
    "house of the dragon": "Дом Дракона",
    "breaking bad": "Во все тяжкие",
    "better call saul": "Лучше звоните Солу",
    "the walking dead": "Ходячие мертвецы",
    "stranger things": "Очень странные дела",
    "the boys": "Пацаны",
    "supernatural": "Сверхъестественное",
    "the last of us": "Одни из нас",
    "the witcher": "Ведьмак",
    "squid game": "Игра в кальмара",
    "dark": "Тьма",
    "lost": "Остаться в живых",
    "friends": "Друзья",
    "sherlock": "Шерлок",
    "peaky blinders": "Острые козырьки",
    "vikings": "Викинги",
    "the mandalorian": "Мандалорец",
    "the lord of the rings": "Властелин колец",
    "the hobbit": "Хоббит",
    "harry potter": "Гарри Поттер",
    "interstellar": "Интерстеллар",
    "inception": "Начало",
    "the matrix": "Матрица",
    "avatar": "Аватар",
    "joker": "Джокер",
    "fight club": "Бойцовский клуб",
    "the godfather": "Крёстный отец",
    "pulp fiction": "Криминальное чтиво",
    "the dark knight": "Тёмный рыцарь",
    "forrest gump": "Форрест Гамп",
    "gladiator": "Гладиатор",
    "titanic": "Титаник",
    "john wick": "Джон Уик",
    "deadpool": "Дэдпул",
    "venom": "Веном",
    "dune": "Дюна"
  };

  if (RU_TITLE_MAP[norm]) {
    return RU_TITLE_MAP[norm];
  }

  return raw || "Без названия";
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
  let lastStatusUpdate = 0;

  for (const chunk of chunks) {
    const partMovies = await fetchChunkMovies(chunk);
    movies.push(...partMovies);
    loadedChunksCount++;

    const now = Date.now();

    if (status && now - lastStatusUpdate > 700) {
      lastStatusUpdate = now;
      status.textContent = `База грузится: ${movies.length} записей · чанков ${loadedChunksCount}/${INITIAL_CHUNKS + chunks.length}`;
    }

    await sleep(BACKGROUND_PAUSE_MS);
  }

  allMovies = movies;
  isBackgroundLoading = false;

  if (status) {
    status.textContent = `База: ${allMovies.length} записей · версия ${index.version || "?"} · ${index.generatedAt || ""}`;
  }

  setTimeout(() => {
    fillFilters();
    applyFilters();
  }, 250);
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
function injectCardFixStyle() {
  if (document.getElementById("cardFixStyle")) return;

  const style = document.createElement("style");
  style.id = "cardFixStyle";
  style.textContent = `
    body {
      padding-bottom: 90px !important;
    }

   header,
.header,
.top,
.topbar {
  overflow: hidden !important;
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  gap: 12px !important;
  padding: 8px 14px 14px !important;
}

.logo,
.brand,
.site-logo {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
}

header img,
.header img,
.logo img,
.brand img,
.site-logo img,
img.logo {
  display: block !important;
  margin-left: auto !important;
  margin-right: auto !important;
  width: auto !important;
  max-width: min(360px, 100%) !important;
  max-height: 120px !important;
  height: auto !important;
  object-fit: contain !important;
}

    #grid {
      padding-bottom: 110px !important;
    }

    .card {
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      min-width: 0 !important;
      height: 100% !important;
    }

    .poster-wrap {
      position: relative !important;
      width: 100% !important;
      aspect-ratio: 2 / 3 !important;
      overflow: hidden !important;
      background:
        radial-gradient(circle at center, rgba(124,58,237,.22), transparent 45%),
        linear-gradient(180deg, #12072d, #050816) !important;
      flex-shrink: 0 !important;
    }

    .poster-wrap img {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      object-fit: cover !important;
      object-position: center center !important;
      font-size: 0 !important;
      color: transparent !important;
      text-indent: -9999px !important;
    }

    .poster-wrap img.poster-broken {
      display: none !important;
    }

    .poster-placeholder {
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      padding: 12px !important;
      color: rgba(255,255,255,.45) !important;
      font-weight: 800 !important;
      font-size: 13px !important;
      background:
        radial-gradient(circle at center, rgba(124,58,237,.28), transparent 45%),
        linear-gradient(180deg, #160b38, #060817) !important;
    }

    .card-body {
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      min-height: 165px !important;
      min-width: 0 !important;
      overflow: hidden !important;
      padding-bottom: 12px !important;
    }

    .card-title {
      min-height: 38px !important;
      max-height: 44px !important;
      overflow: hidden !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2 !important;
      -webkit-box-orient: vertical !important;
      line-height: 1.15 !important;
    }

    .meta {
      overflow: hidden !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2 !important;
      -webkit-box-orient: vertical !important;
    }

    .rating {
      margin-top: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      min-height: 44px !important;
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      font-size: clamp(14px, 1.15vw, 18px) !important;
      padding: 9px 8px !important;
      flex-shrink: 0 !important;
    }

    .similar-block {
      padding-bottom: 110px !important;
    }

    @media (max-width: 700px) {
      body {
        padding-bottom: 120px !important;
      }

      header,
.header,
.top,
.topbar {
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
  padding: 8px 10px 12px !important;
}

.logo,
.brand,
.site-logo {
  width: 100% !important;
  justify-content: center !important;
}

header img,
.header img,
.logo img,
.brand img,
.site-logo img,
img.logo {
  display: block !important;
  margin-left: auto !important;
  margin-right: auto !important;
  width: auto !important;
  max-width: min(320px, 96vw) !important;
  max-height: 105px !important;
  height: auto !important;
  object-fit: contain !important;
}

      #grid {
        padding-bottom: 140px !important;
      }

      .home-row,
      #grid {
        gap: 12px !important;
      }

      .card-body {
        min-height: 150px !important;
        padding: 10px 10px 12px !important;
      }

      .card-title {
        font-size: 13px !important;
        min-height: 34px !important;
        max-height: 40px !important;
      }

      .meta {
        font-size: 11px !important;
        line-height: 1.25 !important;
      }

      .rating {
        font-size: 15px !important;
        min-height: 42px !important;
        border-radius: 12px !important;
        padding: 8px 6px !important;
      }

      .poster-placeholder {
        font-size: 12px !important;
      }

      .similar-block {
        padding-bottom: 150px !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function handlePosterError(img) {
  if (!img) return;

  img.classList.add("poster-broken");

  const wrap = img.closest(".poster-wrap");
  if (!wrap) return;

  if (!wrap.querySelector(".poster-placeholder")) {
    const placeholder = document.createElement("div");
    placeholder.className = "poster-placeholder";
    placeholder.textContent = "Нет постера";
    wrap.appendChild(placeholder);
  }
}
function getBadges(m) {
  const badges = [];
  const fav = loadSet(favKey);
  const genresText = getGenres(m).map(normalize).join(" ");
  const year = Number(getYear(m) || 0);

  if (isAnimeItem(m)) {
    badges.push({ text: "🐉 Аниме", cls: "anime" });
  } else if (genresText.includes("мульт")) {
    badges.push({ text: "🧸 Мультфильм", cls: "cartoon" });
  } else if (m.type === "Сериал") {
    badges.push({ text: "📺 Сериал", cls: "series" });
  } else if (m.type === "Фильм") {
    badges.push({ text: "🎬 Фильм", cls: "movie" });
  }

  if (getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 8) {
    badges.push({ text: "⭐ Топ", cls: "top" });
  }

  if (year >= 2024) {
    badges.push({ text: "🆕 Новинка", cls: "new" });
  }

  if (fav.has(String(m.id))) {
    badges.push({ text: "❤️ Избранное", cls: "fav" });
  }

  return badges.slice(0, 3);
}

function badgesHtml(m) {
  const badges = getBadges(m);

  if (!badges.length) return "";

  return `
    <div class="card-badges">
      ${badges.map(b => `<span class="card-badge badge-${b.cls}">${escapeHtml(b.text)}</span>`).join("")}
    </div>
  `;
}

function injectBadgesStyle() {
  if (document.getElementById("badgesStyle")) return;

  const style = document.createElement("style");
  style.id = "badgesStyle";
  style.textContent = `
    .card-badges {
      position: absolute;
      left: 7px;
      top: 7px;
      z-index: 6;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-width: calc(100% - 50px);
      pointer-events: none;
    }

    .card-badge {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      line-height: 1;
      color: white;
      border: 1px solid rgba(255,255,255,.35);
      background: rgba(2, 6, 23, .82);
      backdrop-filter: blur(8px);
      box-shadow: 0 0 12px rgba(0,0,0,.35);
      text-shadow: 0 1px 2px rgba(0,0,0,.45);
    }

    .badge-anime {
      background: linear-gradient(180deg, rgba(124,58,237,.95), rgba(49,46,129,.95));
      border-color: rgba(167,139,250,.9);
    }

    .badge-movie {
      background: linear-gradient(180deg, rgba(37,99,235,.95), rgba(30,64,175,.95));
      border-color: rgba(96,165,250,.9);
    }

    .badge-series {
      background: linear-gradient(180deg, rgba(14,165,233,.95), rgba(12,74,110,.95));
      border-color: rgba(125,211,252,.9);
    }

    .badge-cartoon {
      background: linear-gradient(180deg, rgba(236,72,153,.95), rgba(157,23,77,.95));
      border-color: rgba(249,168,212,.9);
    }

    .badge-top {
      background: linear-gradient(180deg, rgba(245,158,11,.98), rgba(180,83,9,.98));
      border-color: rgba(253,230,138,.95);
      color: #111827;
      text-shadow: none;
    }

    .badge-new {
      background: linear-gradient(180deg, rgba(34,197,94,.95), rgba(21,128,61,.95));
      border-color: rgba(134,239,172,.9);
    }

    .badge-fav {
      background: linear-gradient(180deg, rgba(244,63,94,.98), rgba(159,18,57,.98));
      border-color: rgba(253,164,175,.95);
    }

    @media (max-width: 700px) {
      .card-badges {
        left: 5px;
        top: 5px;
        gap: 4px;
        max-width: calc(100% - 42px);
      }

      .card-badge {
        font-size: 10px;
        padding: 3px 6px;
        min-height: 20px;
      }
    }
  `;

  document.head.appendChild(style);
}
function cardHtml(m) {
  injectHomeStyle();
  injectBadgesStyle();
  injectCardFixStyle();

  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));

  const poster = m.poster
    ? `<img loading="lazy" src="${escapeAttr(m.poster)}" alt="" onerror="handlePosterError(this)">`
    : `<div class="poster-placeholder">Нет постера</div>`;

  const genres = getGenres(m).slice(0, 3).join(" · ");

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">
        ${badgesHtml(m)}

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
/* ===== ПОХОЖИЕ ===== */

function injectSimilarStyle() {
  if (document.getElementById("similarStyle")) return;

  const style = document.createElement("style");
  style.id = "similarStyle";
  style.textContent = `
    .similar-block {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px solid rgba(130, 70, 255, 0.45);
    }

    .similar-block h3 {
      margin: 0 0 12px;
      font-size: 20px;
      color: #fff;
    }

    .similar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
      gap: 12px;
    }

    .similar-grid .card {
      min-width: 0;
    }

    .similar-grid .card-title {
      font-size: 13px;
    }

    .similar-grid .meta {
      font-size: 11px;
    }

    .similar-empty {
      color: rgba(255,255,255,.7);
      font-size: 14px;
      padding: 8px 0;
    }

    @media (max-width: 700px) {
      .similar-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .similar-block h3 {
        font-size: 18px;
      }
    }
  `;

  document.head.appendChild(style);
}

function similarScore(base, item) {
  if (!base || !item) return 0;
  if (String(base.id) === String(item.id)) return -9999;

  let score = 0;

  const baseGenres = getGenres(base).map(normalize);
  const itemGenres = getGenres(item).map(normalize);

  for (const g of baseGenres) {
    if (itemGenres.includes(g)) score += 10;
  }

  if (base.type && item.type && base.type === item.type) {
    score += 8;
  }

  const baseAnime = isAnimeItem(base);
  const itemAnime = isAnimeItem(item);

  if (baseAnime && itemAnime) score += 10;
  if (baseAnime !== itemAnime) score -= 20;

  const by = Number(getYear(base) || 0);
  const iy = Number(getYear(item) || 0);

  if (by && iy) {
    const diff = Math.abs(by - iy);

    if (diff === 0) score += 5;
    else if (diff <= 2) score += 4;
    else if (diff <= 5) score += 2;
  }

  score += Math.min(getRating(item), 10);

  return score;
}

function findSimilarItems(base, limit = 10) {
  if (!base || !allMovies.length) return [];

  const baseGenres = getGenres(base).map(normalize);
  const baseAnime = isAnimeItem(base);
  const baseType = base.type;

  let candidates = allMovies.filter(item => {
    if (String(item.id) === String(base.id)) return false;

    const itemAnime = isAnimeItem(item);

    if (baseAnime !== itemAnime) return false;

    if (baseType && item.type && baseType !== item.type) {
      return false;
    }

    const itemGenres = getGenres(item).map(normalize);
    const hasSharedGenre = baseGenres.some(g => itemGenres.includes(g));

    return hasSharedGenre;
  });

  if (candidates.length > 1200) {
    candidates = candidates
      .sort((a, b) => scoreSmart(b) - scoreSmart(a))
      .slice(0, 1200);
  }

  return candidates
    .map(item => ({
      item,
      score: similarScore(base, item)
    }))
    .filter(x => x.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);
}

function ensureSimilarBlock() {
  const dialog = $("detailsDialog");
  if (!dialog) return null;

  let block = document.getElementById("similarBlock");

  if (!block) {
    block = document.createElement("section");
    block.id = "similarBlock";
    block.className = "similar-block";
    block.innerHTML = `
      <h3>Похожие</h3>
      <div id="similarGrid" class="similar-grid"></div>
    `;

    const target =
      dialog.querySelector(".detail-body") ||
      dialog.querySelector(".details-body") ||
      dialog.querySelector(".modal-body") ||
      dialog.querySelector(".dialog-body") ||
      dialog.querySelector(".content") ||
      dialog;

    target.appendChild(block);
  }

  return block;
}

function renderSimilarItems(m) {
  injectSimilarStyle();

  const block = ensureSimilarBlock();
  if (!block) return;

  const grid = document.getElementById("similarGrid");
  if (!grid) return;

  const similar = findSimilarItems(m, 10);

  if (!similar.length) {
    block.style.display = "block";
    grid.innerHTML = `<div class="similar-empty">Похожих пока не нашёл.</div>`;
    return;
  }

  block.style.display = "block";
  grid.innerHTML = similar.map(cardHtml).join("");

  bindCardClicks(grid);
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

  if ($("detailGenres")) {
    $("detailGenres").textContent = getGenres(m).join(" · ");
  }

  if ($("detailOverview")) {
    $("detailOverview").textContent = overviewOf(m);
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

  const dialog = $("detailsDialog");
  if (dialog && !dialog.open) {
    dialog.showModal();
  }

  const similarGrid = document.getElementById("similarGrid");
  if (similarGrid) {
    similarGrid.innerHTML = `<div class="similar-empty">Подбираю похожие...</div>`;
  }

  setTimeout(() => {
    if (!selectedMovie || String(selectedMovie.id) !== String(m.id)) return;
    renderSimilarItems(m);
  }, 300);

  setTimeout(() => {
    if (!selectedMovie || String(selectedMovie.id) !== String(m.id)) return;
    loadRussianDescriptionIntoDialog(m);
  }, 100);

  setTimeout(() => {
    if (!selectedMovie || String(selectedMovie.id) !== String(m.id)) return;
    if (typeof addOfficialEmbedButtonsToDetails === "function") {
      addOfficialEmbedButtonsToDetails(m);
    }
  }, 160);

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

/* =========================================================
   RUTUBE ПЛЕЕР И СЕЗОНЫ
   Работает с обычными ссылками Rutube вида:
   https://rutube.ru/video/ID/?playlist=...
========================================================= */

window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

function extractRutubeEmbedLinks(text) {
  const raw = String(text || "");
  const links = [];

  const embedRegex = /https:\/\/rutube\.ru\/play\/embed\/[a-zA-Z0-9_-]+\/?/g;
  const videoRegex = /https:\/\/rutube\.ru\/video\/([a-zA-Z0-9_-]+)\/?/g;

  const embedMatches = raw.match(embedRegex) || [];

  embedMatches.forEach(link => {
    const clean = link.replace(/\/+$/, "");
    if (!links.includes(clean)) links.push(clean);
  });

  let match;
  while ((match = videoRegex.exec(raw)) !== null) {
    const id = match[1];
    const embed = `https://rutube.ru/play/embed/${id}`;
    if (!links.includes(embed)) links.push(embed);
  }

  return links;
}

function normalizeEmbedTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/&/g, " and ")
    .replace(/[‐‑‒–—―-]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addTitleAliasSet(title) {
  const t = String(title || "").trim();
  if (!t) return [];

  const result = new Set([t]);
  const norm = normalizeEmbedTitle(t);

  if (norm.includes("one punch man")) {
    result.add("One Punch Man");
    result.add("One-Punch Man");
    result.add("Wanpanman");
    result.add("Ванпанчмен");

    if (norm.includes("2") || norm.includes("season 2") || norm.includes("2nd")) {
      result.add("One-Punch Man Season 2");
      result.add("One Punch Man Season 2");
      result.add("One Punch Man 2");
      result.add("One-Punch Man 2");
      result.add("One Punch Man 2nd Season");
      result.add("One-Punch Man 2nd Season");
      result.add("Ванпанчмен 2 сезон");
      result.add("Ванпанчмен 2");
    }

    if (norm.includes("3") || norm.includes("season 3") || norm.includes("3rd")) {
      result.add("One-Punch Man Season 3");
      result.add("One Punch Man Season 3");
      result.add("One Punch Man 3");
      result.add("One-Punch Man 3");
      result.add("One Punch Man 3rd Season");
      result.add("One-Punch Man 3rd Season");
      result.add("Ванпанчмен 3 сезон");
      result.add("Ванпанчмен 3");
    }
  }

  if (norm.includes("ванпанчмен")) {
    result.add("Ванпанчмен");
    result.add("One Punch Man");
    result.add("One-Punch Man");
    result.add("Wanpanman");

    if (norm.includes("2")) {
      result.add("Ванпанчмен 2 сезон");
      result.add("One-Punch Man Season 2");
      result.add("One Punch Man Season 2");
      result.add("One Punch Man 2");
    }

    if (norm.includes("3")) {
      result.add("Ванпанчмен 3 сезон");
      result.add("One-Punch Man Season 3");
      result.add("One Punch Man Season 3");
      result.add("One Punch Man 3");
    }
  }

  return [...result];
}

function addRutubeSeasonFromText(config) {
  const titles = config.titles || [];
  const season = Number(config.season || 1);
  const text = config.text || "";

  const links = extractRutubeEmbedLinks(text);

  const episodes = links.map((src, index) => ({
    name: `Rutube — ${season} сезон ${index + 1} серия`,
    season,
    episode: index + 1,
    src,
    source: "rutube"
  }));

  const allTitles = new Set();

  titles.forEach(title => {
    addTitleAliasSet(title).forEach(alias => allTitles.add(alias));
  });

  allTitles.forEach(title => {
    if (!window.OFFICIAL_EMBEDS[title]) {
      window.OFFICIAL_EMBEDS[title] = [];
    }

    const exists = new Set(window.OFFICIAL_EMBEDS[title].map(x => x.src));

    episodes.forEach(ep => {
      if (!exists.has(ep.src)) {
        window.OFFICIAL_EMBEDS[title].push(ep);
        exists.add(ep.src);
      }
    });
  });

  console.log(`Rutube: добавлено серий ${episodes.length}`, [...allTitles]);
}



function addRutubeSeasonExactList(config) {
  const titles = config.titles || [];
  const episodes = Array.isArray(config.episodes) ? config.episodes : [];
  const allTitles = new Set();

  titles.forEach(title => {
    addTitleAliasSet(title).forEach(alias => allTitles.add(alias));
  });

  const cleanEpisodes = episodes
    .filter(ep => ep && ep.src)
    .map(ep => ({
      name: ep.name || `Rutube — ${ep.season || ""} сезон ${ep.episode || ""} серия`,
      season: Number(ep.season || config.season || 0),
      episode: Number(ep.episode || 0),
      src: String(ep.src).replace(/\/+$/, ""),
      url: ep.url || "",
      source: "rutube"
    }));

  allTitles.forEach(title => {
    window.OFFICIAL_EMBEDS[title] = cleanEpisodes.slice();
  });

  console.log(`Rutube: точный список серий ${cleanEpisodes.length}`, [...allTitles]);
}

function addRutubeVideoFromText(config) {
  const titles = config.titles || [];
  const name = config.name || "Rutube — смотреть";
  const text = config.text || "";

  const links = extractRutubeEmbedLinks(text);
  if (!links.length) {
    console.warn("Rutube: ссылка на видео не найдена", config);
    return;
  }

  const item = {
    name,
    src: links[0],
    source: "rutube"
  };

  const allTitles = new Set();

  titles.forEach(title => {
    addTitleAliasSet(title).forEach(alias => allTitles.add(alias));
  });

  allTitles.forEach(title => {
    if (!window.OFFICIAL_EMBEDS[title]) {
      window.OFFICIAL_EMBEDS[title] = [];
    }

    const exists = new Set(window.OFFICIAL_EMBEDS[title].map(x => x.src));

    if (!exists.has(item.src)) {
      window.OFFICIAL_EMBEDS[title].push(item);
    }
  });

  console.log("Rutube: добавлен фильм", name, [...allTitles]);
}

function getMovieTitleCandidates(movie) {
  const candidates = [
    movie && movie.ru,
    movie && movie.en,
    movie && movie.title,
    movie && movie.name,
    movie && movie.title_ru,
    movie && movie.name_ru,
    movie && movie.title_en,
    movie && movie.name_en,
    movie && movie.russian,
    movie && movie.english,
    movie && movie.originalTitle,
    movie && movie.russianTitle,
    movie && movie.englishTitle,
    typeof titleOf === "function" && movie ? titleOf(movie) : "",
    document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
  ]
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(Boolean);

  const expanded = new Set();

  candidates.forEach(title => {
    expanded.add(title);
    addTitleAliasSet(title).forEach(alias => expanded.add(alias));
  });

  return [...expanded];
}

/* ===== FORCE FIX: DEATH NOTE / ТЕТРАДЬ СМЕРТИ ===== */
(function () {
  const deathNoteEpisodes = [
    {
        "name": "Тетрадь смерти — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/91aa850286a0c9eeb8bb71018f058e4b",
        "url": "https://rutube.ru/video/91aa850286a0c9eeb8bb71018f058e4b/",
        "source": "rutube"
    },
    {
        "name": "Тетрадь смерти — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/d614b901cfe922bbbd16466c0ff0528e",
        "url": "https://rutube.ru/video/d614b901cfe922bbbd16466c0ff0528e/",
        "source": "rutube"
    },
    {
        "name": "Тетрадь смерти — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/c44c89adb5f8b20848c32cc00e0a1505",
        "url": "https://rutube.ru/video/c44c89adb5f8b20848c32cc00e0a1505/",
        "source": "rutube"
    }
];

  const keys = [
    "Тетрадь смерти",
    "Death Note",
    "Desu Nōto",
    "デスノート"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = deathNoteEpisodes;
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = deathNoteEpisodes;
    }
  });

  function isDeathNoteRaw(raw) {
    const s = String(raw || "").toLowerCase();
    return s.includes("death note") ||
           s.includes("тетрадь смерти") ||
           s.includes("desu nōto") ||
           s.includes("デスノート");
  }

  try {
    const oldSync = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
    getOfficialEmbedsForMovie = function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isDeathNoteRaw(raw)) return deathNoteEpisodes;
      return oldSync ? oldSync(movie) : [];
    };
  } catch (e) {}

  try {
    const oldAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
    getOfficialEmbedsForMovieAsync = async function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isDeathNoteRaw(raw)) return deathNoteEpisodes;
      return oldAsync ? oldAsync(movie) : [];
    };
  } catch (e) {}
})();

/* ===== ТЕТРАДЬ СМЕРТИ / DEATH NOTE ===== */

addRutubeSeasonExactList({
  titles: [
    "Тетрадь смерти",
    "Death Note",
    "Desu Nōto",
    "デスノート"
  ],
  season: 1,
  episodes: [
    {
        "name": "Тетрадь смерти — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239023&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239023",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239024&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239024",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239025&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239025",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239026&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239026",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239027&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239027",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239028&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239028",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239029&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239029",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239030&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239030",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239031&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239031",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239032&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239032",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239033&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239033",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239034&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239034",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239035&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239035",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239036&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239036",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239037&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239037",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239038&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239038",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239040&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239040",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239042&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239042",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239045&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239045",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239047&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239047",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239049&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239049",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239051&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239051",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239053&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239053",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239055&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239055",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239057&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239057",
        "source": "iframe"
    }
]
});

/* ===== FORCE FIX: DEATH NOTE / ТЕТРАДЬ СМЕРТИ VK ===== */
(function () {
  const deathNoteEpisodes = [
    {
        "name": "Тетрадь смерти — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239023&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239023",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239024&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239024",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239025&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239025",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239026&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239026",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239027&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239027",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239028&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239028",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239029&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239029",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239030&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239030",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239031&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239031",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239032&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239032",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239033&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239033",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239034&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239034",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239035&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239035",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239036&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239036",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239037&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239037",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239038&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239038",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239040&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239040",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239042&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239042",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239045&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239045",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239047&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239047",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239049&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239049",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239051&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239051",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239053&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239053",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239055&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239055",
        "source": "iframe"
    },
    {
        "name": "Тетрадь смерти — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://vk.com/video_ext.php?oid=-196980150&id=456239057&hd=2",
        "url": "https://vkvideo.ru/video-196980150_456239057",
        "source": "iframe"
    }
];

  const keys = [
    "Тетрадь смерти",
    "Death Note",
    "Desu Nōto",
    "デスノート"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = deathNoteEpisodes;
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = deathNoteEpisodes;
    }
  });

  function isDeathNoteRaw(raw) {
    const s = String(raw || "").toLowerCase();
    return s.includes("death note") ||
           s.includes("тетрадь смерти") ||
           s.includes("desu nōto") ||
           s.includes("デスノート");
  }

  try {
    const oldSync = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
    getOfficialEmbedsForMovie = function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isDeathNoteRaw(raw)) return deathNoteEpisodes;
      return oldSync ? oldSync(movie) : [];
    };
  } catch (e) {}

  try {
    const oldAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
    getOfficialEmbedsForMovieAsync = async function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isDeathNoteRaw(raw)) return deathNoteEpisodes;
      return oldAsync ? oldAsync(movie) : [];
    };
  } catch (e) {}
})();


/* ===== CORE FORCE PLAYERS FIX ===== */
const FORCE_EMBEDS_BY_TITLE = [
  {
    keys: ["sword art online", "sao", "s.a.o", "мастера меча онлайн", "мастер меча онлайн", "ソードアート"],
    embeds: [
    {
        "name": "Мастера меча онлайн — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/cc395a0135d14b100d5a87b431d6f8a1",
        "url": "https://rutube.ru/video/cc395a0135d14b100d5a87b431d6f8a1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/1523d746b5bf81ade41c37c26cf707f1",
        "url": "https://rutube.ru/video/1523d746b5bf81ade41c37c26cf707f1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/d60c9b674367da045d663e600c003fc1",
        "url": "https://rutube.ru/video/d60c9b674367da045d663e600c003fc1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/9e6904e419d6778728bc2b2ae94a6c67",
        "url": "https://rutube.ru/video/9e6904e419d6778728bc2b2ae94a6c67/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/4a23d50875d8b9e16472d220c8e3db6a",
        "url": "https://rutube.ru/video/4a23d50875d8b9e16472d220c8e3db6a/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/b794cf4d175b9ef3258008a201caa9a5",
        "url": "https://rutube.ru/video/b794cf4d175b9ef3258008a201caa9a5/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/4615d84c49dfee0f569fe39a72fe787e",
        "url": "https://rutube.ru/video/4615d84c49dfee0f569fe39a72fe787e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/ddd66472657b0b4f9bae3738313f8ace",
        "url": "https://rutube.ru/video/ddd66472657b0b4f9bae3738313f8ace/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/2373e497a102d27466709dc67fdca177",
        "url": "https://rutube.ru/video/2373e497a102d27466709dc67fdca177/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/7b420e6651028b82e07df18b764eac2d",
        "url": "https://rutube.ru/video/7b420e6651028b82e07df18b764eac2d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/0644a97e1d550d77ef065cb8e86cab92",
        "url": "https://rutube.ru/video/0644a97e1d550d77ef065cb8e86cab92/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/09e783dd41c8a690e057e48337e8f6d4",
        "url": "https://rutube.ru/video/09e783dd41c8a690e057e48337e8f6d4/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/1c629b2e70df8956a6473dbe107b73e1",
        "url": "https://rutube.ru/video/1c629b2e70df8956a6473dbe107b73e1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/ddc1fc0d6debe9f958d9f21dfe5d156f",
        "url": "https://rutube.ru/video/ddc1fc0d6debe9f958d9f21dfe5d156f/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/c34e09790e95dc38b36599fe5fa67fed",
        "url": "https://rutube.ru/video/c34e09790e95dc38b36599fe5fa67fed/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/ba79314ad8e5960a5b79a79b18470b1e",
        "url": "https://rutube.ru/video/ba79314ad8e5960a5b79a79b18470b1e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/092f5f531757e30942638ba2f31b1c07",
        "url": "https://rutube.ru/video/092f5f531757e30942638ba2f31b1c07/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/2fced8938c3778bd936487bfff3faefb",
        "url": "https://rutube.ru/video/2fced8938c3778bd936487bfff3faefb/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/0a02dab2631dbb5ebd07a0a26a48fa1d",
        "url": "https://rutube.ru/video/0a02dab2631dbb5ebd07a0a26a48fa1d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/baf81a9fb8da91f7bb008b56966aeccf",
        "url": "https://rutube.ru/video/baf81a9fb8da91f7bb008b56966aeccf/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/924d4415780283484e47300cc156a03d",
        "url": "https://rutube.ru/video/924d4415780283484e47300cc156a03d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/87f303df23d90a19f1350df88819b5c9",
        "url": "https://rutube.ru/video/87f303df23d90a19f1350df88819b5c9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/2c687f8a4742318bf5cb824af44912e9",
        "url": "https://rutube.ru/video/2c687f8a4742318bf5cb824af44912e9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/388f3ddb30bbed6b6573c4cc182f9c35",
        "url": "https://rutube.ru/video/388f3ddb30bbed6b6573c4cc182f9c35/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/0e386965c1aeda99933939626c6064de",
        "url": "https://rutube.ru/video/0e386965c1aeda99933939626c6064de/",
        "source": "rutube"
    }
]
  },
  {
    keys: ["attack on titan", "shingeki no kyojin", "атака титанов", "進撃の巨人"],
    embeds: [
    {
        "name": "Атака титанов — смотреть",
        "season": 1,
        "episode": 1,
        "src": "https://frontend.vh.yandex.ru/player/4521041827197602696?autoplay=1&event_prefix=sandbox:&restore_mute_state=1&init_timeout=15000&counters=%7B%22duration%22%3A1565%2C%22reqid%22%3A%221781132506693846-14550417896480300177-balancer-l7leveler-kubr-yp-klg-39-BAL%22%2C%22table%22%3A%22video_tech%22%2C%22heartbeats%22%3A%7B%22singlePath%22%3A%22heartbeat.single.fserp%22%2C%22noRepeat%22%3Atrue%7D%2C%22live%22%3Afalse%2C%22videoUrl%22%3A%22http%3A%2F%2Ffrontend.vh.yandex.ru%2Fplayer%2F4521041827197602696%22%2C%22extraParams%22%3A%7B%22from%22%3A%22yavideo%22%7D%7D&service=ya-video&from=yavideo",
        "url": "https://frontend.vh.yandex.ru/player/4521041827197602696?autoplay=1&event_prefix=sandbox:&restore_mute_state=1&init_timeout=15000&counters=%7B%22duration%22%3A1565%2C%22reqid%22%3A%221781132506693846-14550417896480300177-balancer-l7leveler-kubr-yp-klg-39-BAL%22%2C%22table%22%3A%22video_tech%22%2C%22heartbeats%22%3A%7B%22singlePath%22%3A%22heartbeat.single.fserp%22%2C%22noRepeat%22%3Atrue%7D%2C%22live%22%3Afalse%2C%22videoUrl%22%3A%22http%3A%2F%2Ffrontend.vh.yandex.ru%2Fplayer%2F4521041827197602696%22%2C%22extraParams%22%3A%7B%22from%22%3A%22yavideo%22%7D%7D&service=ya-video&from=yavideo",
        "source": "iframe"
    }
]
  }
];

function getForcedEmbedsForMovie(movie) {
  const raw = [
    movie && movie.ru,
    movie && movie.en,
    movie && movie.title,
    movie && movie.name,
    movie && movie.title_ru,
    movie && movie.name_ru,
    movie && movie.title_en,
    movie && movie.name_en,
    movie && movie.originalTitle,
    movie && movie.russianTitle,
    movie && movie.englishTitle,
    typeof titleOf === "function" && movie ? titleOf(movie) : "",
    document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
  ].filter(Boolean).join(" ").toLowerCase();

  const norm = typeof normalizeEmbedTitle === "function" ? normalizeEmbedTitle(raw) : raw;

  for (const item of FORCE_EMBEDS_BY_TITLE) {
    if (item.keys.some(k => norm.includes(String(k).toLowerCase()) || raw.includes(String(k).toLowerCase()))) {
      return item.embeds || [];
    }
  }

  return [];
}


function getOfficialEmbedsForMovie(movie) {
  const forcedEmbeds = typeof getForcedEmbedsForMovie === "function" ? getForcedEmbedsForMovie(movie) : [];
  if (forcedEmbeds && forcedEmbeds.length) return forcedEmbeds;

  if (!movie || !window.OFFICIAL_EMBEDS) return [];

  const directTitles = [
    movie && movie.ru,
    movie && movie.en,
    movie && movie.title,
    movie && movie.name,
    movie && movie.title_ru,
    movie && movie.name_ru,
    movie && movie.title_en,
    movie && movie.name_en,
    movie && movie.russian,
    movie && movie.english,
    movie && movie.originalTitle,
    movie && movie.russianTitle,
    movie && movie.englishTitle,
    typeof titleOf === "function" && movie ? titleOf(movie) : "",
    document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
  ]
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(Boolean);

  const directNorms = [...new Set(directTitles.map(normalizeEmbedTitle).filter(Boolean))];
  const expandedNorms = [...new Set(getMovieTitleCandidates(movie).map(normalizeEmbedTitle).filter(Boolean))];
  const entries = Object.entries(window.OFFICIAL_EMBEDS);

  const isNarutoShippudenNorm = (norm) => {
    const s = String(norm || "");
    return (s.includes("naruto") && (s.includes("shippuden") || s.includes("shippuuden"))) || s.includes("ураганные хроники");
  };

  const isNarutoOriginalNorm = (norm) => {
    const s = String(norm || "");
    return (s === "naruto" || s === "наруто" || s.includes("naruto season 1") || s.includes("наруто 1 сезон")) && !isNarutoShippudenNorm(s);
  };

  const movieIsNarutoShippuden = directNorms.some(isNarutoShippudenNorm);
  const movieIsNarutoOriginal = directNorms.some(isNarutoOriginalNorm) && !movieIsNarutoShippuden;

  const narutoKeyAllowed = (keyNorm) => {
    const keyIsShippuden = isNarutoShippudenNorm(keyNorm);
    const keyIsOriginal = isNarutoOriginalNorm(keyNorm);

    // Защита: обычный Naruto и Naruto Shippuden не должны цеплять друг друга по слову "Naruto".
    if (movieIsNarutoOriginal && keyIsShippuden) return false;
    if (movieIsNarutoShippuden && keyIsOriginal) return false;

    return true;
  };

  const getSeasonFromNorm = (norm) => {
    const s = String(norm || "");
    if (/(^|\s)(3|iii|third|3rd)(\s|$)/i.test(s) || /season\s*3/i.test(s) || /3\s*сезон/i.test(s)) return 3;
    if (/(^|\s)(2|ii|second|2nd)(\s|$)/i.test(s) || /season\s*2/i.test(s) || /2\s*сезон/i.test(s)) return 2;
    if (/(^|\s)(1|i|first|1st)(\s|$)/i.test(s) || /season\s*1/i.test(s) || /1\s*сезон/i.test(s)) return 1;
    return 0;
  };

  const wantedSeason = directNorms.map(getSeasonFromNorm).find(Boolean) || 0;
  const sameSeason = ([key]) => !wantedSeason || getSeasonFromNorm(normalizeEmbedTitle(key)) === wantedSeason;

  // 1) Сначала ищем точное совпадение по настоящему названию из базы, без общих алиасов.
  for (const [key, embeds] of entries) {
    const keyNorm = normalizeEmbedTitle(key);
    if (!narutoKeyAllowed(keyNorm)) continue;
    if (directNorms.includes(keyNorm) && sameSeason([key])) {
      return embeds || [];
    }
  }

  // 2) Потом точное совпадение по алиасам, но если в названии есть сезон — не отдаём другой сезон.
  for (const [key, embeds] of entries) {
    const keyNorm = normalizeEmbedTitle(key);
    if (!narutoKeyAllowed(keyNorm)) continue;
    if (expandedNorms.includes(keyNorm) && sameSeason([key])) {
      return embeds || [];
    }
  }

  // 3) Потом мягкое совпадение, тоже с проверкой сезона.
  for (const [key, embeds] of entries) {
    if (!sameSeason([key])) continue;

    const keyNorm = normalizeEmbedTitle(key);
    if (!narutoKeyAllowed(keyNorm)) continue;

    if (expandedNorms.some(t => {
      if (!t || !keyNorm) return false;
      if (t === keyNorm) return true;
      if (t.includes(keyNorm) || keyNorm.includes(t)) return true;

      const tNoSeason = t
        .replace(/\bseason\b/g, "")
        .replace(/\b2nd\b/g, "2")
        .replace(/\b3rd\b/g, "3")
        .replace(/\s+/g, " ")
        .trim();

      const kNoSeason = keyNorm
        .replace(/\bseason\b/g, "")
        .replace(/\b2nd\b/g, "2")
        .replace(/\b3rd\b/g, "3")
        .replace(/\s+/g, " ")
        .trim();

      return tNoSeason === kNoSeason || tNoSeason.includes(kNoSeason) || kNoSeason.includes(tNoSeason);
    })) {
      return embeds || [];
    }
  }

  return [];
}

function injectOfficialEmbedStyles() {
  if (document.getElementById("officialEmbedStyles")) return;

  const style = document.createElement("style");
  style.id = "officialEmbedStyles";
  style.textContent = `
    .official-episodes-box {
      width: 100%;
      max-width: 860px;
      margin-top: 18px;
      padding: 16px;
      border-radius: 18px;
      background: rgba(2, 6, 23, 0.78);
      border: 1px solid rgba(34, 211, 238, 0.38);
      box-shadow: 0 0 18px rgba(59, 130, 246, 0.20);
      box-sizing: border-box;
    }

    .official-episodes-title {
      margin: 0 0 12px;
      color: #facc15;
      font-size: 18px;
      font-weight: 900;
    }

    .official-episodes-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(110px, 1fr));
      gap: 10px;
      width: 100%;
    }

    .official-embed-btn {
      min-height: 46px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(103, 232, 249, 0.58);
      background: linear-gradient(135deg, #7c3aed, #312e81);
      color: white;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 0 14px rgba(124, 58, 237, 0.25);
      text-align: center;
      line-height: 1.15;
    }

    .official-embed-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.14);
    }

    .official-embed-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.82);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      box-sizing: border-box;
    }

    .official-embed-modal {
      width: min(1100px, 100%);
      background: #020617;
      border: 1px solid rgba(34, 211, 238, 0.45);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 0 40px rgba(91, 33, 255, 0.55);
    }

    .official-embed-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      color: white;
      font-weight: 900;
      background: linear-gradient(135deg, rgba(91, 33, 255, 0.55), rgba(2, 6, 23, 0.95));
    }

    .official-embed-close {
      width: 38px;
      height: 38px;
      border: 1px solid rgba(103, 232, 249, 0.55);
      border-radius: 12px;
      color: white;
      background: linear-gradient(135deg, #7c3aed, #312e81);
      cursor: pointer;
      font-size: 24px;
      font-weight: 900;
      line-height: 1;
    }

    .official-embed-frame-wrap {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
    }

    .official-embed-frame-wrap iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }

    @media (max-width: 900px) {
      .official-episodes-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 600px) {
      .official-episodes-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .official-embed-backdrop {
        padding: 8px;
      }
    }
  `;

  document.head.appendChild(style);
}

function closeDetailsBeforePlayer() {
  const dialog = document.getElementById("detailsDialog");

  if (dialog) {
    if (typeof dialog.close === "function" && dialog.open) {
      try {
        dialog.close();
      } catch (e) {}
    }

    dialog.classList.remove("open", "active", "show");
  }

  document.body.classList.remove("modal-open", "dialog-open");
}

function openOfficialEmbedPlayer(embed) {
  injectOfficialEmbedStyles();

  const old = document.getElementById("officialEmbedPlayer");
  if (old) old.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "officialEmbedPlayer";
  backdrop.className = "official-embed-backdrop";

  backdrop.innerHTML = `
    <div class="official-embed-modal">
      <div class="official-embed-head">
        <span>${escapeHtml(embed.name || "Rutube")}</span>
        <button class="official-embed-close" type="button" aria-label="Закрыть">×</button>
      </div>
      <div class="official-embed-frame-wrap">
        <iframe
          src="${escapeAttr(String(embed.src || "").replace(/\/+$/, ""))}"
          allow="clipboard-write; autoplay; fullscreen"
          allowfullscreen
        ></iframe>
      </div>
      ${embed.url ? `<a href="${escapeAttr(embed.url)}" target="_blank" rel="noreferrer" style="display:block;padding:12px 16px;color:#fff;background:#1d4ed8;text-align:center;font-weight:800;text-decoration:none;">Открыть источник, если плеер не запустился</a>` : ""}
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.querySelector(".official-embed-close").addEventListener("click", close);

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) close();
  });

  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", escClose);
    }
  });
}

function findVideoAndSearchBlock() {
  const dialog = document.getElementById("detailsDialog") || document;

  const headings = [...dialog.querySelectorAll("h2, h3")];
  const videoHeading = headings.find(h => normalizeEmbedTitle(h.textContent).includes("видео"));

  if (videoHeading) {
    return videoHeading.parentElement || videoHeading.closest("section, div") || dialog;
  }

  return (
    document.querySelector("#catalogLinksBlock") ||
    document.querySelector(".detail-links") ||
    document.querySelector(".details-body") ||
    document.querySelector(".detail-body") ||
    document.querySelector("#detailsDialog")
  );
}

async function fetchOfficialEmbedsFromWorker(movie) {
  if (!movie || !PLAYER_API_URL) return [];

  const titles = getMovieTitleCandidates(movie);

  for (const title of titles) {
    try {
      const url = `${PLAYER_API_URL}/player?title=${encodeURIComponent(title)}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) continue;

      const data = await res.json();
      const player = data && data.player;

      if (!data || !data.ok || !data.found || !player) continue;

      const embeds = [];

      if (Array.isArray(player.players)) {
        player.players.forEach(item => {
          if (!item || !item.src) return;

          embeds.push({
            name: item.name || "Rutube — смотреть",
            src: item.src,
            source: item.source || "rutube"
          });
        });
      }

      if (Array.isArray(player.seasons)) {
        player.seasons.forEach(seasonItem => {
          const seasonNumber = Number(seasonItem.season || 1);
          const episodes = Array.isArray(seasonItem.episodes) ? seasonItem.episodes : [];

          episodes.forEach(ep => {
            if (!ep || !ep.src) return;

            embeds.push({
              name: ep.name || `${seasonNumber} сезон ${ep.episode || ""} серия`,
              season: seasonNumber,
              episode: ep.episode || 0,
              src: ep.src,
              source: ep.source || "rutube"
            });
          });
        });
      }

      if (embeds.length) {
        console.log("Rutube API: найден плеер", title, embeds.length);
        return embeds;
      }
    } catch (e) {
      console.warn("Rutube API: ошибка запроса", title, e);
    }
  }

  return [];
}

function detectWantedSeasonFromMovie(movie) {
  const rawText = [
    movie && movie.ru,
    movie && movie.en,
    movie && movie.title,
    movie && movie.name,
    movie && movie.originalTitle,
    typeof titleOf === "function" && movie ? titleOf(movie) : "",
    document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
  ].filter(Boolean).join(" ");

  const text = normalizeEmbedTitle(rawText);

  if (/season\s*3/i.test(rawText) || /3\s*сезон/i.test(rawText) || /\b3rd\b/i.test(rawText)) return 3;
  if (/season\s*2/i.test(rawText) || /2\s*сезон/i.test(rawText) || /\b2nd\b/i.test(rawText)) return 2;
  if (/season\s*1/i.test(rawText) || /1\s*сезон/i.test(rawText) || /\b1st\b/i.test(rawText)) return 1;

  // ВАЖНО ДЛЯ ВАНПАНЧМЕНА:
  // В базе 1 сезон часто называется просто "One-Punch Man" без "Season 1".
  // Из-за этого раньше срабатывал общий алиас и карточка 2015 года получала кнопки 3 сезона.
  if (text.includes("one punch man") || text.includes("ванпанчмен") || text.includes("wanpanman")) {
    const year = Number(movie && (movie.year || movie.release_year || movie.aired_on || movie.released) || 0);

    if (year && year <= 2016) return 1;
    if (year >= 2019 && year < 2025) return 2;
    if (year >= 2025) return 3;

    // Если год не найден, обычная карточка без номера сезона — это 1 сезон.
    return 1;
  }

  return 0;
}

function isOnePunchManMovie(movie) {
  const text = normalizeEmbedTitle([
    movie && movie.ru,
    movie && movie.en,
    movie && movie.title,
    movie && movie.name,
    movie && movie.originalTitle,
    typeof titleOf === "function" && movie ? titleOf(movie) : "",
    document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
  ].filter(Boolean).join(" "));

  return text.includes("one punch man") || text.includes("ванпанчмен") || text.includes("wanpanman");
}

async function getOfficialEmbedsForMovieAsync(movie) {
  const forcedEmbeds = typeof getForcedEmbedsForMovie === "function" ? getForcedEmbedsForMovie(movie) : [];
  if (forcedEmbeds && forcedEmbeds.length) return forcedEmbeds;

  // Жёсткая защита для Ванпанчмена: если открыта карточка 3 сезона,
  // нельзя брать 1 сезон из внешнего API по общему названию "One Punch Man".
  const wantedSeason = detectWantedSeasonFromMovie(movie);

  if (isOnePunchManMovie(movie) && wantedSeason) {
    const seasonKeyMap = {
      1: "One-Punch Man Season 1",
      2: "One-Punch Man Season 2",
      3: "One-Punch Man Season 3"
    };

    const key = seasonKeyMap[wantedSeason];
    const strictEmbeds = (window.OFFICIAL_EMBEDS && window.OFFICIAL_EMBEDS[key]) || [];

    if (strictEmbeds.length) {
      return strictEmbeds.filter(x => Number(x.season || wantedSeason) === wantedSeason);
    }
  }

  // Сначала берём серии, которые вручную добавлены в app.js.
  const localEmbeds = getOfficialEmbedsForMovie(movie);

  if (localEmbeds.length) {
    return wantedSeason
      ? localEmbeds.filter(x => !x.season || Number(x.season) === wantedSeason)
      : localEmbeds;
  }

  const apiEmbeds = await fetchOfficialEmbedsFromWorker(movie);
  if (apiEmbeds.length) {
    return wantedSeason
      ? apiEmbeds.filter(x => !x.season || Number(x.season) === wantedSeason)
      : apiEmbeds;
  }

  return [];
}

function getOfficialEmbedsBoxTitle(embeds) {
  const hasEpisodes = embeds.some(x => x && (x.episode || x.season || /сезон|серия/i.test(String(x.name || ""))));
  return hasEpisodes ? "Серии / Плеер" : "Плеер";
}

async function addOfficialEmbedButtonsToDetails(movie) {
  injectOfficialEmbedStyles();

  document.querySelectorAll(".official-episodes-box").forEach(el => el.remove());

  const videoBlock = findVideoAndSearchBlock();
  if (!videoBlock) return;

  const episodesBox = document.createElement("div");
  episodesBox.className = "official-episodes-box";
  episodesBox.innerHTML = `
    <h3 class="official-episodes-title">Плеер</h3>
    <div class="official-episodes-loading">Ищу плеер...</div>
  `;
  videoBlock.appendChild(episodesBox);

  const embeds = await getOfficialEmbedsForMovieAsync(movie);

  if (selectedMovie && movie && String(selectedMovie.id) !== String(movie.id)) {
    episodesBox.remove();
    return;
  }

  if (!embeds.length) {
    episodesBox.remove();
    console.warn("Rutube: для карточки не найдены серии", getMovieTitleCandidates(movie));
    return;
  }

  episodesBox.innerHTML = "";

  const title = document.createElement("h3");
  title.className = "official-episodes-title";
  title.textContent = getOfficialEmbedsBoxTitle(embeds);

  const grid = document.createElement("div");
  grid.className = "official-episodes-grid";

  embeds.forEach((embed) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "official-embed-btn";
    btn.textContent = String(embed.name || "Смотреть")
      .replace(/^Rutube\s*—\s*/i, "")
      .replace(/^Рутуб\s*—\s*/i, "");

    btn.addEventListener("click", () => {
      closeDetailsBeforePlayer();
      openOfficialEmbedPlayer(embed);
    });

    grid.appendChild(btn);
  });

  episodesBox.appendChild(title);
  episodesBox.appendChild(grid);
}


/* ===== ВАНПАНЧМЕН — 1 СЕЗОН ===== */

addRutubeSeasonFromText({
  titles: [
    "Ванпанчмен 1 сезон",
    "Ванпанчмен 1",
    "One Punch Man Season 1",
    "One-Punch Man Season 1",
    "One Punch Man 1",
    "One-Punch Man 1",
    "Wanpanman 1"
  ],
  season: 1,
  text: `
https://rutube.ru/play/embed/d6b0a760d96b6ac2d6bed2193e95f5e0/
https://rutube.ru/play/embed/8c395fcf43a371d4f1338f5a51a5f46f/
https://rutube.ru/play/embed/7b030425b69390b80170fd4e52e9ac1b/
https://rutube.ru/play/embed/045b1d3f176b8db48ce8a5fd3c57c8b6/
https://rutube.ru/play/embed/40ccd7778428998005221a70057c6d0b/
https://rutube.ru/play/embed/563d1ee3e68b3993f933eed1d9158cef/
https://rutube.ru/play/embed/f14286dccb2c4a6598768803331d8112/
https://rutube.ru/play/embed/725962e3357a8aed00378d8f3f8182ee/
https://rutube.ru/play/embed/45564aad021444f37f4883e517b96fcb/
https://rutube.ru/play/embed/562b3d68af589ea5bc1cb56a43e98c14/
https://rutube.ru/play/embed/94070cec15f39b7f9f3a8db0243a19db/
https://rutube.ru/play/embed/40307b2e324ddb314cde0333b1eeab8d/
  `
});

/* ===== ВАНПАНЧМЕН — 2 СЕЗОН ===== */

addRutubeSeasonFromText({
  titles: [
    "Ванпанчмен 2 сезон",
    "Ванпанчмен 2",
    "One-Punch Man Season 2",
    "One Punch Man Season 2",
    "One Punch Man 2nd Season",
    "One-Punch Man 2nd Season",
    "One Punch Man 2",
    "One-Punch Man 2",
    "Wanpanman 2"
  
  ],
  season: 2,
  text: `
https://rutube.ru/video/356fa10c37e612bdecc66231ac8b6498/?playlist=349758
https://rutube.ru/video/bfb824cc997a4fe83f9cddbd387c8c4d/?playlist=349758
https://rutube.ru/video/3c60c6485c81e9b0298645e804693995/?playlist=349758
https://rutube.ru/video/2d10e011fd785e2738233b50b1438fb1/?playlist=349758
https://rutube.ru/video/8e0f6733d56967506917476abcc5e61d/?playlist=349758
https://rutube.ru/video/7ca15b521c53aa484f1edfd5734dcc92/?playlist=349758
https://rutube.ru/video/05ddc67f6abad10539de0f203d8d421f/?playlist=349758
https://rutube.ru/video/c45ae818dda7caa276a86adb91ad85bc/?playlist=349758
https://rutube.ru/video/7ea3e33b1cc749e25d6d280eff6e0e4a/?playlist=349758
https://rutube.ru/video/5f5ece953b9cfe1c69cf2ede933be862/?playlist=349758
https://rutube.ru/video/a9d0753888e19fd7955c6436f2d033f1/?playlist=349758
https://rutube.ru/video/714734c6c2bd1bf445febc0d88decaec/?playlist=349758
  `
});


/* ===== ВАНПАНЧМЕН — 3 СЕЗОН ===== */

addRutubeSeasonExactList({
  titles: [
    "Ванпанчмен 3 сезон",
    "Ванпанчмен 3",
    "One-Punch Man Season 3",
    "One Punch Man Season 3",
    "One Punch Man 3rd Season",
    "One-Punch Man 3rd Season",
    "One Punch Man 3",
    "One-Punch Man 3",
    "Wanpanman 3"
  ],
  season: 3,
  episodes: [
    {
      name: "Rutube — 3 сезон 1 серия",
      season: 3,
      episode: 1,
      src: "https://rutube.ru/play/embed/4e9a5746b7c99a0b4a9ee668a24cae24",
      url: "https://rutube.ru/video/4e9a5746b7c99a0b4a9ee668a24cae24/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 2 серия",
      season: 3,
      episode: 2,
      src: "https://rutube.ru/play/embed/831e2003f962c3ed01597533dc21e0f7",
      url: "https://rutube.ru/video/831e2003f962c3ed01597533dc21e0f7/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 3 серия",
      season: 3,
      episode: 3,
      src: "https://rutube.ru/play/embed/be73e3f823178fa53b41d47665d63cba",
      url: "https://rutube.ru/video/be73e3f823178fa53b41d47665d63cba/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 4 серия",
      season: 3,
      episode: 4,
      src: "https://rutube.ru/play/embed/129be222a0fd669a8db146ead5abba4b",
      url: "https://rutube.ru/video/129be222a0fd669a8db146ead5abba4b/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 5 серия",
      season: 3,
      episode: 5,
      src: "https://rutube.ru/play/embed/a72b8bcb654b6f1f6fdc1ea159057df4",
      url: "https://rutube.ru/video/a72b8bcb654b6f1f6fdc1ea159057df4/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 7 серия",
      season: 3,
      episode: 7,
      src: "https://rutube.ru/play/embed/1e36649bfef46d8b846a9d455506f7fe",
      url: "https://rutube.ru/video/1e36649bfef46d8b846a9d455506f7fe/?playlist=1324026"
    },
    {
      name: "Rutube — 3 сезон 0 серия",
      season: 3,
      episode: 0,
      src: "https://rutube.ru/play/embed/76aec24b54c469f135629f0a0f436380",
      url: "https://rutube.ru/video/76aec24b54c469f135629f0a0f436380/?playlist=1324026"
    }
  ]
});



/* ===== НАРУТО — 1 СЕЗОН ===== */

addRutubeSeasonExactList({
  titles: [
    "Наруто",
    "Наруто 1 сезон",
    "Наруто, Сезон 1",
    "Naruto",
    "Naruto Season 1"
  ],
  season: 1,
  episodes: [
    {
      name: "Наруто — 1 сезон",
      season: 1,
      episode: 1,
      src: "https://play.hideogenius.com/?token_movie=f174d1e9bc42d32d073a2914fd1334&token=dd04704e1a13e780de505738b5ed20&season=1",
      url: "https://play.hideogenius.com/?token_movie=f174d1e9bc42d32d073a2914fd1334&token=dd04704e1a13e780de505738b5ed20&season=1"
    }
  ]
});

/* ===== НАРУТО: УРАГАННЫЕ ХРОНИКИ — 2 СЕЗОН ===== */

addRutubeSeasonExactList({
  titles: [
    "Наруто: Ураганные хроники",
    "Наруто Ураганные хроники",
    "Наруто: Ураганные хроники 2 сезон",
    "Наруто Ураганные хроники 2 сезон",
    "Наруто: Ураганные хроники, Сезон 2 (2007)",
    "Наруто: Ураганные хроники Сезон 2",
    "Naruto: Shippuden",
    "Naruto Shippuden",
    "Naruto: Shippuuden",
    "Naruto Shippuuden",
    "Naruto Shippuden Season 2",
    "Naruto: Shippuden Season 2",
    "Naruto Shippuuden Season 2"
  ],
  season: 2,
  episodes: [
    {
      name: "Наруто: Ураганные хроники — 2 сезон",
      season: 2,
      episode: 1,
      src: "https://play.hideogenius.com/?token_movie=f174d1e9bc42d32d073a2914fd1334&token=dd04704e1a13e780de505738b5ed20&season=2",
      url: "https://play.hideogenius.com/?token_movie=f174d1e9bc42d32d073a2914fd1334&token=dd04704e1a13e780de505738b5ed20&season=2"
    }
  ]
});

/* ===== СТАЛЬНОЙ АЛХИМИК: БРАТСТВО ===== */

addRutubeSeasonExactList({
  titles: [
    "Стальной алхимик: Братство",
    "Стальной алхимик Братство",
    "Fullmetal Alchemist: Brotherhood",
    "Fullmetal Alchemist Brotherhood",
    "Hagane no Renkinjutsushi: Fullmetal Alchemist",
    "FMA Brotherhood"
  ],
  season: 1,
  episodes: [
    {
      name: "Стальной алхимик: Братство — смотреть",
      season: 1,
      episode: 1,
      src: "https://polynoy-as.newplayjj.com:9443/?kp=452838&token=e9a962df5e96874972bd776d247fa6",
      url: "https://polynoy-as.newplayjj.com:9443/?kp=452838&token=e9a962df5e96874972bd776d247fa6",
      source: "iframe"
    }
  ]
});


/* ===== ВАН-ПИС / ONE PIECE — 1 СЕЗОН ===== */

addRutubeSeasonExactList({
  titles: [
    "Ван-Пис",
    "Ван Пис",
    "One Piece",
    "ONE PIECE",
    "OnePiece",
    "Большой куш"
  ],
  season: 1,
  episodes: [
    {
      name: "Ван-Пис — смотреть",
      season: 1,
      episode: 1,
      src: "https://kodikplayer.com/serial/4277/b1108a88309da7c36fe632b47937eb3c/720p",
      url: "https://kodikplayer.com/serial/4277/b1108a88309da7c36fe632b47937eb3c/720p",
      source: "iframe"
    }
  ]
});


/* ===== МОРТАЛ КОМБАТ 2 (2026) ===== */

addRutubeVideoFromText({
  titles: [
    "Мортал Комбат 2",
    "Мортал Комбат 2 (2026)",
    "Мортал Комбат II",
    "Мортал Комбат II (2026)",
    "Mortal Kombat II",
    "Mortal Kombat II 2026",
    "Mortal Kombat 2",
    "Mortal Kombat 2 2026"
  ],
  name: "Rutube — смотреть",
  text: `
https://rutube.ru/video/4cc2b1eb0945443150f622c3419edf66/
  `
});

if (typeof openDetails === "function" && !window.__officialEmbedOpenDetailsPatched) {
  window.__officialEmbedOpenDetailsPatched = true;
  const originalOpenDetails = openDetails;

  openDetails = function patchedOpenDetails(movie) {
    originalOpenDetails(movie);

    setTimeout(() => {
      if (!selectedMovie || String(selectedMovie.id) !== String(movie.id)) return;
      addOfficialEmbedButtonsToDetails(movie);
    }, 180);
  };
}

setupEvents();
loadData().catch(showError);

/* ===== ТВОЁ ИМЯ / YOUR NAME ===== */

addRutubeSeasonExactList({
  titles: [
    "Твоё имя",
    "Твое имя",
    "Your Name",
    "Your Name.",
    "Kimi no Na wa",
    "Kimi no Na wa.",
    "君の名は"
  ],
  season: 1,
  episodes: [
    {
        "name": "Твоё имя — смотреть",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/779300d33a00c2cdce1c7a7d07c4206b",
        "url": "https://rutube.ru/video/779300d33a00c2cdce1c7a7d07c4206b/",
        "source": "rutube"
    }
]
});


/* ===== МОЯ ГЕРОЙСКАЯ АКАДЕМИЯ / MY HERO ACADEMIA ===== */

addRutubeSeasonExactList({
  titles: [
    "Моя геройская академия",
    "My Hero Academia",
    "Boku no Hero Academia",
    "Boku no Hīrō Akademia",
    "僕のヒーローアカデミア"
  ],
  season: 1,
  episodes: [
    {
        "name": "Моя геройская академия — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/d87472b06db060da2c9a3721420e97d0",
        "url": "https://rutube.ru/video/d87472b06db060da2c9a3721420e97d0/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/0385df001f450bf36693a2585d12f280",
        "url": "https://rutube.ru/video/0385df001f450bf36693a2585d12f280/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/445407e39c739e288156df8214a8a806",
        "url": "https://rutube.ru/video/445407e39c739e288156df8214a8a806/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/e4dad21cc8b16a616583dbf98a7b8dec",
        "url": "https://rutube.ru/video/e4dad21cc8b16a616583dbf98a7b8dec/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/5e07b9cf7789f2f095a114183c685e8c",
        "url": "https://rutube.ru/video/5e07b9cf7789f2f095a114183c685e8c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/9d12f96ceec35ed84717658813cea42c",
        "url": "https://rutube.ru/video/9d12f96ceec35ed84717658813cea42c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/a615a42ccaeefab909886cbffbb45309",
        "url": "https://rutube.ru/video/a615a42ccaeefab909886cbffbb45309/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/337d600d13f2603f169b2bbe94195082",
        "url": "https://rutube.ru/video/337d600d13f2603f169b2bbe94195082/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/5c28b231fe1639dadad1f34931d5d9bf",
        "url": "https://rutube.ru/video/5c28b231fe1639dadad1f34931d5d9bf/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/b83679b3514faa2f14b0768d58fd0304",
        "url": "https://rutube.ru/video/b83679b3514faa2f14b0768d58fd0304/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/c3a051d0bdf670a8595e2af41a1a1a5f",
        "url": "https://rutube.ru/video/c3a051d0bdf670a8595e2af41a1a1a5f/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/eb89689fb0b8850cb57456f2905a428e",
        "url": "https://rutube.ru/video/eb89689fb0b8850cb57456f2905a428e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/c4d2a0b9a6d3f9caaed3787a4bacbfdc",
        "url": "https://rutube.ru/video/c4d2a0b9a6d3f9caaed3787a4bacbfdc/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/601f9a82fe16c9c1ed34df232c4f59c2",
        "url": "https://rutube.ru/video/601f9a82fe16c9c1ed34df232c4f59c2/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/bdcf0e244418f169699d7577ed3361d7",
        "url": "https://rutube.ru/video/bdcf0e244418f169699d7577ed3361d7/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/14d779298ea251ecdad6f1d68f4d8963",
        "url": "https://rutube.ru/video/14d779298ea251ecdad6f1d68f4d8963/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/d35bb8f4e3b31fcb27ba010495c2e652",
        "url": "https://rutube.ru/video/d35bb8f4e3b31fcb27ba010495c2e652/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/7867bb2df1e2e8ffe39d01b8d46b5a25",
        "url": "https://rutube.ru/video/7867bb2df1e2e8ffe39d01b8d46b5a25/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/37181a7c3632dbcbda327f649b38685c",
        "url": "https://rutube.ru/video/37181a7c3632dbcbda327f649b38685c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/8bcc94e63eb01e85c8a8c9f691e78249",
        "url": "https://rutube.ru/video/8bcc94e63eb01e85c8a8c9f691e78249/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/47c2fc393fe05169ba0f54bdfe5d6d2e",
        "url": "https://rutube.ru/video/47c2fc393fe05169ba0f54bdfe5d6d2e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/baf1be0576af2307d64d33ceef190cbd",
        "url": "https://rutube.ru/video/baf1be0576af2307d64d33ceef190cbd/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/af6968e916ca90a00b82e358b38f75c5",
        "url": "https://rutube.ru/video/af6968e916ca90a00b82e358b38f75c5/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/b0c2542204b90e5a39dfb305b81f5292",
        "url": "https://rutube.ru/video/b0c2542204b90e5a39dfb305b81f5292/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/f1037d2a45234810f8e9a28eb968d6a9",
        "url": "https://rutube.ru/video/f1037d2a45234810f8e9a28eb968d6a9/",
        "source": "rutube"
    }
]
});

/* ===== МАСТЕРА МЕЧА ОНЛАЙН / SWORD ART ONLINE ===== */

addRutubeSeasonExactList({
  titles: [
    "Мастера меча онлайн",
    "Мастер меча онлайн",
    "Sword Art Online",
    "SAO",
    "S.A.O.",
    "ソードアート・オンライン"
  ],
  season: 1,
  episodes: [
    {
        "name": "Мастера меча онлайн — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/cc395a0135d14b100d5a87b431d6f8a1",
        "url": "https://rutube.ru/video/cc395a0135d14b100d5a87b431d6f8a1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/1523d746b5bf81ade41c37c26cf707f1",
        "url": "https://rutube.ru/video/1523d746b5bf81ade41c37c26cf707f1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/d60c9b674367da045d663e600c003fc1",
        "url": "https://rutube.ru/video/d60c9b674367da045d663e600c003fc1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/9e6904e419d6778728bc2b2ae94a6c67",
        "url": "https://rutube.ru/video/9e6904e419d6778728bc2b2ae94a6c67/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/4a23d50875d8b9e16472d220c8e3db6a",
        "url": "https://rutube.ru/video/4a23d50875d8b9e16472d220c8e3db6a/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/b794cf4d175b9ef3258008a201caa9a5",
        "url": "https://rutube.ru/video/b794cf4d175b9ef3258008a201caa9a5/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/4615d84c49dfee0f569fe39a72fe787e",
        "url": "https://rutube.ru/video/4615d84c49dfee0f569fe39a72fe787e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/ddd66472657b0b4f9bae3738313f8ace",
        "url": "https://rutube.ru/video/ddd66472657b0b4f9bae3738313f8ace/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/2373e497a102d27466709dc67fdca177",
        "url": "https://rutube.ru/video/2373e497a102d27466709dc67fdca177/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/7b420e6651028b82e07df18b764eac2d",
        "url": "https://rutube.ru/video/7b420e6651028b82e07df18b764eac2d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/0644a97e1d550d77ef065cb8e86cab92",
        "url": "https://rutube.ru/video/0644a97e1d550d77ef065cb8e86cab92/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/09e783dd41c8a690e057e48337e8f6d4",
        "url": "https://rutube.ru/video/09e783dd41c8a690e057e48337e8f6d4/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/1c629b2e70df8956a6473dbe107b73e1",
        "url": "https://rutube.ru/video/1c629b2e70df8956a6473dbe107b73e1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/ddc1fc0d6debe9f958d9f21dfe5d156f",
        "url": "https://rutube.ru/video/ddc1fc0d6debe9f958d9f21dfe5d156f/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/c34e09790e95dc38b36599fe5fa67fed",
        "url": "https://rutube.ru/video/c34e09790e95dc38b36599fe5fa67fed/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/ba79314ad8e5960a5b79a79b18470b1e",
        "url": "https://rutube.ru/video/ba79314ad8e5960a5b79a79b18470b1e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/092f5f531757e30942638ba2f31b1c07",
        "url": "https://rutube.ru/video/092f5f531757e30942638ba2f31b1c07/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/2fced8938c3778bd936487bfff3faefb",
        "url": "https://rutube.ru/video/2fced8938c3778bd936487bfff3faefb/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/0a02dab2631dbb5ebd07a0a26a48fa1d",
        "url": "https://rutube.ru/video/0a02dab2631dbb5ebd07a0a26a48fa1d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/baf81a9fb8da91f7bb008b56966aeccf",
        "url": "https://rutube.ru/video/baf81a9fb8da91f7bb008b56966aeccf/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/924d4415780283484e47300cc156a03d",
        "url": "https://rutube.ru/video/924d4415780283484e47300cc156a03d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/87f303df23d90a19f1350df88819b5c9",
        "url": "https://rutube.ru/video/87f303df23d90a19f1350df88819b5c9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/2c687f8a4742318bf5cb824af44912e9",
        "url": "https://rutube.ru/video/2c687f8a4742318bf5cb824af44912e9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/388f3ddb30bbed6b6573c4cc182f9c35",
        "url": "https://rutube.ru/video/388f3ddb30bbed6b6573c4cc182f9c35/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/0e386965c1aeda99933939626c6064de",
        "url": "https://rutube.ru/video/0e386965c1aeda99933939626c6064de/",
        "source": "rutube"
    }
]
});


/* ===== FORCE FIX: SWORD ART ONLINE / МАСТЕРА МЕЧА ОНЛАЙН ===== */
(function () {
  const saoEpisodes = [
    {
        "name": "Мастера меча онлайн — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/cc395a0135d14b100d5a87b431d6f8a1",
        "url": "https://rutube.ru/video/cc395a0135d14b100d5a87b431d6f8a1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/1523d746b5bf81ade41c37c26cf707f1",
        "url": "https://rutube.ru/video/1523d746b5bf81ade41c37c26cf707f1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/d60c9b674367da045d663e600c003fc1",
        "url": "https://rutube.ru/video/d60c9b674367da045d663e600c003fc1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/9e6904e419d6778728bc2b2ae94a6c67",
        "url": "https://rutube.ru/video/9e6904e419d6778728bc2b2ae94a6c67/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/4a23d50875d8b9e16472d220c8e3db6a",
        "url": "https://rutube.ru/video/4a23d50875d8b9e16472d220c8e3db6a/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/b794cf4d175b9ef3258008a201caa9a5",
        "url": "https://rutube.ru/video/b794cf4d175b9ef3258008a201caa9a5/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/4615d84c49dfee0f569fe39a72fe787e",
        "url": "https://rutube.ru/video/4615d84c49dfee0f569fe39a72fe787e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/ddd66472657b0b4f9bae3738313f8ace",
        "url": "https://rutube.ru/video/ddd66472657b0b4f9bae3738313f8ace/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/2373e497a102d27466709dc67fdca177",
        "url": "https://rutube.ru/video/2373e497a102d27466709dc67fdca177/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/7b420e6651028b82e07df18b764eac2d",
        "url": "https://rutube.ru/video/7b420e6651028b82e07df18b764eac2d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/0644a97e1d550d77ef065cb8e86cab92",
        "url": "https://rutube.ru/video/0644a97e1d550d77ef065cb8e86cab92/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/09e783dd41c8a690e057e48337e8f6d4",
        "url": "https://rutube.ru/video/09e783dd41c8a690e057e48337e8f6d4/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/1c629b2e70df8956a6473dbe107b73e1",
        "url": "https://rutube.ru/video/1c629b2e70df8956a6473dbe107b73e1/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/ddc1fc0d6debe9f958d9f21dfe5d156f",
        "url": "https://rutube.ru/video/ddc1fc0d6debe9f958d9f21dfe5d156f/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/c34e09790e95dc38b36599fe5fa67fed",
        "url": "https://rutube.ru/video/c34e09790e95dc38b36599fe5fa67fed/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/ba79314ad8e5960a5b79a79b18470b1e",
        "url": "https://rutube.ru/video/ba79314ad8e5960a5b79a79b18470b1e/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/092f5f531757e30942638ba2f31b1c07",
        "url": "https://rutube.ru/video/092f5f531757e30942638ba2f31b1c07/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/2fced8938c3778bd936487bfff3faefb",
        "url": "https://rutube.ru/video/2fced8938c3778bd936487bfff3faefb/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/0a02dab2631dbb5ebd07a0a26a48fa1d",
        "url": "https://rutube.ru/video/0a02dab2631dbb5ebd07a0a26a48fa1d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/baf81a9fb8da91f7bb008b56966aeccf",
        "url": "https://rutube.ru/video/baf81a9fb8da91f7bb008b56966aeccf/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/924d4415780283484e47300cc156a03d",
        "url": "https://rutube.ru/video/924d4415780283484e47300cc156a03d/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/87f303df23d90a19f1350df88819b5c9",
        "url": "https://rutube.ru/video/87f303df23d90a19f1350df88819b5c9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/2c687f8a4742318bf5cb824af44912e9",
        "url": "https://rutube.ru/video/2c687f8a4742318bf5cb824af44912e9/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/388f3ddb30bbed6b6573c4cc182f9c35",
        "url": "https://rutube.ru/video/388f3ddb30bbed6b6573c4cc182f9c35/",
        "source": "rutube"
    },
    {
        "name": "Мастера меча онлайн — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/0e386965c1aeda99933939626c6064de",
        "url": "https://rutube.ru/video/0e386965c1aeda99933939626c6064de/",
        "source": "rutube"
    }
];

  const keys = [
    "Мастера меча онлайн",
    "Мастер меча онлайн",
    "Sword Art Online",
    "SAO",
    "S.A.O.",
    "ソードアート・オンライン"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = saoEpisodes;
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = saoEpisodes;
    }
  });

  function isSaoRaw(raw) {
    const s = String(raw || "").toLowerCase();
    return s.includes("sword art online") ||
           s.includes("мастера меча онлайн") ||
           s.includes("мастер меча онлайн") ||
           s === "sao" ||
           s.includes("ソードアート");
  }

  try {
    const oldSync = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
    getOfficialEmbedsForMovie = function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isSaoRaw(raw)) return saoEpisodes;
      return oldSync ? oldSync(movie) : [];
    };
  } catch (e) {}

  try {
    const oldAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
    getOfficialEmbedsForMovieAsync = async function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isSaoRaw(raw)) return saoEpisodes;
      return oldAsync ? oldAsync(movie) : [];
    };
  } catch (e) {}
})();


/* ===== FORCE FIX: ONE PIECE / ВАН-ПИС KODIK SERIAL ===== */
(function () {
  const onePiecePlayer = {
    name: "Ван-Пис — смотреть",
    season: 1,
    episode: 1,
    src: "https://kodikplayer.com/serial/4277/b1108a88309da7c36fe632b47937eb3c/720p",
    url: "https://kodikplayer.com/serial/4277/b1108a88309da7c36fe632b47937eb3c/720p",
    source: "iframe"
  };

  const keys = [
    "One Piece",
    "ONE PIECE",
    "one piece",
    "OnePiece",
    "onepiece",
    "Ван-Пис",
    "Ван Пис",
    "ван-пис",
    "ван пис",
    "Большой куш"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = [onePiecePlayer];
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = [onePiecePlayer];
    }
  });

  const oldGetOfficialEmbedsForMovie = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
  window.getOfficialEmbedsForMovie = function(movie) {
    const raw = [
      movie && movie.ru,
      movie && movie.en,
      movie && movie.title,
      movie && movie.name,
      movie && movie.originalTitle,
      document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
    ].filter(Boolean).join(" ").toLowerCase();

    if (raw.includes("one piece") || raw.includes("onepiece") || raw.includes("ван-пис") || raw.includes("ван пис")) {
      return [onePiecePlayer];
    }

    return oldGetOfficialEmbedsForMovie ? oldGetOfficialEmbedsForMovie(movie) : [];
  };

  const oldGetOfficialEmbedsForMovieAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
  window.getOfficialEmbedsForMovieAsync = async function(movie) {
    const raw = [
      movie && movie.ru,
      movie && movie.en,
      movie && movie.title,
      movie && movie.name,
      movie && movie.originalTitle,
      document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
    ].filter(Boolean).join(" ").toLowerCase();

    if (raw.includes("one piece") || raw.includes("onepiece") || raw.includes("ван-пис") || raw.includes("ван пис")) {
      return [onePiecePlayer];
    }

    return oldGetOfficialEmbedsForMovieAsync ? oldGetOfficialEmbedsForMovieAsync(movie) : [];
  };
})();

/* ===== FIX: ПОХОЖИЕ КАРТОЧКИ НЕ ЗАКРЫВАЮТСЯ ===== */
(function () {
  if (window.__similarCardsClickFix) return;
  window.__similarCardsClickFix = true;

  if (typeof renderSimilarItems !== "function") return;

  renderSimilarItems = function fixedRenderSimilarItems(m) {
    injectSimilarStyle();

    const block = ensureSimilarBlock();
    if (!block) return;

    const grid = document.getElementById("similarGrid");
    if (!grid) return;

    const similar = findSimilarItems(m, 10);

    if (!similar.length) {
      block.style.display = "block";
      grid.innerHTML = `<div class="similar-empty">Похожих пока не нашёл.</div>`;
      return;
    }

    block.style.display = "block";
    grid.innerHTML = similar.map(cardHtml).join("");

    grid.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const favBtn = e.target.closest(".card-fav-btn");
        if (favBtn) {
          const id = favBtn.getAttribute("data-fav-id");
          toggleCardFavorite(id, favBtn);
          return;
        }

        const id = card.getAttribute("data-id");
        const movie = allMovies.find(x => String(x.id) === String(id));
        if (!movie) return;

        const dialog = document.getElementById("detailsDialog");

        openDetails(movie);

        if (dialog) {
          if (!dialog.open) dialog.showModal();
          setTimeout(() => {
            try {
              dialog.scrollTop = 0;
              const body = dialog.querySelector(".detail-body, .details-body, .modal-body, .dialog-body");
              if (body) body.scrollTop = 0;
            } catch (err) {}
          }, 30);
        }
      });
    });
  };
})();

/* ===== FORCE FIX: MY HERO ACADEMIA / МОЯ ГЕРОЙСКАЯ АКАДЕМИЯ ===== */
(function () {
  const mhaEpisodes = [
    {
        "name": "Моя геройская академия — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/d87472b06db060da2c9a3721420e97d0",
        "url": "https://rutube.ru/video/d87472b06db060da2c9a3721420e97d0/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/0385df001f450bf36693a2585d12f280",
        "url": "https://rutube.ru/video/0385df001f450bf36693a2585d12f280/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/445407e39c739e288156df8214a8a806",
        "url": "https://rutube.ru/video/445407e39c739e288156df8214a8a806/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/e4dad21cc8b16a616583dbf98a7b8dec",
        "url": "https://rutube.ru/video/e4dad21cc8b16a616583dbf98a7b8dec/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/5e07b9cf7789f2f095a114183c685e8c",
        "url": "https://rutube.ru/video/5e07b9cf7789f2f095a114183c685e8c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/9d12f96ceec35ed84717658813cea42c",
        "url": "https://rutube.ru/video/9d12f96ceec35ed84717658813cea42c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/a615a42ccaeefab909886cbffbb45309",
        "url": "https://rutube.ru/video/a615a42ccaeefab909886cbffbb45309/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/337d600d13f2603f169b2bbe94195082",
        "url": "https://rutube.ru/video/337d600d13f2603f169b2bbe94195082/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/5c28b231fe1639dadad1f34931d5d9bf",
        "url": "https://rutube.ru/video/5c28b231fe1639dadad1f34931d5d9bf/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/b83679b3514faa2f14b0768d58fd0304",
        "url": "https://rutube.ru/video/b83679b3514faa2f14b0768d58fd0304/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/c3a051d0bdf670a8595e2af41a1a1a5f",
        "url": "https://rutube.ru/video/c3a051d0bdf670a8595e2af41a1a1a5f/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/eb89689fb0b8850cb57456f2905a428e",
        "url": "https://rutube.ru/video/eb89689fb0b8850cb57456f2905a428e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/c4d2a0b9a6d3f9caaed3787a4bacbfdc",
        "url": "https://rutube.ru/video/c4d2a0b9a6d3f9caaed3787a4bacbfdc/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/601f9a82fe16c9c1ed34df232c4f59c2",
        "url": "https://rutube.ru/video/601f9a82fe16c9c1ed34df232c4f59c2/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/bdcf0e244418f169699d7577ed3361d7",
        "url": "https://rutube.ru/video/bdcf0e244418f169699d7577ed3361d7/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/14d779298ea251ecdad6f1d68f4d8963",
        "url": "https://rutube.ru/video/14d779298ea251ecdad6f1d68f4d8963/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/d35bb8f4e3b31fcb27ba010495c2e652",
        "url": "https://rutube.ru/video/d35bb8f4e3b31fcb27ba010495c2e652/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/7867bb2df1e2e8ffe39d01b8d46b5a25",
        "url": "https://rutube.ru/video/7867bb2df1e2e8ffe39d01b8d46b5a25/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/37181a7c3632dbcbda327f649b38685c",
        "url": "https://rutube.ru/video/37181a7c3632dbcbda327f649b38685c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/8bcc94e63eb01e85c8a8c9f691e78249",
        "url": "https://rutube.ru/video/8bcc94e63eb01e85c8a8c9f691e78249/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/47c2fc393fe05169ba0f54bdfe5d6d2e",
        "url": "https://rutube.ru/video/47c2fc393fe05169ba0f54bdfe5d6d2e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/baf1be0576af2307d64d33ceef190cbd",
        "url": "https://rutube.ru/video/baf1be0576af2307d64d33ceef190cbd/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/af6968e916ca90a00b82e358b38f75c5",
        "url": "https://rutube.ru/video/af6968e916ca90a00b82e358b38f75c5/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/b0c2542204b90e5a39dfb305b81f5292",
        "url": "https://rutube.ru/video/b0c2542204b90e5a39dfb305b81f5292/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/f1037d2a45234810f8e9a28eb968d6a9",
        "url": "https://rutube.ru/video/f1037d2a45234810f8e9a28eb968d6a9/",
        "source": "rutube"
    }
];

  const keys = [
    "Моя геройская академия",
    "My Hero Academia",
    "Boku no Hero Academia",
    "Boku no Hīrō Akademia",
    "Boku no Hero",
    "僕のヒーローアカデミア"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = mhaEpisodes;
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = mhaEpisodes;
    }
  });

  const isMhaRaw = function(raw) {
    const s = String(raw || "").toLowerCase();
    return s.includes("my hero academia") ||
           s.includes("boku no hero academia") ||
           s.includes("boku no hīrō akademia") ||
           s.includes("моя геройская академия") ||
           s.includes("геройская академия");
  };

  const oldGetOfficialEmbedsForMovie = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
  window.getOfficialEmbedsForMovie = function(movie) {
    const raw = [
      movie && movie.ru,
      movie && movie.en,
      movie && movie.title,
      movie && movie.name,
      movie && movie.originalTitle,
      document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
    ].filter(Boolean).join(" ");

    if (isMhaRaw(raw)) return mhaEpisodes;

    return oldGetOfficialEmbedsForMovie ? oldGetOfficialEmbedsForMovie(movie) : [];
  };

  const oldGetOfficialEmbedsForMovieAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
  window.getOfficialEmbedsForMovieAsync = async function(movie) {
    const raw = [
      movie && movie.ru,
      movie && movie.en,
      movie && movie.title,
      movie && movie.name,
      movie && movie.originalTitle,
      document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
    ].filter(Boolean).join(" ");

    if (isMhaRaw(raw)) return mhaEpisodes;

    return oldGetOfficialEmbedsForMovieAsync ? oldGetOfficialEmbedsForMovieAsync(movie) : [];
  };
})();

/* ===== FORCE FIX V2: MY HERO ACADEMIA DIRECT OVERRIDE ===== */
(function () {
  const mhaEpisodesV2 = [
    {
        "name": "Моя геройская академия — 1 серия",
        "season": 1,
        "episode": 1,
        "src": "https://rutube.ru/play/embed/d87472b06db060da2c9a3721420e97d0",
        "url": "https://rutube.ru/video/d87472b06db060da2c9a3721420e97d0/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 2 серия",
        "season": 1,
        "episode": 2,
        "src": "https://rutube.ru/play/embed/0385df001f450bf36693a2585d12f280",
        "url": "https://rutube.ru/video/0385df001f450bf36693a2585d12f280/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 3 серия",
        "season": 1,
        "episode": 3,
        "src": "https://rutube.ru/play/embed/445407e39c739e288156df8214a8a806",
        "url": "https://rutube.ru/video/445407e39c739e288156df8214a8a806/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 4 серия",
        "season": 1,
        "episode": 4,
        "src": "https://rutube.ru/play/embed/e4dad21cc8b16a616583dbf98a7b8dec",
        "url": "https://rutube.ru/video/e4dad21cc8b16a616583dbf98a7b8dec/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 5 серия",
        "season": 1,
        "episode": 5,
        "src": "https://rutube.ru/play/embed/5e07b9cf7789f2f095a114183c685e8c",
        "url": "https://rutube.ru/video/5e07b9cf7789f2f095a114183c685e8c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 6 серия",
        "season": 1,
        "episode": 6,
        "src": "https://rutube.ru/play/embed/9d12f96ceec35ed84717658813cea42c",
        "url": "https://rutube.ru/video/9d12f96ceec35ed84717658813cea42c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 7 серия",
        "season": 1,
        "episode": 7,
        "src": "https://rutube.ru/play/embed/a615a42ccaeefab909886cbffbb45309",
        "url": "https://rutube.ru/video/a615a42ccaeefab909886cbffbb45309/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 8 серия",
        "season": 1,
        "episode": 8,
        "src": "https://rutube.ru/play/embed/337d600d13f2603f169b2bbe94195082",
        "url": "https://rutube.ru/video/337d600d13f2603f169b2bbe94195082/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 9 серия",
        "season": 1,
        "episode": 9,
        "src": "https://rutube.ru/play/embed/5c28b231fe1639dadad1f34931d5d9bf",
        "url": "https://rutube.ru/video/5c28b231fe1639dadad1f34931d5d9bf/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 10 серия",
        "season": 1,
        "episode": 10,
        "src": "https://rutube.ru/play/embed/b83679b3514faa2f14b0768d58fd0304",
        "url": "https://rutube.ru/video/b83679b3514faa2f14b0768d58fd0304/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 11 серия",
        "season": 1,
        "episode": 11,
        "src": "https://rutube.ru/play/embed/c3a051d0bdf670a8595e2af41a1a1a5f",
        "url": "https://rutube.ru/video/c3a051d0bdf670a8595e2af41a1a1a5f/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 12 серия",
        "season": 1,
        "episode": 12,
        "src": "https://rutube.ru/play/embed/eb89689fb0b8850cb57456f2905a428e",
        "url": "https://rutube.ru/video/eb89689fb0b8850cb57456f2905a428e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 13 серия",
        "season": 1,
        "episode": 13,
        "src": "https://rutube.ru/play/embed/c4d2a0b9a6d3f9caaed3787a4bacbfdc",
        "url": "https://rutube.ru/video/c4d2a0b9a6d3f9caaed3787a4bacbfdc/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 14 серия",
        "season": 1,
        "episode": 14,
        "src": "https://rutube.ru/play/embed/601f9a82fe16c9c1ed34df232c4f59c2",
        "url": "https://rutube.ru/video/601f9a82fe16c9c1ed34df232c4f59c2/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 15 серия",
        "season": 1,
        "episode": 15,
        "src": "https://rutube.ru/play/embed/bdcf0e244418f169699d7577ed3361d7",
        "url": "https://rutube.ru/video/bdcf0e244418f169699d7577ed3361d7/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 16 серия",
        "season": 1,
        "episode": 16,
        "src": "https://rutube.ru/play/embed/14d779298ea251ecdad6f1d68f4d8963",
        "url": "https://rutube.ru/video/14d779298ea251ecdad6f1d68f4d8963/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 17 серия",
        "season": 1,
        "episode": 17,
        "src": "https://rutube.ru/play/embed/d35bb8f4e3b31fcb27ba010495c2e652",
        "url": "https://rutube.ru/video/d35bb8f4e3b31fcb27ba010495c2e652/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 18 серия",
        "season": 1,
        "episode": 18,
        "src": "https://rutube.ru/play/embed/7867bb2df1e2e8ffe39d01b8d46b5a25",
        "url": "https://rutube.ru/video/7867bb2df1e2e8ffe39d01b8d46b5a25/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 19 серия",
        "season": 1,
        "episode": 19,
        "src": "https://rutube.ru/play/embed/37181a7c3632dbcbda327f649b38685c",
        "url": "https://rutube.ru/video/37181a7c3632dbcbda327f649b38685c/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 20 серия",
        "season": 1,
        "episode": 20,
        "src": "https://rutube.ru/play/embed/8bcc94e63eb01e85c8a8c9f691e78249",
        "url": "https://rutube.ru/video/8bcc94e63eb01e85c8a8c9f691e78249/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 21 серия",
        "season": 1,
        "episode": 21,
        "src": "https://rutube.ru/play/embed/47c2fc393fe05169ba0f54bdfe5d6d2e",
        "url": "https://rutube.ru/video/47c2fc393fe05169ba0f54bdfe5d6d2e/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 22 серия",
        "season": 1,
        "episode": 22,
        "src": "https://rutube.ru/play/embed/baf1be0576af2307d64d33ceef190cbd",
        "url": "https://rutube.ru/video/baf1be0576af2307d64d33ceef190cbd/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 23 серия",
        "season": 1,
        "episode": 23,
        "src": "https://rutube.ru/play/embed/af6968e916ca90a00b82e358b38f75c5",
        "url": "https://rutube.ru/video/af6968e916ca90a00b82e358b38f75c5/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 24 серия",
        "season": 1,
        "episode": 24,
        "src": "https://rutube.ru/play/embed/b0c2542204b90e5a39dfb305b81f5292",
        "url": "https://rutube.ru/video/b0c2542204b90e5a39dfb305b81f5292/",
        "source": "rutube"
    },
    {
        "name": "Моя геройская академия — 25 серия",
        "season": 1,
        "episode": 25,
        "src": "https://rutube.ru/play/embed/f1037d2a45234810f8e9a28eb968d6a9",
        "url": "https://rutube.ru/video/f1037d2a45234810f8e9a28eb968d6a9/",
        "source": "rutube"
    }
];

  function isMhaMovieV2(movie) {
    const raw = [
      movie && movie.ru,
      movie && movie.en,
      movie && movie.title,
      movie && movie.name,
      movie && movie.originalTitle,
      movie && movie.russianTitle,
      movie && movie.englishTitle,
      document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
    ].filter(Boolean).join(" ").toLowerCase();

    return raw.includes("my hero academia") ||
           raw.includes("boku no hero academia") ||
           raw.includes("boku no hīrō akademia") ||
           raw.includes("моя геройская академия") ||
           raw.includes("геройская академия");
  }

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};
  [
    "Моя геройская академия",
    "My Hero Academia",
    "Boku no Hero Academia",
    "Boku no Hīrō Akademia",
    "僕のヒーローアカデミア"
  ].forEach(k => {
    window.OFFICIAL_EMBEDS[k] = mhaEpisodesV2;
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = mhaEpisodesV2;
    }
  });

  try {
    const oldSync = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
    getOfficialEmbedsForMovie = function(movie) {
      if (isMhaMovieV2(movie)) return mhaEpisodesV2;
      return oldSync ? oldSync(movie) : [];
    };
  } catch (e) {}

  try {
    const oldAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
    getOfficialEmbedsForMovieAsync = async function(movie) {
      if (isMhaMovieV2(movie)) return mhaEpisodesV2;
      return oldAsync ? oldAsync(movie) : [];
    };
  } catch (e) {}

  // Дополнительная защита: если карточка уже открылась, но блок плеера не появился,
  // через секунду пробуем вставить его ещё раз.
  document.addEventListener("click", function () {
    setTimeout(function () {
      try {
        if (window.selectedMovie && isMhaMovieV2(window.selectedMovie) && typeof addOfficialEmbedButtonsToDetails === "function") {
          const hasBox = document.querySelector(".official-episodes-box");
          if (!hasBox) addOfficialEmbedButtonsToDetails(window.selectedMovie);
        }
      } catch (e) {}
    }, 1000);
  }, true);
})();

/* ===== АТАКА ТИТАНОВ / ATTACK ON TITAN — YANDEX PLAYER ===== */
(function () {
  const aotPlayer = {
    name: "Атака титанов — смотреть",
    season: 1,
    episode: 1,
    src: "https://frontend.vh.yandex.ru/player/4521041827197602696?autoplay=1&event_prefix=sandbox:&restore_mute_state=1&init_timeout=15000&counters=%7B%22duration%22%3A1565%2C%22reqid%22%3A%221781132506693846-14550417896480300177-balancer-l7leveler-kubr-yp-klg-39-BAL%22%2C%22table%22%3A%22video_tech%22%2C%22heartbeats%22%3A%7B%22singlePath%22%3A%22heartbeat.single.fserp%22%2C%22noRepeat%22%3Atrue%7D%2C%22live%22%3Afalse%2C%22videoUrl%22%3A%22http%3A%2F%2Ffrontend.vh.yandex.ru%2Fplayer%2F4521041827197602696%22%2C%22extraParams%22%3A%7B%22from%22%3A%22yavideo%22%7D%7D&service=ya-video&from=yavideo",
    url: "https://frontend.vh.yandex.ru/player/4521041827197602696?autoplay=1&event_prefix=sandbox:&restore_mute_state=1&init_timeout=15000&counters=%7B%22duration%22%3A1565%2C%22reqid%22%3A%221781132506693846-14550417896480300177-balancer-l7leveler-kubr-yp-klg-39-BAL%22%2C%22table%22%3A%22video_tech%22%2C%22heartbeats%22%3A%7B%22singlePath%22%3A%22heartbeat.single.fserp%22%2C%22noRepeat%22%3Atrue%7D%2C%22live%22%3Afalse%2C%22videoUrl%22%3A%22http%3A%2F%2Ffrontend.vh.yandex.ru%2Fplayer%2F4521041827197602696%22%2C%22extraParams%22%3A%7B%22from%22%3A%22yavideo%22%7D%7D&service=ya-video&from=yavideo",
    source: "iframe"
  };

  const keys = [
    "Атака титанов",
    "Attack on Titan",
    "Shingeki no Kyojin",
    "Shingeki no Kyojin Season 1",
    "Attack on Titan Season 1",
    "進撃の巨人"
  ];

  window.OFFICIAL_EMBEDS = window.OFFICIAL_EMBEDS || {};

  keys.forEach(k => {
    window.OFFICIAL_EMBEDS[k] = [aotPlayer];
    if (typeof normalizeEmbedTitle === "function") {
      window.OFFICIAL_EMBEDS[normalizeEmbedTitle(k)] = [aotPlayer];
    }
  });

  function isAotRaw(raw) {
    const s = String(raw || "").toLowerCase();
    return s.includes("attack on titan") ||
           s.includes("shingeki no kyojin") ||
           s.includes("атака титанов");
  }

  try {
    const oldSync = typeof getOfficialEmbedsForMovie === "function" ? getOfficialEmbedsForMovie : null;
    getOfficialEmbedsForMovie = function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isAotRaw(raw)) return [aotPlayer];
      return oldSync ? oldSync(movie) : [];
    };
  } catch (e) {}

  try {
    const oldAsync = typeof getOfficialEmbedsForMovieAsync === "function" ? getOfficialEmbedsForMovieAsync : null;
    getOfficialEmbedsForMovieAsync = async function(movie) {
      const raw = [
        movie && movie.ru,
        movie && movie.en,
        movie && movie.title,
        movie && movie.name,
        movie && movie.originalTitle,
        document.getElementById("detailTitle") ? document.getElementById("detailTitle").textContent : ""
      ].filter(Boolean).join(" ");

      if (isAotRaw(raw)) return [aotPlayer];
      return oldAsync ? oldAsync(movie) : [];
    };
  } catch (e) {}
})();
