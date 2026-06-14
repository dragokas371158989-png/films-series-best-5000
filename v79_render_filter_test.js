
globalThis.window=globalThis;
const PAGE_SIZE=60;
let currentTab="movies", currentPage=1, currentPages=1;
const elements={grid:{innerHTML:""},countText:{textContent:""},pageText:{textContent:""},prevBtn:{disabled:false},nextBtn:{disabled:false},searchInput:{value:""}};
function $(id){return elements[id]||null}
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function getType(m){return m.type||"Фильм"}
function titleOf(m){return m.ru||m.en||""}
function escapeHtml(s){return String(s)}
function escapeAttr(s){return String(s)}
function posterHtml(m){return `<img src="${m.poster||""}">`}
function badgesHtml(m){return ""}
function gradeText(m){return "A"}
function gradeClass(m){return "a"}
function getGenres(m){return m.genres||[]}
function getId(m){return m.id}
function isFav(){return false}
function updatePager(){}
function cardHtml(m){return `<div class="card">${m.id}</div>`}
/* === GKM V74 REAL POSTERS FIRST === */
function gkmHasRealPosterV74(m) {
  const p = String(m && m.poster || "").trim().toLowerCase();
  if (!p || p.length < 8) return false;
  if (m && m.posterFallback) return false;
  if (p.includes("dummyimage.com")) return false;
  return true;
}

window.GKM_REAL_POSTERS_FIRST_VERSION = "v79-no-poster-bottom-10tests-2026-06-14";
/* === /GKM V74 REAL POSTERS FIRST === */
/* === GKM V79 NO POSTER BOTTOM HARD FILTER === */
const GKM_POSTER_DEPARTMENTS_V79 = new Set(["movies", "series", "cartoons", "anime", "top", "new", "popular"]);

function gkmNoPosterBottomV79(items) {
  const list = Array.isArray(items) ? items : [];
  const real = list.filter(gkmHasRealPosterV74);
  const missing = list.filter(x => !gkmHasRealPosterV74(x));
  return [...real, ...missing];
}

function gkmVisibleCardsV79(items) {
  const list = gkmNoPosterBottomV79(items);
  const real = list.filter(gkmHasRealPosterV74);
  const missing = list.filter(x => !gkmHasRealPosterV74(x));

  if (GKM_POSTER_DEPARTMENTS_V79.has(currentTab) && real.length > 0) return real;

  const q = $("searchInput") ? String($("searchInput").value || "").trim() : "";
  if (q && real.length > 0) return real;

  return [...real, ...missing];
}

function gkmNoPosterStatsV79(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    real: list.filter(gkmHasRealPosterV74).length,
    missing: list.filter(x => !gkmHasRealPosterV74(x)).length
  };
}

window.GKM_NO_POSTER_BOTTOM_VERSION = "v79-no-poster-bottom-10tests-2026-06-14";
/* === /GKM V79 NO POSTER BOTTOM HARD FILTER === */
function renderList(items, label) {
  const beforeV79 = Array.isArray(items) ? items : [];
  const statsBeforeV79 = gkmNoPosterStatsV79(beforeV79);
  items = gkmVisibleCardsV79(beforeV79);
  const statsAfterV79 = gkmNoPosterStatsV79(items);
  if (statsBeforeV79.missing && statsAfterV79.missing === 0) {
    label = `${label} · скрыто без постера ${statsBeforeV79.missing}`;
  }
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
function idsFromGrid(){return Array.from(elements.grid.innerHTML.matchAll(/<div class="card">([^<]+)<\/div>/g)).map(m=>m[1])}
const items=[{id:"real1",poster:"https://image.tmdb.org/a.jpg"},{id:"dummy1",poster:"https://dummyimage.com/a.png",posterFallback:true},{id:"real2",poster:"https://x.test/b.jpg"}];
renderList(items,"test");
const ids1=idsFromGrid();
elements.searchInput.value="звёздные войны"; renderList(items,"search"); const ids2=idsFromGrid();
elements.searchInput.value=""; renderList([{id:"dummyOnly",poster:"https://dummyimage.com/a.png",posterFallback:true}],"only"); const ids3=idsFromGrid();
console.log(JSON.stringify({ids1,ids2,ids3,label:elements.countText.textContent}));
if(ids1.join(",")!=="real1,real2") process.exit(2);
if(ids2.join(",")!=="real1,real2") process.exit(3);
if(ids3.join(",")!=="dummyOnly") process.exit(4);
