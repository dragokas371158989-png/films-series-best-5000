const FAST_BASE = "data/fast";
const FAST_HOME_URL = `${FAST_BASE}/home.json`;
const FAST_META_URL = `${FAST_BASE}/meta.json`;
const FAST_SEARCH_URL = `${FAST_BASE}/search_index.json`;
const GKM_APP_CLEAN_VERSION = "fast-architecture-v1-pages-no-microfreezes-2026-06-12";

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
let selectedMovie = null;
let searchTimer = null;

const $ = (id) => document.getElementById(id);
const favKey = "gkm_favorites";
const historyKey = "gkm_history";

function normalize(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").trim();
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

async function fetchJson(url) {
  const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Не загрузилось: ${url} (${res.status})`);
  return await res.json();
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

function rankOf(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if (r >= 9 && v >= MIN_VOTES_FOR_TOP) return { rank: "S", label: "S-класс" };
  if (r >= 8) return { rank: "A", label: "A-класс" };
  if (r >= 7) return { rank: "B", label: "B-класс" };
  if (r >= 6) return { rank: "C", label: "C-класс" };
  return { rank: "D", label: "D-класс" };
}

function ratingLabel(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if (r >= 9.7 && v < 300) return "Новый · мало оценок";
  if (r >= 9.0 && v < 80) return "Новый · мало оценок";

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

function injectFastStyle() {
  if (document.getElementById("gkmFastStyle")) return;

  const style = document.createElement("style");
  style.id = "gkmFastStyle";
  style.textContent = `
    .card {
      content-visibility: auto;
      contain-intrinsic-size: 340px 230px;
    }

    .card img {
      image-rendering: auto;
    }

    .home-hero {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      padding: 22px;
      border: 1px solid rgba(0, 220, 255, 0.35);
      border-radius: 20px;
      background: radial-gradient(circle at top left, rgba(0, 220, 255, 0.18), transparent 35%),
        linear-gradient(135deg, rgba(91, 33, 255, 0.42), rgba(2, 6, 23, 0.96));
      box-shadow: 0 0 28px rgba(91, 33, 255, 0.25);
    }

    .home-section {
      grid-column: 1 / -1;
      margin-top: 12px;
    }

    .home-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 8px 0 14px;
    }

    .home-section-head h3 {
      margin: 0;
      font-size: 22px;
    }

    .home-more-btn,
    .what-watch-main-btn {
      border: 1px solid rgba(0, 220, 255, 0.7);
      background: linear-gradient(180deg, #00d4ff, #5b21ff);
      color: white;
      border-radius: 14px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: 900;
      box-shadow: 0 0 18px rgba(0, 220, 255, 0.24);
    }

    .home-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 16px;
    }

    .poster-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 2 / 3;
      overflow: hidden;
      background: #050816;
    }

    .poster-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .poster-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,.45);
      font-weight: 800;
    }

    .card-fav-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 5;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.35);
      background: rgba(2,6,23,.78);
      color: white;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-fav-btn.active {
      background: linear-gradient(180deg, #ff2f7d, #6d28d9);
    }

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
      min-height: 22px;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      color: white;
      border: 1px solid rgba(255,255,255,.35);
      background: rgba(37,99,235,.95);
      box-shadow: 0 0 12px rgba(0,0,0,.35);
    }

    .badge-top {
      background: linear-gradient(180deg, rgba(245,158,11,.98), rgba(180,83,9,.98));
      color: #111827;
    }

    .badge-new {
      background: linear-gradient(180deg, rgba(34,197,94,.95), rgba(21,128,61,.95));
    }

    .badge-anime {
      background: linear-gradient(180deg, rgba(124,58,237,.95), rgba(49,46,129,.95));
    }

    .rank-n {
      background: linear-gradient(180deg, #64748b, #334155) !important;
      color: white !important;
    }

    #detailsDialog {
      max-width: min(980px, 96vw);
      max-height: 92vh;
      border: 1px solid rgba(34,211,238,.45);
      border-radius: 22px;
      background: #020617;
      color: white;
      padding: 0;
      overflow: auto;
      box-shadow: 0 0 40px rgba(91,33,255,.45);
    }

    #detailsDialog::backdrop {
      background: rgba(0,0,0,.72);
    }

    .gkm-fast-detail {
      padding: 24px;
    }

    .gkm-fast-detail-top {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 22px;
    }

    .gkm-fast-detail-poster img {
      width: 100%;
      border-radius: 16px;
    }

    .gkm-fast-close {
      position: sticky;
      top: 10px;
      float: right;
      z-index: 10;
      border: 0;
      border-radius: 12px;
      background: linear-gradient(180deg, #7b2cff, #2563eb);
      color: white;
      padding: 10px 13px;
      cursor: pointer;
      font-weight: 900;
    }

    .gkm-fast-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-top: 18px;
    }

    .gkm-fast-info-card {
      background: rgba(15,23,42,.75);
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 14px;
      padding: 12px;
    }

    .gkm-fast-link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .gkm-fast-link-row a,
    .gkm-fast-link-row button {
      border: 1px solid rgba(34,211,238,.55);
      background: linear-gradient(180deg,#7b2cff,#2563eb);
      color: white;
      border-radius: 12px;
      padding: 10px 13px;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
    }

    @media (max-width: 700px) {
      .home-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .gkm-fast-detail-top {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function badgesHtml(m) {
  const badges = [];

  if (m.type === "Аниме") badges.push({ text: "🐉 Аниме", cls: "anime" });
  else if (m.type === "Мультфильм") badges.push({ text: "🧸 Мультфильм", cls: "cartoon" });
  else if (m.type === "Сериал") badges.push({ text: "📺 Сериал", cls: "series" });
  else badges.push({ text: "🎬 Фильм", cls: "movie" });

  if (getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 8) badges.push({ text: "⭐ Топ", cls: "top" });
  if (Number(getYear(m) || 0) >= 2024) badges.push({ text: "🆕 Новинка", cls: "new" });

  return `<div class="card-badges">${badges.slice(0, 3).map(b => `<span class="card-badge badge-${b.cls}">${escapeHtml(b.text)}</span>`).join("")}</div>`;
}

function cardHtml(m) {
  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));
  const poster = m.poster
    ? `<img loading="lazy" decoding="async" src="${escapeAttr(m.poster)}" alt="">`
    : `<div class="poster-placeholder">Нет постера</div>`;

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">
        ${badgesHtml(m)}
        <button class="card-fav-btn ${isFav ? "active" : ""}" data-fav-id="${escapeAttr(m.id)}" type="button">${isFav ? "❤️" : "🤍"}</button>
        ${poster}
      </div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(getYear(m) || "—")} · ${escapeHtml(m.type || "—")}</p>
        <p class="meta">${escapeHtml(getGenres(m).slice(0, 3).join(" · "))}</p>
        <span class="rating rank-${rankOf(m).rank.toLowerCase()}">${escapeHtml(ratingLabel(m))}</span>
      </div>
    </article>
  `;
}

function homeSectionHtml(title, items, tabName) {
  if (!items || !items.length) return "";

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

function setStatus(text) {
  const status = $("statusText");
  if (status) status.textContent = text;
}

function renderHome() {
  injectFastStyle();

  const grid = $("grid");
  const countText = $("countText");
  const pageText = $("pageText");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  const s = homeData.sections || {};

  if (countText) {
    countText.textContent = `ГОЛУБЬ Каталог Мира · всего записей: ${homeData.total || 0}`;
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

  currentItems = Object.values(s).flat();
}

async function loadHome() {
  injectFastStyle();
  setStatus("Загружаю быструю главную...");

  try {
    metaData = await fetchJson(FAST_META_URL);
    homeData = await fetchJson(FAST_HOME_URL);
    renderHome();
    setStatus(`Быстрая база: ${metaData.count || homeData.total || 0} записей · ${metaData.generatedAt || ""}`);
  } catch (e) {
    console.error(e);
    showFatalFastError(e);
  }
}

async function loadPage(tab, page = 1) {
  currentTab = tab;
  currentPage = page;

  const url = `${FAST_BASE}/pages/${tab}/page_${String(page).padStart(4, "0")}.json`;
  setStatus(`Загружаю раздел: ${tab} · страница ${page}...`);

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

  setStatus("Загружаю лёгкий поисковый индекс...");
  searchIndex = await fetchJson(FAST_SEARCH_URL);
  setStatus(`Поисковый индекс: ${searchIndex.length} записей`);

  return searchIndex;
}

function matchesQuery(m, q) {
  if (!q) return true;

  const hay = normalize([
    m.ru, m.en, m.year, m.type, m.source,
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

  if (type) out = out.filter(m => m.type === type);
  if (genre) out = out.filter(m => getGenres(m).includes(genre));
  if (year) out = out.filter(m => getYear(m) === year);
  if (minRating) out = out.filter(m => getRating(m) >= minRating);

  if (sort === "rating") out.sort((a, b) => getRating(b) - getRating(a));
  else if (sort === "votes") out.sort((a, b) => getVotes(b) - getVotes(a));
  else if (sort === "year") out.sort((a, b) => Number(getYear(b) || 0) - Number(getYear(a) || 0));
  else if (sort === "title") out.sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru"));
  else out.sort((a, b) => scoreSmart(b) - scoreSmart(a));

  return out;
}

async function runSearch() {
  const searchInput = $("searchInput");
  const q = normalize(searchInput ? searchInput.value : "");

  if (!q) {
    if (currentTab === "all") renderHome();
    else await loadPage(currentTab, 1);
    return;
  }

  const index = await ensureSearchIndex();

  let result = [];

  // Не гоняем весь список через тяжёлый рендер.
  // Ищем максимум 600 совпадений, показываем первую страницу.
  for (const item of index) {
    if (matchesQuery(item, q)) {
      result.push(item);
      if (result.length >= 600) break;
    }
  }

  result = applyLocalFilters(result);

  currentPage = 1;
  currentPages = Math.max(1, Math.ceil(result.length / PAGE_SIZE));
  currentCount = result.length;
  currentItems = result.slice(0, PAGE_SIZE);

  renderList(currentItems, `Поиск: ${result.length} найдено · показано ${currentItems.length}`);
}

function fillFilters() {
  if (!metaData) return;

  const yearFilter = $("yearFilter");
  const genreFilter = $("genreFilter");

  if (yearFilter && Array.isArray(metaData.years)) {
    const cur = yearFilter.value;
    yearFilter.innerHTML = `<option value="">Все годы</option>` + metaData.years.map(y => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join("");
    if (cur) yearFilter.value = cur;
  }

  if (genreFilter && Array.isArray(metaData.genres)) {
    const cur = genreFilter.value;
    genreFilter.innerHTML = `<option value="">Все жанры</option>` + metaData.genres.map(g => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("");
    if (cur) genreFilter.value = cur;
  }
}

function openDetails(m) {
  selectedMovie = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  hist.add(String(m.id));
  saveSet(historyKey, hist);

  let dialog = $("detailsDialog");

  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "detailsDialog";
    document.body.appendChild(dialog);
  }

  const poster = m.poster
    ? `<img loading="lazy" decoding="async" src="${escapeAttr(m.poster)}" alt="">`
    : `<div class="poster-placeholder" style="min-height:320px">Нет постера</div>`;

  const searchQ = encodeURIComponent(titleOf(m));

  dialog.innerHTML = `
    <button class="gkm-fast-close" type="button" id="fastCloseDetails">✕</button>
    <section class="gkm-fast-detail">
      <div class="gkm-fast-detail-top">
        <div class="gkm-fast-detail-poster">${poster}</div>
        <div>
          <h2>${escapeHtml(titleOf(m))}</h2>
          <p style="color:#a5b4fc">${escapeHtml(m.en || "")}</p>
          <p>${escapeHtml(getYear(m) || "—")} · ${escapeHtml(m.type || "—")} · рейтинг ${escapeHtml(getRating(m).toFixed(1))} · голосов ${escapeHtml(getVotes(m))}</p>
          <p>${escapeHtml(getGenres(m).join(" · "))}</p>
          <p style="line-height:1.55">${escapeHtml(m.overview || "Описание пока не добавлено.")}</p>
        </div>
      </div>

      <div class="gkm-fast-info-grid">
        ${infoCard("Тип", m.type)}
        ${infoCard("Год", m.year)}
        ${infoCard("Статус", m.status)}
        ${infoCard("Эпизоды", m.episodes)}
        ${infoCard("Студия", m.studio)}
        ${infoCard("Страна", m.country)}
        ${infoCard("Возраст", m.ageRating)}
        ${infoCard("Источник", m.source)}
      </div>

      <h3 style="margin-top:22px">Найти на сайтах</h3>
      <div class="gkm-fast-link-row">
        <a target="_blank" rel="noreferrer" href="https://www.kinopoisk.ru/index.php?kp_query=${searchQ}">Кинопоиск</a>
        <a target="_blank" rel="noreferrer" href="https://www.youtube.com/results?search_query=${searchQ} трейлер">YouTube</a>
        <a target="_blank" rel="noreferrer" href="https://rutube.ru/search/?query=${searchQ}">Rutube</a>
        <a target="_blank" rel="noreferrer" href="https://www.google.com/search?q=${searchQ} смотреть">Google</a>
      </div>
    </section>
  `;

  $("fastCloseDetails").addEventListener("click", () => dialog.close());

  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function infoCard(label, value) {
  return `
    <div class="gkm-fast-info-card">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:5px">${escapeHtml(label)}</div>
      <div style="font-weight:900">${escapeHtml(value || "—")}</div>
    </div>
  `;
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
      await loadPage(tabName, 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const card = e.target.closest(".card");

    if (card) {
      const id = card.dataset.id;
      const item = currentItems.find(x => String(x.id) === String(id)) || (searchIndex || []).find(x => String(x.id) === String(id));
      if (item) openDetails(item);
      return;
    }
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", async () => {
      const tabName = tab.dataset.tab || "all";
      setActiveTab(tabName);

      if (tabName === "all") {
        currentTab = "all";
        currentPage = 1;
        renderHome();
      } else if (tabName === "fav") {
        await renderFavorites();
      } else if (tabName === "history") {
        await renderHistory();
      } else if (tabName === "random") {
        await renderRandom();
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
      if (currentPage > 1) await loadPage(currentTab, currentPage - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      if (currentPage < currentPages) await loadPage(currentTab, currentPage + 1);
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
  const items = index.filter(x => fav.has(String(x.id)));
  currentItems = items.slice(0, PAGE_SIZE);
  currentPage = 1;
  currentPages = 1;
  renderList(currentItems, `Избранное: ${items.length}`);
}

async function renderHistory() {
  const hist = [...loadSet(historyKey)];
  const index = await ensureSearchIndex();
  const map = new Map(index.map(x => [String(x.id), x]));
  const items = hist.map(id => map.get(String(id))).filter(Boolean).reverse();
  currentItems = items.slice(0, PAGE_SIZE);
  currentPage = 1;
  currentPages = 1;
  renderList(currentItems, `История: ${items.length}`);
}

async function renderRandom() {
  const index = await ensureSearchIndex();
  const items = [...index].sort(() => Math.random() - 0.5).slice(0, PAGE_SIZE);
  currentItems = items;
  currentPage = 1;
  currentPages = 1;
  renderList(currentItems, "Случайное");
}

function showFatalFastError(e) {
  const grid = $("grid");
  const msg = e && e.message ? e.message : String(e);

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>Ошибка быстрой базы</h2>
          <p>${escapeHtml(msg)}</p>
          <p>Нужно запустить GitHub Action, чтобы создать data/fast/home.json и страницы.</p>
        </div>
      </section>
    `;
  }

  setStatus("Ошибка: " + msg);
}

async function startApp() {
  console.log("GKM FAST APP:", GKM_APP_CLEAN_VERSION);
  injectFastStyle();
  setupEvents();
  await loadHome();
  fillFilters();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
