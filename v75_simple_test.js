
function gkmHasRealPosterV74(m) {
  const p = String(m && m.poster || "").trim().toLowerCase();
  if (!p || p.length < 8) return false;
  if (m && m.posterFallback) return false;
  if (p.includes("dummyimage.com")) return false;
  return true;
}
function gkmRealPosterFirstV75(items) {
  const list = Array.isArray(items) ? items : [];
  const real = list.filter(gkmHasRealPosterV74);
  const fallback = list.filter(x => !gkmHasRealPosterV74(x));
  return [...real, ...fallback];
}
const out = gkmRealPosterFirstV75([
 {id:"dummy_giant", poster:"https://dummyimage.com/a.png", posterFallback:true},
 {id:"real_30k", poster:"https://image.tmdb.org/t/p/w500/a.jpg"},
 {id:"real_10k", poster:"https://x.test/b.jpg"}
]).map(x=>x.id);
console.log(JSON.stringify(out));
if (out.join(",") !== "real_30k,real_10k,dummy_giant") process.exit(1);
