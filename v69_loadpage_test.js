
globalThis.window=globalThis;
const FAST_BASE="data/fast";
const TAB_TO_PAGE={movies:"movies",anime:"anime",cartoons:"cartoons",series:"series",all:"all"};
const PAGE_SIZE=60;
let currentTab, currentPage, currentItems, currentPages, currentCount;
let ensureCalled=false, fetched=[];
function ensureSearchIndex(){ ensureCalled=true; throw new Error("must not call ensureSearchIndex"); }
function getType(m){return m.type||"Фильм"}
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function gkmCleanListV60(list){return Array.isArray(list)?list:[]}
function gkmSortVotesFirstV67(list){return [...list].sort((a,b)=>getVotes(b)-getVotes(a))}
function setStatus(s){globalThis.status=s}
function renderList(items,label){globalThis.rendered={items,label,currentPage,currentPages,currentCount}}
async function fetchJson(url){fetched.push(url); return {page:1,pages:2,count:4,items:[
  {id:"anime",type:"Аниме",votes:999999},
  {id:"movie_low",type:"Фильм",votes:2},
  {id:"movie_big",type:"Фильм",votes:100000},
  {id:"cartoon",type:"Мультфильм",votes:500000}
]};}
async function loadPage(tab, page = 1) {
  const pageTab = TAB_TO_PAGE[tab] || "all";

  currentTab = tab;
  currentPage = page;

  // V69: НЕ грузим весь search_index при открытии разделов.
  // Разделы берут готовые быстрые page_0001/page_0002, которые собирает GitHub Action.
  const url = `${FAST_BASE}/pages/${pageTab}/page_${String(page).padStart(4, "0")}.json`;
  setStatus(`Загружаю ${tab} · страница ${page}...`);

  const data = await fetchJson(url);

  let items = gkmCleanListV60(data.items || []);

  // Страховка: даже если старые json смешанные, на экране типы не смешиваем.
  if (pageTab === "movies") items = items.filter(m => getType(m) === "Фильм");
  if (pageTab === "series") items = items.filter(m => getType(m) === "Сериал");
  if (pageTab === "cartoons") items = items.filter(m => getType(m) === "Мультфильм");
  if (pageTab === "anime") items = items.filter(m => getType(m) === "Аниме");

  currentItems = gkmSortVotesFirstV67(items);
  currentPage = data.page || page;
  currentPages = data.pages || 1;
  currentCount = data.count || currentItems.length;

  renderList(currentItems, `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел загружен: ${currentCount} записей · fast pages`);
}

window.GKM_FAST_PAGES_NO_FREEZE_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";

(async()=>{
 await loadPage("movies",1);
 const ids=currentItems.map(x=>x.id);
 console.log(JSON.stringify({ids,ensureCalled,fetched,status}));
 if(ensureCalled) process.exit(2);
 if(!fetched[0].includes("data/fast/pages/movies/page_0001.json")) process.exit(3);
 if(ids.join(",")!=="movie_big,movie_low") process.exit(4);
})();
