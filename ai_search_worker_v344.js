/* GKM V344 FULL CATALOG AI SEARCH WORKER */
"use strict";

const VERSION = "v344.8-double-hard-filter-year-genre-votes-2026-07-12";
const DB_NAME = "gkm_ai_search_v3448";
const DB_VERSION = 1;
const STORE_NAME = "chunks";
const DEFAULT_BASE = "data/fast/poster_wall_v333";
const KIND_NAMES = ["movies", "series", "anime", "cartoons"];

let baseUrl = DEFAULT_BASE;
let manifest = null;
let manifestKey = "";
let dbPromise = null;
let cacheHits = 0;
let networkLoads = 0;
const kindPools = new Map();
const kindPromises = new Map();

function text(value) {
  return String(value == null ? "" : value).trim();
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’`]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function decodePoster(code) {
  const raw = text(code);
  if (raw.startsWith("t:")) return `https://image.tmdb.org/t/p/w342/${raw.slice(2)}`;
  if (raw.startsWith("m:")) return `https://cdn.myanimelist.net/${raw.slice(2)}`;
  return raw.startsWith("u:") ? raw.slice(2) : raw;
}

function compactToItem(row, fallbackKind) {
  if (!Array.isArray(row)) {
    const item = row && typeof row === "object" ? row : null;
    if (!item) return null;
    return prepareItem(item, fallbackKind);
  }
  const typeMap = ["Фильм", "Сериал", "Аниме", "Мультфильм"];
  const kindMap = ["movies", "series", "anime", "cartoons"];
  const typeCode = typeof row[4] === "number" ? row[4] : -1;
  return prepareItem({
    id: row[0],
    ru: row[1] || "",
    en: row[2] || "",
    year: row[3] || "",
    type: typeCode >= 0 ? (typeMap[typeCode] || "Каталог") : (row[4] || "Каталог"),
    rating: Number(row[5] || 0),
    votes: Number(row[6] || 0),
    poster: decodePoster(row[7]),
    genres: typeof row[8] === "string" ? row[8].split("|").filter(Boolean) : (row[8] || []),
    source: row[9] || "",
    status: row[10] || "",
    __gkmV343Compact: true,
    __kind: typeCode >= 0 ? kindMap[typeCode] : fallbackKind
  }, fallbackKind);
}

function detectKindFromType(type, fallbackKind) {
  const n = normalize(type);
  if (n.includes("аниме") || n.includes("anime")) return "anime";
  if (n.includes("мульт") || n.includes("cartoon")) return "cartoons";
  if (n.includes("сериал") || n.includes("series") || n.includes("show")) return "series";
  if (n.includes("фильм") || n.includes("movie") || n.includes("film")) return "movies";
  return fallbackKind || "movies";
}

function prepareItem(item, fallbackKind) {
  const title = text(item.ru || item.title_ru || item.title || item.name || item.en || item.original_title || item.original_name) || "Без названия";
  const original = text(item.en || item.original_title || item.original_name || "");
  const type = text(item.type || item.category || item.kind || "Каталог");
  const genres = Array.isArray(item.genres)
    ? item.genres.map(x => text(x && typeof x === "object" ? x.name : x)).filter(Boolean)
    : (typeof item.genres === "string" ? item.genres.split(/[,|/;]+/).map(text).filter(Boolean) : []);
  const kind = item.__kind || detectKindFromType(type, fallbackKind);
  const yearMatch = text(item.year || item.release_date || item.first_air_date).match(/(19\d{2}|20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : Number(item.year || 0);
  const rating = Number(item.rating || item.vote_average || item.score || 0);
  const votes = Number(item.votes || item.vote_count || item.scored_by || item.members || 0);
  const overview = text(item.overview || item.description || item.synopsis || item.plot || "");
  const hay = normalize([title, original, type, genres.join(" "), overview, item.source, item.status].filter(Boolean).join(" "));
  return {
    id: item.id || item.kinopoiskId || item.tmdbId || item.mal_id || "",
    ru: title,
    en: original,
    year: year || "",
    type,
    rating,
    votes,
    poster: text(item.poster || item.poster_url || item.image || item.cover || ""),
    genres,
    source: text(item.source || ""),
    status: text(item.status || ""),
    overview,
    __kind: kind,
    __titleN: normalize(title),
    __rawN: normalize(`${title} ${original}`),
    __genresN: normalize(genres.join(" ")),
    __typeN: normalize(type),
    __hay: hay
  };
}

function publicItem(item) {
  return {
    id: item.id,
    ru: item.ru,
    en: item.en,
    year: item.year,
    type: item.type,
    rating: item.rating,
    votes: item.votes,
    poster: item.poster,
    genres: item.genres,
    source: item.source,
    status: item.status,
    overview: item.overview,
    __gkmV343Compact: true
  };
}

function openDb() {
  if (!("indexedDB" in self)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function dbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function dbPut(key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function cleanupOldCache(prefix) {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      for (const key of req.result || []) {
        if (typeof key === "string" && !key.startsWith(prefix)) store.delete(key);
      }
    };
  } catch {}
}

function absolute(path) {
  return new URL(path, self.location.href).href;
}

async function fetchManifest(force = false) {
  if (manifest && !force) return manifest;
  const url = absolute(`${baseUrl}/manifest.json?v=343&t=${force ? Date.now() : "init"}`);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`manifest ${response.status}`);
  const next = await response.json();
  const nextKey = text(next.generatedAt || next.version || next.total || "unknown").replace(/[^\w.-]+/g, "_");
  if (manifestKey && manifestKey !== nextKey) {
    kindPools.clear();
    kindPromises.clear();
  }
  manifest = next || {};
  manifestKey = nextKey || "unknown";
  cleanupOldCache(`${manifestKey}:`).catch(() => {});
  return manifest;
}

async function fetchChunk(file, kind) {
  const key = `${manifestKey}:${file}`;
  const cached = await dbGet(key);
  if (cached && Array.isArray(cached.rows)) {
    cacheHits += 1;
    return cached.rows;
  }
  const url = absolute(`${baseUrl}/${file}?v=${encodeURIComponent(manifestKey)}`);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${file} ${response.status}`);
  const rows = await response.json();
  networkLoads += 1;
  if (Array.isArray(rows)) dbPut(key, { kind, rows, savedAt: Date.now() }).catch(() => {});
  return Array.isArray(rows) ? rows : [];
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

async function loadKind(kind, requestId) {
  if (kindPools.has(kind)) return kindPools.get(kind);
  if (kindPromises.has(kind)) return kindPromises.get(kind);
  const promise = (async () => {
    const m = await fetchManifest();
    const info = m && m.kinds && m.kinds[kind];
    if (!info) return [];
    const files = Array.isArray(info.files) ? info.files : [];
    let completed = 0;
    let itemCount = 0;
    const chunks = await mapLimit(files, 4, async file => {
      const rows = await fetchChunk(file, kind);
      completed += 1;
      itemCount += rows.length;
      self.postMessage({
        type: "PROGRESS",
        id: requestId,
        phase: "loading",
        kind,
        loadedFiles: completed,
        totalFiles: files.length,
        loadedItems: itemCount,
        expectedItems: Number(info.count || 0)
      });
      return rows;
    });
    const pool = [];
    const seen = new Set();
    for (const rows of chunks) {
      for (const row of rows || []) {
        const item = compactToItem(row, kind);
        if (!item) continue;
        const key = `${item.id}|${item.__titleN}|${item.year}|${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(item);
      }
    }
    kindPools.set(kind, pool);
    return pool;
  })().finally(() => kindPromises.delete(kind));
  kindPromises.set(kind, promise);
  return promise;
}

function strictGenreWords(mood) {
  const map = {
    horror: ["ужас", "horror"],
    sci: ["фантаст", "science fiction", "sci fi", "sci-fi"],
    fantasy: ["фэнтези", "fantasy"],
    detective: ["детектив", "detective", "mystery"],
    romance: ["романтика", "мелодрама", "romance"],
    sport: ["спорт", "sport"],
    school: ["школа", "school"]
  };
  return map[mood] || [];
}

function moodWords(mood) {
  const map = {
    isekai: ["исекай", "isekai", "попадан", "перерождение", "реинкарнация", "другой мир", "summoned", "reincarnation", "another world"],
    evening: ["драма", "комедия", "приключения", "триллер", "adventure", "drama", "comedy", "thriller"],
    sci: ["фантастика", "космос", "space", "sci", "science", "future", "киберпанк"],
    fantasy: ["фэнтези", "магия", "magic", "fantasy", "dragon", "rpg"],
    dark: ["мрач", "dark", "grim", "thriller", "psychological", "драма", "триллер"],
    horror: ["ужасы", "horror", "мистика", "supernatural", "thriller"],
    detective: ["детектив", "криминал", "crime", "mystery", "detective"],
    romance: ["романтика", "любовь", "romance", "love"],
    light: ["комедия", "семейное", "comedy", "family", "adventure"],
    sport: ["спорт", "sport"],
    school: ["школа", "school", "slice"]
  };
  return map[mood] || [];
}

function clean(item) {
  if (!item || !item.__titleN || item.__titleN === "без названия") return false;
  const current = new Date().getFullYear();
  if (item.year && item.year > current + 3) return false;
  return !["trailer", "teaser", "preview", "recap", "summary", "soundtrack", "трейлер", "тизер", "превью", "рекап"]
    .some(x => item.__hay.includes(x));
}

function parseHardConstraints(query, supplied) {
  const q = normalize(query || "");
  const hard = Object.assign({
    bucket: "all",
    yearMin: 0,
    yearMax: 9999,
    exactYear: false,
    genre: "",
    genreWords: [],
    minVotes: 0,
    popularityFirst: false
  }, supplied || {});

  if (!hard.bucket || hard.bucket === "all") {
    if (/\bфильм\w*|\bкино\b|\bmovie\w*|\bfilm\w*/.test(q)) hard.bucket = "movies";
    else if (/\bсериал\w*|\bseries\b|\bshow\b/.test(q)) hard.bucket = "series";
    else if (/\bаниме\b|\bанимэ\b|\banime\b/.test(q)) hard.bucket = "anime";
    else if (/\bмульт\w*|\bcartoon\w*/.test(q)) hard.bucket = "cartoons";
  }

  if (!hard.exactYear) {
    const range = q.match(/(?:от|с)\s*(19\d{2}|20\d{2})\s*(?:до|по|-)\s*(19\d{2}|20\d{2})/);
    if (range) {
      hard.yearMin = Number(range[1]);
      hard.yearMax = Number(range[2]);
      hard.exactYear = true;
    } else {
      const years = [...q.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => Number(m[1]));
      if (years.length) {
        hard.yearMin = Math.min(...years);
        hard.yearMax = Math.max(...years);
        hard.exactYear = true;
      }
    }
  }

  if (!hard.genreWords || !hard.genreWords.length) {
    const defs = [
      ["horror", /ужас|хоррор|страш/, ["ужас", "horror"]],
      ["sci", /фантаст|sci[\s-]?fi/, ["фантаст", "science fiction", "sci fi"]],
      ["fantasy", /фэнтези|fantasy/, ["фэнтези", "fantasy"]],
      ["detective", /детектив|расслед|mystery/, ["детектив", "detective", "mystery"]],
      ["crime", /криминал|crime/, ["криминал", "crime"]],
      ["thriller", /триллер|thriller/, ["триллер", "thriller"]],
      ["comedy", /комед|смешн|comedy/, ["комед", "comedy"]],
      ["drama", /драм|drama/, ["драм", "drama"]],
      ["romance", /романт|мелодрам|любов|romance/, ["романт", "мелодрам", "romance"]],
      ["action", /боевик|action/, ["боевик", "action"]],
      ["adventure", /приключ|adventure/, ["приключ", "adventure"]]
    ];
    const found = defs.find(def => def[1].test(q));
    if (found) {
      hard.genre = found[0];
      hard.genreWords = found[2];
    }
  }

  const isSelection =
    hard.bucket !== "all" ||
    Boolean(hard.genre) ||
    Boolean(hard.exactYear) ||
    /посоветуй|подбери|найди|покажи|дай|топ|лучшие|популяр|на вечер|что посмотреть/.test(q);

  if (isSelection && !/без ограничения по голосам|не учитывать голоса/.test(q)) {
    hard.minVotes = Math.max(Number(hard.minVotes || 0), 500);
    hard.popularityFirst = true;
  }
  return hard;
}

function matchesHard(item, hard) {
  if (!item || !hard) return false;
  if (hard.bucket && hard.bucket !== "all" && item.__kind !== hard.bucket) return false;

  if (hard.exactYear) {
    if (!item.year || item.year < Number(hard.yearMin) || item.year > Number(hard.yearMax)) return false;
  }

  if ((item.votes || 0) < Number(hard.minVotes || 0)) return false;

  const required = Array.isArray(hard.genreWords)
    ? hard.genreWords.map(normalize).filter(Boolean)
    : [];
  if (required.length) {
    if (!item.__genresN || !required.some(word => item.__genresN.includes(word))) return false;
  }
  return true;
}

function scoreItem(item, intent, tokens) {
  if (!clean(item)) return 0;
  if (intent.bucket && intent.bucket !== "all" && item.__kind !== intent.bucket) return 0;
  if (item.year && (item.year < Number(intent.yearMin || 0) || item.year > Number(intent.yearMax || 9999))) return 0;
  if (item.rating < Number(intent.ratingMin || 0) || item.rating > Number(intent.ratingMax || 10)) return 0;
  if ((item.votes || 0) < Number(intent.minVotes || 0)) return 0;
  if (intent.strictGenre) {
    const required = strictGenreWords(intent.mood).map(normalize).filter(Boolean);
    if (required.length && !required.some(word => item.__genresN.includes(word))) return 0;
  }
  let score = 0;
  for (const rawToken of tokens || []) {
    const token = normalize(rawToken);
    if (!token) continue;
    if (item.__titleN === token || item.__rawN === token) score += 220;
    else if (item.__titleN.includes(token)) score += 100;
    else if (item.__rawN.includes(token)) score += 78;
    else if (item.__genresN.includes(token)) score += 68;
    else if (item.__typeN.includes(token)) score += 24;
    else if (item.__hay.includes(token)) score += 26;
  }
  for (const raw of moodWords(intent.mood)) {
    const mood = normalize(raw);
    if (!mood) continue;
    if (item.__genresN.includes(mood)) score += 88;
    else if (item.__titleN.includes(mood) || item.__rawN.includes(mood)) score += 48;
    else if (item.__hay.includes(mood)) score += 46;
  }
  if (intent.bucket && intent.bucket !== "all") score += 52;
  const rating = item.rating || 0;
  const votes = item.votes || 0;
  if (intent.popularityFirst) {
    score += Math.min(520, Math.log10(votes + 1) * 78);
    if (votes >= Number(intent.popularPriorityVotes || 1000000)) score += 220;
    else if (votes >= 500000) score += 185;
    else if (votes >= 100000) score += 145;
    else if (votes >= 10000) score += 95;
    else if (votes >= 1000) score += 55;
  }
  if (intent.sort === "top") score += Math.min(150, Math.log10(votes + 1) * 22) + rating * 12;
  else if (intent.sort === "new") score += item.year >= 2020 ? (item.year - 2019) * 14 : 0;
  else if (intent.sort === "hidden") score += rating * 12 - Math.min(50, Math.log10(votes + 1) * 8);
  else score += Math.min(72, Math.log10(votes + 1) * 10) + rating * 7;
  return score;
}

function insertTop(top, entry, limit) {
  let low = 0;
  let high = top.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (top[mid].score >= entry.score) low = mid + 1;
    else high = mid;
  }
  top.splice(low, 0, entry);
  if (top.length > limit) top.pop();
}

function dedupeTop(entries, limit) {
  const result = [];
  const seen = new Set();
  for (const entry of entries) {
    const item = entry.item;
    const key = `${item.__kind}|${item.__titleN}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
    if (result.length >= limit) break;
  }
  return result;
}

async function runSearch(message) {
  const requestId = message.id;
  const intent = message.intent || { bucket: "all", yearMin: 0, yearMax: 9999, sort: "smart" };
  const hard = parseHardConstraints(message.query || "", message.hardConstraints || {});
  const tokens = Array.isArray(message.tokens) ? message.tokens : words(message.query || "");
  const resultLimit = Math.max(1, Math.min(200, Number(message.limit || 120)));
  const topLimit = Math.max(resultLimit * 5, 300);

  if (hard.bucket && hard.bucket !== "all") intent.bucket = hard.bucket;
  if (hard.exactYear) {
    intent.yearMin = hard.yearMin;
    intent.yearMax = hard.yearMax;
  }
  intent.minVotes = Math.max(Number(intent.minVotes || 0), Number(hard.minVotes || 0));
  intent.popularityFirst = Boolean(intent.popularityFirst || hard.popularityFirst);

  const kinds = intent.bucket && intent.bucket !== "all" ? [intent.bucket] : KIND_NAMES.slice();
  const pools = [];
  for (const kind of kinds) pools.push(await loadKind(kind, requestId));

  self.postMessage({
    type: "PROGRESS",
    id: requestId,
    phase: "scanning",
    scanned: 0,
    total: pools.reduce((sum, pool) => sum + pool.length, 0)
  });

  const top = [];
  let scanned = 0;
  const total = pools.reduce((sum, pool) => sum + pool.length, 0);

  for (const pool of pools) {
    for (const item of pool) {
      // FIRST NON-NEGOTIABLE CHECK IN THE WORKER.
      if (!matchesHard(item, hard)) {
        scanned += 1;
        continue;
      }

      const score = scoreItem(item, intent, tokens);
      if (score > 0) insertTop(top, { item, score }, topLimit);
      scanned += 1;

      if (scanned % 12000 === 0) {
        self.postMessage({ type: "PROGRESS", id: requestId, phase: "scanning", scanned, total });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  let entries = dedupeTop(top, resultLimit);

  // Hard fallback: constraints remain active; nothing is relaxed.
  if (!entries.length) {
    const fallback = [];
    for (const pool of pools) {
      for (const item of pool) {
        if (!clean(item) || !matchesHard(item, hard)) continue;
        const popularity = (item.votes || 0) * 1000 + (item.rating || 0) * 10;
        insertTop(fallback, { item, score: popularity }, topLimit);
      }
    }
    entries = dedupeTop(fallback, resultLimit);
  }

  entries.sort((a, b) =>
    (b.item.votes || 0) - (a.item.votes || 0) ||
    (b.item.rating || 0) - (a.item.rating || 0)
  );

  return {
    items: entries.slice(0, resultLimit).map(entry => publicItem(entry.item)),
    scores: entries.slice(0, resultLimit).map(entry => Math.round(entry.score * 100) / 100),
    searched: total,
    kinds,
    hardConstraints: hard,
    manifestTotal: Number(manifest && manifest.total || total),
    counts: Object.fromEntries(KIND_NAMES.map(kind => [
      kind,
      Number(manifest && manifest.kinds && manifest.kinds[kind] && manifest.kinds[kind].count || 0)
    ])),
    loadedCounts: Object.fromEntries(KIND_NAMES.map(kind => [
      kind,
      (kindPools.get(kind) || []).length
    ])),
    cacheHits,
    networkLoads,
    manifestVersion: manifestKey
  };
}

function statusPayload() {
  return {
    version: VERSION,
    ready: Boolean(manifest),
    manifestTotal: Number(manifest && manifest.total || 0),
    counts: Object.fromEntries(KIND_NAMES.map(kind => [kind, Number(manifest && manifest.kinds && manifest.kinds[kind] && manifest.kinds[kind].count || 0)])),
    loadedCounts: Object.fromEntries(KIND_NAMES.map(kind => [kind, (kindPools.get(kind) || []).length])),
    loadedKinds: KIND_NAMES.filter(kind => kindPools.has(kind)),
    cacheHits,
    networkLoads,
    manifestVersion: manifestKey,
    indexedDb: "indexedDB" in self
  };
}

self.onmessage = async event => {
  const message = event.data || {};
  const id = message.id;
  try {
    if (message.type === "INIT") {
      baseUrl = text(message.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
      await fetchManifest(true);
      self.postMessage({ type: "RESULT", id, result: statusPayload() });
      return;
    }
    if (message.type === "STATUS") {
      if (!manifest) await fetchManifest();
      self.postMessage({ type: "RESULT", id, result: statusPayload() });
      return;
    }
    if (message.type === "REFRESH") {
      await fetchManifest(true);
      self.postMessage({ type: "RESULT", id, result: statusPayload() });
      return;
    }
    if (message.type === "SEARCH") {
      if (!manifest) await fetchManifest();
      const result = await runSearch(message);
      self.postMessage({ type: "RESULT", id, result });
      return;
    }
    self.postMessage({ type: "ERROR", id, error: `Unknown message type: ${message.type}` });
  } catch (error) {
    self.postMessage({ type: "ERROR", id, error: String(error && error.message || error) });
  }
};
