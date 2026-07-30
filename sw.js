/* GKM V370 PWA: fresh critical shell + explicitly opened posters only. */
const VERSION = "v370-2026-07-30";
const SHELL_CACHE = `gkm-shell-${VERSION}`;
const RECENT_CACHE = `gkm-recent-${VERSION}`;
const CACHE_PREFIX = "gkm-";
const SHELL_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js?v=370",
  "./ai_search_worker_v343.js",
  "./manifest.webmanifest?v=370",
  "./logo-banner.webp",
  "./pwa-icon-192.png",
  "./pwa-icon-512.png"
];
const HEAVY_CATALOG_PATTERN =
  /(?:search_index|search_shards|poster_wall|poster_atlas|catalog|full[_-]?data|all[_-]?(?:movies|series|anime|cartoons))|\/data\/.*(?:page|chunk|shard)/i;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL_URLS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RECENT_CACHE].includes(name))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
}

async function networkFirstNavigation(request) {
  const recent = await caches.open(RECENT_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await recent.put(request, response.clone());
      await trimCache(RECENT_CACHE, 16);
    }
    return response;
  } catch {
    return (await recent.match(request))
      || (await caches.match("./index.html", {ignoreSearch: true}))
      || (await caches.match("./", {ignoreSearch: true}))
      || Response.error();
  }
}

async function currentShellFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (HEAVY_CATALOG_PATTERN.test(url.pathname + url.search)) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const shellNames = new Set([
    "index.html",
    "style.css",
    "app.js",
    "ai_search_worker_v343.js",
    "manifest.webmanifest",
    "logo-banner.webp",
    "pwa-icon-192.png",
    "pwa-icon-512.png"
  ]);
  const fileName = url.pathname.split("/").pop();
  if (shellNames.has(fileName) || url.pathname.endsWith("/")) {
    event.respondWith(currentShellFirst(request));
  }
});

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type !== "GKM_CACHE_RECENT" || !Array.isArray(data.urls)) return;
  const urls = data.urls.slice(0, 4).filter(value => /^https?:\/\//i.test(String(value || "")));
  event.waitUntil((async () => {
    const cache = await caches.open(RECENT_CACHE);
    await Promise.allSettled(urls.map(async value => {
      const request = new Request(value, {mode: "no-cors", credentials: "omit"});
      const response = await fetch(request);
      if (response) await cache.put(request, response);
    }));
    await trimCache(RECENT_CACHE, 40);
  })());
});
