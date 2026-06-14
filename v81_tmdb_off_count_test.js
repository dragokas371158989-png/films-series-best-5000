const fs = require("fs");
const path = require("path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function ok(name, condition) {
  if (!condition) throw new Error("FAIL: " + name);
  console.log("OK:", name);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function extractItems(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of ["items", "movies", "data", "results", "records", "list"]) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

function typeOf(item) {
  const text = String([
    item.type,
    item.kind,
    item.category,
    item.source,
    item.provider,
    item.title,
    item.name,
    item.ru,
    item.en,
    Array.isArray(item.genres) ? item.genres.join(" ") : item.genres
  ].filter(Boolean).join(" ")).toLowerCase();

  if (text.includes("аниме") || text.includes("anime")) return "anime";
  if (text.includes("мульт")) return "cartoon";
  if (text.includes("сериал") || text.includes("series") || text.includes("tv")) return "series";
  return "movie";
}

function collectJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...collectJsonFiles(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

const dataFiles = collectJsonFiles(path.join(root, "data"));
let items = [];
for (const file of dataFiles) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (rel === "data/fast/meta.json" || rel === "data/index.json") continue;
  items.push(...extractItems(readJson(file)));
}

const counts = items.reduce((acc, item) => {
  acc[typeOf(item)] += 1;
  return acc;
}, { movie: 0, series: 0, anime: 0, cartoon: 0 });

ok("TMDB flag is off", /const\s+TMDB_ENABLED\s*=\s*false/.test(app));
ok("TMDB fetch guard exists", app.includes("blockTmdbRequest") && app.includes("__GKM_TMDB_FETCH_GUARD__"));
ok("TMDB API hosts are blocked", /themoviedb\\\.org/.test(app) && /api\\\.tmdb\\\.org/.test(app));
ok("local fast database is still selected", app.includes('const FAST_BASE = "data/fast"'));
ok("legacy local index is still selected", app.includes('const LEGACY_INDEX_URL = "data/index.json"'));
ok("no TMDB token remains in app.js", !/TMDB_TOKEN|TMDB_API_KEY|themoviedb[^\\n]+api_key|Authorization["']?\s*:\s*["']?Bearer/i.test(app));

console.log("COUNT_JSON_FILES:", dataFiles.length);
console.log("COUNT_TOTAL_ITEMS:", items.length);
console.log("COUNT_MOVIES:", counts.movie);
console.log("COUNT_SERIES:", counts.series);
console.log("COUNT_ANIME:", counts.anime);
console.log("COUNT_CARTOONS:", counts.cartoon);
