
globalThis.window=globalThis;
const FAST_BASE="data/fast";
const PAGE_SIZE=3;
const MIN_VOTES_FOR_TOP=300;
const TAB_TO_PAGE={movies:"movies",anime:"anime",series:"series",cartoons:"cartoons",all:"all"};
let currentTab="all", currentPage=1, currentItems=[], currentPages=1, currentCount=0;
let fetched=[], ensureCalled=false;
const elements={
  searchInput:{value:""},
  typeFilter:{value:""},
  genreFilter:{value:""},
  yearFilter:{value:""},
  ratingFilter:{value:"0"},
  sortFilter:{value:"votes"}
};
function $(id){return elements[id]||null}
function getType(m){return m.type||"Фильм"}
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function gkmCleanListV60(list){return Array.isArray(list)?list:[]}
function renderList(items,label){globalThis.rendered={items,label,currentPage,currentPages,currentCount};}
function setStatus(s){globalThis.status=s}
function ensureSearchIndex(){ensureCalled=true; throw new Error("must not call index");}
async function fetchJson(url){
  fetched.push(url);
  const page=url.match(/page_(\d+)\.json/)[1];
  if(page==="0001") return {page:1,pages:4,count:240,items:[
    {id:"anime_big",type:"Аниме",votes:999999},
    {id:"m_low",type:"Фильм",votes:2},
    {id:"m_30k",type:"Фильм",votes:30000}
  ]};
  if(page==="0002") return {page:2,pages:4,count:240,items:[
    {id:"m_10k",type:"Фильм",votes:15000},
    {id:"cartoon",type:"Мультфильм",votes:500000},
    {id:"m_1k",type:"Фильм",votes:1200}
  ]};
  return {page:Number(page),pages:4,count:240,items:[{id:"m_tiny_"+page,type:"Фильм",votes:Number(page)}]};
}
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
/* === GKM V71 PAGE BUFFER + NO SEARCH PAGER === */
const GKM_PAGE_BUFFER_LIMIT_V71 = 12;
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
  return gkmSortVotesFirstV67(out);
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
    `Раздел: ${currentCount} · Страница ${currentPage} из ${currentPages} · буфер ${buffer.sourcePages} стр.`
  );
  setStatus(`Раздел ${pageTab} · без search_index · сортировка по голосам`);
}

window.GKM_PAGER_NO_SEARCH_VERSION = "v71-pager-buffer-no-search-tested-2026-06-13";
window.GKM_PAGE_BUFFER_VERSION = "v71-pager-buffer-no-search-tested-2026-06-13";
/* === /GKM V71 PAGE BUFFER + NO SEARCH PAGER === */
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
(async()=>{
  const active=hasActiveControls();
  await loadPage("movies",1);
  const ids1=currentItems.map(x=>x.id);
  await loadPage("movies",2);
  const ids2=currentItems.map(x=>x.id);
  console.log(JSON.stringify({active,ensureCalled,fetched:fetched.length,ids1,ids2,currentPages,status}));
  if(active) process.exit(2);
  if(ensureCalled) process.exit(3);
  if(ids1.join(",")!=="m_30k,m_10k,m_1k") process.exit(4);
  if(ids2[ids2.length-1]!=="m_low") process.exit(5);
})();
