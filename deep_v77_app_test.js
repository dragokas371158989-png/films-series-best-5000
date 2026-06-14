
globalThis.window = {
  scrollTo(arg){ globalThis.scrolled = arg; },
  GKM_GENERIC_SEARCH_TIMER_V76: null
};
const PAGE_SIZE = 60;
const MIN_VOTES_FOR_TOP = 300;
const FAST_BASE = "data/fast";
const TAB_TO_PAGE = { movies:"movies", anime:"anime", series:"series", cartoons:"cartoons", all:"all" };
let currentTab = "all", currentPage = 1, currentPages = 1, currentItems = [], currentCount = 0;
let lastSearchResults = [];
let fetched = [];
let searchIndexCalled = false;
let activeTab = "";
const elements = {
  searchInput: { value:"фильм", blur(){ this.blurred = true; }, addEventListener(){} },
  typeFilter: { value:"Аниме" },
  genreFilter: { value:"Драма" },
  yearFilter: { value:"2024" },
  ratingFilter: { value:"8" },
  sortFilter: { value:"smart", addEventListener(){} },
};
function $(id){ return elements[id] || null; }
function setStatus(s){ globalThis.status = s; }
function setActiveTab(t){ activeTab = t; currentTab = t; }
function getType(m){ return m.type || "Фильм"; }
function getVotes(m){ return Number(m.votes || 0); }
function getRating(m){ return Number(m.rating || 0); }
function getYear(m){ return String(m.year || ""); }
function titleOf(m){ return m.ru || m.en || ""; }
function gkmCleanListV60(list){ return Array.isArray(list) ? list : []; }
function renderList(items, label){ globalThis.rendered = { items, label, currentPage, currentPages, currentCount }; }
function renderHome(){ globalThis.homeRendered = true; }
function currentSearchActive(){ return false; }
function renderSearchPage(p){ globalThis.searchPageRendered = p; }
async function renderFavorites(){}
async function renderHistory(){}
async function renderRandom(){}
function ensureSearchIndex(){ searchIndexCalled = true; throw new Error("index must not load"); }
async function fetchJson(url){
  fetched.push(url);
  const m = url.match(/page_(\d+)\.json/);
  const page = m ? m[1] : "0001";
  if (page === "0001") return {page:1,pages:2,count:120,items:[
    {id:"fallback_big",type:"Фильм",votes:900000,rating:9,poster:"https://dummyimage.com/a.png",posterFallback:true},
    {id:"anime_big",type:"Аниме",votes:999999,rating:9,poster:"https://image.tmdb.org/anime.jpg"},
    {id:"real30",type:"Фильм",votes:30000,rating:7,poster:"https://image.tmdb.org/t/p/w500/real30.jpg"},
    {id:"real10",type:"Фильм",votes:10000,rating:8,poster:"https://x.test/real10.jpg"}
  ]};
  return {page:2,pages:2,count:120,items:[
    {id:"real1k",type:"Фильм",votes:1000,rating:8,poster:"https://x.test/real1k.jpg"},
    {id:"fallback_low",type:"Фильм",votes:100,rating:8,poster:"https://dummyimage.com/b.png",posterFallback:true}
  ]};
}
globalThis.document = {
  documentElement:{dataset:{}},
  readyState:"complete",
  addEventListener(){},
};
/* === GKM V74 REAL POSTERS FIRST === */
function gkmHasRealPosterV74(m) {
  const p = String(m && m.poster || "").trim().toLowerCase();
  if (!p || p.length < 8) return false;
  if (m && m.posterFallback) return false;
  if (p.includes("dummyimage.com")) return false;
  return true;
}

window.GKM_REAL_POSTERS_FIRST_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
/* === /GKM V74 REAL POSTERS FIRST === */
function gkmVotesBucketV70(m) {
  const v = Number(getVotes(m) || 0);
  if (v >= 30000) return 4;   // сперва жир: 30k+
  if (v >= 10000) return 3;   // потом крепкие: 10k+
  if (v >= 1000) return 2;    // потом средние
  if (v >= 100) return 1;     // потом мелкие
  return 0;                   // почти без голосов в самый низ
}

function gkmSortVotesFirstV67(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    // V74: на ранних страницах сначала карточки с настоящими постерами.
    const bp = gkmHasRealPosterV74(b) ? 1 : 0;
    const ap = gkmHasRealPosterV74(a) ? 1 : 0;
    if (bp !== ap) return bp - ap;

    const bb = gkmVotesBucketV70(b);
    const ab = gkmVotesBucketV70(a);
    if (bb !== ab) return bb - ab;

    const bv = Number(getVotes(b) || 0);
    const av = Number(getVotes(a) || 0);
    if (bv !== av) return bv - av;

    const br = Number(getRating(b) || 0);
    const ar = Number(getRating(a) || 0);
    if (br !== ar) return br - ar;

    return Number(getYear(b) || 0) - Number(getYear(a) || 0);
  });
}
/* === GKM V75 NO FALLBACK FIRST PAGES === */
function gkmRealPosterFirstV75(items) {
  const list = Array.isArray(items) ? items : [];
  const real = list.filter(gkmHasRealPosterV74);
  const fallback = list.filter(x => !gkmHasRealPosterV74(x));
  return [...real, ...fallback];
}

function gkmCountFallbackInSliceV75(items, limit = PAGE_SIZE) {
  return (Array.isArray(items) ? items : []).slice(0, limit).filter(x => !gkmHasRealPosterV74(x)).length;
}

window.GKM_NO_FALLBACK_FIRST_PAGES_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
/* === /GKM V75 NO FALLBACK FIRST PAGES === */
/* === GKM V71 PAGE BUFFER + NO SEARCH PAGER === */
const GKM_PAGE_BUFFER_LIMIT_V71 = 80;
let gkmDepartmentBufferCacheV71 = {};

function gkmStrictFilterTabV71(tab, items) {
  let out = gkmCleanListV60(items || []);
  if (tab === "movies") out = out.filter(m => getType(m) === "Фильм");
  else if (tab === "series") out = out.filter(m => getType(m) === "Сериал");
  else if (tab === "cartoons") out = out.filter(m => getType(m) === "Мультфильм");
  else if (tab === "anime") out = out.filter(m => getType(m) === "Аниме");
  else if (tab === "new") out = out.filter(m => Number(getYear(m) || 0) >= 2024);
  else if (tab === "top") out = out.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  else if (tab === "popular") out = out.filter(m => getVotes(m) >= 1);
  return gkmVisiblePosterItemsV76(gkmRealPosterFirstV75(gkmSortVotesFirstV67(out)));
}

async function gkmFetchPageQuietV71(pageTab, page) {
  try {
    return await fetchJson(`${FAST_BASE}/pages/${pageTab}/page_${String(page).padStart(4, "0")}.json`);
  } catch (e) {
    console.warn("V71 page fetch failed", pageTab, page, e);
    return null;
  }
}

async function gkmBuildPageBufferV71(pageTab, firstData) {
  const cacheKey = pageTab;
  if (gkmDepartmentBufferCacheV71[cacheKey]) return gkmDepartmentBufferCacheV71[cacheKey];

  const totalPages = Math.max(1, Number(firstData && firstData.pages || 1));
  const fetchCount = Math.min(totalPages, GKM_PAGE_BUFFER_LIMIT_V71);
  const datas = [firstData];

  const promises = [];
  for (let p = 2; p <= fetchCount; p++) promises.push(gkmFetchPageQuietV71(pageTab, p));
  const more = await Promise.all(promises);
  more.forEach(x => { if (x && Array.isArray(x.items)) datas.push(x); });

  const raw = datas.flatMap(x => Array.isArray(x && x.items) ? x.items : []);
  const strict = gkmStrictFilterTabV71(pageTab, raw);

  const result = {
    items: strict,
    sourcePages: datas.length,
    originalPages: totalPages,
    originalCount: Number(firstData && firstData.count || strict.length),
    syntheticPages: Math.max(1, Math.ceil(strict.length / PAGE_SIZE))
  };

  gkmDepartmentBufferCacheV71[cacheKey] = result;
  return result;
}

function gkmRenderBufferedDepartmentV71(pageTab, requestedPage, buffer) {
  currentPage = Math.max(1, Number(requestedPage || 1));
  currentPages = buffer.syntheticPages || 1;
  if (currentPage > currentPages) currentPage = currentPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  currentItems = buffer.items.slice(start, start + PAGE_SIZE);
  currentCount = buffer.originalCount || buffer.items.length;

  renderList(
    currentItems,
    `Раздел: ${currentCount} · Страница ${currentPage} из ${currentPages} · буфер ${buffer.sourcePages} стр. · заглушек ${gkmCountFallbackInSliceV75(currentItems, PAGE_SIZE)}`
  );
  setStatus(`Раздел ${pageTab} · без search_index · сортировка по голосам`);
}

window.GKM_PAGER_NO_SEARCH_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
window.GKM_PAGE_BUFFER_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
/* === /GKM V71 PAGE BUFFER + NO SEARCH PAGER === */
/* === GKM V76 HIDE NO POSTERS + NO GENERIC SEARCH === */
function gkmVisiblePosterItemsV76(items) {
  const list = Array.isArray(items) ? items : [];
  const real = list.filter(gkmHasRealPosterV74);
  return real.length ? real : list.filter(x => !String(x && x.poster || "").includes("dummyimage.com"));
}

function gkmGenericQueryTabV76(q) {
  const s = String(q || "").toLowerCase().replace(/ё/g, "е").trim();
  if (!s) return "";
  if (["фильм", "фильмы", "кино", "movies", "movie"].includes(s)) return "movies";
  if (["сериал", "сериалы", "series", "show", "shows"].includes(s)) return "series";
  if (["мульт", "мультик", "мультики", "мультфильм", "мультфильмы", "cartoon", "cartoons"].includes(s)) return "cartoons";
  if (["аниме", "anime", "анимэ"].includes(s)) return "anime";
  return "";
}

function gkmOpenGenericQueryTabV76(q) {
  const tab = gkmGenericQueryTabV76(q);
  if (!tab) return false;

  const search = $("searchInput");
  if (search) {
    search.value = "";
    search.blur();
  }

  // V77: generic words like "фильм" open a section and must clear ALL filters.
  // Otherwise filters kept hasActiveControls=true and pager could fall back to search mode.
  ["typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
    const el = $(id);
    if (el) el.value = id === "ratingFilter" ? "0" : "";
  });

  const sort = $("sortFilter");
  if (sort) sort.value = "votes";

  lastSearchResults = [];
  currentPage = 1;
  setActiveTab(tab);

  loadPage(tab, 1).then(() => {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0,0); }
  });
  return true;
}

window.GKM_HIDE_NO_POSTERS_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
window.GKM_NO_GENERIC_SEARCH_VERSION = "v77-retested-no-freeze-no-posters-2026-06-14";
/* === /GKM V76 HIDE NO POSTERS + NO GENERIC SEARCH === */
async function loadPage(tab, page = 1) {
  const pageTab = TAB_TO_PAGE[tab] || "all";

  currentTab = tab;
  currentPage = page;

  const url = `${FAST_BASE}/pages/${pageTab}/page_${String(page).padStart(4, "0")}.json`;
  setStatus(`Загружаю ${tab} · страница ${page}...`);

  const data = await fetchJson(url);

  const departmentTabs = new Set(["movies", "series", "cartoons", "anime", "top", "new", "popular"]);
  if (departmentTabs.has(pageTab)) {
    const buffer = await gkmBuildPageBufferV71(pageTab, data);
    gkmRenderBufferedDepartmentV71(pageTab, page, buffer);
    return;
  }

  currentItems = gkmSortVotesFirstV67(gkmCleanListV60(data.items || []));
  currentPage = data.page || page;
  currentPages = data.pages || 1;
  currentCount = data.count || currentItems.length;

  renderList(currentItems, `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел загружен: ${currentCount} записей · fast pages`);
}
function hasActiveControls() {
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");

  // V71: сортировка "По голосам" не включает режим поиска.
  return Boolean(
    (typeFilter && typeFilter.value) ||
    (genreFilter && genreFilter.value) ||
    (yearFilter && yearFilter.value) ||
    Number(ratingFilter ? ratingFilter.value || 0 : 0)
  );
}
(async () => {
  const genericOk = gkmGenericQueryTabV76("фильм") === "movies" && gkmGenericQueryTabV76("аниме") === "anime";
  const opened = gkmOpenGenericQueryTabV76("фильм");
  await new Promise(r => setTimeout(r, 30));
  const activeSearch = hasActiveControls();

  const page1 = currentItems.map(x => x.id);
  const visible = gkmVisiblePosterItemsV76([
    {id:"dummy", poster:"https://dummyimage.com/a.png", posterFallback:true},
    {id:"real", poster:"https://image.tmdb.org/t/p/w500/r.jpg"},
  ]).map(x => x.id);

  console.log(JSON.stringify({
    genericOk, opened, activeSearch, page1, visible,
    searchIndexCalled, filters:{
      type: elements.typeFilter.value,
      genre: elements.genreFilter.value,
      year: elements.yearFilter.value,
      rating: elements.ratingFilter.value,
      sort: elements.sortFilter.value,
      search: elements.searchInput.value
    },
    fetched
  }));

  if (!genericOk || !opened) process.exit(2);
  if (activeSearch) process.exit(3);
  if (searchIndexCalled) process.exit(4);
  if (page1.includes("fallback_big") || page1.includes("anime_big")) process.exit(5);
  if (visible.join(",") !== "real") process.exit(6);
  if (elements.typeFilter.value || elements.genreFilter.value || elements.yearFilter.value || elements.ratingFilter.value !== "0") process.exit(7);
})();
