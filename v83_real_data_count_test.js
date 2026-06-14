const fs = require("fs");
const path = require("path");

const root = __dirname;
const searchPath = path.join(root, "data", "fast", "search_index.json");
const metaPath = path.join(root, "data", "fast", "meta.json");

function ok(name, condition) {
  if (!condition) throw new Error("FAIL: " + name);
  console.log("OK:", name);
}

function norm(value) {
  return String(value || "").toLowerCase().replace(/ё/g, "е");
}

function typeOf(item) {
  const text = norm([
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
  ].filter(Boolean).join(" "));

  if (text.includes("аниме") || text.includes("anime") || text.includes("myanimelist") || text.includes("jikan")) return "anime";
  if (text.includes("мульт")) return "cartoons";
  if (text.includes("сериал") || text.includes("series") || text.includes("tv")) return "series";
  return "movies";
}

function posterValue(item) {
  return String(item && (
    item.poster || item.poster_path || item.posterUrl || item.poster_url ||
    item.image || item.imageUrl || item.cover || item.coverUrl || item.img || ""
  ) || "").trim();
}

function hasPoster(item) {
  const p = posterValue(item).toLowerCase();
  if (!p || p === "null" || p === "undefined" || p === "n/a") return false;
  if (p.includes("dummyimage.com") || p.includes("placeholder") || p.includes("no-poster") || p.includes("noposter")) return false;
  return /^https?:\/\//i.test(p) || p.startsWith("data:image/");
}

ok("fast search index exists", fs.existsSync(searchPath));
ok("fast meta exists", fs.existsSync(metaPath));

const list = JSON.parse(fs.readFileSync(searchPath, "utf8"));
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

const count = {
  total: list.length,
  posters: 0,
  noPosters: 0,
  byType: {
    movies: { total: 0, posters: 0 },
    series: { total: 0, posters: 0 },
    anime: { total: 0, posters: 0 },
    cartoons: { total: 0, posters: 0 }
  },
  metaPages: meta.pages || {}
};

for (const item of list) {
  const type = typeOf(item);
  const poster = hasPoster(item);
  count.byType[type].total += 1;
  if (poster) {
    count.posters += 1;
    count.byType[type].posters += 1;
  } else {
    count.noPosters += 1;
  }
}

ok("all fast records have posters", count.total === count.posters && count.noPosters === 0);
ok("meta total matches fast search index", Number(meta.count) === count.total);

console.log("COUNT_TOTAL:", count.total);
console.log("COUNT_POSTERS:", count.posters);
console.log("COUNT_NO_POSTERS:", count.noPosters);
console.log("COUNT_MOVIES_META:", meta.pages.movies.count);
console.log("COUNT_SERIES_META:", meta.pages.series.count);
console.log("COUNT_ANIME_META:", meta.pages.anime.count);
console.log("COUNT_CARTOONS_META:", meta.pages.cartoons.count);
console.log("COUNT_BY_TYPE_SCAN:", JSON.stringify(count.byType));
