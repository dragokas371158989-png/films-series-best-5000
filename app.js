const MOVIES_URL = "movies_updates.json";
const ANIME_URL = "anime_updates.json";
const PAGE_SIZE = 40;

let movies = [];
let anime = [];
let allItems = [];
let filtered = [];
let currentPage = 1;
let currentTab = "all";
let selectedItem = null;
let selectedAnimeGenre = "";

const $ = (id) => document.getElementById(id);
const favKey = "mediaFav";
const historyKey = "mediaHistory";

function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function titleOf(m) { return m.ru || m.en || "Без названия"; }
function queryOf(m) { return encodeURIComponent(titleOf(m)); }
function normalize(s) { return String(s || "").toLowerCase().trim(); }
function getYear(m) { return String(m.year || "").trim(); }
function getRating(m) { return Number(m.rating || 0); }
function getGenres(m) { return Array.isArray(m.genres) ? m.genres.filter(Boolean) : []; }

function mapMovie(m) {
  return {...m, kind: m.type === "Сериал" ? "series" : "movie"};
}

function mapAnime(a) {
  return {
    id: "anime_" + (a.id || a.mal_id || Math.abs((a.ru || a.en || "").split("").reduce((x,c)=>x+c.charCodeAt(0),0))),
    sourceId: a.id || a.mal_id,
    ru: a.ru || a.title_ru || a.title || a.en || "",
    en: a.en || a.title_en || a.title_english || a.title || "",
    year: a.year || "",
    type: "Аниме",
    kind: "anime",
    episodes: a.episodes || "",
    status: a.status || "",
    rating: a.rating || a.score || 0,
    votes: a.votes || 0,
    poster: a.poster || "",
    overview: a.overview || a.synopsis || "",
    genres: getGenres(a),
    studio: a.studio || ""
  };
}

async function fetchJsonSafe(url) {
  try {
    const r = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function loadData() {
  $("statusText").textContent = "Загрузка баз...";

  const [movieData, animeData] = await Promise.all([
    fetchJsonSafe(MOVIES_URL),
    fetchJsonSafe(ANIME_URL)
  ]);

  movies = ((movieData && (movieData.movies || movieData.items)) || []).map(mapMovie);
  anime = ((animeData && (animeData.anime || animeData.data || animeData.items)) || []).map(mapAnime);

  allItems = [...movies, ...anime];

  $("statusText").textContent = `Фильмы/сериалы: ${movies.length} · Аниме: ${anime.length}`;
  fillFilters();
  renderAnimeGenresPage();
  applyFilters();
}

function fillFilters() {
  const years = [...new Set(allItems.map(getYear).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
  const genres = [...new Set(allItems.flatMap(getGenres))].sort((a,b) => a.localeCompare(b, "ru"));

  $("yearFilter").innerHTML = `<option value="">Все годы</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  $("genreFilter").innerHTML = `<option value="">Все жанры</option>` + genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

function applyFilters() {
  const q = normalize($("searchInput").value);
  const type = $("typeFilter").value;
  const genre = $("genreFilter").value;
  const year = $("yearFilter").value;
  const minRating = Number($("ratingFilter").value || 0);

  let list = [...allItems];

  if (currentTab === "movies") list = list.filter(m => m.kind === "movie");
  else if (currentTab === "series") list = list.filter(m => m.kind === "series");
  else if (currentTab === "anime" || currentTab === "animeGenres") list = list.filter(m => m.kind === "anime");
  else if (currentTab === "new") list = list.slice(0, 500);
  else if (currentTab === "fav") {
    const fav = loadSet(favKey);
    list = list.filter(m => fav.has(String(m.id)));
  } else if (currentTab === "history") {
    const hist = [...loadSet(historyKey)];
    const map = new Map(allItems.map(m => [String(m.id), m]));
    list = hist.map(id => map.get(id)).filter(Boolean);
  } else if (currentTab === "random") {
    list = shuffle(list).slice(0, 200);
  }

  if (q) {
    list = list.filter(m => {
      const hay = normalize([m.ru, m.en, m.year, m.type, m.status, m.overview, ...getGenres(m)].join(" "));
      return hay.includes(q);
    });
  }

  if (type) list = list.filter(m => m.type === type);
  if (genre) list = list.filter(m => getGenres(m).includes(genre));
  if (year) list = list.filter(m => getYear(m) === year);
  if (minRating) list = list.filter(m => getRating(m) >= minRating);
  if (selectedAnimeGenre) list = list.filter(m => m.kind === "anime" && animeGenreMatch(m, selectedAnimeGenre));

  filtered = list;
  currentPage = 1;
  render();
}

function animeGenreMatch(m, selected) {
  const q = normalize(selected);
  const hay = normalize(getGenres(m).join(" ") + " " + (m.ru || "") + " " + (m.en || "") + " " + (m.overview || ""));
  const aliases = {
    "экшен": ["экшен","action","боевик"],
    "фантастика": ["фантастика","sci-fi","science fiction"],
    "фэнтези": ["фэнтези","fantasy"],
    "романтика": ["романтика","romance"],
    "мистика / загадки": ["мистика","mystery","загад"],
    "повседневность": ["повседневность","slice of life"],
    "сверхъестественное": ["сверхъестественное","supernatural"],
    "исекай": ["исекай","isekai"],
    "сёнэн": ["сёнэн","shounen","shonen"],
    "сэйнэн": ["сэйнэн","seinen"],
    "сёдзё": ["сёдзё","shoujo","shojo"],
    "дзёсэй": ["дзёсэй","josei"],
    "меха / роботы": ["меха","mecha","робот"]
  };
  const arr = aliases[q] || [q];
  return arr.some(x => hay.includes(normalize(x)));
}

function render() {
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  $("countText").textContent = `Найдено: ${filtered.length} · Страница ${currentPage} из ${pages}`;
  $("grid").innerHTML = pageItems.map(cardHtml).join("");

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const item = allItems.find(m => String(m.id) === id);
      if (item) openDetails(item);
    });
  });

  $("prevBtn").disabled = currentPage <= 1;
  $("nextBtn").disabled = currentPage >= pages;
  $("pageText").textContent = `${currentPage} / ${pages}`;
}

function cardHtml(m) {
  const poster = m.poster ? `<img loading="lazy" src="${escapeAttr(m.poster)}" alt="${escapeAttr(titleOf(m))}">` : `<div class="no-poster">Нет постера</div>`;
  const genres = getGenres(m).slice(0, 3).join(" · ");
  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">${poster}</div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(m.year || "—")} · ${escapeHtml(m.type || "—")}</p>
        <p class="meta">${escapeHtml(genres)}</p>
        <span class="rating">${getRating(m).toFixed(1)}</span>
      </div>
    </article>
  `;
}

function openDetails(m) {
  selectedItem = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  const arr = [String(m.id), ...hist].slice(0, 300);
  localStorage.setItem(historyKey, JSON.stringify(arr));

  $("detailTitle").textContent = titleOf(m);
  $("detailMeta").textContent = `${m.year || "—"} · ${m.type || "—"} · рейтинг ${getRating(m).toFixed(1)} · ${m.episodes ? "эпизодов: " + m.episodes : "голосов: " + (m.votes || 0)}`;
  $("detailGenres").textContent = getGenres(m).join(" · ");
  $("detailOverview").textContent = m.overview || "Описание пока не добавлено.";

  if (m.poster) {
    $("detailPoster").src = m.poster;
    $("detailPoster").style.display = "block";
    $("detailNoPoster").style.display = "none";
  } else {
    $("detailPoster").style.display = "none";
    $("detailNoPoster").style.display = "block";
  }

  const q = queryOf(m);
  $("kinopoiskLink").href = `https://www.kinopoisk.ru/index.php?kp_query=${q}`;
  $("youtubeLink").href = `https://www.youtube.com/results?search_query=${q}+трейлер`;
  $("vkLink").href = `https://vk.com/video?q=${q}`;
  $("rutubeLink").href = `https://rutube.ru/search/?query=${q}`;

  updateFavBtn();
  $("detailsDialog").showModal();
}

function updateFavBtn() {
  const fav = loadSet(favKey);
  const yes = selectedItem && fav.has(String(selectedItem.id));
  $("favBtn").textContent = yes ? "Убрать из избранного" : "В избранное";
}

function toggleFav() {
  if (!selectedItem) return;
  const fav = loadSet(favKey);
  const id = String(selectedItem.id);
  if (fav.has(id)) fav.delete(id);
  else fav.add(id);
  saveSet(favKey, fav);
  updateFavBtn();
  if (currentTab === "fav") applyFilters();
}

function renderAnimeGenresPage() {
  if (typeof ANIME_GENRES === "undefined") return;

  const renderGroup = (id, arr) => {
    $(id).innerHTML = arr.map(x => `<button class="chip" data-anime-genre="${escapeAttr(x.ru)}" title="${escapeAttr(x.en)}">${escapeHtml(x.ru)}</button>`).join("");
  };

  renderGroup("animeGenresList", ANIME_GENRES.groups.genres || []);
  renderGroup("animeThemesList", ANIME_GENRES.groups.themes || []);
  renderGroup("animeDemographicsList", ANIME_GENRES.groups.demographics || []);

  document.querySelectorAll(".chip[data-anime-genre]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedAnimeGenre = btn.getAttribute("data-anime-genre") || "";
      currentTab = "animeGenres";
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      const t = document.querySelector('.tab[data-tab="animeGenres"]');
      if (t) t.classList.add("active");
      $("animeGenrePage").classList.remove("hidden");

      document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function escapeAttr(s) { return escapeHtml(s); }

function setupEvents() {
  ["searchInput", "typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
    $(id).addEventListener("change", applyFilters);
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      selectedAnimeGenre = "";
      document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
      $("animeGenrePage").classList.toggle("hidden", currentTab !== "animeGenres");
      applyFilters();
    });
  });

  $("clearAnimeGenreBtn").addEventListener("click", () => {
    selectedAnimeGenre = "";
    document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
    applyFilters();
  });

  $("prevBtn").addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  $("nextBtn").addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage < pages) { currentPage++; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  $("closeDialog").addEventListener("click", () => $("detailsDialog").close());
  $("favBtn").addEventListener("click", toggleFav);
  $("reloadBtn").addEventListener("click", () => loadData().catch(showError));

  $("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem("mediaTheme", document.body.classList.contains("light") ? "light" : "dark");
  });

  if (localStorage.getItem("mediaTheme") === "light") document.body.classList.add("light");
}

function showError(e) {
  console.error(e);
  $("statusText").textContent = "Ошибка: " + e.message;
  $("grid").innerHTML = `<div class="card"><div class="card-body">Не удалось загрузить базу. Проверь movies_updates.json и anime_updates.json.</div></div>`;
}

setupEvents();
loadData().catch(showError);
