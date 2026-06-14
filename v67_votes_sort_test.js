
globalThis.window = globalThis;
function getVotes(m){ return Number(m.votes||0); }
function getRating(m){ return Number(m.rating||0); }
function getYear(m){ return String(m.year||""); }
function titleOf(m){ return m.ru || m.en || ""; }
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

window.GKM_VOTES_FIRST_SORT_VERSION = "v67-votes-first-tested-2026-06-13";
/* === /GKM V67 VOTES FIRST SORT === */
const list=[
  {id:"low_high_rating", ru:"9.9 мало голосов", votes:2, rating:9.9, year:2026},
  {id:"mid", ru:"8.0 средне", votes:5000, rating:8.0, year:2020},
  {id:"big", ru:"7.5 много", votes:500000, rating:7.5, year:2014},
  {id:"bigger", ru:"8.7 больше", votes:900000, rating:8.7, year:2019}
];
const smart=gkmSortSmartV67(list).map(x=>x.id);
const votes=gkmSortVotesFirstV67(list).map(x=>x.id);
console.log(JSON.stringify({smart,votes}));
if(smart[0] !== "bigger") process.exit(2);
if(smart[1] !== "big") process.exit(3);
if(smart[smart.length-1] !== "low_high_rating") process.exit(4);
if(votes[0] !== "bigger") process.exit(5);
if(votes[votes.length-1] !== "low_high_rating") process.exit(6);
