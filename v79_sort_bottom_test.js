
function gkmHasRealPosterV74(m){const p=String(m&&m.poster||"").toLowerCase(); return p && !p.includes("dummyimage.com") && !m.posterFallback}
function gkmNoPosterBottomV79(items){const list=Array.isArray(items)?items:[]; const real=list.filter(gkmHasRealPosterV74); const missing=list.filter(x=>!gkmHasRealPosterV74(x)); return [...real,...missing];}
const ids=gkmNoPosterBottomV79([{id:"d",poster:"https://dummyimage.com/a.png",posterFallback:true},{id:"r",poster:"https://image.tmdb.org/r.jpg"}]).map(x=>x.id);
console.log(JSON.stringify(ids)); if(ids.join(",")!=="r,d") process.exit(1);
