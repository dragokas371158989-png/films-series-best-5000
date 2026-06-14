const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

function ok(name, condition) {
  if (!condition) throw new Error("FAIL: " + name);
  console.log("OK:", name);
}

ok("Kinopoisk API flag exists", /const\s+KINOPOISK_ENABLED\s*=\s*true/.test(app));
ok("Kinopoisk API base is v1.4", app.includes('const KINOPOISK_API_BASE = "https://api.kinopoisk.dev/v1.4"'));
ok("Kinopoisk key placeholder exists", /const\s+KINOPOISK_API_KEY\s*=\s*""/.test(app));
ok("Kinopoisk uses X-API-KEY header", app.includes('"X-API-KEY": key'));
ok("Kinopoisk movie search endpoint exists", app.includes('/movie/search'));
ok("Kinopoisk poster normalization exists", app.includes("normalizeKinopoiskDoc") && app.includes("doc.poster"));
ok("Kinopoisk detail enrichment exists", app.includes("enrichFromKinopoisk(m)") && app.includes("Кинопоиск API"));
ok("poster counter exists", app.includes("countPostersInItems") && app.includes("logPosterCount"));
ok("TMDB remains disabled", /const\s+TMDB_ENABLED\s*=\s*false/.test(app));
ok("TMDB guard does not block Kinopoisk host", !/kinopoisk\.dev/.test(app.match(/function isTmdbRequest[\s\S]*?\n}/)?.[0] || ""));

console.log("RESULT 10/10 passed");
