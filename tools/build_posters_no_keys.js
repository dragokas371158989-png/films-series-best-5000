/**
 * GKM V255 — готовый локальный инструмент постеров БЕЗ ключей.
 *
 * Что делает:
 * 1) Проходит по:
 *    - data/games_catalog.json
 *    - data/books_catalog.json
 *    - data/games/*.json
 *    - data/books/*.json
 *
 * 2) Если poster пустой / заглушка / data:image:
 *    - Игры: Steam Store API -> Wikipedia
 *    - Книги: Google Books -> Open Library -> Wikipedia
 *    - Манга: Jikan -> Google Books -> Open Library -> Wikipedia
 *    - Ранобэ: Google Books -> Jikan -> Open Library -> Wikipedia
 *    - Комиксы: Google Books -> Open Library -> Wikipedia
 *
 * 3) Если внешний источник ничего не нашёл:
 *    генерирует свою НОРМАЛЬНУЮ SVG-обложку в assets/generated-posters/
 *    и прописывает путь в poster.
 *
 * 4) Если description пустой/короткий:
 *    пытается дозаполнить description из Google Books / Jikan / Wikipedia.
 *
 * Запуск из корня проекта:
 * node tools/build_posters_no_keys.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const GENERATED_DIR = path.join(ROOT, "assets", "generated-posters");
const REPORT_FILE = path.join(ROOT, "data", "posters_v255_report.json");
const CACHE_FILE = path.join(ROOT, "data", "posters_v255_cache.json");

const TARGET_FILES = [
  path.join(DATA_DIR, "games_catalog.json"),
  path.join(DATA_DIR, "books_catalog.json"),
  ...listJsonFiles(path.join(DATA_DIR, "games")),
  ...listJsonFiles(path.join(DATA_DIR, "books")),
].filter(Boolean);

const cache = readJson(CACHE_FILE, {});
const report = {
  version: "GKM V255 no-key posters enrichment",
  startedAt: new Date().toISOString(),
  files: [],
  updatedPosters: 0,
  generatedPosters: 0,
  updatedDescriptions: 0,
  failed: [],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith(".json"))
    .map(name => path.join(dir, name));
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getArrayContainer(json) {
  if (Array.isArray(json)) return { arr: json, set: arr => arr };
  if (json && Array.isArray(json.items)) return { arr: json.items, set: arr => ({ ...json, items: arr }) };
  if (json && Array.isArray(json.data)) return { arr: json.data, set: arr => ({ ...json, data: arr }) };
  return null;
}

function txt(v) {
  return String(v == null ? "" : v).trim();
}

function norm(v) {
  return txt(v)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(v) {
  return txt(v)
    .replace(/\b(v\d{2,4}|split db\s*\d+\+?)\b/gi, "")
    .replace(/[:\-–—]\s*(том|выпуск|часть|сборник|collection|vol\.?|issue)\s*\d+[a-zа-я0-9-]*/gi, "")
    .replace(/\b(том|выпуск|часть|сборник|collection|vol\.?|issue)\s*\d+[a-zа-я0-9-]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(item) {
  return cleanTitle(item.ru || item.title_ru || item.title || item.name || item.en || item.original_title || item.original_name || "");
}

function typeOf(item, filePath = "") {
  const raw = txt(item.type || item.kind || item.category).toLowerCase();
  const fp = filePath.toLowerCase();

  if (raw.includes("игра") || raw.includes("game") || fp.includes("/games/") || fp.includes("\\games\\") || fp.includes("games_catalog")) return "Игра";
  if (raw.includes("раноб") || raw.includes("light novel") || fp.includes("ranobe")) return "Ранобэ";
  if (raw.includes("манг") || raw.includes("manga") || fp.includes("manga")) return "Манга";
  if (raw.includes("комик") || raw.includes("comic") || fp.includes("comics")) return "Комикс";
  if (raw.includes("книг") || raw.includes("book") || fp.includes("/books/") || fp.includes("\\books\\") || fp.includes("books_catalog")) return "Книга";

  return "";
}

function posterIsBad(value) {
  const s = txt(value).toLowerCase();
  if (!s) return true;
  if (s === "null" || s === "undefined" || s === "n/a") return true;
  if (s.includes("нет постера")) return true;
  if (s.includes("dummyimage")) return true;
  if (s.includes("placeholder")) return true;
  if (s.includes("no-poster") || s.includes("noposter")) return true;
  if (s.startsWith("data:image")) return true;
  return false;
}

function descIsBad(item) {
  const s = txt(item.description || item.description_ru || item.overview || item.overview_ru || item.plot || item.synopsis);
  if (!s) return true;
  if (s.length < 60) return true;
  if (/описание пока не добавлено/i.test(s)) return true;
  return false;
}

function itemId(item, filePath, index) {
  return txt(item.id || item.kinopoiskId || item.tmdbId || item.mal_id || item.slug) ||
    norm(`${typeOf(item, filePath)}-${titleOf(item)}-${item.year || ""}-${index}`);
}

function cacheKey(type, title, year = "") {
  return `${type}|${norm(title)}|${txt(year)}`;
}

function scoreTitle(candidate, title) {
  const a = norm(candidate);
  const b = norm(title);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 80;
  if (a.includes(b) || b.includes(a)) return 60;
  let score = 0;
  for (const p of b.split(" ").filter(x => x.length > 2)) {
    if (a.includes(p)) score += 8;
  }
  return score;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 GKM-Poster-Enricher/255"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.json();
}

async function imageOk(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return true;
  } catch {}
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

function fixGoogleImage(url) {
  let out = txt(url).replace(/^http:/i, "https:");
  out = out.replace(/&edge=curl/gi, "");
  out = out.replace(/zoom=\d+/gi, "zoom=2");
  return out;
}

async function findSteamPoster(title) {
  const q = encodeURIComponent(title);
  const url = `https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=us`;
  const data = await fetchJson(url);
  const items = Array.isArray(data.items) ? data.items : [];

  const best = items
    .map(x => ({ item: x, score: scoreTitle(x.name, title) }))
    .sort((a, b) => b.score - a.score)
    .find(x => x.score >= 45 && x.item && x.item.id);

  if (!best) return "";
  const img = `https://cdn.akamai.steamstatic.com/steam/apps/${best.item.id}/library_600x900_2x.jpg`;
  return (await imageOk(img)) ? img : "";
}

async function findWikipediaPoster(title, type) {
  const query = type === "Игра" ? `${title} video game` :
    type === "Манга" ? `${title} manga` :
    type === "Комикс" ? `${title} comic book` :
    type === "Ранобэ" ? `${title} light novel` :
    `${title} novel`;

  const search = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=pageimages&pithumbsize=900&piprop=thumbnail`);

  const pages = Object.values(search?.query?.pages || {});
  const best = pages
    .map(x => ({ item: x, score: scoreTitle(x.title, title) }))
    .sort((a, b) => b.score - a.score)
    .find(x => x.score >= 25 && x.item?.thumbnail?.source);

  return best?.item?.thumbnail?.source || "";
}

async function findWikipediaDescription(title, type) {
  const query = type === "Игра" ? `${title} video game` :
    type === "Манга" ? `${title} manga` :
    type === "Комикс" ? `${title} comic book` :
    type === "Ранобэ" ? `${title} light novel` :
    `${title} novel`;

  try {
    const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    return txt(summary.extract || "");
  } catch {
    return "";
  }
}

async function findGoogleBooks(title, year = "") {
  const queries = [
    `intitle:"${title}" ${year}`,
    `intitle:${title} ${year}`,
    `${title} ${year}`,
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=7&printType=books`);
      const items = Array.isArray(data.items) ? data.items : [];
      const best = items
        .map(x => ({
          item: x,
          score: scoreTitle(x?.volumeInfo?.title || "", title),
        }))
        .sort((a, b) => b.score - a.score)
        .find(x => x.score >= 35 && x.item?.volumeInfo);

      if (best) {
        const info = best.item.volumeInfo || {};
        const img = info.imageLinks || {};
        const poster = img.extraLarge || img.large || img.medium || img.small || img.thumbnail || img.smallThumbnail || "";
        const description = stripHtml(info.description || "");
        if (poster || description) {
          return {
            poster: poster ? fixGoogleImage(poster) : "",
            description
          };
        }
      }
    } catch {}
  }

  return { poster: "", description: "" };
}

async function findOpenLibraryPoster(title) {
  const data = await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=7`);
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const best = docs
    .map(x => ({ item: x, score: scoreTitle(x.title, title) }))
    .sort((a, b) => b.score - a.score)
    .find(x => x.score >= 35 && (x.item.cover_i || (Array.isArray(x.item.isbn) && x.item.isbn.length) || (Array.isArray(x.item.olid) && x.item.olid.length)));

  if (!best) return "";

  let url = "";
  if (best.item.cover_i) url = `https://covers.openlibrary.org/b/id/${best.item.cover_i}-L.jpg?default=false`;
  else if (best.item.isbn?.length) url = `https://covers.openlibrary.org/b/isbn/${best.item.isbn[0]}-L.jpg?default=false`;
  else if (best.item.olid?.length) url = `https://covers.openlibrary.org/b/olid/${best.item.olid[0]}-L.jpg?default=false`;

  return (await imageOk(url)) ? url : "";
}

async function findJikanManga(title) {
  const data = await fetchJson(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=5`);
  const items = Array.isArray(data.data) ? data.data : [];

  const best = items
    .map(x => ({
      item: x,
      score: scoreTitle(x.title || x.title_english || x.title_japanese || "", title)
    }))
    .sort((a, b) => b.score - a.score)
    .find(x => x.score >= 35);

  if (!best) return { poster: "", description: "" };

  const img = best.item.images || {};
  const poster =
    img.webp?.large_image_url ||
    img.jpg?.large_image_url ||
    img.webp?.image_url ||
    img.jpg?.image_url ||
    "";

  return {
    poster,
    description: stripHtml(best.item.synopsis || "")
  };
}

function stripHtml(html) {
  return txt(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function svgEscape(s) {
  return txt(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(s) {
  const base = norm(s).replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "poster";
}

function wrapWords(title, max = 18) {
  const words = txt(title).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function colorSet(type) {
  if (type === "Игра") return ["#07111f", "#1641ff", "#00d5ff", "🎮", "GAME COVER"];
  if (type === "Манга") return ["#170414", "#b90042", "#ff4fd8", "🗯️", "MANGA COVER"];
  if (type === "Комикс") return ["#091021", "#f4c400", "#ff2c55", "⚡", "COMIC COVER"];
  if (type === "Ранобэ") return ["#12051f", "#6d38ff", "#ffcf5a", "📖", "LIGHT NOVEL"];
  return ["#08131f", "#0ca678", "#00d5ff", "📚", "BOOK COVER"];
}

function makeGeneratedCover(title, type, id) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const [bg, c1, c2, icon, label] = colorSet(type);
  const lines = wrapWords(title, 17);
  const fileName = `${slugify(type)}-${slugify(title)}-${slugify(id)}.svg`;
  const filePath = path.join(GENERATED_DIR, fileName);
  const rel = `assets/generated-posters/${fileName}`;

  const titleLines = lines.map((line, i) =>
    `<text x="50%" y="${360 + i * 58}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${lines.length > 2 ? 42 : 50}" font-weight="900" fill="#ffffff">${svgEscape(line)}</text>`
  ).join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${bg}" offset="0"/>
      <stop stop-color="${c1}" offset="0.58"/>
      <stop stop-color="${c2}" offset="1"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="30%" r="75%">
      <stop stop-color="#ffffff" stop-opacity="0.28" offset="0"/>
      <stop stop-color="#000000" stop-opacity="0" offset="1"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="600" height="900" fill="url(#g)"/>
  <rect width="600" height="900" fill="url(#r)"/>
  <circle cx="95" cy="120" r="110" fill="#ffffff" opacity="0.08"/>
  <circle cx="510" cy="760" r="150" fill="#000000" opacity="0.18"/>
  <path d="M0 700 C130 630 230 760 360 680 C470 610 550 650 600 610 L600 900 L0 900 Z" fill="#000000" opacity="0.22"/>
  <rect x="44" y="44" width="512" height="812" rx="34" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="4"/>

  <text x="50%" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="92" filter="url(#shadow)">${svgEscape(icon)}</text>
  <text x="50%" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#dff7ff" letter-spacing="4">${svgEscape(label)}</text>

  ${titleLines}

  <text x="50%" y="790" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="900" fill="#ffffff" opacity="0.95">ГОЛУБЬ КАТАЛОГ МИРА</text>
  <text x="50%" y="830" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#dff7ff" opacity="0.85">generated cover art</text>
</svg>`;

  fs.writeFileSync(filePath, svg, "utf8");
  return rel;
}

async function resolvePosterAndDescription(item, filePath, index) {
  const title = titleOf(item);
  const type = typeOf(item, filePath);
  const year = txt(item.year || "");
  const id = itemId(item, filePath, index);
  const key = cacheKey(type, title, year);

  if (!title || !type) return { poster: "", description: "" };

  if (cache[key]?.poster && !posterIsBad(cache[key].poster)) {
    return cache[key];
  }

  let found = { poster: "", description: "" };

  try {
    if (type === "Игра") {
      found.poster = await findSteamPoster(title);
      if (!found.poster) found.poster = await findWikipediaPoster(title, type);
      if (!found.description) found.description = await findWikipediaDescription(title, type);
    } else if (type === "Манга") {
      found = await findJikanManga(title);
      if (!found.poster) {
        const gb = await findGoogleBooks(title, year);
        found.poster = gb.poster || found.poster;
        found.description = found.description || gb.description;
      }
      if (!found.poster) found.poster = await findOpenLibraryPoster(title);
      if (!found.poster) found.poster = await findWikipediaPoster(title, type);
      if (!found.description) found.description = await findWikipediaDescription(title, type);
    } else if (type === "Ранобэ") {
      const gb = await findGoogleBooks(title, year);
      found.poster = gb.poster;
      found.description = gb.description;
      if (!found.poster) {
        const jk = await findJikanManga(title);
        found.poster = jk.poster || found.poster;
        found.description = found.description || jk.description;
      }
      if (!found.poster) found.poster = await findOpenLibraryPoster(title);
      if (!found.poster) found.poster = await findWikipediaPoster(title, type);
      if (!found.description) found.description = await findWikipediaDescription(title, type);
    } else if (type === "Комикс") {
      const gb = await findGoogleBooks(title, year);
      found.poster = gb.poster;
      found.description = gb.description;
      if (!found.poster) found.poster = await findOpenLibraryPoster(title);
      if (!found.poster) found.poster = await findWikipediaPoster(title, type);
      if (!found.description) found.description = await findWikipediaDescription(title, type);
    } else if (type === "Книга") {
      const gb = await findGoogleBooks(title, year);
      found.poster = gb.poster;
      found.description = gb.description;
      if (!found.poster) found.poster = await findOpenLibraryPoster(title);
      if (!found.poster) found.poster = await findWikipediaPoster(title, type);
      if (!found.description) found.description = await findWikipediaDescription(title, type);
    }
  } catch (e) {
    report.failed.push({ title, type, error: e.message });
  }

  if (!found.poster) {
    found.poster = makeGeneratedCover(title, type, id);
    found.generated = true;
  }

  cache[key] = found;
  writeJson(CACHE_FILE, cache);
  return found;
}

async function processFile(filePath) {
  const json = readJson(filePath, null);
  const container = getArrayContainer(json);
  if (!container) return;

  let changed = false;
  let posters = 0;
  let descriptions = 0;
  let generated = 0;

  for (let i = 0; i < container.arr.length; i++) {
    const item = container.arr[i];
    if (!item || typeof item !== "object") continue;

    const type = typeOf(item, filePath);
    if (!["Игра", "Книга", "Манга", "Комикс", "Ранобэ"].includes(type)) continue;

    const title = titleOf(item);
    if (!title) continue;

    const needsPoster = posterIsBad(item.poster || item.posterUrl || item.poster_url || item.image || item.cover || item.img);
    const needsDescription = descIsBad(item);

    if (!needsPoster && !needsDescription) continue;

    console.log(`→ ${type}: ${title}`);
    const found = await resolvePosterAndDescription(item, filePath, i);

    if (needsPoster && found.poster) {
      item.poster = found.poster;
      delete item.posterUrl;
      delete item.poster_url;
      delete item.image;
      delete item.cover;
      delete item.img;
      posters++;
      changed = true;
      if (found.generated) generated++;
      console.log(`  poster: ${found.poster}`);
    }

    if (needsDescription && found.description && found.description.length > 60) {
      item.description = found.description;
      descriptions++;
      changed = true;
      console.log(`  description: ${found.description.slice(0, 90)}...`);
    }

    await sleep(450);
  }

  if (changed) {
    writeJson(filePath, container.set(container.arr));
  }

  report.files.push({
    file: path.relative(ROOT, filePath),
    posters,
    generated,
    descriptions,
    changed
  });

  report.updatedPosters += posters;
  report.generatedPosters += generated;
  report.updatedDescriptions += descriptions;
}

async function main() {
  console.log("GKM V255: старт заполнения постеров без ключей");
  console.log("ROOT:", ROOT);
  console.log("Файлов:", TARGET_FILES.length);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  for (const file of TARGET_FILES) {
    if (!fs.existsSync(file)) continue;
    console.log("\nFILE:", path.relative(ROOT, file));
    await processFile(file);
  }

  report.finishedAt = new Date().toISOString();
  writeJson(REPORT_FILE, report);
  writeJson(CACHE_FILE, cache);

  console.log("\nГОТОВО");
  console.log("Постеров обновлено:", report.updatedPosters);
  console.log("Сгенерировано своих обложек:", report.generatedPosters);
  console.log("Описаний обновлено:", report.updatedDescriptions);
  console.log("Отчёт:", path.relative(ROOT, REPORT_FILE));
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
