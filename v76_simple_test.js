
function gkmHasRealPosterV74(m) {
 const p=String(m&&m.poster||"").trim().toLowerCase();
 if(!p||p.length<8) return false;
 if(m&&m.posterFallback) return false;
 if(p.includes("dummyimage.com")) return false;
 return true;
}
function gkmVisiblePosterItemsV76(items) {
 const list=Array.isArray(items)?items:[];
 const real=list.filter(gkmHasRealPosterV74);
 return real.length ? real : list.filter(x => !String(x && x.poster || "").includes("dummyimage.com"));
}
function gkmGenericQueryTabV76(q) {
 const s=String(q||"").toLowerCase().replace(/ё/g,"е").trim();
 if(["фильм","фильмы","кино","movies","movie"].includes(s)) return "movies";
 if(["сериал","сериалы","series","show","shows"].includes(s)) return "series";
 if(["мульт","мультик","мультики","мультфильм","мультфильмы","cartoon","cartoons"].includes(s)) return "cartoons";
 if(["аниме","anime","анимэ"].includes(s)) return "anime";
 return "";
}
const out=gkmVisiblePosterItemsV76([
 {id:"dummy",poster:"https://dummyimage.com/a.png",posterFallback:true},
 {id:"real",poster:"https://image.tmdb.org/a.jpg"}
]).map(x=>x.id);
console.log(JSON.stringify({out,film:gkmGenericQueryTabV76("фильм"),anime:gkmGenericQueryTabV76("аниме")}));
if(out.join(",")!=="real") process.exit(2);
if(gkmGenericQueryTabV76("фильм")!=="movies") process.exit(3);
