
globalThis.window=globalThis;
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
function getType(m){return m.type||"Фильм"}
function titleOf(m){return m.ru||m.en||""}
/* === GKM V74 REAL POSTERS FIRST === */
function gkmHasRealPosterV74(m) {
  const p = String(m && m.poster || "").trim().toLowerCase();
  if (!p || p.length < 8) return false;
  if (m && m.posterFallback) return false;
  if (p.includes("dummyimage.com")) return false;
  return true;
}

window.GKM_REAL_POSTERS_FIRST_VERSION = "v74-real-posters-first-tested-2026-06-13";
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
const list=[
 {id:"huge_no_poster",votes:900000,rating:9,poster:"https://dummyimage.com/x.png",posterFallback:true},
 {id:"real_30k",votes:30000,rating:7,poster:"https://image.tmdb.org/t/p/w500/a.jpg"},
 {id:"real_10k",votes:10000,rating:8,poster:"https://x.test/b.jpg"}
];
const ids=gkmSortVotesFirstV67(list).map(x=>x.id);
console.log(JSON.stringify(ids));
if(ids[0]!=="real_30k") process.exit(2);
if(ids[2]!=="huge_no_poster") process.exit(3);
