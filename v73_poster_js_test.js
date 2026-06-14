
globalThis.window=globalThis;
function titleOf(m){return m.ru||m.en||"Без названия"}
function getType(m){return m.type||"Фильм"}
function getYear(m){return String(m.year||"")}
function escapeAttr(s){return String(s).replace(/"/g,'&quot;')}
/* === GKM V73 POSTER REPAIR === */
function gkmPosterFallbackV73(m) {
  const type = getType(m);
  const title = encodeURIComponent(titleOf(m) || "Без постера");
  const sub = encodeURIComponent(`${getYear(m) || "—"} · ${type}`);
  const colors = {
    "Фильм": ["1b2a6b", "08d9ff"],
    "Сериал": ["0b3d52", "47eaff"],
    "Аниме": ["3a1478", "9d4dff"],
    "Мультфильм": ["5a2360", "ff6bd6"]
  }[type] || ["141428", "00e5ff"];
  return `https://dummyimage.com/420x630/${colors[0]}/${colors[1]}.png&text=${title}%0A${sub}`;
}

function gkmPosterSrcV73(m) {
  const p = String(m && m.poster || "").trim();
  if (!p || p === "null" || p === "undefined" || p.length < 8) return gkmPosterFallbackV73(m);
  if (/^http:\/\//i.test(p)) return p.replace(/^http:/i, "https:");
  return p;
}

function gkmPosterErrorV73(img) {
  try {
    img.onerror = null;
    img.src = img.dataset.fallback || "https://dummyimage.com/420x630/141428/00e5ff.png&text=%D0%9D%D0%B5%D1%82%20%D0%BF%D0%BE%D1%81%D1%82%D0%B5%D1%80%D0%B0";
    img.classList.add("poster-fallback-img");
    window.GKM_POSTER_FALLBACK_HITS = (window.GKM_POSTER_FALLBACK_HITS || 0) + 1;
  } catch(e) {}
}

window.GKM_POSTER_REPAIR_VERSION = "v73-poster-repair-tested-2026-06-13";
/* === /GKM V73 POSTER REPAIR === */
function posterHtml(m) {
  const src = gkmPosterSrcV73(m);
  const fallback = gkmPosterFallbackV73(m);
  return `<img src="${escapeAttr(src)}" data-fallback="${escapeAttr(fallback)}" loading="lazy" decoding="async" alt="" onerror="gkmPosterErrorV73(this)">`;
}
const a=posterHtml({ru:"День сурка",type:"Фильм",year:1995,poster:""});
const b=posterHtml({ru:"X",type:"Фильм",year:2020,poster:"http://x.test/a.jpg"});
console.log(JSON.stringify({a:a.includes("dummyimage.com"), b:b.includes("https://x.test/a.jpg"), onerr:a.includes("gkmPosterErrorV73")}));
if(!a.includes("dummyimage.com")) process.exit(2);
if(!b.includes("https://x.test/a.jpg")) process.exit(3);
if(!a.includes("onerror")) process.exit(4);
