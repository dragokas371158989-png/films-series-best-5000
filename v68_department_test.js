
globalThis.window=globalThis;
const PAGE_SIZE=3;
const MIN_VOTES_FOR_TOP=300;
let currentTab="all", currentPage=1, currentItems=[], currentPages=1, currentCount=0, lastSearchResults=[];
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function getType(m){return m.type||"Фильм"}
function gkmCleanListV60(list){return Array.isArray(list)?list:[]}
function renderList(items,label){globalThis.rendered={items,label,currentPage,currentPages,currentCount};}
function setStatus(s){globalThis.status=s}
async function ensureSearchIndex(){return globalThis.index}
/* === GKM V67 VOTES FIRST SORT === */
function gkmVotesFirstScoreV67(m) {
  const votes = Number(getVotes(m) || 0);
  const rating = Number(getRating(m) || 0);
  const year = Number(getYear(m) || 0);

  // Главный вес — голоса. Оценка и год только помогают при равных/похожих голосах.
  return (votes * 100000) + (rating * 1000) + year;
}

function gkmSortVotesFirstV67(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bv = Number(getVotes(b) || 0);
    const av = Number(getVotes(a) || 0);
    if (bv !== av) return bv - av;

    const br = Number(getRating(b) || 0);
    const ar = Number(getRating(a) || 0);
    if (br !== ar) return br - ar;

    return Number(getYear(b) || 0) - Number(getYear(a) || 0);
  });
}

function gkmSortRatingWithVotesV67(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bs = (Number(getRating(b) || 0) * 1000000) + Math.log10(Number(getVotes(b) || 0) + 1) * 100000 + Number(getVotes(b) || 0);
    const as = (Number(getRating(a) || 0) * 1000000) + Math.log10(Number(getVotes(a) || 0) + 1) * 100000 + Number(getVotes(a) || 0);
    return bs - as;
  });
}

function gkmSortSmartV67(list) {
  // Smart теперь не тащит наверх "9.9 при 2 голосах".
  // Сначала доверие по голосам, потом рейтинг.
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bv = Number(getVotes(b) || 0);
    const av = Number(getVotes(a) || 0);

    // Если разрыв по голосам большой — побеждают голоса.
    if (Math.abs(bv - av) >= 300) return bv - av;

    const br = Number(getRating(b) || 0);
    const ar = Number(getRating(a) || 0);
    if (br !== ar) return br - ar;

    return bv - av;
  });
}

window.GKM_VOTES_FIRST_SORT_VERSION = "v68-strict-department-pages-tested-2026-06-13";
/* === /GKM V67 VOTES FIRST SORT === */
/* === GKM V68 STRICT DEPARTMENT PAGES === */
function gkmDepartmentFullListV68(tab, index) {
  const list = gkmCleanListV60(Array.isArray(index) ? index : []);
  let out = list;

  if (tab === "movies") out = out.filter(m => getType(m) === "Фильм");
  else if (tab === "series") out = out.filter(m => getType(m) === "Сериал");
  else if (tab === "cartoons") out = out.filter(m => getType(m) === "Мультфильм");
  else if (tab === "anime") out = out.filter(m => getType(m) === "Аниме");
  else if (tab === "new") out = out.filter(m => Number(getYear(m) || 0) >= 2024);
  else if (tab === "popular") out = out.filter(m => getVotes(m) >= 1);
  else if (tab === "top") out = out.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  else out = list;

  if (tab === "new") {
    out = [...out].sort((a, b) => {
      const dy = Number(getYear(b) || 0) - Number(getYear(a) || 0);
      return dy || (getVotes(b) - getVotes(a)) || (getRating(b) - getRating(a));
    });
  } else {
    out = gkmSortVotesFirstV67(out);
  }

  return out;
}

function gkmRenderDepartmentPageV68(tab, page, fullList) {
  currentTab = tab;
  currentPage = Math.max(1, Number(page || 1));
  lastSearchResults = gkmDepartmentFullListV68(tab, fullList);
  currentCount = lastSearchResults.length;
  currentPages = Math.max(1, Math.ceil(currentCount / PAGE_SIZE));

  if (currentPage > currentPages) currentPage = currentPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  currentItems = lastSearchResults.slice(start, start + PAGE_SIZE);

  renderList(currentItems, `Раздел: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел ${tab}: ${currentCount} записей · сортировка по голосам`);
}

async function gkmLoadDepartmentFromIndexV68(tab, page = 1) {
  const idx = await ensureSearchIndex();
  gkmRenderDepartmentPageV68(tab, page, idx);
}

window.GKM_STRICT_DEPARTMENT_VERSION = "v68-strict-department-pages-tested-2026-06-13";
/* === /GKM V68 STRICT DEPARTMENT PAGES === */
globalThis.index=[
  {id:"m_low",type:"Фильм",votes:2,rating:9.9,year:2026},
  {id:"anime_big",type:"Аниме",votes:999999,rating:9.1,year:2020},
  {id:"cartoon_big",type:"Мультфильм",votes:888888,rating:8.5,year:2010},
  {id:"m_big",type:"Фильм",votes:700000,rating:8.0,year:2014},
  {id:"m_mid",type:"Фильм",votes:5000,rating:8.5,year:2024},
  {id:"series_big",type:"Сериал",votes:600000,rating:8.8,year:2021},
  {id:"m_lower",type:"Фильм",votes:900,rating:8.9,year:2023}
];
(async()=>{
  await gkmLoadDepartmentFromIndexV68("movies",1);
  const ids1=currentItems.map(x=>x.id);
  await gkmLoadDepartmentFromIndexV68("movies",2);
  const ids2=currentItems.map(x=>x.id);
  await gkmLoadDepartmentFromIndexV68("anime",1);
  const animeOnly=currentItems.every(x=>x.type==="Аниме");
  console.log(JSON.stringify({ids1,ids2,animeOnly,currentCount,currentPages,status:globalThis.status}));
  if(ids1[0]!=="m_big") process.exit(2);
  if(ids1.includes("anime_big") || ids1.includes("cartoon_big") || ids1.includes("series_big")) process.exit(3);
  if(ids2[ids2.length-1]!=="m_low") process.exit(4);
  if(!animeOnly) process.exit(5);
})();
