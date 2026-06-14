
globalThis.window={scrollTo(arg){globalThis.scrolled=arg}};
let GKM_SEARCH_RUN_ID_V78=0;
function gkmSleepFrameV78(){ yielded++; return Promise.resolve(); }
function gkmSearchMinReadyV78(q){const s=String(q||"").trim(); if(!s)return true; return s.replace(/\s+/g,"").length>=2;}
function gkmSearchPrepareResultsV78(items){return gkmVisiblePosterItemsV76(gkmSortVotesFirstV67(items||[]));}
const PAGE_SIZE=60;
let yielded=0,currentTab="movies",lastSearchResults=[],currentPage=1,currentPages=1,currentItems=[],currentCount=0;
let searchIndex=[];
const elements={searchInput:{value:"звёздные войны"},typeFilter:{value:""},genreFilter:{value:""},yearFilter:{value:""},ratingFilter:{value:"0"},sortFilter:{value:"votes"}};
function $(id){return elements[id]||null}
function gkmSearchNormV49(s){return String(s||"").toLowerCase().replace(/ё/g,"е").trim();}
function gkmGenericQueryTabV76(q){const s=String(q||"").toLowerCase().replace(/ё/g,"е").trim(); if(["фильм","фильмы","кино"].includes(s)) return "movies"; if(["аниме","анимэ"].includes(s)) return "anime"; return "";}
function gkmOpenGenericQueryTabV76(){throw new Error("generic should not open for Star Wars");}
function hasActiveControls(){return false}
function renderHome(){}
async function loadPage(){}
function setStatus(s){globalThis.status=s}
function ensureSearchIndex(){return Promise.resolve(searchIndex)}
function gkmSearchVariantsV49(q){return [q, q.replace("звездные","звёздные"), q.replace("звёздные","звездные"), "star wars"];}
function titleOf(m){return m.ru||m.en||m.title||m.name||""}
function getType(m){return m.type||"Фильм"}
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function gkmTitleOnlyHayV49(m){return (titleOf(m)+" "+(m.en||"")+" "+(m.aliases||[]).join(" ")).toLowerCase().replace(/ё/g,"е");}
function gkmTitleSearchScoreV49(m,q){return gkmTitleOnlyHayV49(m).includes(q.replace(/ё/g,"е"))||gkmTitleOnlyHayV49(m).includes("star wars") ? 100+getVotes(m)/1000 : 0}
function applyTabFilter(items){return items.filter(x=>getType(x)==="Фильм")}
function applyLocalFilters(items){return items}
function gkmHasRealPosterV74(m){const p=String(m&&m.poster||"").toLowerCase(); return p && !p.includes("dummyimage.com") && !m.posterFallback}
function gkmVisiblePosterItemsV76(items){const real=items.filter(gkmHasRealPosterV74); return real.length?real:items.filter(x=>!String(x.poster||"").includes("dummyimage.com"))}
function gkmVotesBucketV70(m){const v=getVotes(m); if(v>=30000)return 4;if(v>=10000)return 3;if(v>=1000)return 2;if(v>=100)return 1;return 0}
function gkmSortVotesFirstV67(list){return [...list].sort((a,b)=> (gkmHasRealPosterV74(b)-gkmHasRealPosterV74(a)) || (gkmVotesBucketV70(b)-gkmVotesBucketV70(a)) || (getVotes(b)-getVotes(a)))}
function renderSearchPage(page=1){currentPage=page;currentPages=Math.max(1,Math.ceil(lastSearchResults.length/PAGE_SIZE));currentItems=lastSearchResults.slice(0,PAGE_SIZE);globalThis.rendered=currentItems.map(x=>x.id)}
async function runSearch() {
  const myRun = ++GKM_SEARCH_RUN_ID_V78;

  const searchInput = $("searchInput");
  const qRaw = searchInput ? searchInput.value : "";
  const q = gkmSearchNormV49(qRaw);
  const genericTabV76 = gkmGenericQueryTabV76(qRaw);

  if (genericTabV76) {
    gkmOpenGenericQueryTabV76(genericTabV76);
    return;
  }

  const controlsActive = hasActiveControls();

  if (!gkmSearchMinReadyV78(qRaw) && !controlsActive) {
    setStatus("Введите минимум 2 символа для поиска");
    return;
  }

  if (!q && !controlsActive) {
    lastSearchResults = [];
    if (currentTab === "all") renderHome();
    else await loadPage(currentTab, 1);
    return;
  }

  setStatus(`Ищу: ${qRaw}...`);

  const index = await ensureSearchIndex();
  if (myRun !== GKM_SEARCH_RUN_ID_V78) return;

  let raw = [];

  if (q) {
    const scored = [];
    const variants = gkmSearchVariantsV49(q);
    const BATCH = 450;

    for (let i = 0; i < index.length; i++) {
      if (myRun !== GKM_SEARCH_RUN_ID_V78) return;

      const item = index[i];
      const hay = gkmTitleOnlyHayV49(item);

      let realTitleHit = false;
      for (const v of variants) {
        if (!v) continue;
        if (hay.includes(v)) {
          realTitleHit = true;
          break;
        }

        const parts = v.split(" ").filter(x => x.length > 1);
        if (parts.length && parts.every(p => hay.includes(p))) {
          realTitleHit = true;
          break;
        }
      }

      if (realTitleHit) {
        const s = gkmTitleSearchScoreV49(item, q);
        if (s > 0) scored.push({ item, s });
      }

      if (i > 0 && i % BATCH === 0) {
        if (i % 9000 === 0) setStatus(`Ищу: ${qRaw} · проверено ${i} из ${index.length}`);
        await gkmSleepFrameV78();
      }
    }

    if (myRun !== GKM_SEARCH_RUN_ID_V78) return;
    scored.sort((a, b) => b.s - a.s);
    raw = scored.map(x => x.item);
  } else {
    raw = index;
  }

  const scoped = applyTabFilter(raw);
  lastSearchResults = gkmSearchPrepareResultsV78(applyLocalFilters(scoped));

  if (myRun !== GKM_SEARCH_RUN_ID_V78) return;

  if (!lastSearchResults.length && q) {
    renderList([], `Поиск: 0 найдено · ищет строго по названию`);
    setStatus(`Поиск ничего не нашёл: ${qRaw}`);
    return;
  }

  renderSearchPage(1);
  setStatus(`Поиск: ${lastSearchResults.length} найдено`);
  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0, 0); }
}
for(let i=0;i<3000;i++) searchIndex.push({id:"noise"+i,ru:"Шум "+i,type:"Фильм",votes:i,poster:"https://image.tmdb.org/t/p/w500/n.jpg"});
searchIndex.push({id:"sw1",ru:"Звёздные войны",en:"Star Wars",type:"Фильм",votes:900000,poster:"https://image.tmdb.org/t/p/w500/sw.jpg"});
searchIndex.push({id:"sw_dummy",ru:"Звёздные войны",type:"Фильм",votes:999999,poster:"https://dummyimage.com/a.png",posterFallback:true});
searchIndex.push({id:"sw_anime",ru:"Звёздные войны",type:"Аниме",votes:999999,poster:"https://image.tmdb.org/t/p/w500/a.jpg"});
(async()=>{await runSearch(); const ids=lastSearchResults.map(x=>x.id); console.log(JSON.stringify({ids:ids.slice(0,5),yielded,rendered:globalThis.rendered,status:globalThis.status})); if(!ids.includes("sw1"))process.exit(2); if(ids.includes("sw_dummy"))process.exit(3); if(ids.includes("sw_anime"))process.exit(4); if(yielded<5)process.exit(5);})();
