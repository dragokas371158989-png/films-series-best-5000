
globalThis.window=globalThis;
function getVotes(m){return Number(m.votes||0)}
function getRating(m){return Number(m.rating||0)}
function getYear(m){return String(m.year||"")}
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
const list=[
 {id:"tiny",votes:2,rating:10,year:2026},
 {id:"hundred",votes:300,rating:9,year:2025},
 {id:"thousand",votes:5000,rating:8,year:2020},
 {id:"tenk",votes:15000,rating:7,year:2019},
 {id:"fat",votes:30000,rating:6,year:2010},
 {id:"mega",votes:900000,rating:8,year:2014}
];
const sorted=gkmSortVotesFirstV67(list).map(x=>x.id);
console.log(JSON.stringify(sorted));
if(sorted.join(",")!=="mega,fat,tenk,thousand,hundred,tiny") process.exit(2);
