const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const FAST_DIR = path.join(DATA_DIR, "fast");

const OUT_GAMES = path.join(DATA_DIR, "posters_games.json");
const OUT_BOOKS = path.join(DATA_DIR, "posters_books.json");
const OUT_MANGA = path.join(DATA_DIR, "posters_manga.json");
const OUT_COMICS = path.join(DATA_DIR, "posters_comics.json");

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.json();
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function listJsonFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...listJsonFilesRecursive(full));
    } else if (name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function normalizeTitle(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[“”„"]/g, "")
    .replace(/[–—]/g, "-")
    .trim();
}

function pickTitle(item) {
  return normalizeTitle(
    item.ru ||
    item.title ||
    item.name ||
    item.original_title ||
    item.original_name ||
    ""
  );
}

function pickType(item) {
  return String(item.type || item.kind || "").toLowerCase();
}

function hasRealPoster(item) {
  const p = String(item.poster || "").trim();
  if (!p) return false;
  if (p.includes("Нет постера")) return false;
  if (p.includes("placeholder")) return false;
  return true;
}

function uniqById(arr) {
  const map = new Map();
  for (const item of arr) {
    const id = String(item.id || item.kinopoiskId || item.tmdbId || "");
    if (!id) continue;
    if (!map.has(id)) map.set(id, item);
  }
  return [...map.values()];
}

function detectBucket(item) {
  const t = pickType(item);

  if (t.includes("игра") || t.includes("game")) return "games";
  if (t.includes("книга") || t.includes("book")) return "books";
  if (t.includes("манга") || t.includes("manga") || t.includes("ранобэ") || t.includes("novel")) return "manga";
  if (t.includes("комикс") || t.includes("comic")) return "comics";

  const genres = String(item.genres || item.genre || "").toLowerCase();
  const tags = String(item.tags || "").toLowerCase();

  if (genres.includes("манга") || tags.includes("манга")) return "manga";
  if (genres.includes("комикс") || tags.includes("комикс")) return "comics";
  if (genres.includes("книга") || tags.includes("книга")) return "books";

  return null;
}

function loadAllItems() {
  const files = listJsonFilesRecursive(DATA_DIR);
  const all = [];

  for (const file of files) {
    const json = readJsonSafe(file);
    if (!json) continue;

    if (Array.isArray(json)) {
      for (const item of json) {
        if (item && typeof item === "object") all.push(item);
      }
    } else if (json && Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item && typeof item === "object") all.push(item);
      }
    } else if (json && Array.isArray(json.data)) {
      for (const item of json.data) {
        if (item && typeof item === "object") all.push(item);
      }
    }
  }

  return uniqById(all);
}

async function findSteamPoster(title) {
  const q = encodeURIComponent(title);
  const url = `https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=us`;
  const data = await fetchJson(url);

  if (!data || !Array.isArray(data.items) || !data.items.length) return null;

  const first = data.items[0];
  if (first && first.id) {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${first.id}/library_600x900_2x.jpg`;
  }
  return null;
}

async function findWikipediaThumb(title) {
  const q = encodeURIComponent(title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${q}`;
  try {
    const data = await fetchJson(url);
    return data?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function findGoogleBooksPoster(title) {
  const q = encodeURIComponent(title);
  const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${q}&maxResults=5`;
  const data = await fetchJson(url);

  if (!data || !Array.isArray(data.items)) return null;

  for (const item of data.items) {
    const img = item?.volumeInfo?.imageLinks;
    if (img?.thumbnail) return img.thumbnail.replace("http://", "https://");
    if (img?.smallThumbnail) return img.smallThumbnail.replace("http://", "https://");
  }
  return null;
}

async function findOpenLibraryPoster(title) {
  const q = encodeURIComponent(title);
  const url = `https://openlibrary.org/search.json?title=${q}&limit=5`;
  const data = await fetchJson(url);

  if (!data || !Array.isArray(data.docs)) return null;

  for (const doc of data.docs) {
    if (doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (Array.isArray(doc.isbn) && doc.isbn.length) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
  }
  return null;
}

async function findJikanMangaPoster(title) {
  const q = encodeURIComponent(title);
  const url = `https://api.jikan.moe/v4/manga?q=${q}&limit=5`;
  const data = await fetchJson(url);

  if (!data || !Array.isArray(data.data)) return null;

  for (const item of data.data) {
    const jpg = item?.images?.jpg;
    if (jpg?.large_image_url) return jpg.large_image_url;
    if (jpg?.image_url) return jpg.image_url;
  }
  return null;
}

async function resolvePoster(item) {
  const title = pickTitle(item);
  const bucket = detectBucket(item);

  if (!title || !bucket) return null;

  try {
    if (bucket === "games") {
      return (
        await findSteamPoster(title) ||
        await findWikipediaThumb(title)
      );
    }

    if (bucket === "books") {
      return (
        await findGoogleBooksPoster(title) ||
        await findOpenLibraryPoster(title) ||
        await findWikipediaThumb(title)
      );
    }

    if (bucket === "manga") {
      return (
        await findJikanMangaPoster(title) ||
        await findGoogleBooksPoster(title) ||
        await findWikipediaThumb(title)
      );
    }

    if (bucket === "comics") {
      return (
        await findGoogleBooksPoster(title) ||
        await findOpenLibraryPoster(title) ||
        await findWikipediaThumb(title)
      );
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const items = loadAllItems();

  const gamesMap = {};
  const booksMap = {};
  const mangaMap = {};
  const comicsMap = {};

  const targets = items.filter(item => {
    const bucket = detectBucket(item);
    return bucket && !hasRealPoster(item);
  });

  console.log(`Всего записей без постера для обработки: ${targets.length}`);

  let n = 0;
  for (const item of targets) {
    n++;
    const id = String(item.id || item.kinopoiskId || item.tmdbId || "");
    const title = pickTitle(item);
    const bucket = detectBucket(item);

    console.log(`[${n}/${targets.length}] ${bucket}: ${title}`);

    const poster = await resolvePoster(item);
    if (poster) {
      if (bucket === "games") gamesMap[id] = poster;
      if (bucket === "books") booksMap[id] = poster;
      if (bucket === "manga") mangaMap[id] = poster;
      if (bucket === "comics") comicsMap[id] = poster;
      console.log(`  OK -> ${poster}`);
    } else {
      console.log(`  NOT FOUND`);
    }

    await sleep(350);
  }

  writeJson(OUT_GAMES, gamesMap);
  writeJson(OUT_BOOKS, booksMap);
  writeJson(OUT_MANGA, mangaMap);
  writeJson(OUT_COMICS, comicsMap);

  console.log("Готово:");
  console.log(OUT_GAMES);
  console.log(OUT_BOOKS);
  console.log(OUT_MANGA);
  console.log(OUT_COMICS);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
