
globalThis.window=globalThis;
const PAGE_SIZE=3;
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function getType(m){return m.type||"Фильм"}
function titleOf(m){return m.ru||m.en||""}
function gkmCleanListV60(list){return Array.isArray(list)?list:[]}
/* === GKM V74 REAL POSTERS FIRST === */
function gkmHasRealPosterV74(m) {
  const p = String(m && m.poster || "").trim().toLowerCase();
  if (!p || p.length < 8) return false;
  if (m && m.posterFallback) return false;
  if (p.includes("dummyimage.com")) return false;
  return true;
}

window.GKM_REAL_POSTERS_FIRST_VERSION = "v75-no-fallback-first-pages-tested-2026-06-14";
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

window.GKM_NO_FALLBACK_FIRST_PAGES_VERSION = "v75-no-fallback-first-pages-tested-2026-06-14";
/* === /GKM V75 NO FALLBACK FIRST PAGES === */
function gkmStrictFilterTabV71(tab, items) {
  let out = gkmCleanListV60(items || []);
  if (tab === "movies") out = out.filter(m => getType(m) === "Фильм");
  else if (tab === "series") out = out.filter(m => getType(m) === "Сериал");
  else if (tab === "cartoons") out = out.filter(m => getType(m) === "Мультфильм");
  else if (tab === "anime") out = out.filter(m => getType(m) === "Аниме");
  else if (tab === "new") out = out.filter(m => Number(getYear(m) || 0) >= 2024);
  else if (tab === "top") out = out.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  else if (tab === "popular") out = out.filter(m => getVotes(m) >= 1);
  return gkmRealPosterFirstV75(gkmSortVotesFirstV67(out));
}


const items=[
 {id:"dummy_giant",type:"Фильм",votes:999999,rating:9,poster:"https://dummyimage.com/a.png",posterFallback:true},
 {id:"real_30k",type:"Фильм",votes:30000,rating:7,poster:"https://image.tmdb.org/t/p/w500/a.jpg"},
 {id:"anime",type:"Аниме",votes:999999,rating:9,poster:"https://image.tmdb.org/t/p/w500/anime.jpg"},
 {id:"real_10k",type:"Фильм",votes:10000,rating:8,poster:"https://x.test/b.jpg"},
 {id:"real_1k",type:"Фильм",votes:1000,rating:8,poster:"https://x.test/c.jpg"}
];
const out=gkmStrictFilterTabV71("movies",items);
console.log(JSON.stringify(out.map(x=>x.id)));
if(out[0]!=="real_30k") process.exit(2);
if(out[1]!=="real_10k") process.exit(3);
if(out[2]!=="real_1k") process.exit(4);
if(out[out.length-1]!=="dummy_giant") process.exit(5);
