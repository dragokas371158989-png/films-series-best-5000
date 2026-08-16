/* GKM V383.1 PWA shell + fast automatic repair and working compare. */
const VERSION = "v3831-fast-auto-repair-compare-2026-08-16";
const SHELL_CACHE = `gkm-shell-${VERSION}`;
const RECENT_CACHE = `gkm-recent-${VERSION}`;
const CACHE_PREFIX = "gkm-";
const SHELL_URLS = [
  "./","./index.html","./style.css?v=3751","./app.js?v=3810",
  "./gkm_v376_v380.js?v=3810","./gkm_v382_feature_center.js?v=3831",
  "./ai_search_worker_v343.js?v=3751",
  "./manifest.webmanifest?v=3753","./logo-banner.webp","./pwa-icon-192.png","./pwa-icon-512.png"
];
const HEAVY_CATALOG_PATTERN=/(?:search_index|search_shards|poster_wall|poster_atlas|catalog|full[_-]?data|all[_-]?(?:movies|series|anime|cartoons))|\/data\/.*(?:page|chunk|shard)/i;

self.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await Promise.allSettled(SHELL_URLS.map(url=>cache.add(url)));await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&![SHELL_CACHE,RECENT_CACHE].includes(n)).map(n=>caches.delete(n)));await self.clients.claim();})()));

async function trimCache(name,max){const cache=await caches.open(name),keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(k=>cache.delete(k)));}
async function injectLayer(response){
  const type=response.headers.get("content-type")||"";
  if(!response.ok||!type.includes("text/html"))return response;
  let patched=await response.text();
  if(!patched.includes("gkm_v376_v380.js"))patched=patched.replace(/<\/body>/i,'<script src="gkm_v376_v380.js?v=3810" defer></script></body>');
  if(!patched.includes("gkm_v382_feature_center.js"))patched=patched.replace(/<\/body>/i,'<script src="gkm_v382_feature_center.js?v=3831" defer></script></body>');
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}
async function navigation(request){
  const recent=await caches.open(RECENT_CACHE);
  try{const response=await fetch(request);if(response&&response.ok){await recent.put(request,response.clone());await trimCache(RECENT_CACHE,16);}return injectLayer(response);}
  catch{const fallback=(await recent.match(request))||(await caches.match("./index.html",{ignoreSearch:true}))||(await caches.match("./",{ignoreSearch:true}));return fallback?injectLayer(fallback):Response.error();}
}
async function shellFirst(request){const cache=await caches.open(SHELL_CACHE);const cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response&&response.ok)await cache.put(request,response.clone());return response;}

self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);
  if(HEAVY_CATALOG_PATTERN.test(url.pathname+url.search))return;
  if(request.mode==="navigate"){event.respondWith(navigation(request));return;}
  if(url.origin!==self.location.origin)return;
  const names=new Set(["index.html","style.css","app.js","gkm_v376_v380.js","gkm_v382_feature_center.js","ai_search_worker_v343.js","manifest.webmanifest","logo-banner.webp","pwa-icon-192.png","pwa-icon-512.png"]);
  const file=url.pathname.split("/").pop();if(names.has(file)||url.pathname.endsWith("/"))event.respondWith(shellFirst(request));
});
self.addEventListener("message",event=>{
  const data=event.data||{};if(data.type!=="GKM_CACHE_RECENT"||!Array.isArray(data.urls))return;
  const urls=data.urls.slice(0,4).filter(v=>/^https?:\/\//i.test(String(v||"")));
  event.waitUntil((async()=>{const cache=await caches.open(RECENT_CACHE);await Promise.allSettled(urls.map(async v=>{const req=new Request(v,{mode:"no-cors",credentials:"omit"}),res=await fetch(req);if(res)await cache.put(req,res);}));await trimCache(RECENT_CACHE,40);})());
});
