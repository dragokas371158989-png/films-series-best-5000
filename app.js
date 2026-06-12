const GKM_APP_CLEAN_VERSION = "v8-isekai-smart-helper-2026-06-13";

const FAST_BASE = "data/fast";
const FAST_HOME_URL = `${FAST_BASE}/home.json`;
const FAST_META_URL = `${FAST_BASE}/meta.json`;
const FAST_SEARCH_URL = `${FAST_BASE}/search_index.json`;
const LEGACY_INDEX_URL = "data/index.json";
const PAGE_SIZE = 60;
const MIN_VOTES_FOR_TOP = 300;

let currentTab = "all";
let currentPage = 1;
let currentItems = [];
let currentPages = 1;
let currentCount = 0;
let metaData = null;
let homeData = null;
let searchIndex = null;
let lastSearchResults = [];
let selectedMovie = null;
let searchTimer = null;

const $ = (id) => document.getElementById(id);
const favKey = "gkm_favorites";
const historyKey = "gkm_history";

const TAB_TO_PAGE = {
  all: "all",
  movies: "movies",
  series: "series",
  cartoons: "cartoons",
  anime: "anime",
  top: "top",
  new: "new",
  popular: "popular",
};

function normalize(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").trim();
}

function normKey(s) {
  return normalize(s).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
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

async function fetchJson(url, cache = "no-store") {
  const res = await fetch(url + "?v=" + Date.now(), { cache });
  if (!res.ok) throw new Error(`Не загрузилось: ${url} (${res.status})`);
  return await res.json();
}

function titleOf(m) {
  return m.ru || m.title || m.name || m.en || "Без названия";
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

function getType(m) {
  return m.type || "Фильм";
}

function rankOf(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if ((r >= 9.7 && v < 300) || (r >= 9 && v < 80)) return { rank: "d", label: "Новый" };
  if (r >= 9 && v >= MIN_VOTES_FOR_TOP) return { rank: "s", label: "S-класс" };
  if (r >= 8) return { rank: "a", label: "A-класс" };
  if (r >= 7) return { rank: "b", label: "B-класс" };
  if (r >= 6) return { rank: "c", label: "C-класс" };
  return { rank: "d", label: "D-класс" };
}

function ratingLabel(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if ((r >= 9.7 && v < 300) || (r >= 9 && v < 80)) {
    return "Новый · мало оценок";
  }

  return `${rankOf(m).label} · ${r.toFixed(1)}`;
}

function scoreSmart(m) {
  const rating = getRating(m);
  const votes = getVotes(m);
  const year = Number(getYear(m) || 0);

  if (votes < 30) return rating;

  const voteBonus = Math.min(votes, 50000) / 50000 * 4;
  const yearBonus = year >= 2010 ? 0.4 : 0;

  return rating * 10 + voteBonus + yearBonus;
}

function setStatus(text) {
  const status = $("statusText");
  if (status) status.textContent = text || "";
}

function getTotalCount() {
  return Number((metaData && metaData.count) || (homeData && homeData.total) || 0);
}

function fillFilters() {
  const yearFilter = $("yearFilter");
  const genreFilter = $("genreFilter");

  if (yearFilter && metaData && Array.isArray(metaData.years)) {
    const cur = yearFilter.value;
    yearFilter.innerHTML = `<option value="">Все годы</option>` +
      metaData.years.map(y => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join("");
    if (cur) yearFilter.value = cur;
  }

  if (genreFilter && metaData && Array.isArray(metaData.genres)) {
    const cur = genreFilter.value;
    genreFilter.innerHTML = `<option value="">Все жанры</option>` +
      metaData.genres.map(g => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("");
    if (cur) genreFilter.value = cur;
  }
}

function posterHtml(m) {
  if (m.poster) {
    return `<img src="${escapeAttr(m.poster)}" loading="lazy" decoding="async" alt="">`;
  }

  return `<div class="poster-placeholder">Нет постера</div>`;
}

function badgesHtml(m) {
  const badges = [];
  const type = getType(m);
  const year = Number(getYear(m) || 0);

  if (type === "Аниме") badges.push({ text: "🐉 Аниме", cls: "anime" });
  else if (type === "Мультфильм") badges.push({ text: "🧸 Мультфильм", cls: "cartoon" });
  else if (type === "Сериал") badges.push({ text: "📺 Сериал", cls: "series" });
  else badges.push({ text: "🎬 Фильм", cls: "movie" });

  if (getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 8) badges.push({ text: "⭐ Топ", cls: "top" });
  if (year >= 2024) badges.push({ text: "🆕 Новинка", cls: "new" });

  return `<div class="card-badges">${badges.slice(0, 3).map(b => `<span class="card-badge badge-${b.cls}">${escapeHtml(b.text)}</span>`).join("")}</div>`;
}

function cardHtml(m) {
  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));
  const rank = rankOf(m).rank;

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">
        ${badgesHtml(m)}
        <button class="card-fav-btn ${isFav ? "active" : ""}" data-fav-id="${escapeAttr(m.id)}" type="button">${isFav ? "❤️" : "🤍"}</button>
        ${posterHtml(m)}
      </div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(getYear(m) || "—")} · ${escapeHtml(getType(m))}</p>
        <p class="meta">${escapeHtml(getGenres(m).slice(0, 3).join(" · "))}</p>
        <span class="rating rank-${rank}">${escapeHtml(ratingLabel(m))}</span>
      </div>
    </article>
  `;
}

function homeSectionHtml(title, items, tabName) {
  if (!Array.isArray(items) || !items.length) return "";

  return `
    <section class="home-section">
      <div class="home-section-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="home-more-btn" data-open-tab="${escapeAttr(tabName)}" type="button">Смотреть все</button>
      </div>
      <div class="home-row">${items.map(cardHtml).join("")}</div>
    </section>
  `;
}

function renderHome() {
  const grid = $("grid");
  const countText = $("countText");
  const pageText = $("pageText");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  const s = homeData.sections || {};
  currentItems = [
    ...(s.popular || []),
    ...(s.top || []),
    ...(s.new || []),
    ...(s.anime || []),
    ...(s.movies || []),
    ...(s.series || []),
    ...(s.cartoons || [])
  ];

  if (countText) countText.textContent = `ГОЛУБЬ Каталог Мира · всего записей: ${getTotalCount()}`;

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>ГОЛУБЬ Каталог Мира</h2>
          <p>Фильмы, сериалы, мультфильмы и аниме в одном месте.</p>
        </div>
        <button id="whatToWatchBtn" class="what-watch-main-btn" type="button">🎲 Что посмотреть?</button>
      </section>

      ${homeSectionHtml("🔥 Популярное", s.popular, "popular")}
      ${homeSectionHtml("⭐ Лучший рейтинг", s.top, "top")}
      ${homeSectionHtml("🆕 Новинки", s.new, "new")}
      ${homeSectionHtml("🐉 Аниме", s.anime, "anime")}
      ${homeSectionHtml("🎬 Фильмы", s.movies, "movies")}
      ${homeSectionHtml("📺 Сериалы", s.series, "series")}
      ${homeSectionHtml("🧸 Мультфильмы", s.cartoons, "cartoons")}
    `;
  }

  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  if (pageText) pageText.textContent = "Главная";
}

async function fetchJsonQuiet(url) {
  try {
    return await fetchJson(url);
  } catch (e) {
    console.warn("Не загрузилось:", url, e);
    return null;
  }
}

function normalizeChunkUrl(chunk) {
  let url = "";

  if (typeof chunk === "string") {
    url = chunk;
  } else if (chunk && typeof chunk === "object") {
    url = chunk.file || chunk.path || chunk.url || chunk.src || chunk.name || "";
  }

  url = String(url || "").trim().replace(/^\/+/, "");

  if (!url) return "";

  if (url.startsWith("http") || url.startsWith("data/")) return url;
  if (url.startsWith("chunks/")) return "data/" + url;
  if (/chunk_\d+\.json$/i.test(url)) return "data/chunks/" + url.split("/").pop();

  return "data/" + url;
}

function getItemsFromAnyJson(data) {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    for (const key of ["movies", "items", "data", "results", "records", "list"]) {
      if (Array.isArray(data[key])) return data[key];
    }

    const values = Object.values(data);
    if (values.length && values.slice(0, 20).every(x => x && typeof x === "object" && !Array.isArray(x))) {
      return values;
    }
  }

  return [];
}

function quickCleanItem(raw, idx) {
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map(g => typeof g === "object" ? (g.genre || g.name || g.title || "") : g).filter(Boolean)
    : (typeof raw.genres === "string" ? raw.genres.split(/[,;/|·]+/).map(x => x.trim()).filter(Boolean) : []);

  const title = raw.ru || raw.title || raw.name || raw.nameRu || raw.en || raw.originalTitle || "Без названия";

  let year = String(raw.year || raw.release_date || raw.first_air_date || "");
  const ym = year.match(/(19\d{2}|20\d{2})/);
  year = ym ? ym[1] : year;

  let type = raw.type || raw.kind || "Фильм";
  const typeText = normalize([type, raw.source, raw.provider, title, ...genres].join(" "));

  if (typeText.includes("аниме") || typeText.includes("anime") || typeText.includes("jikan") || typeText.includes("myanimelist")) {
    type = "Аниме";
  } else if (typeText.includes("мульт")) {
    type = "Мультфильм";
  } else if (typeText.includes("сериал") || typeText.includes("series")) {
    type = "Сериал";
  } else {
    type = "Фильм";
  }

  return {
    ...raw,
    id: raw.id || raw.uid || raw.tmdbId || raw.kinopoiskId || raw.filmId || raw.mal_id || ("legacy_" + idx),
    ru: title,
    en: raw.en || raw.nameEn || raw.originalTitle || "",
    year,
    type,
    rating: Number(raw.rating || raw.vote_average || raw.ratingKinopoisk || raw.ratingImdb || 0),
    votes: Number(raw.votes || raw.vote_count || raw.ratingVoteCount || 0),
    poster: raw.poster || raw.posterUrl || raw.poster_url || raw.image || raw.imageUrl || "",
    genres,
    overview: raw.overview_ru || raw.ruOverview || raw.description_ru || raw.descriptionRu || raw.description || raw.overview || raw.synopsis || "",
    source: raw.source || raw.provider || "",
  };
}

function buildHomeFromLegacy(items) {
  const cleaned = items.map(quickCleanItem).filter(x => titleOf(x) !== "Без названия");

  const bySmart = list => [...list].sort((a, b) => scoreSmart(b) - scoreSmart(a)).slice(0, 18);
  const popular = [...cleaned].filter(x => getVotes(x) >= 1000).sort((a, b) => getVotes(b) - getVotes(a)).slice(0, 18);
  const top = bySmart(cleaned.filter(x => getVotes(x) >= MIN_VOTES_FOR_TOP && getRating(x) >= 7));
  const newItems = [...cleaned].filter(x => Number(getYear(x) || 0) >= 2024).sort((a, b) => Number(getYear(b) || 0) - Number(getYear(a) || 0)).slice(0, 18);

  return {
    total: cleaned.length,
    sections: {
      popular,
      top,
      new: newItems,
      anime: bySmart(cleaned.filter(x => getType(x) === "Аниме")),
      movies: bySmart(cleaned.filter(x => getType(x) === "Фильм")),
      series: bySmart(cleaned.filter(x => getType(x) === "Сериал")),
      cartoons: bySmart(cleaned.filter(x => getType(x) === "Мультфильм")),
    }
  };
}

async function loadLegacyFallbackHome(reason) {
  setStatus("Быстрая база пустая, включаю запасную загрузку...");

  const index = await fetchJsonQuiet(LEGACY_INDEX_URL);
  const chunks = index && Array.isArray(index.chunks) ? index.chunks : [];

  if (!chunks.length) {
    throw new Error("data/fast пустая и data/index.json не содержит chunks");
  }

  const firstChunks = chunks.slice(0, 4);
  const legacyItems = [];

  for (const chunk of firstChunks) {
    const url = normalizeChunkUrl(chunk);
    if (!url) continue;

    const data = await fetchJsonQuiet(url);
    legacyItems.push(...getItemsFromAnyJson(data));
  }

  homeData = buildHomeFromLegacy(legacyItems);
  metaData = {
    count: homeData.total,
    generatedAt: "legacy fallback",
    years: [...new Set(legacyItems.map(x => quickCleanItem(x).year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)),
    genres: [...new Set(legacyItems.flatMap(x => quickCleanItem(x).genres || []))].sort((a, b) => a.localeCompare(b, "ru")),
    fallback: true,
  };

  fillFilters();
  renderHome();

  setStatus(`Запасная база: ${homeData.total} записей · причина: ${reason || "data/fast пустая"}`);
}


async function loadHome() {
  setStatus("Загружаю быструю главную...");

  metaData = await fetchJson(FAST_META_URL);
  homeData = await fetchJson(FAST_HOME_URL);

  const total = getTotalCount();

  if (!total || total <= 0) {
    await loadLegacyFallbackHome("data/fast вернула 0");
    return;
  }

  fillFilters();
  renderHome();

  setStatus(`Быстрая база: ${getTotalCount()} записей · ${metaData.generatedAt || ""}`);
}

async function loadPage(tab, page = 1) {
  const pageTab = TAB_TO_PAGE[tab] || "all";

  currentTab = tab;
  currentPage = page;

  const url = `${FAST_BASE}/pages/${pageTab}/page_${String(page).padStart(4, "0")}.json`;
  setStatus(`Загружаю ${tab} · страница ${page}...`);

  const data = await fetchJson(url);

  currentItems = data.items || [];
  currentPage = data.page || page;
  currentPages = data.pages || 1;
  currentCount = data.count || currentItems.length;

  renderList(currentItems, `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел загружен: ${currentCount} записей`);
}

function renderList(items, label) {
  const grid = $("grid");
  const countText = $("countText");
  const pageText = $("pageText");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (countText) countText.textContent = label || `Найдено: ${items.length}`;
  if (grid) grid.innerHTML = items.map(cardHtml).join("");

  if (pageText) pageText.textContent = `${currentPage} / ${currentPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= currentPages;
}

async function ensureSearchIndex() {
  if (searchIndex) return searchIndex;

  setStatus("Загружаю поисковый индекс...");
  searchIndex = await fetchJson(FAST_SEARCH_URL);
  setStatus(`Поисковый индекс: ${searchIndex.length} записей`);

  return searchIndex;
}

function matchesQuery(m, q) {
  if (!q) return true;

  const hay = normKey([
    m.ru, m.en, m.year, m.type, m.source, m.status,
    ...(m.genres || []),
    m.overview || ""
  ].join(" "));

  return hay.includes(q);
}

function applyLocalFilters(list) {
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");
  const sortFilter = $("sortFilter");

  const type = typeFilter ? typeFilter.value : "";
  const genre = genreFilter ? genreFilter.value : "";
  const year = yearFilter ? yearFilter.value : "";
  const minRating = Number(ratingFilter ? ratingFilter.value || 0 : 0);
  const sort = sortFilter ? sortFilter.value : "smart";

  let out = list;

  if (type) out = out.filter(m => getType(m) === type);
  if (genre) out = out.filter(m => getGenres(m).includes(genre));
  if (year) out = out.filter(m => getYear(m) === year);
  if (minRating) out = out.filter(m => getRating(m) >= minRating);

  out = [...out];

  if (sort === "rating") out.sort((a, b) => getRating(b) - getRating(a));
  else if (sort === "votes") out.sort((a, b) => getVotes(b) - getVotes(a));
  else if (sort === "year") out.sort((a, b) => Number(getYear(b) || 0) - Number(getYear(a) || 0));
  else if (sort === "title") out.sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru"));
  else out.sort((a, b) => scoreSmart(b) - scoreSmart(a));

  return out;
}

function renderSearchPage(page = 1) {
  currentPage = page;
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));

  const start = (currentPage - 1) * PAGE_SIZE;
  currentItems = lastSearchResults.slice(start, start + PAGE_SIZE);

  renderList(currentItems, `Поиск: ${lastSearchResults.length} найдено · Страница ${currentPage} из ${currentPages}`);
}

async function runSearch() {
  const searchInput = $("searchInput");
  const q = normKey(searchInput ? searchInput.value : "");
  const controlsActive = hasActiveControls();

  if (!q && !controlsActive) {
    lastSearchResults = [];

    if (currentTab === "all") renderHome();
    else await loadPage(currentTab, 1);

    return;
  }

  const index = await ensureSearchIndex();
  const raw = [];

  for (const item of index) {
    if (matchesQuery(item, q)) {
      raw.push(item);
    }
  }

  const scoped = applyTabFilter(raw);
  lastSearchResults = applyLocalFilters(scoped);
  renderSearchPage(1);
}

function factCard(label, value) {
  return `
    <div class="fact-card">
      <div class="fact-label">${escapeHtml(label)}</div>
      <div class="fact-value">${escapeHtml(value || "—")}</div>
    </div>
  `;
}

function collectPlayerLinks(m) {
  const links = [];

  const possible = [
    m.player, m.playerUrl, m.video, m.videoUrl, m.url, m.src, m.iframe, m.rutube,
    m.watchUrl, m.watch, m.trailer, m.trailerUrl,
    ...(Array.isArray(m.players) ? m.players : []),
    ...(Array.isArray(m.videoLinks) ? m.videoLinks : []),
    ...(Array.isArray(m.links) ? m.links : []),
    ...(Array.isArray(m.sources) ? m.sources : []),
  ].filter(Boolean);

  for (const item of possible) {
    if (typeof item === "string") {
      if (/rutube|youtube|youtu\.be|vk\.com|vkvideo|iframe|embed|http/i.test(item)) {
        let name = "Смотреть";
        if (/rutube/i.test(item)) name = "Rutube";
        else if (/youtu/i.test(item)) name = "YouTube";
        else if (/vk/i.test(item)) name = "VK Видео";
        links.push({ name, url: item });
      }
    } else if (item && typeof item === "object") {
      const url = item.url || item.src || item.href || item.iframe || item.embed || item.link || "";
      if (url) links.push({ name: item.name || item.title || item.label || "Смотреть", url });
    }
  }

  const seen = new Set();
  return links.filter(link => {
    const key = String(link.url || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function renderPlayerButtons(m) {
  const box = $("playerButtons");
  if (!box) return;

  const q = encodeURIComponent(titleOf(m));
  const links = collectPlayerLinks(m);

  const buttons = [];

  for (const link of links) {
    buttons.push(`<a class="watch-direct" target="_blank" rel="noreferrer" href="${escapeAttr(link.url)}">▶ ${escapeHtml(link.name || "Смотреть")}</a>`);
  }

  buttons.push(`<a target="_blank" rel="noreferrer" href="https://yandex.ru/video/search?text=${q} смотреть">Яндекс Видео</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://yandex.ru/search/?text=${q} смотреть онлайн">Яндекс поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://rutube.ru/search/?query=${q}">Rutube поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://vk.com/video?q=${q}">VK Видео поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://www.youtube.com/results?search_query=${q} трейлер">YouTube трейлер</a>`);

  box.innerHTML = buttons.join("");
}

function openDetails(m) {
  selectedMovie = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  hist.add(String(m.id));
  saveSet(historyKey, hist);

  const dialog = $("detailsDialog");
  const rank = rankOf(m);
  const genres = getGenres(m);
  const source = m.source || m.provider || "—";
  const overview = m.overview || "Описание пока не добавлено.";

  $("detailPoster").src = m.poster || "";
  $("detailPoster").style.display = m.poster ? "block" : "none";
  $("detailTitle").textContent = titleOf(m);
  $("detailMeta").innerHTML = `
    <span class="detail-type-pill">${escapeHtml(getType(m))}</span>
    <span>${escapeHtml(getYear(m) || "—")}</span>
    <span class="detail-rating-pill rank-${rank.rank}">${escapeHtml(ratingLabel(m))}</span>
    <span>${escapeHtml(getVotes(m))} голосов</span>
  `;
  $("detailGenres").innerHTML = genres.length
    ? genres.slice(0, 12).map(g => `<span class="genre-chip">${escapeHtml(g)}</span>`).join("")
    : `<span class="genre-chip">Жанры не указаны</span>`;
  $("detailOverview").textContent = overview;

  const facts = $("detailFacts");
  if (facts) {
    facts.innerHTML = [
      factCard("Тип", getType(m)),
      factCard("Год", getYear(m)),
      factCard("Рейтинг", getRating(m).toFixed(1)),
      factCard("Голосов", getVotes(m)),
      factCard("Статус", m.status),
      factCard("Эпизоды", m.episodes),
      factCard("Студия", Array.isArray(m.studio) ? m.studio.join(", ") : m.studio),
      factCard("Страна", Array.isArray(m.country) ? m.country.join(", ") : m.country),
      factCard("Возраст", m.ageRating),
      factCard("Источник", source),
    ].filter(Boolean).join("");
  }

  renderPlayerButtons(m);
  setupDetailLinks(m);

  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function setupDetailLinks(m) {
  const q = encodeURIComponent(titleOf(m));
  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));

  const favBtn = $("favBtn");
  if (favBtn) {
    favBtn.textContent = isFav ? "Убрать из избранного" : "В избранное";
    favBtn.onclick = () => {
      toggleFavorite(String(m.id));
      setupDetailLinks(m);
    };
  }

  const links = {
    yandexLink: `https://yandex.ru/search/?text=${q} смотреть онлайн`,
    yandexVideoLink: `https://yandex.ru/video/search?text=${q} смотреть`,
    kinopoiskLink: `https://www.kinopoisk.ru/index.php?kp_query=${q}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${q} трейлер`,
    vkLink: `https://vk.com/video?q=${q}`,
    rutubeLink: `https://rutube.ru/search/?query=${q}`,
    googleLink: `https://www.google.com/search?q=${q} смотреть`,
    shikimoriLink: `https://shikimori.one/animes?search=${q}`,
    malLink: `https://myanimelist.net/anime.php?q=${q}`,
    anilistLink: `https://anilist.co/search/anime?search=${q}`,
    animePlanetLink: `https://www.anime-planet.com/anime/all?name=${q}`,
    anidbLink: `https://anidb.net/anime/?adb.search=${q}&do.search=1`,
  };

  for (const [id, href] of Object.entries(links)) {
    const el = $(id);
    if (el) el.href = href;
  }

  const animeBlock = $("animeLinksBlock");
  if (animeBlock) animeBlock.style.display = getType(m) === "Аниме" ? "block" : "none";
}

function toggleFavorite(id, btn) {
  const fav = loadSet(favKey);
  const key = String(id);

  if (fav.has(key)) {
    fav.delete(key);
    if (btn) {
      btn.classList.remove("active");
      btn.textContent = "🤍";
    }
  } else {
    fav.add(key);
    if (btn) {
      btn.classList.add("active");
      btn.textContent = "❤️";
    }
  }

  saveSet(favKey, fav);
}

function setActiveTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", (t.dataset.tab || "all") === tabName);
  });
}

async function renderFavorites() {
  const fav = loadSet(favKey);
  const index = await ensureSearchIndex();
  lastSearchResults = index.filter(x => fav.has(String(x.id)));
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

async function renderHistory() {
  const hist = [...loadSet(historyKey)];
  const index = await ensureSearchIndex();
  const map = new Map(index.map(x => [String(x.id), x]));
  lastSearchResults = hist.map(id => map.get(String(id))).filter(Boolean).reverse();
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

async function renderRandom() {
  const index = await ensureSearchIndex();
  lastSearchResults = [...index].sort(() => Math.random() - 0.5).slice(0, 240);
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

function currentSearchActive() {
  const searchInput = $("searchInput");
  return Boolean(normKey(searchInput ? searchInput.value : "") || hasActiveControls());
}

function hasActiveControls() {
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");
  const sortFilter = $("sortFilter");

  return Boolean(
    (typeFilter && typeFilter.value) ||
    (genreFilter && genreFilter.value) ||
    (yearFilter && yearFilter.value) ||
    Number(ratingFilter ? ratingFilter.value || 0 : 0) ||
    (sortFilter && sortFilter.value && sortFilter.value !== "smart")
  );
}

function applyTabFilter(list) {
  if (currentTab === "movies") return list.filter(m => getType(m) === "Фильм");
  if (currentTab === "series") return list.filter(m => getType(m) === "Сериал");
  if (currentTab === "anime") return list.filter(m => getType(m) === "Аниме");
  if (currentTab === "cartoons") return list.filter(m => getType(m) === "Мультфильм");
  if (currentTab === "top") return list.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  if (currentTab === "new") return list.filter(m => Number(getYear(m) || 0) >= 2024);
  if (currentTab === "popular") return list.filter(m => getVotes(m) >= 1000);
  return list;
}

function setupEvents() {
  document.addEventListener("click", async (e) => {
    const favBtn = e.target.closest(".card-fav-btn");

    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.favId, favBtn);
      return;
    }

    const moreBtn = e.target.closest("[data-open-tab]");
    if (moreBtn) {
      const tabName = moreBtn.dataset.openTab || "all";
      setActiveTab(tabName);

      if (currentSearchActive()) {
        await runSearch();
      } else {
        await loadPage(tabName, 1);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const card = e.target.closest(".card");
    if (card) {
      const id = card.dataset.id;
      const item =
        currentItems.find(x => String(x.id) === String(id)) ||
        lastSearchResults.find(x => String(x.id) === String(id)) ||
        (searchIndex || []).find(x => String(x.id) === String(id));

      if (item) openDetails(item);
    }
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", async () => {
      const tabName = tab.dataset.tab || "all";
      setActiveTab(tabName);

      if (tabName === "fav") {
        await renderFavorites();
      } else if (tabName === "history") {
        await renderHistory();
      } else if (tabName === "random") {
        await renderRandom();
      } else if (currentSearchActive()) {
        await runSearch();
      } else if (tabName === "all") {
        currentPage = 1;
        renderHome();
      } else if (metaData && metaData.fallback && homeData && homeData.sections) {
        const section = homeData.sections[tabName] || [];
        currentItems = section;
        currentPage = 1;
        currentPages = 1;
        renderList(section, `Запасной раздел: ${section.length}`);
      } else {
        await loadPage(tabName, 1);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", async () => {
      if (currentPage <= 1) return;

      if (currentSearchActive() || currentTab === "fav" || currentTab === "history" || currentTab === "random") {
        renderSearchPage(currentPage - 1);
      } else {
        await loadPage(currentTab, currentPage - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      if (currentPage >= currentPages) return;

      if (currentSearchActive() || currentTab === "fav" || currentTab === "history" || currentTab === "random") {
        renderSearchPage(currentPage + 1);
      } else {
        await loadPage(currentTab, currentPage + 1);
      }
    });
  }

  const resetBtn = $("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      ["searchInput", "typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
        const el = $(id);
        if (el) el.value = "";
      });

      currentTab = "all";
      setActiveTab("all");
      renderHome();
    });
  }

  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 220);
    });
  }

  ["typeFilter", "genreFilter", "yearFilter", "ratingFilter", "sortFilter"].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("change", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, 120);
      });
    }
  });

  const closeDialog = $("closeDialog");
  if (closeDialog) {
    closeDialog.addEventListener("click", () => {
      const dialog = $("detailsDialog");
      if (dialog && dialog.open) dialog.close();
    });
  }
}

function showFatalError(e) {
  console.error(e);

  const grid = $("grid");
  const message = e && e.message ? e.message : String(e);

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>Ошибка запуска</h2>
          <p>${escapeHtml(message)}</p>
          <p>Проверь, что существует папка data/fast и файлы home.json, meta.json, search_index.json.</p>
        </div>
      </section>
    `;
  }

  setStatus("Ошибка: " + message);
}

async function startApp() {
  console.log("GKM:", GKM_APP_CLEAN_VERSION);

  setupEvents();

  try {
    await loadHome();
  } catch (e) {
    showFatalError(e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

/* === GKM SMART VISUAL HELPER V8 === */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function normalizeText(text) {
    return String(text || "").toLowerCase().replaceAll("ё", "е").trim();
  }

  function aiBox() {
    return $("gkmAiMessages");
  }

  function scrollAi() {
    const box = aiBox();
    if (box) box.scrollTop = box.scrollHeight;
  }

  function addMsg(text, who) {
    const box = aiBox();
    if (!box) return null;
    const div = document.createElement("div");
    div.className = "ai-msg " + (who === "user" ? "ai-user" : "ai-bot");
    div.textContent = text;
    box.appendChild(div);
    scrollAi();
    return div;
  }

  function addBotWithActions(text, actions) {
    const box = aiBox();
    if (!box) return;
    const div = document.createElement("div");
    div.className = "ai-msg ai-bot";

    const p = document.createElement("div");
    p.textContent = text;
    div.appendChild(p);

    if (actions && actions.length) {
      const row = document.createElement("div");
      row.className = "ai-action-row";
      actions.forEach(a => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = a.label;
        b.addEventListener("click", a.run);
        row.appendChild(b);
      });
      div.appendChild(row);
    }

    box.appendChild(div);
    scrollAi();
  }

  function addRecommendationCard(item, intro, extraActions) {
    const box = aiBox();
    if (!box || !item) return;

    const wrap = document.createElement("div");
    wrap.className = "ai-msg ai-bot ai-rec-msg";

    const introEl = document.createElement("div");
    introEl.textContent = intro || "Вот хороший вариант:";
    wrap.appendChild(introEl);

    const card = document.createElement("div");
    card.className = "ai-rec-card";

    const poster = document.createElement("img");
    poster.className = "ai-rec-poster";
    poster.loading = "lazy";
    poster.alt = titleOf(item);
    poster.src = item.poster || "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="100%" height="100%" fill="#0a1020"/><text x="50%" y="50%" fill="#fff" font-size="14" text-anchor="middle">Нет постера</text></svg>');
    card.appendChild(poster);

    const genres = (getGenres(item) || []).slice(0, 4).join(" · ");
    const rating = Number(getRating(item) || 0);
    const votes = Number(getVotes(item) || 0);

    const info = document.createElement("div");
    info.className = "ai-rec-info";
    info.innerHTML = `
      <div class="ai-rec-title">${escapeHtml(titleOf(item))}</div>
      <div class="ai-rec-meta">${escapeHtml(getYear(item) || "—")} · ${escapeHtml(getType(item) || "—")}</div>
      <div class="ai-rec-meta">${escapeHtml(genres || "Без жанров")}</div>
      <div class="ai-rec-meta">Рейтинг: ${rating ? rating.toFixed(1) : "—"} · Голосов: ${votes ? String(votes) : "—"}</div>
    `;
    card.appendChild(info);
    wrap.appendChild(card);

    const actions = document.createElement("div");
    actions.className = "ai-action-row";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Открыть";
    openBtn.addEventListener("click", () => openItemCard(item));
    actions.appendChild(openBtn);

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.textContent = "Найти";
    searchBtn.addEventListener("click", () => setSearch(titleOf(item)));
    actions.appendChild(searchBtn);

    (extraActions || []).forEach(a => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      b.addEventListener("click", a.run);
      actions.appendChild(b);
    });

    wrap.appendChild(actions);
    box.appendChild(wrap);
    scrollAi();
  }

  function openAi() {
    const dlg = $("gkmAiDialog");
    if (!dlg) return;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
    setTimeout(() => $("gkmAiInput") && $("gkmAiInput").focus(), 50);
  }

  function closeAi() {
    const dlg = $("gkmAiDialog");
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  function clickByText(words) {
    const list = Array.from(document.querySelectorAll("button, a"));
    const found = list.find(el => {
      const t = normalizeText(el.textContent);
      return words.some(w => t.includes(normalizeText(w)));
    });
    if (found) {
      found.click();
      return true;
    }
    return false;
  }

  function setSearch(query) {
    const candidates = [
      $("searchInput"),
      document.querySelector('input[type="search"]'),
      document.querySelector('input[placeholder*="Поиск"]'),
      document.querySelector('input[placeholder*="поиск"]')
    ].filter(Boolean);

    const input = candidates[0];
    if (!input) return false;

    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const form = input.closest("form");
    if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
  }

  async function ensureSearchIndex() {
    if (Array.isArray(searchIndex) && searchIndex.length) return searchIndex;

    try {
      if (typeof fetchJson === "function") {
        searchIndex = await fetchJson(FAST_SEARCH_URL);
      } else {
        const res = await fetch(FAST_SEARCH_URL + "?v=" + Date.now(), { cache: "no-store" });
        searchIndex = await res.json();
      }
    } catch (e) {
      console.warn("AI helper: search_index не загрузился", e);
    }

    return Array.isArray(searchIndex) ? searchIndex : [];
  }

  function detectKindFromText(q) {
    if (q.includes("аниме") || q.includes("анимэ") || q.includes("наруто") || q.includes("исекай") || q.includes("попадан")) return "anime";
    if (q.includes("сериал")) return "series";
    if (q.includes("мульт")) return "cartoons";
    if (q.includes("фильм") || q.includes("кино") || q.includes("вечер")) return "movies";
    return "any";
  }

  function detectKindFromItem(item) {
    const t = normalizeText(getType(item));
    if (t.includes("аниме")) return "anime";
    if (t.includes("сериал")) return "series";
    if (t.includes("мульт")) return "cartoons";
    return "movies";
  }

  function matchesKind(item, kind) {
    if (!kind || kind === "any") return true;
    const t = normalizeText(getType(item));
    const full = normalizeText([titleOf(item), getType(item), ...(getGenres(item) || [])].join(" "));

    if (kind === "anime") return t.includes("аниме") || full.includes("аниме");
    if (kind === "series") return t.includes("сериал");
    if (kind === "cartoons") return t.includes("мульт");
    if (kind === "movies" || kind === "movie") {
      return t.includes("фильм") || (!t.includes("сериал") && !t.includes("аниме") && !t.includes("мульт"));
    }

    return true;
  }

  function allKnownItems(extraPool) {
    const seen = new Set();
    const out = [];

    const addMany = (arr) => {
      (arr || []).forEach(item => {
        if (!item || item.id == null) return;
        const key = String(item.id);
        if (seen.has(key)) return;
        seen.add(key);

        // В search_index иногда нет полного type/genres, но обычно хватает.
        out.push(item);
      });
    };

    addMany(extraPool || []);
    addMany(currentItems || []);
    addMany(lastSearchResults || []);

    if (homeData && homeData.sections) {
      Object.values(homeData.sections).forEach(addMany);
    }

    return out;
  }

  function queryHints(q) {
    const hints = [];

    if (q.includes("попадан") || q.includes("исекай") || q.includes("другой мир") || q.includes("реинкарн") || q.includes("перерожд")) {
      hints.push("исекай", "перерождение", "реинкарнация", "фэнтези", "приключения", "магия", "другой мир");
    }

    if (q.includes("интерстел")) hints.push("фантастика", "космос", "драма", "приключения");
    if (q.includes("сильн")) hints.push("боевик", "экшен", "сёнэн", "сенэн", "приключения", "фэнтези");
    if (q.includes("вечер")) hints.push("драма", "приключения", "комедия", "популярное");
    if (q.includes("умн")) hints.push("психология", "детектив", "драма", "фантастика");
    if (q.includes("мрач")) hints.push("психология", "ужасы", "триллер", "саспенс");
    if (q.includes("смешн") || q.includes("весел")) hints.push("комедия");
    if (q.includes("романт")) hints.push("романтика", "мелодрама", "драма");
    if (q.includes("боев")) hints.push("боевик", "экшен", "боевые искусства");

    return hints;
  }

  function titleAliasScore(item, q) {
    const title = normalizeText([titleOf(item), item.en, item.title, item.name].join(" "));
    let score = 0;

    // Жёсткие подсказки для популярных запросов, чтобы не выдавал случайную фэнтези вместо попаданцев.
    if (q.includes("попадан") || q.includes("исекай") || q.includes("другой мир") || q.includes("перерожд")) {
      const isekaiTitles = [
        "re zero", "rezero", "starting life in another world",
        "mushoku", "jobless reincarnation",
        "slime", "tensei shitara", "reincarnated as a slime",
        "overlord", "konosuba", "sword art online",
        "shield hero", "tate no yuusha",
        "tsukimichi", "no game no life", "log horizon",
        "eminence in shadow", "kage no jitsuryokusha",
        "arifureta", "cautious hero", "youjo senki",
        "in another world", "another world", "isekai"
      ];
      if (isekaiTitles.some(x => title.includes(normalizeText(x)))) score += 80;
    }

    if (q.includes("наруто") && title.includes("naruto")) score += 100;
    if (q.includes("магич") && title.includes("magic")) score += 15;
    return score;
  }

  function smartScore(item, q, kind) {
    let score = 0;

    const full = normalizeText([
      titleOf(item),
      item.en,
      item.title,
      item.name,
      getType(item),
      getYear(item),
      ...(getGenres(item) || []),
      item.overview || ""
    ].join(" "));

    const title = normalizeText(titleOf(item));
    const genres = (getGenres(item) || []).map(normalizeText);
    const rating = Number(getRating(item) || 0);
    const votes = Number(getVotes(item) || 0);
    const year = Number(getYear(item) || 0);

    if (matchesKind(item, kind)) score += 35;

    // качество
    score += rating * 6;
    score += Math.min(votes, 500000) / 500000 * 12;
    if (year >= 2015) score += 3;
    if (year >= 2020) score += 2;

    // прямые слова запроса
    q.split(/\s+/).filter(Boolean).forEach(tok => {
      if (tok.length < 3) return;
      if (title.includes(tok)) score += 20;
      if (full.includes(tok)) score += 9;
    });

    // жанровые подсказки
    queryHints(q).forEach(h => {
      const nh = normalizeText(h);
      if (genres.some(g => g.includes(nh)) || full.includes(nh)) score += 18;
    });

    score += titleAliasScore(item, q);

    // штраф, если просили аниме/попаданцев, а у элемента нет аниме/исекай признаков
    if (kind === "anime" && !matchesKind(item, "anime")) score -= 60;
    if ((q.includes("попадан") || q.includes("исекай") || q.includes("другой мир")) && !/исекай|перерожд|реинкарн|another world|isekai|re zero|mushoku|slime|overlord|konosuba|sword art|shield hero|log horizon|no game no life|tsukimichi/i.test(full)) {
      score -= 35;
    }

    if ((q.includes("топ") || q.includes("лучш")) && rating >= 8.3) score += 8;
    if ((q.includes("популяр") || q.includes("вечер")) && votes >= 50000) score += 8;

    return score;
  }

  async function bestItems(query, kind, limit = 3) {
    const q = normalizeText(query);
    const loaded = await ensureSearchIndex();
    const pool = allKnownItems(loaded).filter(item => matchesKind(item, kind));

    return pool
      .map(item => ({ item, score: smartScore(item, q, kind) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.item);
  }

  function openItemCard(item) {
    if (!item) return;

    const id = String(item.id);
    const domCard = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (domCard) {
      domCard.scrollIntoView({ behavior: "smooth", block: "center" });
      domCard.classList.add("gkm-ai-picked");
      setTimeout(() => domCard.classList.remove("gkm-ai-picked"), 1800);
      domCard.click();
      return;
    }

    if (typeof openDetails === "function") {
      openDetails(item);
      return;
    }

    setSearch(titleOf(item));
  }

  async function recommendFromQuery(query, opts = {}) {
    const kind = opts.kind || detectKindFromText(normalizeText(query));
    const wait = addMsg("Подбираю по базе сайта...", "bot");

    const items = await bestItems(query, kind, opts.limit || 3);
    if (wait) wait.remove();

    if (!items.length) {
      addBotWithActions("Не нашёл точное совпадение. Могу открыть поиск или популярное.", [
        { label: "Искать запрос", run: () => setSearch(query) },
        { label: "Популярное", run: () => clickByText(["Популярное"]) },
        { label: "Топ 250", run: () => clickByText(["Топ 250"]) },
      ]);
      return;
    }

    const intro = opts.intro || "Вот что могу посоветовать:";
    items.forEach((item, idx) => {
      addRecommendationCard(item, idx === 0 ? intro : "Ещё вариант:", [
        { label: "Ещё похожее", run: () => recommendFromQuery(query, { kind, limit: 3, intro: "Лови ещё варианты:" }) }
      ]);
    });
  }

  function helperAnswer(text) {
    const q = normalizeText(text);
    addMsg(text, "user");
    if (!q) return;

    const kind = detectKindFromText(q);

    if (kind === "anime") {
      addBotWithActions("Понял: подбираю аниме. Для попаданцев ищу исекай, другой мир, перерождение и похожие тайтлы.", [
        { label: "Открыть Аниме", run: () => clickByText(["Аниме"]) },
        { label: "Искать Исекай", run: () => setSearch("Исекай") },
        { label: "Подобрать", run: () => recommendFromQuery(text, { kind: "anime", intro: "Вот аниме под запрос:" }) }
      ]);
      recommendFromQuery(text, { kind: "anime", intro: "Вот аниме под запрос:" });
      return;
    }

    if (kind === "movies") {
      addBotWithActions("Окей, подбираю фильмы и показываю мини-карточки.", [
        { label: "Популярное", run: () => clickByText(["Популярное"]) },
        { label: "Топ 250", run: () => clickByText(["Топ 250"]) },
        { label: "Подобрать", run: () => recommendFromQuery(text, { kind: "movies", intro: "Вот фильмы под запрос:" }) }
      ]);
      recommendFromQuery(text, { kind: "movies", intro: "Вот фильмы под запрос:" });
      return;
    }

    if (kind === "series") {
      addBotWithActions("Подбираю сериалы.", [
        { label: "Открыть Сериалы", run: () => clickByText(["Сериалы"]) },
        { label: "Подобрать", run: () => recommendFromQuery(text, { kind: "series", intro: "Вот сериалы под запрос:" }) }
      ]);
      recommendFromQuery(text, { kind: "series", intro: "Вот сериалы под запрос:" });
      return;
    }

    if (kind === "cartoons") {
      addBotWithActions("Подбираю мультфильмы.", [
        { label: "Открыть Мультфильмы", run: () => clickByText(["Мультфильмы"]) },
        { label: "Подобрать", run: () => recommendFromQuery(text, { kind: "cartoons", intro: "Вот мультфильмы под запрос:" }) }
      ]);
      recommendFromQuery(text, { kind: "cartoons", intro: "Вот мультфильмы под запрос:" });
      return;
    }

    if (q.includes("новин")) clickByText(["Новинки"]);
    if (q.includes("топ") || q.includes("лучшее") || q.includes("рейтинг")) clickByText(["Топ 250"]);

    addBotWithActions("Ищу по базе и покажу визуальные рекомендации.", [
      { label: "Искать", run: () => setSearch(text.trim().slice(0, 80)) },
      { label: "Подобрать", run: () => recommendFromQuery(text, { kind: "any", intro: "Вот что нашёл:" }) },
      { label: "Популярное", run: () => clickByText(["Популярное"]) }
    ]);
    recommendFromQuery(text, { kind: "any", intro: "Вот что нашёл:" });
  }

  function initAiChat() {
    const top = $("gkmAiTopBtn");
    const float = $("gkmAiFloatBtn");
    const close = $("gkmAiCloseBtn");
    const form = $("gkmAiForm");
    const input = $("gkmAiInput");

    const title = document.querySelector(".ai-title");
    const subtitle = document.querySelector(".ai-subtitle");
    const note = document.querySelector(".ai-note");

    if (title) title.textContent = "Голубь помощник";
    if (subtitle) subtitle.textContent = "Бесплатно: умные советы + мини-постеры";
    if (note) note.textContent = "";

    const first = document.querySelector("#gkmAiMessages .ai-bot");
    if (first) {
      first.textContent = "Я стал умнее: понимаю анимэ/аниме, попаданцев/исекай, жанры и показываю мини-карточки с постером.";
    }

    if (top) top.addEventListener("click", openAi);
    if (float) float.addEventListener("click", openAi);
    if (close) close.addEventListener("click", closeAi);

    document.querySelectorAll("[data-ai-prompt]").forEach(btn => {
      btn.addEventListener("click", () => helperAnswer(btn.getAttribute("data-ai-prompt") || btn.textContent || ""));
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = (input && input.value || "").trim();
        if (!text) return;
        input.value = "";
        helperAnswer(text);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAiChat);
  else initAiChat();

  window.GKM_AI_CHAT_VERSION = "v8-isekai-smart-helper-2026-06-13";
})();
