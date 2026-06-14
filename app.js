const GKM_APP_CLEAN_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";

const FAST_BASE = "data/fast";
const FAST_HOME_URL = `${FAST_BASE}/home.json`;
const FAST_META_URL = `${FAST_BASE}/meta.json`;
const FAST_SEARCH_URL = `${FAST_BASE}/search_index.json`;
const LEGACY_INDEX_URL = "data/index.json";
const PAGE_SIZE = 60;
const MIN_VOTES_FOR_TOP = 300;

let currentTab = "all";
let currentPage = 1;
let currentItems = [];
let currentPages = 1;
let currentCount = 0;
let metaData = null;
let homeData = null;
let searchIndex = null;
let lastSearchResults = [];
let selectedMovie = null;
let searchTimer = null;

const $ = (id) => document.getElementById(id);
const favKey = "gkm_favorites";
const historyKey = "gkm_history";

const TAB_TO_PAGE = {
  all: "all",
  movies: "movies",
  series: "series",
  cartoons: "cartoons",
  anime: "anime",
  top: "top",
  new: "new",
  popular: "popular",
};

function normalize(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").trim();
}

function normKey(s) {
  return normalize(s).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[ch]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function loadSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

async function fetchJson(url, cache = "no-store") {
  const res = await fetch(url + "?v=" + Date.now(), { cache });
  if (!res.ok) throw new Error(`Не загрузилось: ${url} (${res.status})`);
  return await res.json();
}


/* === GKM V60 RUNTIME DATA GUARD: types, RU titles, visible dedupe === */
const GKM_RU_TITLE_RULES_V60 = [
  ["witch hat atelier", "Ателье колдовских колпаков", ["atelier of witch hat","tongari boushi no atelier","とんがり帽子のアトリエ","ателье колдовских колпаков"]],
  ["that time i got reincarnated as a slime", "О моём перерождении в слизь", ["tensei shitara slime datta ken","tensei shitara slime","reincarnated as a slime","slime","слизь"]],
  ["oshi no ko", "Звёздное дитя", ["推しの子","звездное дитя","звёздное дитя"]],
  ["re zero", "Re:ZERO — Жизнь с нуля в альтернативном мире", ["re:zero","starting life in another world","ре зеро"]],
  ["jujutsu kaisen", "Магическая битва", ["дзюдзюцу кайсен","呪術廻戦","магическая битва"]],
  ["demon slayer", "Истребитель демонов", ["kimetsu no yaiba","鬼滅の刃","клинок рассекающий демонов","истребитель демонов"]],
  ["attack on titan", "Атака титанов", ["shingeki no kyojin","進撃の巨人","атака титанов"]],
  ["naruto shippuden", "Наруто: Ураганные хроники", ["наруто ураганные хроники"]],
  ["naruto", "Наруто", ["наруто"]],
  ["boruto", "Боруто", ["боруто"]],
  ["one piece", "Ван-Пис", ["ван пис","ванпис","ван-пис"]],
  ["bleach thousand year blood war", "Блич: Тысячелетняя кровавая война", ["tybw"]],
  ["bleach", "Блич", ["блич"]],
  ["frieren", "Провожающая в последний путь Фрирен", ["sousou no frieren","фрирен"]],
  ["fullmetal alchemist brotherhood", "Стальной алхимик: Братство", ["fma brotherhood"]],
  ["fullmetal alchemist", "Стальной алхимик", ["fma"]],
  ["chainsaw man", "Человек-бензопила", ["бензопила"]],
  ["death note", "Тетрадь смерти", ["тетрадь смерти"]],
  ["solo leveling", "Поднятие уровня в одиночку", ["соло левелинг"]],
  ["one punch man", "Ванпанчмен", ["ванпанчмен"]],
  ["hunter x hunter", "Охотник х Охотник", ["hxh"]],
  ["my hero academia", "Моя геройская академия", ["boku no hero academia"]],
  ["sword art online", "Мастера меча онлайн", ["sao"]],
  ["tokyo ghoul", "Токийский гуль", ["гуль"]],
  ["black clover", "Чёрный клевер", []],
  ["fairy tail", "Хвост Феи", []],
  ["spy x family", "Семья шпиона", []],
  ["blue lock", "Синяя тюрьма", []],
  ["haikyuu", "Волейбол!!", ["haikyu"]],
  ["violet evergarden", "Вайолет Эвергарден", []],
  ["made in abyss", "Созданный в Бездне", []],
  ["goblin slayer", "Убийца гоблинов", []],
  ["overlord", "Повелитель", []],
  ["konosuba", "Этот замечательный мир!", []],
  ["pokemon", "Покемон", []],
  ["cowboy bebop", "Ковбой Бибоп", []],
  ["evangelion", "Евангелион", ["neon genesis evangelion"]],
  ["code geass", "Код Гиас", []],
  ["steins gate", "Врата Штейна", ["steins;gate"]],
  ["parasyte", "Паразит", ["kiseijuu"]],
  ["mob psycho", "Моб Психо 100", []],
  ["vinland saga", "Сага о Винланде", []],
  ["dr stone", "Доктор Стоун", ["dr. stone"]],
  ["your name", "Твоё имя", ["kimi no na wa"]],
  ["weathering with you", "Дитя погоды", ["tenki no ko"]],
  ["suzume", "Судзумэ, закрывающая двери", []],
  ["initial d", "Инициал Ди", []],
  ["inuyasha", "Инуяша", []]
];

const GKM_WESTERN_CARTOON_WORDS_V60 = [
  "scooby","скуби","lego scooby","tom and jerry","том и джерри","looney tunes","bugs bunny",
  "spongebob","sponge bob","губка боб","simpsons","симпсоны","family guy","griffins","гриффины",
  "south park","южный парк","rick and morty","рик и морти","regular show","обычный мультик",
  "adventure time","время приключений","gravity falls","гравити фолз","steven universe","clarence",
  "teen titans","юные титаны","powerpuff girls","суперкрошки","my little pony","disney","pixar","dreamworks"
];

function gkmNormV60(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е")
    .replace(/\s*\(\d{4}\)\s*/g, " ")
    .replace(/[^0-9a-zа-я一-龯ぁ-ゔァ-ヴー々〆〤]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function gkmHasRuV60(s) {
  return /[а-яё]/i.test(String(s || ""));
}

function gkmNamesV60(m) {
  const arr = [
    m && m.ru, m && m.en, m && m.title, m && m.name, m && m.title_ru, m && m.ruTitle,
    m && m.originalTitle, m && m.original_title, m && m.title_original, m && m.english,
    m && m.japanese, m && m.romaji, m && m.searchTitle
  ].filter(Boolean);
  if (m && Array.isArray(m.aliases)) arr.push(...m.aliases);
  if (m && Array.isArray(m.names)) arr.push(...m.names);
  return arr.map(x => String(x || ""));
}

function gkmHayV60(m) {
  return gkmNormV60([
    ...gkmNamesV60(m),
    m && m.source,
    m && m.provider,
    m && Array.isArray(m.genres) ? m.genres.join(" ") : ""
  ].join(" "));
}

function gkmIsWesternCartoonV60(m) {
  const h = gkmHayV60(m);
  return GKM_WESTERN_CARTOON_WORDS_V60.some(x => h.includes(gkmNormV60(x)));
}

function gkmRuleV60(m) {
  const h = gkmHayV60(m);
  let best = null, bestLen = 0;
  for (const [key, ru, aliases] of GKM_RU_TITLE_RULES_V60) {
    for (const c of [key, ru, ...(aliases || [])]) {
      const n = gkmNormV60(c);
      if (n && h.includes(n) && n.length > bestLen) {
        best = [key, ru, aliases || []];
        bestLen = n.length;
      }
    }
  }
  return best;
}

function gkmRuTitleV60(m) {
  if (!m) return "Без названия";
  const rule = gkmRuleV60(m);
  if (rule) {
    const base = rule[1];
    const h = gkmHayV60(m);
    const season = h.match(/(?:season|сезон)\s*(\d+)/);
    const part = h.match(/(?:part|часть)\s*(\d+)/);
    let extra = "";
    if (season && !gkmNormV60(base).includes("сезон")) extra += `: Сезон ${season[1]}`;
    if (part && !gkmNormV60(base).includes("часть")) extra += ` — Часть ${part[1]}`;
    return base + extra;
  }
  for (const k of ["ru", "title_ru", "ruTitle", "nameRu", "titleRu", "russian"]) {
    if (m[k] && gkmHasRuV60(m[k])) return String(m[k]);
  }
  return m.ru || m.title || m.name || m.en || "Без названия";
}

function gkmTypeV60(m) {
  if (!m) return "Фильм";
  if (gkmIsWesternCartoonV60(m)) return "Мультфильм";
  return m.type || "Фильм";
}

function gkmCleanItemV60(m) {
  if (!m || typeof m !== "object") return m;
  const out = { ...m };
  out.ru = gkmRuTitleV60(out);
  out.type = gkmTypeV60(out);
  const rule = gkmRuleV60(out);
  if (rule) {
    const oldAliases = Array.isArray(out.aliases) ? out.aliases : [];
    out.aliases = [...new Set([...oldAliases, rule[0], rule[1], ...(rule[2] || []), ...gkmNamesV60(m)])].filter(Boolean).slice(0, 30);
  }
  if (out.type === "Мультфильм") {
    const g = Array.isArray(out.genres) ? out.genres.filter(x => gkmNormV60(x) !== "аниме") : [];
    if (!g.some(x => gkmNormV60(x) === "мультфильм")) g.unshift("Мультфильм");
    out.genres = g;
  }
  return out;
}

function gkmCanonKeyV60(m) {
  const x = gkmCleanItemV60(m);
  let title = gkmNormV60(x.ru || x.en || x.title || x.name);
  const h = gkmHayV60(x);
  if (gkmIsWesternCartoonV60(x)) {
    if (h.includes("lego") && h.includes("scooby")) title = "lego scooby doo";
    else if (h.includes("scooby") || h.includes("скуби")) title = h.includes("behind") ? "scooby doo behind scenes" : "scooby doo";
  } else {
    const rule = gkmRuleV60(x);
    if (rule) title = gkmNormV60(gkmRuTitleV60(x));
  }
  return [x.type || "", title, x.year || ""].join("|");
}

function gkmCleanListV60(list, opts = {}) {
  if (!Array.isArray(list)) return [];
  const best = new Map();
  for (const raw of list) {
    const item = gkmCleanItemV60(raw);
    if (opts.excludeAnimeScooby && item.type === "Аниме" && gkmIsWesternCartoonV60(item)) continue;
    const key = gkmCanonKeyV60(item);
    const prev = best.get(key);
    const q = Number(item.votes || 0) + Number(item.rating || 0) * 1000 + (item.poster ? 999999 : 0) + String(item.overview || "").length;
    const pq = prev ? Number(prev.votes || 0) + Number(prev.rating || 0) * 1000 + (prev.poster ? 999999 : 0) + String(prev.overview || "").length : -1;
    if (!prev || q >= pq) best.set(key, item);
  }
  return [...best.values()];
}

function gkmCleanFastDataV60(data) {
  if (Array.isArray(data)) return gkmCleanListV60(data);
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if (Array.isArray(out.items)) out.items = gkmCleanListV60(out.items);
  if (out.sections && typeof out.sections === "object") {
    const originalSections = out.sections;
    const westernCartoons = [];
    for (const sec of Object.values(originalSections)) {
      if (Array.isArray(sec)) {
        sec.forEach(x => {
          if (gkmIsWesternCartoonV60(x)) westernCartoons.push(gkmCleanItemV60(x));
        });
      }
    }

    out.sections = { ...originalSections };
    for (const k of Object.keys(out.sections)) {
      out.sections[k] = gkmCleanListV60(out.sections[k], { excludeAnimeScooby: k === "anime" });
    }
    if (Array.isArray(out.sections.anime)) {
      out.sections.anime = out.sections.anime.filter(x => !gkmIsWesternCartoonV60(x));
    }
    if (!Array.isArray(out.sections.cartoons)) out.sections.cartoons = [];
    out.sections.cartoons = gkmCleanListV60([...out.sections.cartoons, ...westernCartoons]);
  }
  return out;
}

function gkmUniqueByIdOrKeyV61(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach(x => {
    const item = gkmCleanItemV60(x);
    const key = String(item.id || "") || gkmCanonKeyV60(item);
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

function gkmEnsureHomeSectionsV61(sections) {
  const s = sections && typeof sections === "object" ? { ...sections } : {};
  const all = [];
  for (const arr of Object.values(s)) {
    if (Array.isArray(arr)) all.push(...arr);
  }

  const cleanAll = gkmUniqueByIdOrKeyV61(all);
  const byScore = (a, b) => {
    const av = Number(a.votes || 0), bv = Number(b.votes || 0);
    const ar = Number(a.rating || 0), br = Number(b.rating || 0);
    return (br * 10 + Math.min(bv, 80000) / 80000 * 5) - (ar * 10 + Math.min(av, 80000) / 80000 * 5);
  };

  const allAnime = cleanAll.filter(x => getType(x) === "Аниме").sort(byScore);
  const cleanedAnime = Array.isArray(s.anime) ? gkmCleanListV60(s.anime).filter(x => getType(x) === "Аниме").sort(byScore) : [];
  s.anime = gkmUniqueByIdOrKeyV61([...cleanedAnime, ...allAnime]).filter(x => getType(x) === "Аниме").sort(byScore).slice(0, 18);

  if (!Array.isArray(s.cartoons) || !s.cartoons.length) {
    s.cartoons = cleanAll.filter(x => getType(x) === "Мультфильм").sort(byScore).slice(0, 18);
  } else {
    s.cartoons = gkmCleanListV60(s.cartoons).filter(x => getType(x) === "Мультфильм").sort(byScore).slice(0, 18);
  }

  ["popular","top","new","movies","series"].forEach(k => {
    if (Array.isArray(s[k])) s[k] = gkmCleanListV60(s[k]);
  });

  return s;
}

function gkmClearSearchControlsV61() {
  ["searchInput", "typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  const sort = $("sortFilter");
  if (sort) sort.value = "smart";
}

async function gkmOpenDepartmentV61(tabName, opts = {}) {
  tabName = tabName || "all";
  gkmClearSearchControlsV61();
  lastSearchResults = [];
  currentPage = 1;
  setActiveTab(tabName);

  const searchInput = $("searchInput");
  if (searchInput) searchInput.blur();

  if (tabName === "all") {
    renderHome();
  } else if (tabName === "fav") {
    await renderFavorites();
  } else if (tabName === "history") {
    await renderHistory();
  } else if (tabName === "random") {
    await renderRandom();
  } else if (metaData && metaData.fallback && homeData && homeData.sections) {
    const section = gkmEnsureHomeSectionsV61(homeData.sections)[tabName] || [];
    currentItems = section;
    currentPages = 1;
    renderList(section, `Раздел: ${section.length}`);
  } else {
    await loadPage(tabName, 1);
  }

  setStatus(`Открыт раздел: ${tabName}`);
  if (opts.keepPosition) return;

  const target = $("countText") || $("grid") || document.querySelector("main");
  if (target && target.scrollIntoView) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
/* === /GKM V61 MORE BUTTONS + ANIME SECTION FIX === */


/* === GKM V65 BALANCED HOME: votes + rating + all types === */
const GKM_HOME_MIN_VOTES_V65 = 300;
const GKM_HOME_SECTION_LIMIT_V65 = 12;

function gkmVotesV65(m) {
  return Number(m && m.votes || 0);
}

function gkmRatingV65(m) {
  return Number(m && m.rating || 0);
}

function gkmYearV65(m) {
  return Number(m && m.year || 0);
}

function gkmHomeScoreV65(m) {
  const r = gkmRatingV65(m);
  const v = gkmVotesV65(m);
  const y = gkmYearV65(m);
  if (v < GKM_HOME_MIN_VOTES_V65) return -999999;
  return (r * 10) + (Math.log10(v + 1) * 8) + Math.min(v, 500000) / 500000 * 12 + (y >= 2024 ? 3 : 0);
}

function gkmGoodHomeItemsV65(list, soft = false) {
  const minVotes = soft ? 80 : GKM_HOME_MIN_VOTES_V65;
  return gkmCleanListV60(Array.isArray(list) ? list : [])
    .filter(x => gkmVotesV65(x) >= minVotes)
    .sort((a, b) => gkmHomeScoreV65(b) - gkmHomeScoreV65(a));
}

function gkmPickHomeV65(list, limit = GKM_HOME_SECTION_LIMIT_V65, soft = false) {
  return gkmGoodHomeItemsV65(list, soft).slice(0, limit);
}

async function gkmFetchPageItemsV65(tab) {
  try {
    const data = await fetchJsonQuiet(`${FAST_BASE}/pages/${tab}/page_0001.json`);
    return data && Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function gkmBuildBalancedHomeV65() {
  if (!homeData || !homeData.sections) return;

  const source = { ...(homeData.sections || {}) };
  const tabs = ["popular", "top", "new", "movies", "series", "cartoons", "anime"];

  const pages = await Promise.all(tabs.map(async t => [t, await gkmFetchPageItemsV65(t)]));
  pages.forEach(([t, items]) => {
    if (items && items.length) source[t] = gkmCleanListV60([...(source[t] || []), ...items]);
  });

  const all = gkmCleanListV60(Object.values(source).flatMap(arr => Array.isArray(arr) ? arr : []));
  const byType = (type) => all.filter(x => getType(x) === type);

  const movies = gkmPickHomeV65(byType("Фильм"));
  const series = gkmPickHomeV65(byType("Сериал"));
  const cartoons = gkmPickHomeV65(byType("Мультфильм"));
  const anime = gkmPickHomeV65(byType("Аниме"));

  const newItems = gkmPickHomeV65(all.filter(x => gkmYearV65(x) >= 2024), GKM_HOME_SECTION_LIMIT_V65, true);
  const popular = gkmPickHomeV65(all.sort((a, b) => gkmVotesV65(b) - gkmVotesV65(a)), GKM_HOME_SECTION_LIMIT_V65);
  const top = gkmPickHomeV65(all, GKM_HOME_SECTION_LIMIT_V65);

  homeData.sections = {
    new: newItems.length ? newItems : gkmPickHomeV65(source.new || [], GKM_HOME_SECTION_LIMIT_V65, true),
    movies: movies.length ? movies : gkmPickHomeV65(source.movies || [], GKM_HOME_SECTION_LIMIT_V65, true),
    series: series.length ? series : gkmPickHomeV65(source.series || [], GKM_HOME_SECTION_LIMIT_V65, true),
    cartoons: cartoons.length ? cartoons : gkmPickHomeV65(source.cartoons || [], GKM_HOME_SECTION_LIMIT_V65, true),
    anime: anime.length ? anime : gkmPickHomeV65(source.anime || [], GKM_HOME_SECTION_LIMIT_V65, true),
    popular: popular.length ? popular : gkmPickHomeV65(source.popular || [], GKM_HOME_SECTION_LIMIT_V65, true),
    top: top.length ? top : gkmPickHomeV65(source.top || [], GKM_HOME_SECTION_LIMIT_V65, true)
  };

  window.GKM_BALANCED_HOME_STATS = {
    minVotes: GKM_HOME_MIN_VOTES_V65,
    new: homeData.sections.new.length,
    movies: homeData.sections.movies.length,
    series: homeData.sections.series.length,
    cartoons: homeData.sections.cartoons.length,
    anime: homeData.sections.anime.length,
    popular: homeData.sections.popular.length,
    top: homeData.sections.top.length
  };
}
/* === /GKM V65 BALANCED HOME === */

/* === /GKM V60 RUNTIME DATA GUARD === */

function titleOf(m) {
  return gkmRuTitleV60(m);
}

function getYear(m) {
  return String(m.year || "").trim();
}

function getRating(m) {
  return Number(m.rating || 0);
}

function getVotes(m) {
  return Number(m.votes || 0);
}

function getGenres(m) {
  return Array.isArray(m.genres) ? m.genres.filter(Boolean) : [];
}

function getType(m) {
  return gkmTypeV60(m);
}

function rankOf(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if ((r >= 9.7 && v < 300) || (r >= 9 && v < 80)) return { rank: "d", label: "Новый" };
  if (r >= 9 && v >= MIN_VOTES_FOR_TOP) return { rank: "s", label: "S-класс" };
  if (r >= 8) return { rank: "a", label: "A-класс" };
  if (r >= 7) return { rank: "b", label: "B-класс" };
  if (r >= 6) return { rank: "c", label: "C-класс" };
  return { rank: "d", label: "D-класс" };
}

function ratingLabel(m) {
  const r = getRating(m);
  const v = getVotes(m);

  if ((r >= 9.7 && v < 300) || (r >= 9 && v < 80)) {
    return "Новый · мало оценок";
  }

  return `${rankOf(m).label} · ${r.toFixed(1)}`;
}

function scoreSmart(m) {
  const rating = getRating(m);
  const votes = getVotes(m);
  const year = Number(getYear(m) || 0);

  if (votes < 30) return rating;

  const voteBonus = Math.min(votes, 50000) / 50000 * 4;
  const yearBonus = year >= 2010 ? 0.4 : 0;

  return rating * 10 + voteBonus + yearBonus;
}

function setStatus(text) {
  const status = $("statusText");
  if (status) status.textContent = text || "";
}

function getTotalCount() {
  return Number((metaData && metaData.count) || (homeData && homeData.total) || 0);
}

function fillFilters() {
  const yearFilter = $("yearFilter");
  const genreFilter = $("genreFilter");

  if (yearFilter && metaData && Array.isArray(metaData.years)) {
    const cur = yearFilter.value;
    yearFilter.innerHTML = `<option value="">Все годы</option>` +
      metaData.years.map(y => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join("");
    if (cur) yearFilter.value = cur;
  }

  if (genreFilter && metaData && Array.isArray(metaData.genres)) {
    const cur = genreFilter.value;
    genreFilter.innerHTML = `<option value="">Все жанры</option>` +
      metaData.genres.map(g => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("");
    if (cur) genreFilter.value = cur;
  }
}

function posterHtml(m) {
  if (m.poster) {
    return `<img src="${escapeAttr(m.poster)}" loading="eager" decoding="async" fetchpriority="high" alt="">`;
  }

  return `<div class="poster-placeholder">Нет постера</div>`;
}

function badgesHtml(m) {
  const badges = [];
  const type = getType(m);
  const year = Number(getYear(m) || 0);

  if (type === "Аниме") badges.push({ text: "🐉 Аниме", cls: "anime" });
  else if (type === "Мультфильм") badges.push({ text: "🧸 Мультфильм", cls: "cartoon" });
  else if (type === "Сериал") badges.push({ text: "📺 Сериал", cls: "series" });
  else badges.push({ text: "🎬 Фильм", cls: "movie" });

  if (getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 8) badges.push({ text: "⭐ Топ", cls: "top" });
  if (year >= 2024) badges.push({ text: "🆕 Новинка", cls: "new" });

  return `<div class="card-badges">${badges.slice(0, 3).map(b => `<span class="card-badge badge-${b.cls}">${escapeHtml(b.text)}</span>`).join("")}</div>`;
}

function cardHtml(m) {
  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));
  const rank = rankOf(m).rank;

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">
        ${badgesHtml(m)}
        <button class="card-fav-btn ${isFav ? "active" : ""}" data-fav-id="${escapeAttr(m.id)}" type="button">${isFav ? "❤️" : "🤍"}</button>
        ${posterHtml(m)}
      </div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(getYear(m) || "—")} · ${escapeHtml(getType(m))}</p>
        <p class="meta">${escapeHtml(getGenres(m).slice(0, 3).join(" · "))}</p>
        <span class="rating rank-${rank}">${escapeHtml(ratingLabel(m))}</span>
      </div>
    </article>
  `;
}

function homeSectionHtml(title, items, tabName) {
  if (!Array.isArray(items) || !items.length) return "";

  return `
    <section class="home-section">
      <div class="home-section-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="home-more-btn" data-open-tab="${escapeAttr(tabName)}" type="button">Смотреть все</button>
      </div>
      <div class="home-row">${items.map(cardHtml).join("")}</div>
    </section>
  `;
}

function renderHome() {
  const grid = $("grid");
  const countText = $("countText");
  const pageText = $("pageText");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  const s = gkmEnsureHomeSectionsV61(homeData.sections || {});
  currentItems = [
    ...(s.popular || []),
    ...(s.top || []),
    ...(s.new || []),
    ...(s.anime || []),
    ...(s.movies || []),
    ...(s.series || []),
    ...(s.cartoons || [])
  ];

  if (countText) countText.textContent = `ГОЛУБЬ Каталог Мира · всего записей: ${getTotalCount()}`;

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>ГОЛУБЬ Каталог Мира</h2>
          <p>Фильмы, сериалы, мультфильмы и аниме в одном месте.</p>
        </div>
        <button id="whatToWatchBtn" class="what-watch-main-btn" type="button">🎲 Что посмотреть?</button>
      </section>

      ${homeSectionHtml("🆕 Новинки с нормальными голосами", s.new, "new")}
      ${homeSectionHtml("🎬 Фильмы", s.movies, "movies")}
      ${homeSectionHtml("📺 Сериалы", s.series, "series")}
      ${homeSectionHtml("🧸 Мультфильмы", s.cartoons, "cartoons")}
      ${homeSectionHtml("🐉 Аниме", s.anime, "anime")}
      ${homeSectionHtml("🔥 Популярное по голосам", s.popular, "popular")}
      ${homeSectionHtml("⭐ Лучший рейтинг + голоса", s.top, "top")}
    `;
  }

  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  if (pageText) pageText.textContent = "Главная";
}

async function fetchJsonQuiet(url) {
  try {
    return await fetchJson(url);
  } catch (e) {
    console.warn("Не загрузилось:", url, e);
    return null;
  }
}

function normalizeChunkUrl(chunk) {
  let url = "";

  if (typeof chunk === "string") {
    url = chunk;
  } else if (chunk && typeof chunk === "object") {
    url = chunk.file || chunk.path || chunk.url || chunk.src || chunk.name || "";
  }

  url = String(url || "").trim().replace(/^\/+/, "");

  if (!url) return "";

  if (url.startsWith("http") || url.startsWith("data/")) return url;
  if (url.startsWith("chunks/")) return "data/" + url;
  if (/chunk_\d+\.json$/i.test(url)) return "data/chunks/" + url.split("/").pop();

  return "data/" + url;
}

function getItemsFromAnyJson(data) {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    for (const key of ["movies", "items", "data", "results", "records", "list"]) {
      if (Array.isArray(data[key])) return data[key];
    }

    const values = Object.values(data);
    if (values.length && values.slice(0, 20).every(x => x && typeof x === "object" && !Array.isArray(x))) {
      return values;
    }
  }

  return [];
}

function quickCleanItem(raw, idx) {
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map(g => typeof g === "object" ? (g.genre || g.name || g.title || "") : g).filter(Boolean)
    : (typeof raw.genres === "string" ? raw.genres.split(/[,;/|·]+/).map(x => x.trim()).filter(Boolean) : []);

  const title = raw.ru || raw.title || raw.name || raw.nameRu || raw.en || raw.originalTitle || "Без названия";

  let year = String(raw.year || raw.release_date || raw.first_air_date || "");
  const ym = year.match(/(19\d{2}|20\d{2})/);
  year = ym ? ym[1] : year;

  let type = raw.type || raw.kind || "Фильм";
  const typeText = normalize([type, raw.source, raw.provider, title, ...genres].join(" "));

  if (typeText.includes("аниме") || typeText.includes("anime") || typeText.includes("jikan") || typeText.includes("myanimelist")) {
    type = "Аниме";
  } else if (typeText.includes("мульт")) {
    type = "Мультфильм";
  } else if (typeText.includes("сериал") || typeText.includes("series")) {
    type = "Сериал";
  } else {
    type = "Фильм";
  }

  return {
    ...raw,
    id: raw.id || raw.uid || raw.tmdbId || raw.kinopoiskId || raw.filmId || raw.mal_id || ("legacy_" + idx),
    ru: title,
    en: raw.en || raw.nameEn || raw.originalTitle || "",
    year,
    type,
    rating: Number(raw.rating || raw.vote_average || raw.ratingKinopoisk || raw.ratingImdb || 0),
    votes: Number(raw.votes || raw.vote_count || raw.ratingVoteCount || 0),
    poster: raw.poster || raw.posterUrl || raw.poster_url || raw.image || raw.imageUrl || "",
    genres,
    overview: raw.overview_ru || raw.ruOverview || raw.description_ru || raw.descriptionRu || raw.description || raw.overview || raw.synopsis || "",
    source: raw.source || raw.provider || "",
  };
}

function buildHomeFromLegacy(items) {
  const cleaned = items.map(quickCleanItem).filter(x => titleOf(x) !== "Без названия");

  const bySmart = list => [...list].sort((a, b) => scoreSmart(b) - scoreSmart(a)).slice(0, 18);
  const popular = [...cleaned].filter(x => getVotes(x) >= 1000).sort((a, b) => getVotes(b) - getVotes(a)).slice(0, 18);
  const top = bySmart(cleaned.filter(x => getVotes(x) >= MIN_VOTES_FOR_TOP && getRating(x) >= 7));
  const newItems = [...cleaned].filter(x => Number(getYear(x) || 0) >= 2024).sort((a, b) => Number(getYear(b) || 0) - Number(getYear(a) || 0)).slice(0, 18);

  return {
    total: cleaned.length,
    sections: {
      popular,
      top,
      new: newItems,
      anime: bySmart(cleaned.filter(x => getType(x) === "Аниме")),
      movies: bySmart(cleaned.filter(x => getType(x) === "Фильм")),
      series: bySmart(cleaned.filter(x => getType(x) === "Сериал")),
      cartoons: bySmart(cleaned.filter(x => getType(x) === "Мультфильм")),
    }
  };
}

async function loadLegacyFallbackHome(reason) {
  setStatus("Быстрая база пустая, включаю запасную загрузку...");

  const index = await fetchJsonQuiet(LEGACY_INDEX_URL);
  const chunks = index && Array.isArray(index.chunks) ? index.chunks : [];

  if (!chunks.length) {
    throw new Error("data/fast пустая и data/index.json не содержит chunks");
  }

  const firstChunks = chunks.slice(0, 4);
  const legacyItems = [];

  for (const chunk of firstChunks) {
    const url = normalizeChunkUrl(chunk);
    if (!url) continue;

    const data = await fetchJsonQuiet(url);
    legacyItems.push(...getItemsFromAnyJson(data));
  }

  homeData = gkmCleanFastDataV60(buildHomeFromLegacy(legacyItems));
  metaData = {
    count: homeData.total,
    generatedAt: "legacy fallback",
    years: [...new Set(legacyItems.map(x => quickCleanItem(x).year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)),
    genres: [...new Set(legacyItems.flatMap(x => quickCleanItem(x).genres || []))].sort((a, b) => a.localeCompare(b, "ru")),
    fallback: true,
  };

  fillFilters();
  renderHome();

  setStatus(`Запасная база: ${homeData.total} записей · причина: ${reason || "data/fast пустая"}`);
}


async function loadHome() {
  setStatus("Загружаю быструю главную...");

  metaData = await fetchJson(FAST_META_URL);
  homeData = gkmCleanFastDataV60(await fetchJson(FAST_HOME_URL));

  const total = getTotalCount();

  if (!total || total <= 0) {
    await loadLegacyFallbackHome("data/fast вернула 0");
    return;
  }

  await gkmBuildBalancedHomeV65();

  fillFilters();
  renderHome();

  setStatus(`Быстрая база: ${getTotalCount()} записей · ${metaData.generatedAt || ""}`);
}


/* === GKM V68 STRICT DEPARTMENT PAGES === */
function gkmDepartmentFullListV68(tab, index) {
  const list = gkmCleanListV60(Array.isArray(index) ? index : []);
  let out = list;

  if (tab === "movies") out = out.filter(m => getType(m) === "Фильм");
  else if (tab === "series") out = out.filter(m => getType(m) === "Сериал");
  else if (tab === "cartoons") out = out.filter(m => getType(m) === "Мультфильм");
  else if (tab === "anime") out = out.filter(m => getType(m) === "Аниме");
  else if (tab === "new") out = out.filter(m => Number(getYear(m) || 0) >= 2024);
  else if (tab === "popular") out = out.filter(m => getVotes(m) >= 1);
  else if (tab === "top") out = out.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  else out = list;

  if (tab === "new") {
    out = [...out].sort((a, b) => {
      const dy = Number(getYear(b) || 0) - Number(getYear(a) || 0);
      return dy || (getVotes(b) - getVotes(a)) || (getRating(b) - getRating(a));
    });
  } else {
    out = gkmSortVotesFirstV67(out);
  }

  return out;
}

function gkmRenderDepartmentPageV68(tab, page, fullList) {
  currentTab = tab;
  currentPage = Math.max(1, Number(page || 1));
  lastSearchResults = gkmDepartmentFullListV68(tab, fullList);
  currentCount = lastSearchResults.length;
  currentPages = Math.max(1, Math.ceil(currentCount / PAGE_SIZE));

  if (currentPage > currentPages) currentPage = currentPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  currentItems = lastSearchResults.slice(start, start + PAGE_SIZE);

  renderList(currentItems, `Раздел: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел ${tab}: ${currentCount} записей · сортировка по голосам`);
}

async function gkmLoadDepartmentFromIndexV68(tab, page = 1) {
  const idx = await ensureSearchIndex();
  gkmRenderDepartmentPageV68(tab, page, idx);
}

window.GKM_STRICT_DEPARTMENT_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
/* === /GKM V68 STRICT DEPARTMENT PAGES === */


async function loadPage(tab, page = 1) {
  const pageTab = TAB_TO_PAGE[tab] || "all";

  currentTab = tab;
  currentPage = page;

  // V69: НЕ грузим весь search_index при открытии разделов.
  // Разделы берут готовые быстрые page_0001/page_0002, которые собирает GitHub Action.
  const url = `${FAST_BASE}/pages/${pageTab}/page_${String(page).padStart(4, "0")}.json`;
  setStatus(`Загружаю ${tab} · страница ${page}...`);

  const data = await fetchJson(url);

  let items = gkmCleanListV60(data.items || []);

  // Страховка: даже если старые json смешанные, на экране типы не смешиваем.
  if (pageTab === "movies") items = items.filter(m => getType(m) === "Фильм");
  if (pageTab === "series") items = items.filter(m => getType(m) === "Сериал");
  if (pageTab === "cartoons") items = items.filter(m => getType(m) === "Мультфильм");
  if (pageTab === "anime") items = items.filter(m => getType(m) === "Аниме");

  currentItems = gkmSortVotesFirstV67(items);
  currentPage = data.page || page;
  currentPages = data.pages || 1;
  currentCount = data.count || currentItems.length;

  renderList(currentItems, `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`);
  setStatus(`Раздел загружен: ${currentCount} записей · fast pages`);
}

window.GKM_FAST_PAGES_NO_FREEZE_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


function renderList(items, label) {
  const grid = $("grid");
  const countText = $("countText");
  const pageText = $("pageText");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (countText) countText.textContent = label || `Найдено: ${items.length}`;
  if (grid) grid.innerHTML = items.map(cardHtml).join("");

  if (pageText) pageText.textContent = `${currentPage} / ${currentPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= currentPages;
}

async function ensureSearchIndex() {
  if (searchIndex) return searchIndex;

  setStatus("Загружаю поисковый индекс...");
  searchIndex = gkmCleanListV60(await fetchJson(FAST_SEARCH_URL));
  setStatus(`Поисковый индекс: ${searchIndex.length} записей`);

  return searchIndex;
}




/* === GKM V45 FAST CORRECT SEARCH ENGINE === */
const GKM_SEARCH_SYNONYMS_V45 = {
  "наруто": ["naruto", "норуто", "нарута"],
  "норуто": ["naruto", "наруто"],
  "нарута": ["naruto", "наруто"],
  "боруто": ["boruto", "baruto", "naruto"],
  "баруто": ["boruto", "боруто"],
  "ван пис": ["one piece", "onepiece", "ванпис", "ван-пис"],
  "ванпис": ["one piece", "ван пис", "ван-пис"],
  "ван-пис": ["one piece", "ван пис"],
  "блич": ["bleach"],
  "магическая битва": ["jujutsu kaisen", "дзюдзюцу кайсен", "jujutsu"],
  "дзюдзюцу": ["jujutsu kaisen", "магическая битва"],
  "атака титанов": ["attack on titan", "shingeki no kyojin"],
  "клинок": ["demon slayer", "kimetsu no yaiba", "истребитель демонов"],
  "истребитель демонов": ["demon slayer", "kimetsu no yaiba"],
  "тетрадь смерти": ["death note"],
  "слизь": ["slime", "tensei shitara slime", "reincarnated as a slime"],
  "фрирен": ["frieren", "sousou no frieren"],
  "бензопила": ["chainsaw man", "человек бензопила", "человек-бензопила"],
  "человек бензопила": ["chainsaw man"],
  "соло левелинг": ["solo leveling", "поднятие уровня"],
  "поднятие уровня": ["solo leveling"],
  "ре зеро": ["re zero", "re:zero"],
  "реинкарнация безработного": ["mushoku tensei"],
  "охотник": ["hunter x hunter"],
  "стальной алхимик": ["fullmetal alchemist"],
  "волейбол": ["haikyuu"],
  "покемон": ["pokemon"],
  "драконий жемчуг": ["dragon ball"],
  "гуль": ["tokyo ghoul", "токийский гуль"],
  "токийский гуль": ["tokyo ghoul"],
  "берсерк": ["berserk"]
};

function gkmSearchKeyboardFixV45(s) {
  const map = {
    "q":"й","w":"ц","e":"у","r":"к","t":"е","y":"н","u":"г","i":"ш","o":"щ","p":"з","[":"х","]":"ъ",
    "a":"ф","s":"ы","d":"в","f":"а","g":"п","h":"р","j":"о","k":"л","l":"д",";":"ж","'":"э",
    "z":"я","x":"ч","c":"с","v":"м","b":"и","n":"т","m":"ь",",":"б",".":"ю"
  };
  return String(s || "").split("").map(ch => map[ch.toLowerCase()] || ch).join("");
}

function gkmLevSmallV45(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (!a || !b) return 99;
  if (Math.abs(a.length - b.length) > 2) return 99;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function gkmQueryVariantsV45(q) {
  const base = normKey(q);
  const out = new Set([base]);
  const kb = normKey(gkmSearchKeyboardFixV45(base));
  if (kb && kb !== base) out.add(kb);

  for (const [k, arr] of Object.entries(GKM_SEARCH_SYNONYMS_V45)) {
    if (base.includes(k) || k.includes(base)) {
      arr.forEach(x => out.add(normKey(x)));
    }
  }

  return [...out].filter(Boolean);
}

function gkmTitleHayV45(m) {
  if (m.__gkmTitleHayV45) return m.__gkmTitleHayV45;
  m.__gkmTitleHayV45 = normKey([
    m.ru, m.en, m.title, m.name, m.title_ru, m.ruTitle, m.title_original,
    m.originalTitle, m.original_title, m.english, m.japanese, m.romaji,
    ...(m.aliases || []),
    ...(m.names || [])
  ].join(" "));
  return m.__gkmTitleHayV45;
}

function gkmFullHayV45(m) {
  if (m.__gkmFullHayV45) return m.__gkmFullHayV45;
  m.__gkmFullHayV45 = normKey([
    gkmTitleHayV45(m),
    m.year, m.type, m.source, m.status,
    ...(m.genres || []),
    m.searchTitle || ""
  ].join(" "));
  return m.__gkmFullHayV45;
}

function gkmSearchScoreV45(m, q) {
  if (!q) return 1;

  const variants = gkmQueryVariantsV45(q);
  const titleHay = gkmTitleHayV45(m);
  const fullHay = gkmFullHayV45(m);
  const titleWords = titleHay.split(" ").filter(Boolean);

  let best = 0;

  for (const v of variants) {
    if (!v) continue;

    const parts = v.split(" ").filter(x => x.length > 1);

    if (titleHay === v) best = Math.max(best, 100000);
    else if (titleHay.startsWith(v + " ")) best = Math.max(best, 90000);
    else if (titleHay.includes(" " + v + " ") || titleHay.includes(v)) best = Math.max(best, 80000);

    if (parts.length) {
      let titleHits = 0;

      for (const p of parts) {
        if (titleHay.includes(p)) titleHits++;
        else if (p.length >= 4 && titleWords.some(w => gkmLevSmallV45(w, p) <= (p.length <= 5 ? 1 : 2))) titleHits++;
      }

      if (titleHits === parts.length) best = Math.max(best, 70000 + titleHits * 500);
      else if (parts.length >= 2 && titleHits >= Math.ceil(parts.length * 0.75)) best = Math.max(best, 50000 + titleHits * 300);
    }

    // Описание/жанры используем только для длинных запросов.
    // Одно слово "наруто" больше не тащит мусор из overview.
    if (best === 0 && v.length >= 8 && parts.length >= 2) {
      if (fullHay.includes(v)) best = Math.max(best, 9000);

      let fullHits = 0;
      for (const p of parts) {
        if (fullHay.includes(p)) fullHits++;
      }
      if (fullHits === parts.length) best = Math.max(best, 7000 + fullHits * 100);
    }
  }

  if (best > 0) {
    best += Math.min(getRating(m) || 0, 10) * 10;
    best += Math.min(getVotes(m) || 0, 100000) / 1000;
    if (getType(m) === "Аниме") best += 500;
  }

  return best;
}




/* === GKM V67 VOTES FIRST SORT === */
function gkmVotesFirstScoreV67(m) {
  const votes = Number(getVotes(m) || 0);
  const rating = Number(getRating(m) || 0);
  const year = Number(getYear(m) || 0);

  // Главный вес — голоса. Оценка и год только помогают при равных/похожих голосах.
  return (votes * 100000) + (rating * 1000) + year;
}

function gkmSortVotesFirstV67(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bv = Number(getVotes(b) || 0);
    const av = Number(getVotes(a) || 0);
    if (bv !== av) return bv - av;

    const br = Number(getRating(b) || 0);
    const ar = Number(getRating(a) || 0);
    if (br !== ar) return br - ar;

    return Number(getYear(b) || 0) - Number(getYear(a) || 0);
  });
}

function gkmSortRatingWithVotesV67(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bs = (Number(getRating(b) || 0) * 1000000) + Math.log10(Number(getVotes(b) || 0) + 1) * 100000 + Number(getVotes(b) || 0);
    const as = (Number(getRating(a) || 0) * 1000000) + Math.log10(Number(getVotes(a) || 0) + 1) * 100000 + Number(getVotes(a) || 0);
    return bs - as;
  });
}

function gkmSortSmartV67(list) {
  // Smart теперь не тащит наверх "9.9 при 2 голосах".
  // Сначала доверие по голосам, потом рейтинг.
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const bv = Number(getVotes(b) || 0);
    const av = Number(getVotes(a) || 0);

    // Если разрыв по голосам большой — побеждают голоса.
    if (Math.abs(bv - av) >= 300) return bv - av;

    const br = Number(getRating(b) || 0);
    const ar = Number(getRating(a) || 0);
    if (br !== ar) return br - ar;

    return bv - av;
  });
}

window.GKM_VOTES_FIRST_SORT_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
/* === /GKM V67 VOTES FIRST SORT === */


function applyLocalFilters(list) {
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");
  const sortFilter = $("sortFilter");

  const type = typeFilter ? typeFilter.value : "";
  const genre = genreFilter ? genreFilter.value : "";
  const year = yearFilter ? yearFilter.value : "";
  const minRating = Number(ratingFilter ? ratingFilter.value || 0 : 0);
  const sort = sortFilter ? sortFilter.value : "smart";

  let out = list;

  if (type) out = out.filter(m => getType(m) === type);
  if (genre) out = out.filter(m => getGenres(m).includes(genre));
  if (year) out = out.filter(m => getYear(m) === year);
  if (minRating) out = out.filter(m => getRating(m) >= minRating);

  out = [...out];

  if (sort === "rating") out = gkmSortRatingWithVotesV67(out);
  else if (sort === "votes") out = gkmSortVotesFirstV67(out);
  else if (sort === "year") out.sort((a, b) => {
    const dy = Number(getYear(b) || 0) - Number(getYear(a) || 0);
    return dy || (getVotes(b) - getVotes(a));
  });
  else if (sort === "title") out.sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru"));
  else out = gkmSortSmartV67(out);

  return out;
}



/* === GKM V49 STABLE SEARCH CORE === */
function gkmSearchNormV49(v) {
  return String(v || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}:]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gkmSearchKeyboardFixV49(s) {
  const map = {
    "q":"й","w":"ц","e":"у","r":"к","t":"е","y":"н","u":"г","i":"ш","o":"щ","p":"з","[":"х","]":"ъ",
    "a":"ф","s":"ы","d":"в","f":"а","g":"п","h":"р","j":"о","k":"л","l":"д",";":"ж","'":"э",
    "z":"я","x":"ч","c":"с","v":"м","b":"и","n":"т","m":"ь",",":"б",".":"ю"
  };
  return String(s || "").split("").map(ch => map[ch.toLowerCase()] || ch).join("");
}

function gkmSearchVariantsV49(q) {
  const base = gkmSearchNormV49(q);
  const out = new Set([base]);
  const kb = gkmSearchNormV49(gkmSearchKeyboardFixV49(base));
  if (kb && kb !== base) out.add(kb);

  const syn = {
    "наруто": ["naruto"],
    "норуто": ["наруто", "naruto"],
    "нарута": ["наруто", "naruto"],
    "боруто": ["boruto"],
    "ван пис": ["one piece", "ванпис", "ван-пис"],
    "ванпис": ["one piece", "ван пис"],
    "ван-пис": ["one piece", "ван пис"],
    "блич": ["bleach"],
    "магическая битва": ["jujutsu kaisen", "дзюдзюцу"],
    "дзюдзюцу": ["jujutsu kaisen", "магическая битва"],
    "атака титанов": ["attack on titan", "shingeki no kyojin"],
    "истребитель демонов": ["demon slayer", "kimetsu no yaiba"],
    "клинок": ["demon slayer", "истребитель демонов"],
    "тетрадь смерти": ["death note"],
    "фрирен": ["frieren"],
    "бензопила": ["chainsaw man"],
    "соло левелинг": ["solo leveling"],
    "ре зеро": ["re zero", "re:zero"],
    "охотник": ["hunter x hunter"],
    "стальной алхимик": ["fullmetal alchemist"],
    "волейбол": ["haikyuu"],
    "покемон": ["pokemon"]
  };

  for (const [k, arr] of Object.entries(syn)) {
    if (base === k || base.includes(k) || k.includes(base)) {
      arr.forEach(x => out.add(gkmSearchNormV49(x)));
    }
  }

  return [...out].filter(Boolean);
}

function gkmTitleOnlyHayV49(m) {
  const mainTitle = typeof titleOf === "function" ? titleOf(m) : "";
  return gkmSearchNormV49([
    mainTitle,
    m.title,
    m.name,
    m.title_ru,
    m.ruTitle,
    m.title_original,
    m.originalTitle,
    m.original_title,
    m.english,
    m.title_en,
    m.japanese,
    m.romaji,
    ...(m.aliases || []),
    ...(m.names || [])
  ].join(" "));
}

function gkmLevV49(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (!a || !b) return 99;
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function gkmTitleSearchScoreV49(m, q) {
  q = gkmSearchNormV49(q);
  if (!q) return 1;

  const hay = gkmTitleOnlyHayV49(m);
  if (!hay) return 0;

  const variants = gkmSearchVariantsV49(q);
  const words = hay.split(" ").filter(Boolean);
  let best = 0;

  for (const v of variants) {
    if (!v) continue;

    if (hay === v) best = Math.max(best, 1000000);
    else if (hay.startsWith(v + " ")) best = Math.max(best, 900000);
    else if ((" " + hay + " ").includes(" " + v + " ")) best = Math.max(best, 800000);
    else if (hay.includes(v)) best = Math.max(best, 700000);

    const parts = v.split(" ").filter(x => x.length > 1);
    if (parts.length) {
      let hits = 0;
      for (const p of parts) {
        if (hay.includes(p)) hits++;
        else if (p.length >= 4 && words.some(w => gkmLevV49(w, p) <= (p.length <= 5 ? 1 : 2))) hits++;
      }
      if (hits === parts.length) best = Math.max(best, 600000 + hits * 1000);
    }
  }

  if (best > 0) {
    if (getType(m) === "Аниме") best += 2000;
    if (getType(m) === "Мультфильм") best += 300;
    best += Math.min(getRating(m) || 0, 10) * 10;
    best += Math.min(getVotes(m) || 0, 100000) / 1000;
  }

  return best;
}

function matchesQuery(m, q) {
  return !q || gkmTitleSearchScoreV49(m, q) > 0;
}

function renderSearchPage(page = 1) {
  currentPage = page;
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));

  const start = (currentPage - 1) * PAGE_SIZE;
  currentItems = lastSearchResults.slice(start, start + PAGE_SIZE);

  renderList(currentItems, `Поиск: ${lastSearchResults.length} найдено · Страница ${currentPage} из ${currentPages}`);
}

async function runSearch() {
  const searchInput = $("searchInput");
  const qRaw = searchInput ? searchInput.value : "";
  const q = gkmSearchNormV49(qRaw);
  const controlsActive = hasActiveControls();

  if (!q && !controlsActive) {
    lastSearchResults = [];
    if (currentTab === "all") renderHome();
    else await loadPage(currentTab, 1);
    return;
  }

  const index = await ensureSearchIndex();
  let raw = [];

  if (q) {
    const scored = [];
    const variants = gkmSearchVariantsV49(q);

    for (let i = 0; i < index.length; i++) {
      const item = index[i];
      const hay = gkmTitleOnlyHayV49(item);

      // ЖЁСТКО: если в названии/алиасах нет запроса/синонима — вообще не показываем.
      let realTitleHit = false;
      for (const v of variants) {
        if (!v) continue;
        if (hay.includes(v)) {
          realTitleHit = true;
          break;
        }

        const parts = v.split(" ").filter(x => x.length > 1);
        if (parts.length && parts.every(p => hay.includes(p))) {
          realTitleHit = true;
          break;
        }
      }

      if (!realTitleHit) {
        if (i % 9000 === 0) await new Promise(r => setTimeout(r, 0));
        continue;
      }

      const s = gkmTitleSearchScoreV49(item, q);
      if (s > 0) scored.push({ item, s });

      if (i % 9000 === 0) await new Promise(r => setTimeout(r, 0));
    }

    scored.sort((a, b) => b.s - a.s);
    raw = scored.map(x => x.item);
  } else {
    raw = index;
  }

  const scoped = applyTabFilter(raw);
  lastSearchResults = applyLocalFilters(scoped);

  if (!lastSearchResults.length && q) {
    renderList([], `Поиск: 0 найдено · ищет строго по названию`);
    setStatus(`Поиск ничего не нашёл: ${qRaw}`);
    return;
  }

  renderSearchPage(1);
  setStatus(`Поиск: ${lastSearchResults.length} найдено`);
}

function factCard(label, value) {
  return `
    <div class="fact-card">
      <div class="fact-label">${escapeHtml(label)}</div>
      <div class="fact-value">${escapeHtml(value || "—")}</div>
    </div>
  `;
}

function collectPlayerLinks(m) {
  const links = [];

  const possible = [
    m.player, m.playerUrl, m.video, m.videoUrl, m.url, m.src, m.iframe, m.rutube,
    m.watchUrl, m.watch, m.trailer, m.trailerUrl,
    ...(Array.isArray(m.players) ? m.players : []),
    ...(Array.isArray(m.videoLinks) ? m.videoLinks : []),
    ...(Array.isArray(m.links) ? m.links : []),
    ...(Array.isArray(m.sources) ? m.sources : []),
  ].filter(Boolean);

  for (const item of possible) {
    if (typeof item === "string") {
      if (/rutube|youtube|youtu\.be|vk\.com|vkvideo|iframe|embed|http/i.test(item)) {
        let name = "Смотреть";
        if (/rutube/i.test(item)) name = "Rutube";
        else if (/youtu/i.test(item)) name = "YouTube";
        else if (/vk/i.test(item)) name = "VK Видео";
        links.push({ name, url: item });
      }
    } else if (item && typeof item === "object") {
      const url = item.url || item.src || item.href || item.iframe || item.embed || item.link || "";
      if (url) links.push({ name: item.name || item.title || item.label || "Смотреть", url });
    }
  }

  const seen = new Set();
  return links.filter(link => {
    const key = String(link.url || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function renderPlayerButtons(m) {
  const box = $("playerButtons");
  if (!box) return;

  const q = encodeURIComponent(titleOf(m));
  const links = collectPlayerLinks(m);

  const buttons = [];

  for (const link of links) {
    buttons.push(`<a class="watch-direct" target="_blank" rel="noreferrer" href="${escapeAttr(link.url)}">▶ ${escapeHtml(link.name || "Смотреть")}</a>`);
  }

  buttons.push(`<a target="_blank" rel="noreferrer" href="https://yandex.ru/video/search?text=${q} смотреть">Яндекс Видео</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://yandex.ru/search/?text=${q} смотреть онлайн">Яндекс поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://rutube.ru/search/?query=${q}">Rutube поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://vk.com/video?q=${q}">VK Видео поиск</a>`);
  buttons.push(`<a target="_blank" rel="noreferrer" href="https://www.youtube.com/results?search_query=${q} трейлер">YouTube трейлер</a>`);

  box.innerHTML = buttons.join("");
}


/* === GKM V66 RELATED CARDS IN DETAILS === */
function gkmRelatedNormV66(v) {
  return String(v || "").toLowerCase().replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я一-龯ぁ-ゔァ-ヴー々〆〤]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function gkmRelatedTextV66(m) {
  return gkmRelatedNormV66([
    titleOf(m), m && m.en, m && m.title, m && m.name, m && m.originalTitle,
    getType(m), getYear(m), ...(Array.isArray(m && m.genres) ? m.genres : []),
    ...(Array.isArray(m && m.aliases) ? m.aliases : []),
    ...(Array.isArray(m && m.aiTags) ? m.aiTags : []),
    ...(Array.isArray(m && m.moodTags) ? m.moodTags : []),
    ...(Array.isArray(m && m.recTags) ? m.recTags : []),
    m && m.overview, m && m.description, m && m.source
  ].join(" "));
}

function gkmRelatedKeyV66(m) {
  if (!m) return "";
  return String(m.id || "") || [getType(m), gkmRelatedNormV66(titleOf(m) || m.en || m.title || m.name), getYear(m)].join("|");
}

function gkmRelatedGenresV66(m) {
  return new Set(getGenres(m).map(gkmRelatedNormV66).filter(Boolean));
}

function gkmRelatedPoolV66() {
  const arr = [];
  try { if (Array.isArray(currentItems)) arr.push(...currentItems); } catch {}
  try { if (Array.isArray(lastSearchResults)) arr.push(...lastSearchResults); } catch {}
  try { if (Array.isArray(searchIndex)) arr.push(...searchIndex); } catch {}
  try {
    if (homeData && homeData.sections) {
      Object.values(homeData.sections).forEach(x => { if (Array.isArray(x)) arr.push(...x); });
    }
  } catch {}
  return gkmCleanListV60(arr);
}

function gkmRelatedScoreV66(base, item) {
  if (!base || !item) return -999999;
  if (gkmRelatedKeyV66(base) === gkmRelatedKeyV66(item)) return -999999;
  if (getType(base) !== getType(item)) return -999999;

  const votes = Number(getVotes(item) || 0);
  if (votes < 80) return -999999;

  const rating = Number(getRating(item) || 0);
  const bg = gkmRelatedGenresV66(base);
  const ig = gkmRelatedGenresV66(item);
  let genreScore = 0;
  ig.forEach(g => { if (bg.has(g)) genreScore += 18; });

  const bt = gkmRelatedTextV66(base);
  const it = gkmRelatedTextV66(item);
  let wordScore = 0;
  bt.split(" ").filter(w => w.length >= 4).slice(0, 35).forEach(w => {
    if (it.includes(w)) wordScore += 2;
  });

  const voteScore = Math.log10(votes + 1) * 12;
  const ratingScore = rating * 10;
  const yearBoost = Number(getYear(item) || 0) >= 2020 ? 3 : 0;
  const posterBoost = item.poster ? 4 : 0;
  const strongVoteGate = votes >= 300 ? 20 : 0;

  return genreScore + wordScore + voteScore + ratingScore + yearBoost + posterBoost + strongVoteGate;
}

function gkmPickRelatedV66(base, pool, limit = 10) {
  const seen = new Set();
  return gkmCleanListV60(pool)
    .filter(x => {
      const k = gkmRelatedKeyV66(x);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(x => ({ item: x, score: gkmRelatedScoreV66(base, x) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);
}

function gkmEnsureRelatedBlockV66() {
  let block = document.getElementById("relatedBlock");
  if (block) return block;

  block = document.createElement("section");
  block.id = "relatedBlock";
  block.className = "links-block related-block";
  block.innerHTML = `
    <h3 class="links-title">🔥 Что посмотреть похожее</h3>
    <div id="relatedCards" class="related-cards"></div>
  `;

  const playerBlock = document.getElementById("playerBlock");
  const animeBlock = document.getElementById("animeLinksBlock");
  const facts = document.getElementById("detailFacts");

  if (playerBlock && playerBlock.parentNode) playerBlock.parentNode.insertBefore(block, playerBlock);
  else if (animeBlock && animeBlock.parentNode) animeBlock.parentNode.insertBefore(block, animeBlock);
  else if (facts && facts.parentNode) facts.parentNode.insertBefore(block, facts.nextSibling);
  else {
    const content = document.querySelector("#detailsDialog .dialog-content") || document.getElementById("detailsDialog");
    if (content) content.appendChild(block);
  }

  return block;
}

function gkmRelatedCardHtmlV66(m) {
  const rank = rankOf(m).rank;
  const poster = m.poster
    ? `<img class="related-poster" src="${escapeAttr(m.poster)}" alt="">`
    : `<div class="related-poster related-empty">Нет<br>постера</div>`;
  return `
    <article class="related-card" data-related-id="${escapeAttr(m.id || gkmRelatedKeyV66(m))}">
      ${poster}
      <div class="related-info">
        <div class="related-title">${escapeHtml(titleOf(m))}</div>
        <div class="related-meta">${escapeHtml(getYear(m) || "—")} · ${escapeHtml(getType(m))}</div>
        <div class="related-meta">${escapeHtml(getGenres(m).slice(0, 3).join(" · ") || "Жанры не указаны")}</div>
        <div class="related-rating rank-${rank}">${escapeHtml(ratingLabel(m))} · ${escapeHtml(getVotes(m))} голосов</div>
      </div>
    </article>
  `;
}

async function renderRelatedCardsV66(baseItem) {
  const block = gkmEnsureRelatedBlockV66();
  const box = document.getElementById("relatedCards");
  if (!box || !baseItem) return;

  box.innerHTML = `<div class="related-loading">Подбираю похожее...</div>`;

  let pool = gkmRelatedPoolV66();
  let items = gkmPickRelatedV66(baseItem, pool, 10);

  // V69: не грузим весь search_index при открытии деталки.
  // Похожие берём из уже загруженных секций/текущего списка, чтобы деталка не подвешивала страницу.
  if (items.length < 6) {
    console.info("related: limited pool, search_index lazy load skipped for speed");
  }

  if (!items.length) {
    block.style.display = "none";
    return;
  }

  block.style.display = "";
  box.innerHTML = items.map(gkmRelatedCardHtmlV66).join("");

  box.querySelectorAll(".related-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-related-id");
      const item = items.find(x => String(x.id || gkmRelatedKeyV66(x)) === String(id));
      if (item) openDetails(item);
    });
  });
}

window.GKM_RELATED_CARDS_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
/* === /GKM V66 RELATED CARDS IN DETAILS === */


function openDetails(m) {
  selectedMovie = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  hist.add(String(m.id));
  saveSet(historyKey, hist);

  const dialog = $("detailsDialog");
  const rank = rankOf(m);
  const genres = getGenres(m);
  const source = m.source || m.provider || "—";
  const overview = m.overview || "Описание пока не добавлено.";

  $("detailPoster").src = m.poster || "";
  $("detailPoster").style.display = m.poster ? "block" : "none";
  $("detailTitle").textContent = titleOf(m);
  $("detailMeta").innerHTML = `
    <span class="detail-type-pill">${escapeHtml(getType(m))}</span>
    <span>${escapeHtml(getYear(m) || "—")}</span>
    <span class="detail-rating-pill rank-${rank.rank}">${escapeHtml(ratingLabel(m))}</span>
    <span>${escapeHtml(getVotes(m))} голосов</span>
  `;
  $("detailGenres").innerHTML = genres.length
    ? genres.slice(0, 12).map(g => `<span class="genre-chip">${escapeHtml(g)}</span>`).join("")
    : `<span class="genre-chip">Жанры не указаны</span>`;
  $("detailOverview").textContent = overview;

  const facts = $("detailFacts");
  if (facts) {
    facts.innerHTML = [
      factCard("Тип", getType(m)),
      factCard("Год", getYear(m)),
      factCard("Рейтинг", getRating(m).toFixed(1)),
      factCard("Голосов", getVotes(m)),
      factCard("Статус", m.status),
      factCard("Эпизоды", m.episodes),
      factCard("Студия", Array.isArray(m.studio) ? m.studio.join(", ") : m.studio),
      factCard("Страна", Array.isArray(m.country) ? m.country.join(", ") : m.country),
      factCard("Возраст", m.ageRating),
      factCard("Источник", source),
    ].filter(Boolean).join("");
  }

  renderPlayerButtons(m);
  setupDetailLinks(m);
  renderRelatedCardsV66(m);

  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}


function isAnimeLikeTitle(m) {
  const hay = normKey([
    getType(m),
    titleOf(m),
    m.en,
    m.ru,
    m.title,
    m.name,
    m.original_title,
    m.english,
    m.japanese,
    m.romaji,
    m.source,
    ...(m.genres || []),
    ...(m.aliases || []),
    ...(m.names || [])
  ].join(" "));

  if (getType(m) === "Аниме") return true;
  if (hay.includes("аниме") || hay.includes("anime") || hay.includes("jikan") || hay.includes("myanimelist")) return true;

  const hints = [
    "naruto", "наруто", "boruto", "боруто",
    "one piece", "ван пис", "ванпис", "ван-пис",
    "bleach", "блич",
    "demon slayer", "kimetsu", "истребитель демонов",
    "jujutsu", "магическая битва",
    "attack on titan", "атака титанов",
    "hunter x hunter", "охотник",
    "gintama", "гинтама",
    "frieren", "фрирен",
    "fullmetal", "стальной алхимик",
    "chainsaw", "бензопила",
    "dragon ball", "драконий жемчуг",
    "re zero", "re:zero", "ре зеро",
    "mushoku", "slime", "слизь",
    "jojo", "джоджо",
    "sword art online", "sao",
    "one punch", "ванпанч",
    "tokyo ghoul", "токийский гуль",
    "black clover", "fairy tail",
    "haikyuu", "волейбол",
    "pokemon", "покемон",
    "berserk", "берсерк",
    "death note", "тетрадь смерти",
    "violet evergarden", "вайолет эвергарден",
    "avatar the last airbender", "аватар легенда об аанге"
  ];

  return hints.some(h => hay.includes(normKey(h)));
}

function setupDetailLinks(m) {
  const q = encodeURIComponent(titleOf(m));
  const fav = loadSet(favKey);
  const isFav = fav.has(String(m.id));

  const favBtn = $("favBtn");
  if (favBtn) {
    favBtn.textContent = isFav ? "Убрать из избранного" : "В избранное";
    favBtn.onclick = () => {
      toggleFavorite(String(m.id));
      setupDetailLinks(m);
    };
  }

  const links = {
    yandexLink: `https://yandex.ru/search/?text=${q} смотреть онлайн`,
    yandexVideoLink: `https://yandex.ru/video/search?text=${q} смотреть`,
    kinopoiskLink: `https://www.kinopoisk.ru/index.php?kp_query=${q}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${q} трейлер`,
    vkLink: `https://vk.com/video?q=${q}`,
    rutubeLink: `https://rutube.ru/search/?query=${q}`,
    googleLink: `https://www.google.com/search?q=${q} смотреть`,
    shikimoriLink: `https://shikimori.one/animes?search=${q}`,
    malLink: `https://myanimelist.net/anime.php?q=${q}`,
    anilistLink: `https://anilist.co/search/anime?search=${q}`,
    animePlanetLink: `https://www.anime-planet.com/anime/all?name=${q}`,
    anidbLink: `https://anidb.net/anime/?adb.search=${q}&do.search=1`,
  };

  for (const [id, href] of Object.entries(links)) {
    const el = $(id);
    if (el) el.href = href;
  }

  const animeBlock = $("animeLinksBlock");
  if (animeBlock) animeBlock.style.display = isAnimeLikeTitle(m) ? "block" : "none";

  ensureDetailAnimeExtraLinks(m);
}



function ensureDetailAnimeExtraLinks(m) {
  const animeBlock = $("animeLinksBlock");
  if (!animeBlock || !isAnimeLikeTitle(m)) return;

  const q = encodeURIComponent(titleOf(m));
  const titleText = normKey(titleOf(m) + " " + (m.en || "") + " " + (m.original_title || ""));
  const isSlime = titleText.includes("слизь") || titleText.includes("slime") || titleText.includes("tensei shitara slime");

  const links = [
    ["shikimoriLink", "Shikimori", `https://shikimori.one/animes?search=${q}`],
    ["malLink", "MyAnimeList", `https://myanimelist.net/anime.php?q=${q}`],
    ["anilistLink", "AniList", `https://anilist.co/search/anime?search=${q}`],
    ["animePlanetLink", "Anime-Planet", `https://www.anime-planet.com/anime/all?name=${q}`],
    ["anidbLink", "AniDB", `https://anidb.net/anime/?adb.search=${q}&do.search=1`],
    ["yummyAnimeLink", "YummyAnime", isSlime ? "https://yummyanime.tv/1204-o-moem-pererozhdenii-v-sliz-film-g1.html" : `https://yummyanime.tv/index.php?do=search&subaction=search&story=${q}`]
  ];

  let box = animeBlock.querySelector(".detail-buttons");
  if (!box) {
    box = document.createElement("div");
    box.className = "detail-buttons";
    animeBlock.appendChild(box);
  }

  for (const [id, text, href] of links) {
    let a = document.getElementById(id);
    if (!a) {
      a = document.createElement("a");
      a.id = id;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = text;
      box.appendChild(a);
    }
    a.href = href;
    a.style.display = "";
  }
}

function toggleFavorite(id, btn) {
  const fav = loadSet(favKey);
  const key = String(id);

  if (fav.has(key)) {
    fav.delete(key);
    if (btn) {
      btn.classList.remove("active");
      btn.textContent = "🤍";
    }
  } else {
    fav.add(key);
    if (btn) {
      btn.classList.add("active");
      btn.textContent = "❤️";
    }
  }

  saveSet(favKey, fav);
}

function setActiveTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", (t.dataset.tab || "all") === tabName);
  });
}

async function renderFavorites() {
  const fav = loadSet(favKey);
  const index = await ensureSearchIndex();
  lastSearchResults = index.filter(x => fav.has(String(x.id)));
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

async function renderHistory() {
  const hist = [...loadSet(historyKey)];
  const index = await ensureSearchIndex();
  const map = new Map(index.map(x => [String(x.id), x]));
  lastSearchResults = hist.map(id => map.get(String(id))).filter(Boolean).reverse();
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

async function renderRandom() {
  const index = await ensureSearchIndex();
  lastSearchResults = [...index].sort(() => Math.random() - 0.5).slice(0, 240);
  currentPages = Math.max(1, Math.ceil(lastSearchResults.length / PAGE_SIZE));
  renderSearchPage(1);
}

function currentSearchActive() {
  const searchInput = $("searchInput");
  return Boolean(normKey(searchInput ? searchInput.value : "") || hasActiveControls());
}

function hasActiveControls() {
  const typeFilter = $("typeFilter");
  const genreFilter = $("genreFilter");
  const yearFilter = $("yearFilter");
  const ratingFilter = $("ratingFilter");
  const sortFilter = $("sortFilter");

  return Boolean(
    (typeFilter && typeFilter.value) ||
    (genreFilter && genreFilter.value) ||
    (yearFilter && yearFilter.value) ||
    Number(ratingFilter ? ratingFilter.value || 0 : 0) ||
    (sortFilter && sortFilter.value && sortFilter.value !== "smart")
  );
}

function applyTabFilter(list) {
  if (currentTab === "movies") return list.filter(m => getType(m) === "Фильм");
  if (currentTab === "series") return list.filter(m => getType(m) === "Сериал");
  if (currentTab === "anime") return list.filter(m => getType(m) === "Аниме");
  if (currentTab === "cartoons") return list.filter(m => getType(m) === "Мультфильм");
  if (currentTab === "top") return list.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP && getRating(m) >= 7);
  if (currentTab === "new") return list.filter(m => Number(getYear(m) || 0) >= 2024);
  if (currentTab === "popular") return list.filter(m => getVotes(m) >= 1000);
  return list;
}

function setupEvents() {
  document.addEventListener("click", async (e) => {
    const favBtn = e.target.closest(".card-fav-btn");

    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.favId, favBtn);
      return;
    }

    const moreBtn = e.target.closest("[data-open-tab]");
    if (moreBtn) {
      e.preventDefault();
      e.stopPropagation();
      const tabName = moreBtn.dataset.openTab || "all";
      await gkmOpenDepartmentV61(tabName);
      return;
    }

    const card = e.target.closest(".card");
    if (card) {
      const id = card.dataset.id;
      const item =
        currentItems.find(x => String(x.id) === String(id)) ||
        lastSearchResults.find(x => String(x.id) === String(id)) ||
        (searchIndex || []).find(x => String(x.id) === String(id));

      if (item) openDetails(item);
    }
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", async () => {
      const tabName = tab.dataset.tab || "all";
      setActiveTab(tabName);

      if (tabName === "fav") {
        await renderFavorites();
      } else if (tabName === "history") {
        await renderHistory();
      } else if (tabName === "random") {
        await renderRandom();
      } else if (currentSearchActive()) {
        await runSearch();
      } else if (tabName === "all") {
        currentPage = 1;
        renderHome();
      } else if (metaData && metaData.fallback && homeData && homeData.sections) {
        const section = homeData.sections[tabName] || [];
        currentItems = section;
        currentPage = 1;
        currentPages = 1;
        renderList(section, `Запасной раздел: ${section.length}`);
      } else {
        await loadPage(tabName, 1);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", async () => {
      if (currentPage <= 1) return;

      if (currentSearchActive() || currentTab === "fav" || currentTab === "history" || currentTab === "random") {
        renderSearchPage(currentPage - 1);
      } else {
        await loadPage(currentTab, currentPage - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      if (currentPage >= currentPages) return;

      if (currentSearchActive() || currentTab === "fav" || currentTab === "history" || currentTab === "random") {
        renderSearchPage(currentPage + 1);
      } else {
        await loadPage(currentTab, currentPage + 1);
      }
    });
  }

  const resetBtn = $("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      ["searchInput", "typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
        const el = $(id);
        if (el) el.value = "";
      });

      currentTab = "all";
      setActiveTab("all");
      renderHome();
    });
  }

  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 220);
    });
  }

  ["typeFilter", "genreFilter", "yearFilter", "ratingFilter", "sortFilter"].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("change", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, 120);
      });
    }
  });

  const closeDialog = $("closeDialog");
  if (closeDialog) {
    closeDialog.addEventListener("click", () => {
      const dialog = $("detailsDialog");
      if (dialog && dialog.open) dialog.close();
    });
  }
}

function showFatalError(e) {
  console.error(e);

  const grid = $("grid");
  const message = e && e.message ? e.message : String(e);

  if (grid) {
    grid.innerHTML = `
      <section class="home-hero">
        <div>
          <h2>Ошибка запуска</h2>
          <p>${escapeHtml(message)}</p>
          <p>Проверь, что существует папка data/fast и файлы home.json, meta.json, search_index.json.</p>
        </div>
      </section>
    `;
  }

  setStatus("Ошибка: " + message);
}

async function startApp() {
  console.log("GKM:", GKM_APP_CLEAN_VERSION);

  setupEvents();

  try {
    await loadHome();
  } catch (e) {
    showFatalError(e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

/* === GKM ABSOLUTE FREE HELPER V26 === */
(function () {
  const STOP_WORDS = new Set([
    "и","или","а","но","да","нет","ну","в","во","на","по","про","для","из","от","до","как","что","чем","где",
    "мне","меня","мой","моя","мои","мы","нам","ты","тебя","твой","свой","это","этот","эти","под","за","с","со",
    "подбери","посоветуй","найди","покажи","хочу","можно","надо","дай","кинь","сделай","смотреть","посмотреть",
    "что-нибудь","чтонибудь","норм","хорошее","лучшее","пожалуйста","брат","братик","бро"
  ]);

  const FIXES = [
    [/анимэ|анеме|анимешк/gi, "аниме"],
    [/поподан|пападан|поподанц|попаданц/gi, "попадан"],
    [/исекаи|исекайчик|исикай/gi, "исекай"],
    [/фентези|фэнтази|фентази/gi, "фэнтези"],
    [/сериял|сереал/gi, "сериал"],
    [/камеди|комеди/gi, "комедия"],
    [/детектев/gi, "детектив"],
    [/мультик|мульты/gi, "мультфильм"],
    [/романтика|романтич/gi, "романс"],
    [/главн(ый|ого)? герой|гг/gi, "главный герой"],
    [/имбовый|имбовая|имба/gi, "сильный герой"],
    [/левелинг|прокачка|уровни/gi, "прокачка уровни"],
    [/наруто|naruto/gi, "naruto сёнэн ниндзя"],
    [/интерстеллар|interstellar/gi, "interstellar космос фантастика драма"],
  ];

  const TAGS = {
    isekai: {
      words: ["попадан","попаданец","попаданцы","исекай","isekai","другой мир","ином мире","перерожд","реинкарн","призван","summoned","another world","parallel world"],
      boost: ["исекай","перерожд","реинкарн","другой мир","another world","isekai","summoned","parallel world","фэнтези","магия","приключения"],
      titles: ["re zero","rezero","starting life in another world","mushoku","jobless reincarnation","slime","tensei shitara","reincarnated as a slime","overlord","konosuba","sword art online","shield hero","tate no yuusha","tsukimichi","no game no life","log horizon","eminence in shadow","kage no jitsuryokusha","arifureta","cautious hero","youjo senki","moonlit fantasy","farming life in another world","death march","parallel world","world's finest assassin","ascendance of a bookworm","grimgar","problem children","black summoner","skeleton knight","campfire cooking"]
    },
    opmc: {
      words: ["сильн","имба","имбовый","overpowered","op","главный герой","прокачк","leveling","уровн","непобедим"],
      boost: ["сёнэн","сенэн","боевик","экшен","боевые искусства","приключения","фэнтези","прокачка"],
      titles: ["solo leveling","one punch","overlord","eminence in shadow","mob psycho","misfit","irregular at magic high school","slime","sword art online","hellsing","black summoner","mashle"]
    },
    magic: {
      words: ["маг","магия","волшеб","академ","заклин","чарод"],
      boost: ["магия","фэнтези","академия","сверхъестественное"]
    },
    dark: {
      words: ["мрач","жест","кров","dark","ужас","триллер","саспенс","страшн"],
      boost: ["ужасы","триллер","саспенс","психология","кровь"]
    },
    funny: {
      words: ["смешн","угар","ржач","комед","весел","легкое","легкий"],
      boost: ["комедия","пародия","повседневность"]
    },
    romance: {
      words: ["романт","любов","мелодрам","отнош","вайфу"],
      boost: ["романс","мелодрама","драма","школа"]
    },
    smart: {
      words: ["умн","психолог","детектив","головолом","интриг","мозг","расслед"],
      boost: ["психология","детектив","триллер","саспенс","тайна","мистика"],
      titles: ["death note","steins gate","monster","code geass","erased","psycho pass","parasyte","promised neverland","detective","mystery"]
    },
    space: {
      words: ["космос","космич","интерстел","галакт","звезд","планет"],
      boost: ["космос","фантастика","драма","приключения","sci-fi","science fiction"],
      titles: ["interstellar","gravity","martian","space odyssey","expanse","cowboy bebop","planetes"]
    },
    school: {
      words: ["школ","академ","учени","студент"],
      boost: ["школа","академия","повседневность"]
    },
    action: {
      words: ["боев","драк","экшен","битв","сраж","махач","мясо"],
      boost: ["боевик","экшен","сёнэн","сенэн","боевые искусства","приключения"]
    },
    survival: {
      words: ["выживание","зомби","апокалип","остров","игра на смерть","королевская битва"],
      boost: ["выживание","ужасы","триллер","боевик","зомби"]
    },
    sport: {
      words: ["спорт","футбол","баскет","волейбол","бокс"],
      boost: ["спорт"]
    },
    family: {
      words: ["семейн","детям","ребенку","детский","мульт"],
      boost: ["семейный","мультфильм","для детей","комедия"]
    },
    vampire: {
      words: ["вампир","vampire"],
      boost: ["вампиры","vampire","ужасы","сверхъестественное"]
    },
    demons: {
      words: ["демон","демоны","дьявол","devil","demon"],
      boost: ["демоны","сверхъестественное","ужасы","фэнтези"]
    },
    military: {
      words: ["война","военный","армия","military","war"],
      boost: ["военный","война","армия","история"]
    },
    dystopia: {
      words: ["антиутопия","постапокалипсис","киберпанк","cyberpunk","dystopia"],
      boost: ["антиутопия","киберпанк","фантастика","мрачное"]
    },
    game_world: {
      words: ["игровой мир","игры","vr","мморпг","mmorpg","виртуальная реальность"],
      boost: ["игры","виртуальная реальность","фэнтези","приключения"]
    },
    martial: {
      words: ["ниндзя","самурай","боевые искусства","ninja","samurai","martial"],
      boost: ["боевые искусства","самураи","ниндзя","боевик"]
    },
    new: {
      words: ["новин","новое","свежее","2024","2025","2026"],
      boost: []
    },
    top: {
      words: ["топ","лучшее","лучший","рейтинг","s-класс","а-класс","шедевр"],
      boost: []
    },
    popular: {
      words: ["популяр","известн","хайп","много голос"],
      boost: []
    }
  };

  const KIND_WORDS = {
    anime: ["аниме","анимэ","исекай","попадан","сёнэн","сенэн","манга","наруто","тян","вайфу"],
    movies: ["фильм","кино","кинчик","боевик","ужастик","комедия","вечер"],
    series: ["сериал","сериалы","сезон"],
    cartoons: ["мульт","мультфильм","мультик","детям"]
  };

  const SEMANTIC_EXPANSIONS = {
    "попадан": ["исекай","другой мир","перерождение","реинкарнация","призван","another world","isekai"],
    "исекай": ["попаданцы","другой мир","перерождение","реинкарнация","fantasy","adventure"],
    "сильный": ["opmc","overpowered","сильный герой","прокачка","leveling","боевик"],
    "мрачный": ["dark","триллер","ужасы","психология","саспенс","кровь"],
    "умный": ["smart","психология","детектив","mystery","mind game","интрига"],
    "легкий": ["funny","комедия","повседневность","без жести","slice of life"],
    "космос": ["space","фантастика","галактика","планеты","sci-fi"],
    "выживание": ["survival","апокалипсис","зомби","death game","battle royale"],
    "магия": ["magic","фэнтези","академия","заклинания"],
    "романтика": ["romance","мелодрама","любовь","отношения"],
    "самурай": ["martial","samurai","боевые искусства","история"],
    "ниндзя": ["martial","ninja","боевые искусства","сёнэн"],
    "киберпанк": ["cyberpunk","dystopia","фантастика","технологии"],
    "вампир": ["vampire","dark","сверхъестественное"],
    "демон": ["demons","dark","сверхъестественное","фэнтези"]
  };

  const ORACLE_PROFILES = {
    wife_evening: {
      label: "С женой вечером",
      query: "фильм на вечер без жести без ужасов рейтинг 7.5+",
      kind: "movies",
      tags: ["romance", "funny"]
    },
    hard_anime: {
      label: "Жёсткое аниме",
      query: "мрачное аниме с экшеном рейтинг 8+",
      kind: "anime",
      tags: ["dark", "action"]
    },
    isekai_op: {
      label: "Исекай + сильный ГГ",
      query: "аниме исекай попаданцы с сильным главным героем рейтинг 8+",
      kind: "anime",
      tags: ["isekai", "opmc"]
    },
    brain: {
      label: "Умный сюжет",
      query: "умный психологический детектив триллер рейтинг 8+",
      kind: "any",
      tags: ["smart"]
    },
    no_stress: {
      label: "Без напряга",
      query: "легкое смешное кино или аниме без жести",
      kind: "any",
      tags: ["funny"]
    },
    survival: {
      label: "Выживание",
      query: "сериал или фильм про выживание апокалипсис рейтинг 7+",
      kind: "any",
      tags: ["survival"]
    }
  };

  const shownIds = new Set();

  const GODMODE_PRESETS = {
    "аниме попаданцы": "5 аниме про попаданцев исекай с сильным главным героем рейтинг 8+ голосов 300+ без гарема",
    "сильный гг": "аниме с сильным главным героем прокачка уровни рейтинг 8+",
    "на вечер": "фильм на вечер рейтинг 8+ голосов 1000+ без шлака",
    "с женой": "фильм с женой вечером без жести рейтинг 7.5+",
    "без напряга": "легкое смешное без жести рейтинг 7+",
    "мрачное": "мрачный умный триллер детектив рейтинг 7.5+",
    "выживание": "сериал или фильм про выживание апокалипсис рейтинг 7+",
    "космос": "фантастика космос рейтинг 8+ голосов 1000+",
    "семейное": "семейный фильм мультфильм без жести рейтинг 7+"
  };

  function godmodePresetText(text) {
    const q = norm(text);
    for (const [key, val] of Object.entries(GODMODE_PRESETS)) {
      if (q.includes(key)) return val;
    }
    return "";
  }

  function explainQueryUnderstanding(text) {
    const cls = classify(text);
    const c = parseConstraints(text);
    const parts = [];
    parts.push("тип: " + (cls.kind || "любой"));
    if (cls.tags && cls.tags.length) parts.push("теги: " + cls.tags.join(", "));
    if (c.minRating) parts.push("рейтинг от " + c.minRating);
    if (c.minVotes) parts.push("голосов от " + c.minVotes);
    if (c.minYear) parts.push("после " + c.minYear);
    if (c.maxYear !== 9999) parts.push("до " + c.maxYear);
    if (c.excludeTags && c.excludeTags.size) parts.push("исключить: " + [...c.excludeTags].join(", "));
    return parts.join(" · ");
  }

  function addUnderstanding(text) {
    const understood = explainQueryUnderstanding(text);
    if (understood) addMsg("Понял запрос → " + understood, "bot");
  }

  function neuroPlan(text) {
    const cls = classify(text);
    const c = parseConstraints(text);
    const steps = [];
    steps.push("1) Определяю тип: " + (cls.kind || "любой"));
    if (cls.tags && cls.tags.length) steps.push("2) Поднимаю теги: " + cls.tags.join(", "));
    else steps.push("2) Ищу по смысловым словам и aiWords");
    steps.push("3) Отсекаю минусы: " + (c.excludeTags && c.excludeTags.size ? [...c.excludeTags].join(", ") : "нет"));
    steps.push("4) Учитываю качество: рейтинг, голоса, recScore, qualityFlags");
    steps.push("5) Учитываю твои лайки/дизлайки и контекст прошлого запроса");
    addMsg("NEURO-план:\n" + steps.join("\n"), "bot");
  }

  function aiBlacklist() {
    try { return new Set(JSON.parse(localStorage.getItem("gkm_ai_blacklist_words") || "[]")); }
    catch { return new Set(); }
  }

  function saveAiBlacklist(set) {
    try { localStorage.setItem("gkm_ai_blacklist_words", JSON.stringify([...set])); } catch {}
  }

  function addBlacklistWords(text) {
    const words = toks(text.replace(/заблокируй|не\s+показывай|убери\s+из\s+советов|минус/gi, ""));
    const bl = aiBlacklist();
    words.forEach(w => bl.add(w));
    saveAiBlacklist(bl);
    addMsg("Добавил в минус-слова: " + words.join(", "), "bot");
  }

  function clearBlacklistWords() {
    localStorage.removeItem("gkm_ai_blacklist_words");
    addMsg("Минус-слова очищены.", "bot");
  }

  function blacklistPenalty(item) {
    const bl = aiBlacklist();
    if (!bl.size) return 0;
    const full = textOfItem(item);
    let p = 0;
    bl.forEach(w => {
      if (full.includes(w)) p -= 80;
    });
    return p;
  }

  function savePlaylist(items, name) {
    try {
      const list = (items || []).map(x => ({
        id: x.id,
        title: titleOf(x),
        year: getYear(x),
        type: getType(x),
        rating: getRating(x),
        poster: posterOfItem(x)
      }));
      localStorage.setItem("gkm_ai_playlist_" + (name || "last"), JSON.stringify(list));
      localStorage.setItem("gkm_ai_playlist_last", JSON.stringify(list));
      addMsg("Сохранил подборку: " + list.length + " шт. Команда для просмотра: «покажи плейлист».", "bot");
    } catch {}
  }

  function absoluteConfig() {
    try { return JSON.parse(localStorage.getItem("gkm_ai_absolute_config") || "{}"); }
    catch { return {}; }
  }

  function saveAbsoluteConfig(c) {
    try { localStorage.setItem("gkm_ai_absolute_config", JSON.stringify(c || {})); } catch {}
  }

  function absoluteSet(key, value) {
    const c = absoluteConfig();
    c[key] = value;
    saveAbsoluteConfig(c);
    addMsg("ABSOLUTE настройка: " + key + " = " + value, "bot");
  }

  function absoluteBoostText() {
    const c = absoluteConfig();
    const parts = [];
    if (c.onlyReliable) parts.push("без шлака рейтинг 8+ голосов 1000+");
    if (c.onlyModern) parts.push("после 2015");
    if (c.noKids) parts.push("взрослое без детского");
    if (c.safe) parts.push("без жести без ужасов");
    if (c.short) parts.push("короткое на вечер");
    if (c.long) parts.push("марафон много серий");
    return parts.join(" ");
  }

  function absoluteMenu() {
    addBotWithActions("ABSOLUTE настройки будут подмешиваться ко всем коротким запросам:", [
      { label: "Только надёжное", run: () => absoluteSet("onlyReliable", true) },
      { label: "Только новое", run: () => absoluteSet("onlyModern", true) },
      { label: "Без детского", run: () => absoluteSet("noKids", true) },
      { label: "Без жести", run: () => absoluteSet("safe", true) },
      { label: "Короткое", run: () => absoluteSet("short", true) },
      { label: "Марафон", run: () => absoluteSet("long", true) }
    ]);
  }

  function absoluteReset() {
    localStorage.removeItem("gkm_ai_absolute_config");
    addMsg("ABSOLUTE настройки сброшены.", "bot");
  }

  function absoluteDirector(text) {
    const q = norm(text);
    if (/девочк|жена|романт|вдвоем|вдвоём/.test(q)) return "режим жена фильм на вечер без жести рейтинг 7.5+";
    if (/мужик|пацан|жестк|мясо|боевик/.test(q)) return "жесткое боевик экшен рейтинг 8+";
    if (/аниме|исекай|попадан/.test(q)) return "аниме исекай попаданцы сильный герой рейтинг 8+ без гарема";
    if (/семь|дет|мульт/.test(q)) return "семейное мультфильм без жести рейтинг 7+";
    if (/сон|ночь|устал/.test(q)) return "короткое легкое без жести рейтинг 7+";
    return "";
  }

  function absoluteExplainFull(text) {
    const cls = classify(text);
    const c = parseConstraints(text);
    const lines = [
      "ABSOLUTE разбор:",
      "тип: " + (cls.kind || "любой"),
      "интент: " + (cls.type || "recommend"),
      "теги: " + ((cls.tags && cls.tags.length) ? cls.tags.join(", ") : "нет"),
      "рейтинг от: " + (c.minRating || "не задан"),
      "голосов от: " + (c.minVotes || "не задан"),
      "год: " + (c.minYear || "любой") + " — " + (c.maxYear !== 9999 ? c.maxYear : "любой"),
      "исключения: " + (c.excludeTags && c.excludeTags.size ? [...c.excludeTags].join(", ") : "нет"),
      "absolute: " + (absoluteBoostText() || "нет")
    ];
    addMsg(lines.join("\\n"), "bot");
  }

  function infinityConfig() {
    try { return JSON.parse(localStorage.getItem("gkm_ai_infinity_config") || "{}"); }
    catch { return {}; }
  }

  function saveInfinityConfig(c) {
    try { localStorage.setItem("gkm_ai_infinity_config", JSON.stringify(c || {})); } catch {}
  }

  function setInfinityQuality(mode) {
    const c = infinityConfig();
    c.quality = mode;
    saveInfinityConfig(c);
    addMsg("INFINITY качество: " + mode, "bot");
  }

  function infinityQualityBoost() {
    const c = infinityConfig();
    if (c.quality === "strict") return "без шлака рейтинг 8.2+ голосов 3000+";
    if (c.quality === "balanced") return "рейтинг 7.7+ голосов 500+";
    if (c.quality === "hidden") return "скрытые жемчужины рейтинг 7.4+ голосов 100+";
    return "";
  }

  function infinityMenu() {
    addBotWithActions("INFINITY режим. Выбери качество и стиль подбора:", [
      { label: "Строго годное", run: () => setInfinityQuality("strict") },
      { label: "Баланс", run: () => setInfinityQuality("balanced") },
      { label: "Скрытые", run: () => setInfinityQuality("hidden") },
      { label: "Микс 3+3+3", run: () => infinityMix() },
      { label: "План на вечер", run: () => infinityEveningPlan() }
    ]);
  }

  function infinityMix() {
    addMsg("Собираю микс: аниме + фильм + сериал.", "bot");
    recommendFromQuery("3 аниме рейтинг 8+ без шлака", { kind: "anime", intro: "INFINITY микс: аниме", limit: 3 });
    recommendFromQuery("3 фильма рейтинг 8+ голосов 1000+", { kind: "movies", intro: "INFINITY микс: фильмы", limit: 3 });
    recommendFromQuery("3 сериала рейтинг 8+ голосов 1000+", { kind: "series", intro: "INFINITY микс: сериалы", limit: 3 });
  }

  function infinityEveningPlan() {
    addBotWithActions("План на вечер:", [
      { label: "1 фильм", run: () => recommendFromQuery("один фильм на вечер рейтинг 8+ без жести", { kind: "movies", limit: 1, intro: "План на вечер: один фильм" }) },
      { label: "2 серии", run: () => recommendFromQuery("короткий сериал 2 серии на вечер рейтинг 8+", { kind: "series", limit: 2, intro: "План на вечер: 2 серии" }) },
      { label: "Аниме вечер", run: () => recommendFromQuery("аниме на вечер рейтинг 8+ без шлака", { kind: "anime", limit: 3, intro: "План на вечер: аниме" }) }
    ]);
  }

  function infinityState() {
    const c = infinityConfig();
    const sup = supremeSession ? supremeSession() : {};
    const apex = apexProfile ? apexProfile() : {};
    addMsg(
      "INFINITY состояние:\\n" +
      "качество: " + (c.quality || "обычно") + "\\n" +
      "supreme mode: " + (sup.mode || "нет") + "\\n" +
      "apex profile: " + (Object.keys(apex).length ? JSON.stringify(apex) : "пусто"),
      "bot"
    );
  }

  function ultraProfileBoostText() {
    const likes = aiFeedbackSet("gkm_ai_likes");
    const dislikes = aiFeedbackSet("gkm_ai_dislikes");
    const p = apexProfile ? apexProfile() : {};
    const parts = [];

    if (likes.size >= 3) parts.push("учитывай лайки");
    if (dislikes.size >= 3) parts.push("не повторяй дизлайки");
    if (p.noTrash) parts.push("без шлака");
    if (p.safe) parts.push("без жести");
    if (p.newer) parts.push("посвежее");
    if (p.mood) parts.push(p.mood);
    return parts.join(" ");
  }

  function ultraRewrite(text) {
    let q = String(text || "").trim();
    const n = norm(q);
    const boost = ultraProfileBoostText();

    if (/^(посоветуй|подбери|что смотреть|что посмотреть)$/i.test(n)) q = "что посмотреть рейтинг 8+ голосов 1000+";
    if (/скрыт|жемчуж|недооцен/.test(n)) q += " рейтинг 7.5+ голосов 100+";
    if (/безопасн|спокойн|не напряж/.test(n)) q += " без жести без ужасов";
    if (/жестк|мясо|кров/.test(n)) q += " мрачное экшен триллер";
    if (/самое лучшее|ультра топ|легенд/.test(n)) q += " рейтинг 8.7+ голосов 10000+";
    if (/новое/.test(n)) q += " после 2020";
    if (/старое|классик/.test(n)) q += " до 2010";

    const inf = infinityQualityBoost();
    const abs = absoluteBoostText();
    const director = absoluteDirector(q);
    if (director && toks(q).length <= 4) q += " " + director;
    if (boost) q += " " + boost;
    if (inf) q += " " + inf;
    if (abs && !/сброс|настрой|режим|команды/.test(n)) q += " " + abs;
    return q;
  }

  function ultraModes() {
    addBotWithActions("ULTRA INSTINCT режимы:", [
      { label: "Легенды", run: () => recommendFromQuery("легендарное рейтинг 8.7+ голосов 10000+", { intro: "ULTRA: легенды:" }) },
      { label: "Скрытые жемчужины", run: () => recommendFromQuery("скрытые жемчужины рейтинг 7.5+ голосов 100+", { intro: "ULTRA: скрытые жемчужины:" }) },
      { label: "Без риска", run: () => recommendFromQuery("без шлака рейтинг 8+ голосов 1000+ без жести", { intro: "ULTRA: безопасный выбор:" }) },
      { label: "Жёстко", run: () => recommendFromQuery("жесткое мрачное экшен триллер рейтинг 8+", { intro: "ULTRA: жёсткое:" }) },
      { label: "По вкусу", run: () => recommendFromQuery("под мой вкус рейтинг 8+", { intro: "ULTRA: под твой вкус:" }) }
    ]);
  }

  function ultraSummary() {
    const ctx = getAiContext();
    const likes = aiFeedbackSet("gkm_ai_likes");
    const dislikes = aiFeedbackSet("gkm_ai_dislikes");
    const bl = aiBlacklist ? aiBlacklist() : new Set();
    addMsg(
      "ULTRA память:\\n" +
      "последний запрос: " + (ctx.lastQuery || "нет") + "\\n" +
      "последний тайтл: " + (ctx.lastTitle || "нет") + "\\n" +
      "лайков: " + likes.size + "\\n" +
      "дизлайков: " + dislikes.size + "\\n" +
      "минус-слов: " + bl.size,
      "bot"
    );
  }

  function supremeSession() {
    try { return JSON.parse(localStorage.getItem("gkm_ai_supreme_session") || "{}"); }
    catch { return {}; }
  }

  function saveSupremeSession(s) {
    try { localStorage.setItem("gkm_ai_supreme_session", JSON.stringify(s || {})); } catch {}
  }

  function setSupremeMode(mode) {
    const s = supremeSession();
    s.mode = mode;
    s.time = Date.now();
    saveSupremeSession(s);
    addMsg("SUPREME-режим включён: " + mode, "bot");
  }

  function supremeModeBoost() {
    const s = supremeSession();
    if (!s.mode) return "";
    if (s.mode === "company") return "популярное без жести рейтинг 7.5+ голосов 1000+";
    if (s.mode === "solo") return "умное атмосферное рейтинг 8+";
    if (s.mode === "wife") return "с женой без жести без ужасов рейтинг 7.5+";
    if (s.mode === "anime") return "аниме рейтинг 8+ голосов 500+";
    if (s.mode === "trash_off") return "без шлака рейтинг 8+ голосов 1000+";
    return "";
  }

  function supremeExplainModes() {
    addBotWithActions("SUPREME умеет режимы. Они будут подмешиваться в короткие запросы.", [
      { label: "Для компании", run: () => setSupremeMode("company") },
      { label: "Один", run: () => setSupremeMode("solo") },
      { label: "С женой", run: () => setSupremeMode("wife") },
      { label: "Аниме", run: () => setSupremeMode("anime") },
      { label: "Анти-мусор", run: () => setSupremeMode("trash_off") }
    ]);
  }

  function supremeReset() {
    localStorage.removeItem("gkm_ai_supreme_session");
    addMsg("SUPREME-режим сброшен.", "bot");
  }

  function apexProfile() {
    try { return JSON.parse(localStorage.getItem("gkm_ai_apex_profile") || "{}"); }
    catch { return {}; }
  }

  function saveApexProfile(p) {
    try { localStorage.setItem("gkm_ai_apex_profile", JSON.stringify(p || {})); } catch {}
  }

  function setProfileValue(key, value) {
    const p = apexProfile();
    p[key] = value;
    saveApexProfile(p);
    addMsg("Запомнил профиль: " + key + " = " + value, "bot");
  }

  function profileQueryBoost() {
    const p = apexProfile();
    const parts = [];
    if (p.kind) parts.push("только " + p.kind);
    if (p.mood) parts.push(p.mood);
    if (p.noTrash) parts.push("без шлака рейтинг 8+ голосов 1000+");
    if (p.safe) parts.push("без жести");
    if (p.noRomance) parts.push("без романтики");
    if (p.newer) parts.push("после 2015");
    return parts.join(" ");
  }

  function startApexQuiz() {
    addBotWithActions("APEX-квиз: выбери, что чаще хочешь смотреть. Я сохраню профиль в этом браузере.", [
      { label: "Аниме", run: () => setProfileValue("kind", "аниме") },
      { label: "Фильмы", run: () => setProfileValue("kind", "фильм") },
      { label: "Сериалы", run: () => setProfileValue("kind", "сериал") },
      { label: "Без шлака", run: () => setProfileValue("noTrash", true) },
      { label: "Без жести", run: () => setProfileValue("safe", true) },
      { label: "Новее", run: () => setProfileValue("newer", true) }
    ]);
    addBotWithActions("Настроение:", [
      { label: "Исекай", run: () => setProfileValue("mood", "исекай попаданцы") },
      { label: "Сильный ГГ", run: () => setProfileValue("mood", "сильный главный герой") },
      { label: "Мрачное", run: () => setProfileValue("mood", "мрачное умное") },
      { label: "Лёгкое", run: () => setProfileValue("mood", "легкое смешное") },
      { label: "Космос", run: () => setProfileValue("mood", "космос фантастика") }
    ]);
  }

  function showApexProfile() {
    const p = apexProfile();
    const keys = Object.keys(p);
    if (!keys.length) {
      addMsg("Профиль пуст. Напиши «квиз» и я настрою вкус.", "bot");
      return;
    }
    addMsg("APEX-профиль:\n" + keys.map(k => k + ": " + p[k]).join("\n"), "bot");
  }

  function resetApexProfile() {
    localStorage.removeItem("gkm_ai_apex_profile");
    addMsg("APEX-профиль сброшен.", "bot");
  }

  function omegaTimePreset() {
    const h = new Date().getHours();
    if (h >= 22 || h < 5) return "короткое легкое без жести рейтинг 7+";
    if (h >= 18) return "фильм на вечер рейтинг 8+ голосов 1000+";
    return "что посмотреть рейтинг 8+ без шлака";
  }

  function omegaImproveQuery(text) {
    let q = String(text || "").trim();
    const profileBoost = profileQueryBoost();
    const n = norm(q);

    if (/^(аниме|анимэ)$/.test(n)) q = "топ аниме рейтинг 8+ голосов 1000+";
    if (/^(фильм|кино)$/.test(n)) q = "фильм на вечер рейтинг 8+ голосов 1000+";
    if (/^(сериал)$/.test(n)) q = "сериал рейтинг 8+ голосов 1000+";
    if (/^(мульт|мультик|мультфильм)$/.test(n)) q = "мультфильм семейный рейтинг 7+";
    if (/^(вечер|на вечер)$/.test(n)) q = omegaTimePreset();

    if (/марафон|надолго|много серий/i.test(n)) q += " длинное много серий";
    if (/быстро|короткое|на час/i.test(n)) q += " короткое";
    if (/жена|с женой|для двоих/i.test(n)) q += " без жести без ужасов";
    if (/топчик|имба|самое лучшее/i.test(n)) q += " рейтинг 8.3+ голосов 1000+ без шлака";
    const supremeBoost = supremeModeBoost();
    if (profileBoost && !/сброс|профиль|квиз|команды/.test(n)) q += " " + profileBoost;
    if (supremeBoost && !/сброс|режим|команды/.test(n)) q += " " + supremeBoost;

    return q;
  }

  function exportPlaylistText() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem("gkm_ai_playlist_last") || "[]"); } catch {}
    if (!list.length && Array.isArray(window.GKM_AI_LAST_ITEMS)) {
      list = window.GKM_AI_LAST_ITEMS.map(x => ({
        title: titleOf(x), year: getYear(x), type: getType(x), rating: getRating(x)
      }));
    }
    if (!list.length) {
      addMsg("Экспортировать нечего. Сначала сделай подборку.", "bot");
      return;
    }

    const text = list.slice(0, 20).map((x, i) =>
      `${i + 1}. ${x.title} (${x.year || "—"}) · ${x.type || "—"} · ${x.rating || "—"}`
    ).join("\\n");

    navigator.clipboard && navigator.clipboard.writeText(text).then(
      () => addMsg("Скопировал подборку в буфер:\\n" + text, "bot"),
      () => addMsg("Не смог скопировать автоматически. Вот текст:\\n" + text, "bot")
    );
    if (!navigator.clipboard) addMsg("Вот подборка:\\n" + text, "bot");
  }

  function diagnoseNoResults(query) {
    const c = parseConstraints(query);
    const reasons = [];
    if (c.minRating >= 8.5) reasons.push("слишком высокий рейтинг");
    if (c.minVotes >= 1000) reasons.push("слишком много голосов");
    if (c.excludeTags && c.excludeTags.size >= 2) reasons.push("много исключений");
    if (c.minYear >= 2023) reasons.push("слишком свежий год");
    if (!reasons.length) reasons.push("в базе мало точных совпадений");
    addBotWithActions("Если результатов мало: " + reasons.join(", ") + ". Могу ослабить фильтр.", [
      { label: "Ослабить", run: () => recommendFromQuery(String(query).replace(/рейтинг\\s*\\d+(?:[\\.,]\\d)?\\+?/gi, "рейтинг 7+").replace(/голосов\\s*\\d+\\+?/gi, "голосов 100+"), { intro: "Ослабил фильтр:" }) },
      { label: "Популярное", run: () => clickByText(["Популярное"]) }
    ]);
  }

  function showPlaylist() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem("gkm_ai_playlist_last") || "[]"); } catch {}
    if (!list.length) {
      addMsg("Плейлист пуст. Сначала попроси подборку и напиши «сохрани плейлист».", "bot");
      return;
    }
    addBotWithActions("В плейлисте " + list.length + " тайтлов. Могу кинуть первый в поиск.", [
      { label: "Открыть первый", run: () => setSearch(list[0].title) },
      { label: "Очистить", run: () => { localStorage.removeItem("gkm_ai_playlist_last"); addMsg("Плейлист очищен.", "bot"); } }
    ]);
    list.slice(0, 10).forEach((x, i) => {
      addMsg((i+1) + ". " + x.title + " (" + (x.year || "—") + ") · " + (x.type || "—") + " · " + (x.rating || "—"), "bot");
    });
  }


  function getAiContext() {
    try { return JSON.parse(localStorage.getItem("gkm_ai_context") || "{}"); }
    catch { return {}; }
  }

  function setAiContext(ctx) {
    try { localStorage.setItem("gkm_ai_context", JSON.stringify(ctx || {})); } catch {}
  }

  function mergeWithContext(text) {
    const q = norm(text);
    const ctx = getAiContext();
    const last = ctx.lastQuery || "";

    if (!last) return text;

    // Follow-up команды: "ещё", "похожие", "не это", "без романтики", "рейтинг 8+"
    if (/^(еще|ещё|давай еще|давай ещё|покажи еще|покажи ещё|дальше|следующие|еще варианты|ещё варианты)$/i.test(q)) {
      return last + " " + text;
    }

    if (/^(не то|не это|другое|другие|не подходит|не зашло)$/i.test(q)) {
      return last + " без похожего на прошлое";
    }

    if (/^(похожие|похожее|такое же|типа этого)$/i.test(q) && ctx.lastTitle) {
      return "похожее на " + ctx.lastTitle;
    }

    if (/^(без|с|после|до|рейтинг|оценка|голосов|не старше|новее)/i.test(q)) {
      return last + " " + text;
    }

    return text;
  }

  function rememberContext(query, items) {
    try {
      const first = items && items[0];
      setAiContext({
        lastQuery: query,
        lastTitle: first ? titleOf(first) : "",
        lastKind: first ? kindFromItem(first) : classify(query).kind,
        time: Date.now()
      });
    } catch {}
  }


  function aiFeedbackSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch { return new Set(); }
  }

  function saveAiFeedback(key, set) {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
  }

  function markAiFeedback(item, liked) {
    if (!item || item.id == null) return;
    const id = String(item.id);
    const likes = aiFeedbackSet("gkm_ai_likes");
    const dislikes = aiFeedbackSet("gkm_ai_dislikes");

    if (liked) {
      likes.add(id);
      dislikes.delete(id);
      saveAiFeedback("gkm_ai_likes", likes);
      saveAiFeedback("gkm_ai_dislikes", dislikes);
      addMsg("Запомнил: тебе такое нравится. Дальше похожее буду поднимать выше.", "bot");
    } else {
      dislikes.add(id);
      likes.delete(id);
      saveAiFeedback("gkm_ai_dislikes", dislikes);
      saveAiFeedback("gkm_ai_likes", likes);
      addMsg("Понял: такое опущу ниже в будущих советах.", "bot");
    }
  }


  function $(id) { return document.getElementById(id); }
  function box() { return $("gkmAiMessages"); }
  function norm(text) { return String(text || "").toLowerCase().replaceAll("ё", "е").trim(); }
  function fixQuery(text) {
    let q = String(text || "");
    FIXES.forEach(([rx, to]) => q = q.replace(rx, to));
    return q;
  }
  function compact(text) { return norm(fixQuery(text)).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }
  function toks(text) { return compact(text).split(" ").filter(t => t.length >= 3 && !STOP_WORDS.has(t)); }

  function semanticTokens(text) {
    const base = new Set(toks(text));
    const q = norm(fixQuery(text));
    Object.entries(SEMANTIC_EXPANSIONS || {}).forEach(([key, vals]) => {
      if (q.includes(key)) {
        base.add(key);
        vals.forEach(v => toks(v).forEach(t => base.add(t)));
      }
    });
    return [...base];
  }

  function tokenSimilarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length < 4 || b.length < 4) return 0;
    if (a.includes(b) || b.includes(a)) return 0.72;

    // лёгкая похожесть для опечаток без тяжёлкого алгоритма
    const min = Math.min(a.length, b.length);
    let same = 0;
    for (let i = 0; i < min; i++) if (a[i] === b[i]) same++;
    return same / Math.max(a.length, b.length);
  }

  function hasAny(q, arr) { return arr.some(x => q.includes(norm(x))); }

  function parseConstraints(raw) {
    const q = norm(fixQuery(raw));
    const c = {
      minYear: 0,
      maxYear: 9999,
      minRating: 0,
      limit: 5,
      excludeTags: new Set(),
      includeTags: new Set(),
      preferNew: false,
      preferShort: false,
      preferLong: false,
      onlyWithPoster: false,
      minVotes: 0,
      excludeWatched: false,
      safeMode: false,
      forceKind: ""
    };

    const yearAfter = q.match(/(?:после|от|с)\s*(19\d{2}|20\d{2})/);
    const yearBefore = q.match(/(?:до|раньше)\s*(19\d{2}|20\d{2})/);
    const exactYear = q.match(/(?:за|год|в)\s*(19\d{2}|20\d{2})/);
    if (yearAfter) c.minYear = Number(yearAfter[1]);
    if (yearBefore) c.maxYear = Number(yearBefore[1]);
    if (exactYear && !yearAfter && !yearBefore) {
      c.minYear = Number(exactYear[1]);
      c.maxYear = Number(exactYear[1]);
    }

    const rating = q.match(/(?:рейтинг|оценк[аи]?|от)\s*(\d(?:[\.,]\d)?|10)(?:\+|\s*и\s*выше)?/);
    const ratingPlus = q.match(/(\d(?:[\.,]\d)?|10)\s*\+/);
    if (rating) c.minRating = Number(rating[1].replace(",", "."));
    else if (ratingPlus) c.minRating = Number(ratingPlus[1].replace(",", "."));

    const count = q.match(/(?:дай|покажи|подбери)?\s*(\d{1,2})\s*(?:вариант|аниме|фильм|сериал|штук)/);
    if (count) c.limit = Math.max(1, Math.min(10, Number(count[1])));

    if (/без\s+романт|без\s+любв|не\s+романт/.test(q)) c.excludeTags.add("romance");
    if (/без\s+ужас|не\s+страш|без\s+кров|без\s+жести/.test(q)) c.excludeTags.add("dark");
    if (/без\s+комед|не\s+смешн/.test(q)) c.excludeTags.add("funny");
    if (/без\s+школ/.test(q)) c.excludeTags.add("school");
    if (/без\s+меха|без\s+робот/.test(q)) c.excludeTags.add("mecha");
    if (/без\s+гарем|не\s+гарем/.test(q)) c.excludeTags.add("harem");

    if (/с\s+романт|романт|любов/.test(q)) c.includeTags.add("romance");
    if (/мрач|темн|жест|триллер|ужас/.test(q)) c.includeTags.add("dark");
    if (/смешн|комед|легк|угар/.test(q)) c.includeTags.add("funny");
    if (/школ|академ/.test(q)) c.includeTags.add("school");
    if (/выживание|зомби|апокалип/.test(q)) c.includeTags.add("survival");
    if (/космос|галакт|звезд/.test(q)) c.includeTags.add("space");

    if (/новое|свеж|посвежее|новин/.test(q)) c.preferNew = true;
    if (/коротк|на\s+вечер|быстро/.test(q)) c.preferShort = true;
    if (/длинн|много\s+серий|надолго/.test(q)) c.preferLong = true;
    if (/с\s+постер|красив|визуал/.test(q)) c.onlyWithPoster = true;


    const votes = q.match(/(?:голосов|оценок|votes)\\s*(\\d{2,7})\\+?/);
    if (votes) c.minVotes = Number(votes[1]);

    if (/без\\s+мусор|без\\s+шлака|только\\s+норм|проверенн/.test(q)) {
      c.minVotes = Math.max(c.minVotes, 300);
      c.minRating = Math.max(c.minRating, 7);
    }

    if (/не\\s+показывай\\s+уже|без\\s+просмотренн|новое\\s+для\\s+меня/.test(q)) c.excludeWatched = true;
    if (/без\\s+жести|без\\s+крови|без\\s+насилия|спокойн/.test(q)) c.safeMode = true;

    if (/для\s+семьи|семейное|с\s+ребенком|с\s+детьми/.test(q)) {
      c.includeTags.add("family");
      c.safeMode = true;
    }

    if (/взросл|без\s+детск|не\s+детск/.test(q)) {
      c.excludeTags.add("family");
      c.excludeTags.add("school");
    }

    if (/только\s+аниме|строго\s+аниме/.test(q)) c.forceKind = "anime";
    if (/только\s+фильм|строго\s+фильм/.test(q)) c.forceKind = "movies";
    if (/только\s+сериал|строго\s+сериал/.test(q)) c.forceKind = "series";

    return c;
  }

  function itemHasTag(item, tag) {
    const all = new Set([...tagsOfItem(item), ...genresOfItem(item).map(norm), ...textOfItem(item).split(/\s+/)]);
    if (tag === "romance") return all.has("romance") || all.has("романс") || all.has("мелодрама") || all.has("романтика");
    if (tag === "dark") return all.has("dark") || all.has("ужасы") || all.has("триллер") || all.has("саспенс") || all.has("horror");
    if (tag === "funny") return all.has("funny") || all.has("комедия") || all.has("comedy");
    if (tag === "school") return all.has("school") || all.has("школа") || all.has("академия");
    if (tag === "survival") return all.has("survival") || all.has("выживание") || all.has("зомби");
    if (tag === "space") return all.has("space") || all.has("космос") || all.has("фантастика");
    return all.has(tag);
  }

  function passesConstraints(item, c) {
    const year = Number(getYear(item) || 0);
    const rating = Number(getRating(item) || 0);

    if (c.minYear && year && year < c.minYear) return false;
    if (c.maxYear !== 9999 && year && year > c.maxYear) return false;
    if (c.minRating && rating < c.minRating) return false;
    if (c.minVotes && Number(getVotes(item) || 0) < c.minVotes) return false;
    if (c.onlyWithPoster && !posterOfItem(item)) return false;

    try {
      if (c.excludeWatched) {
        const hist = new Set(JSON.parse(localStorage.getItem("gkm_history") || "[]"));
        if (hist.has(String(item.id))) return false;
      }
    } catch {}

    if (c.safeMode && (itemHasTag(item, "dark") || itemHasTag(item, "survival"))) return false;

    for (const tag of c.excludeTags) {
      if (itemHasTag(item, tag)) return false;
    }

    return true;
  }

  function constraintBoost(item, c) {
    let boost = 0;
    const year = Number(getYear(item) || 0);
    const votes = Number(getVotes(item) || 0);

    for (const tag of c.includeTags) {
      if (itemHasTag(item, tag)) boost += 35;
    }

    if (c.preferNew && year >= 2020) boost += 25;
    if (c.preferNew && year >= 2024) boost += 35;
    if (c.preferShort && votes > 5000) boost += 4;
    if (c.preferLong && votes > 10000) boost += 4;
    if (posterOfItem(item)) boost += 2;

    return boost;
  }

  function scrollAi() { const b = box(); if (b) b.scrollTop = b.scrollHeight; }

  function limitMessages() {
    const b = box();
    if (!b) return;
    const msgs = Array.from(b.querySelectorAll(".ai-msg"));
    if (msgs.length > 34) msgs.slice(1, 10).forEach(x => x.remove());
  }

  function addMsg(text, who) {
    const b = box();
    if (!b) return null;
    const div = document.createElement("div");
    div.className = "ai-msg " + (who === "user" ? "ai-user" : "ai-bot");
    div.textContent = text;
    b.appendChild(div);
    limitMessages();
    scrollAi();
    return div;
  }

  function addBotWithActions(text, actions) {
    const b = box();
    if (!b) return;
    const div = document.createElement("div");
    div.className = "ai-msg ai-bot";
    const p = document.createElement("div");
    p.textContent = text;
    div.appendChild(p);

    if (actions && actions.length) {
      const row = document.createElement("div");
      row.className = "ai-action-row";
      actions.forEach(a => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = a.label;
        btn.addEventListener("click", a.run);
        row.appendChild(btn);
      });
      div.appendChild(row);
    }

    b.appendChild(div);
    limitMessages();
    scrollAi();
  }

  function posterOfItem(item) {
    return item.poster || item.posterUrl || item.image || item.imageUrl || "";
  }

  function genresOfItem(item) {
    return getGenres(item) || item.genres || [];
  }

  function textOfItem(item) {
    return norm([
      titleOf(item), item.en, item.title, item.name, item.originalTitle,
      getType(item), getYear(item), ...(genresOfItem(item) || []),
      ...(item.aiTags || []), ...(item.moodTags || []), ...(item.recTags || []),
      item.absoluteText, item.infinityText, item.ultraText, item.supremeText, item.apexText, item.omegaText, item.recText, item.qualityTier, item.popularityTier, ...(item.qualityFlags || []), ...(item.neuroVector || []), item.overview, item.description, item.source
    ].join(" "));
  }

  function tagsOfItem(item) {
    return [
      ...(Array.isArray(item.aiTags) ? item.aiTags : []),
      ...(Array.isArray(item.moodTags) ? item.moodTags : []),
      ...(Array.isArray(item.recTags) ? item.recTags : [])
    ].map(norm);
  }

  function addRecommendationCard(item, intro, query, kind, number) {
    const b = box();
    if (!b || !item) return;

    const wrap = document.createElement("div");
    wrap.className = "ai-msg ai-bot ai-rec-msg";

    const introEl = document.createElement("div");
    introEl.textContent = intro || "Вот вариант:";
    wrap.appendChild(introEl);

    const card = document.createElement("div");
    card.className = "ai-rec-card";

    const poster = document.createElement("img");
    poster.className = "ai-rec-poster";
    poster.loading = "lazy";
    poster.alt = titleOf(item);
    poster.src = posterOfItem(item) || "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="100%" height="100%" fill="#0a1020"/><text x="50%" y="50%" fill="#fff" font-size="14" text-anchor="middle">Нет постера</text></svg>');
    card.appendChild(poster);

    const rating = Number(getRating(item) || 0);
    const votes = Number(getVotes(item) || 0);
    const genres = (genresOfItem(item) || []).slice(0, 4).join(" · ");

    const info = document.createElement("div");
    info.className = "ai-rec-info";
    info.innerHTML = `
      <div class="ai-rec-title">${number ? number + ". " : ""}${escapeHtml(titleOf(item))}</div>
      <div class="ai-rec-meta">${escapeHtml(getYear(item) || "—")} · ${escapeHtml(getType(item) || "—")}</div>
      <div class="ai-rec-meta">${escapeHtml(genres || "Без жанров")}</div>
      <div class="ai-rec-meta">⭐ ${rating ? rating.toFixed(1) : "—"} · 👥 ${votes ? String(votes) : "—"}</div>
      <div class="ai-match-row"><span style="width:${matchPercent(item, query)}%"></span></div>
      <div class="ai-rec-meta">Совпадение: ${matchPercent(item, query)}%</div>
    `;
    card.appendChild(info);
    wrap.appendChild(card);

    const why = explainWhy(item, query);
    if (why) {
      const w = document.createElement("div");
      w.className = "ai-rec-why";
      w.textContent = why;
      wrap.appendChild(w);
    }

    const actions = document.createElement("div");
    actions.className = "ai-action-row";

    [
      { label: "Открыть", run: () => openItemCard(item) },
      { label: "👍 Нравится", run: () => markAiFeedback(item, true) },
      { label: "👎 Не то", run: () => markAiFeedback(item, false) },
      { label: "Найти", run: () => setSearch(titleOf(item)) },
      { label: "Похожие", run: () => recommendFromQuery("похожее на " + titleOf(item), { kind: kind || kindFromItem(item), intro: "Похожие варианты:", limit: 5, fresh: true }) }
    ].forEach(a => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = a.label;
      btn.addEventListener("click", a.run);
      actions.appendChild(btn);
    });

    wrap.appendChild(actions);
    b.appendChild(wrap);
    limitMessages();
    scrollAi();
  }

  function explainWhy(item, query) {
    const q = norm(fixQuery(query));
    const itemText = textOfItem(item);
    const reasons = [];
    const tags = detectTags(q);

    if (tags.includes("isekai") && tagHit(item, "isekai") > 0) reasons.push("попаданцы/исекай");
    if (tags.includes("opmc") && tagHit(item, "opmc") > 0) reasons.push("сильный герой/экшен");
    if (tags.includes("magic") && tagHit(item, "magic") > 0) reasons.push("магия/фэнтези");
    if (tags.includes("smart") && tagHit(item, "smart") > 0) reasons.push("умный сюжет");
    if (tags.includes("dark") && tagHit(item, "dark") > 0) reasons.push("мрачная атмосфера");
    if (Number(getRating(item) || 0) >= 8.3) reasons.push("высокий рейтинг");
    if (Number(getVotes(item) || 0) >= 10000) reasons.push("много оценок");
    if (Number(getRating(item) || 0) >= 8.6 && Number(getVotes(item) || 0) >= 1000) reasons.push("надёжный топ");
    const cc = parseConstraints(query);
    if (cc.minRating && Number(getRating(item) || 0) >= cc.minRating) reasons.push("проходит рейтинг " + cc.minRating + "+");
    if (cc.minYear && Number(getYear(item) || 0) >= cc.minYear) reasons.push("подходит по году");
    if (tagsOfItem(item).length) reasons.push("есть умные теги базы");
    if (posterOfItem(item)) reasons.push("есть постер");

    return reasons.length ? "Почему: " + reasons.slice(0, 4).join(", ") + "." : "";
  }

  function matchPercent(item, query) {
    try {
      const cls = classify(query || getAiContext().lastQuery || "");
      const raw = scoreItem(item, query || "", cls);
      let percent = Math.round(Math.max(35, Math.min(98, raw)));
      const rating = Number(getRating(item) || 0);
      const votes = Number(getVotes(item) || 0);
      if (rating >= 8.5 && votes >= 1000) percent = Math.min(99, percent + 6);
      if (votes < 30 && rating >= 9) percent = Math.max(30, percent - 18);
      return percent;
    } catch {
      return 70;
    }
  }

  function clearAiChat() {
    const b = box();
    if (!b) return;
    b.innerHTML = "";
    addMsg("Чат очищен. Пиши новый запрос.", "bot");
  }

  function showTasteStats() {
    const likes = aiFeedbackSet("gkm_ai_likes");
    const dislikes = aiFeedbackSet("gkm_ai_dislikes");
    addBotWithActions("Твой вкус в этом браузере: лайков — " + likes.size + ", дизлайков — " + dislikes.size + ". Я использую это при подборе.", [
      { label: "Сбросить обучение", run: () => {
        localStorage.removeItem("gkm_ai_likes");
        localStorage.removeItem("gkm_ai_dislikes");
        addMsg("Сбросил обучение.", "bot");
      }}
    ]);
  }

  function openAi() {
    const dlg = $("gkmAiDialog");
    if (!dlg) return;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
    setTimeout(() => $("gkmAiInput") && $("gkmAiInput").focus(), 50);
  }

  function closeAi() {
    const dlg = $("gkmAiDialog");
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  function clickByText(words) {
    const list = Array.from(document.querySelectorAll("button, a"));
    const found = list.find(el => {
      const t = norm(el.textContent);
      return words.some(w => t.includes(norm(w)));
    });
    if (found) {
      found.click();
      return true;
    }
    return false;
  }

  function setSearch(query) {
    const input = $("searchInput") || document.querySelector('input[type="search"]') || document.querySelector('input[placeholder*="Поиск"]');
    if (!input) return false;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function classify(raw) {
    const q = norm(fixQuery(raw));
    const pure = compact(q);

    if (/^(привет|прив|здарова|здравствуй|салам|хай|hello|hi|ку|йоу|добрый день|добрый вечер)$/.test(pure)) return { type: "greeting", kind: "any", tags: [] };
    if (/^(спасибо|благодарю|ок|окей|понял|ясно|норм|круто)$/.test(pure)) return { type: "smalltalk", kind: "any", tags: [] };

    const tags = detectTags(q);
    let kind = "any";

    for (const [k, words] of Object.entries(KIND_WORDS)) {
      if (hasAny(q, words)) {
        kind = k;
        break;
      }
    }

    if (tags.includes("isekai")) kind = "anime";

    let type = "recommend";
    if (/найди|поиск|искать|поищи/.test(q)) type = "search";
    if (tags.includes("new")) type = "new";
    if (tags.includes("top")) type = "top";
    if (tags.includes("popular")) type = "popular";
    if (/похож|как |типа /.test(q)) type = "similar";

    return { type, kind, tags };
  }

  function detectTags(q) {
    const tags = [];
    Object.keys(TAGS).forEach(key => {
      if (hasAny(q, TAGS[key].words)) tags.push(key);
    });
    return tags;
  }

  async function ensureSearchIndex() {
    if (Array.isArray(searchIndex) && searchIndex.length) return searchIndex;
    try {
      if (typeof fetchJson === "function") searchIndex = await fetchJson(FAST_SEARCH_URL);
      else {
        const res = await fetch(FAST_SEARCH_URL + "?v=" + Date.now(), { cache: "no-store" });
        searchIndex = await res.json();
      }
    } catch (e) {
      console.warn("AI helper: search_index не загрузился", e);
    }
    return Array.isArray(searchIndex) ? searchIndex : [];
  }

  function kindFromItem(item) {
    const t = norm(getType(item));
    if (t.includes("аниме")) return "anime";
    if (t.includes("сериал")) return "series";
    if (t.includes("мульт")) return "cartoons";
    return "movies";
  }

  function matchesKind(item, kind) {
    if (!kind || kind === "any") return true;
    const t = norm(getType(item));
    const full = textOfItem(item);
    if (kind === "anime") return t.includes("аниме") || /anime|myanimelist|shounen|seinen|isekai/.test(full);
    if (kind === "series") return t.includes("сериал");
    if (kind === "cartoons") return t.includes("мульт");
    if (kind === "movies") return t.includes("фильм") || (!t.includes("сериал") && !t.includes("аниме") && !t.includes("мульт"));
    return true;
  }

  function tagHit(item, tag) {
    const data = TAGS[tag];
    if (!data) return 0;

    const full = textOfItem(item);
    const title = norm([titleOf(item), item.en, item.title, item.name].join(" "));
    const tagList = tagsOfItem(item);
    let s = 0;

    // Самый сильный сигнал: теги, которые заранее собрал build_fast_site_data.py
    if (tagList.includes(tag)) s += 140;
    if (tagList.some(t => t.includes(tag) || tag.includes(t))) s += 45;

    (data.boost || []).forEach(w => {
      const nw = norm(w);
      if (tagList.includes(nw)) s += 70;
      if (full.includes(nw)) s += 24;
    });

    (data.titles || []).forEach(w => {
      if (title.includes(norm(w))) s += 95;
    });

    return s;
  }

  function quality(item) {
    const rating = Number(getRating(item) || 0);
    const votes = Number(getVotes(item) || 0);
    const year = Number(getYear(item) || 0);

    let score = Number(item.absoluteRank || item.recScore || 0) || (rating * 7 + Math.min(votes, 500000) / 500000 * 16);
    if (posterOfItem(item)) score += 5;
    if (year >= 2015) score += 2;
    if (year >= 2020) score += 2;
    if (votes < 30 && rating >= 9.2) score -= 30;
    return score;
  }

  function userTasteBoost(item) {
    let boost = 0;
    try {
      const id = String(item.id);
      const favs = new Set(JSON.parse(localStorage.getItem("gkm_favorites") || "[]"));
      const hist = new Set(JSON.parse(localStorage.getItem("gkm_history") || "[]"));
      const likes = aiFeedbackSet("gkm_ai_likes");
      const dislikes = aiFeedbackSet("gkm_ai_dislikes");

      if (favs.has(id)) boost += 8;
      if (likes.has(id)) boost += 30;
      if (dislikes.has(id)) boost -= 120;
      if (hist.has(id)) boost -= 2; // уже открывал — чуть ниже, но не убиваем полностью

      // Учимся по жанрам лайкнутых карточек
      const pool = pools(Array.isArray(searchIndex) ? searchIndex : []);
      const likedItems = pool.filter(x => likes.has(String(x.id))).slice(0, 50);
      const myTags = new Set([...tagsOfItem(item), ...genresOfItem(item).map(norm)]);

      likedItems.forEach(liked => {
        const likedTags = new Set([...tagsOfItem(liked), ...genresOfItem(liked).map(norm)]);
        likedTags.forEach(t => {
          if (t && myTags.has(t)) boost += 4;
        });
      });
    } catch {}
    return boost;
  }

  function scoreItem(item, query, cls) {
    const q = norm(fixQuery(query));
    const ts = semanticTokens(q);
    const full = textOfItem(item);
    const title = norm(titleOf(item));
    const aiWords = Array.isArray(item.aiWords) ? item.aiWords.map(norm) : [];
    const recText = norm(item.recText || '');
    let score = quality(item) + userTasteBoost(item) + blacklistPenalty(item);

    if (matchesKind(item, cls.kind)) score += 45;
    else score -= 45;

    cls.tags.forEach(tag => score += tagHit(item, tag));

    ts.forEach(tok => {
      if (title.includes(tok)) score += 34;
      if (full.includes(tok)) score += 12;
      if (aiWords.includes(tok)) score += 30;
      if (recText.includes(tok)) score += 18;
      if (aiWords.some(w => tokenSimilarity(w, tok) >= 0.82)) score += 12;
    });

    if (cls.kind === "anime" && !matchesKind(item, "anime")) score -= 90;
    if (cls.tags.includes("isekai") && tagHit(item, "isekai") < 24) score -= 70;
    if (cls.tags.includes("opmc") && tagHit(item, "opmc") < 20) score -= 18;
    if (cls.tags.includes("top") && Number(getRating(item) || 0) >= 8.2) score += 18;
    if (cls.tags.includes("popular") && Number(getVotes(item) || 0) >= 10000) score += 18;
    if (cls.tags.includes("new") && Number(getYear(item) || 0) >= 2024) score += 40;

    // диверсификация: уже показанные не повторяем
    if (shownIds.has(String(item.id))) score -= 100;

    return score;
  }

  function pools(extra) {
    const seen = new Set();
    const out = [];

    function add(arr) {
      (arr || []).forEach(item => {
        if (!item || item.id == null) return;
        const id = String(item.id);
        if (seen.has(id)) return;
        seen.add(id);
        out.push(item);
      });
    }

    add(extra || []);
    add(currentItems || []);
    add(lastSearchResults || []);
    if (homeData && homeData.sections) Object.values(homeData.sections).forEach(add);

    return out;
  }

  async function bestItems(query, cls, limit) {
    const idx = await ensureSearchIndex();
    const c = parseConstraints(query);
    const finalLimit = Math.max(1, Math.min(10, limit || c.limit || 5));

    // ВАЖНО: не прогоняем 96к записей тяжёлым скорингом сразу.
    // Сначала берём быстрый кандидатный набор, иначе браузер зависает.
    const q = norm(fixQuery(query));
    const qTokens = semanticTokens(q).slice(0, 14);
    const tagList = (cls.tags || []).slice(0, 8);

    const fullPool = pools(idx).filter(item => matchesKind(item, cls.kind));
    const candidates = [];
    const maxCandidates = (window.GKM_MOBILE_HELPER_LIGHT ? 350 : 1600);

    for (let i = 0; i < fullPool.length; i++) {
      const item = fullPool[i];
      if (!passesConstraints(item, c)) continue;

      const text = textOfItem(item);
      let quick = 0;

      for (const t of qTokens) {
        if (text.includes(t)) quick += 6;
      }

      for (const tag of tagList) {
        if (text.includes(tag) || tagHit(item, tag) > 0) quick += 12;
      }

      // качество тоже учитываем на лёгком этапе
      quick += Math.min(Number(item.recScore || getRating(item) || 0), 100) / 10;
      quick += posterOfItem(item) ? 2 : 0;

      if (quick > 0 || qTokens.length === 0) {
        candidates.push({ item, quick });
      }

      // каждые 1200 элементов отдаём поток браузеру, чтобы страница не висла
      if (i % 1200 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    candidates.sort((a, b) => b.quick - a.quick);
    const limited = candidates.slice(0, maxCandidates).map(x => x.item);

    const scored = [];
    for (let i = 0; i < limited.length; i++) {
      const item = limited[i];
      scored.push({ item, score: scoreItem(item, query, cls) + constraintBoost(item, c) });

      if (i % 300 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const picked = [];
    for (const x of scored) {
      if (picked.length >= finalLimit) break;
      const title = norm(titleOf(x.item));
      if (!picked.some(p => norm(titleOf(p)) === title)) picked.push(x.item);
    }

    if (!picked.length) {
      const fallback = fullPool
        .slice(0, 800)
        .filter(item => passesConstraints(item, c))
        .sort((a, b) => Number(getRating(b) || 0) - Number(getRating(a) || 0))
        .slice(0, finalLimit);
      fallback.forEach(item => shownIds.add(String(item.id)));
      return fallback;
    }

    picked.forEach(item => shownIds.add(String(item.id)));
    return picked;
  }

  function openItemCard(item) {
    if (!item) return;
    const id = String(item.id);
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("gkm-ai-picked");
      setTimeout(() => card.classList.remove("gkm-ai-picked"), 1800);
      card.click();
      return;
    }

    if (typeof openDetails === "function") openDetails(item);
    else setSearch(titleOf(item));
  }

  async function recommendFromQuery(query, options = {}) {
    query = ultraRewrite(query);
    query = omegaImproveQuery(query);
    const preset = godmodePresetText(query);
    if (preset && norm(query).split(/\s+/).length <= 4) query = preset;
    query = mergeWithContext(query);
    const cls = classify(query);
    const force = parseConstraints(query).forceKind;
    if (force) cls.kind = force;
    if (options.kind) cls.kind = options.kind;
    if (options.tags) cls.tags = [...new Set([...(cls.tags || []), ...options.tags])];

    if (!options.silentUnderstanding) addUnderstanding(query);
    const wait = addMsg("GODMODE ищет по базе 96к...", "bot");
    const items = await bestItems(query, cls, options.limit || parseConstraints(query).limit || 5);
    rememberContext(query, items);
    try { window.GKM_AI_LAST_ITEMS = items || []; } catch {}
    if (wait) wait.remove();

    if (!items.length) {
      addBotWithActions("Не нашёл точное. Сейчас объясню и предложу ослабить фильтр.", [
        { label: "Искать", run: () => setSearch(query) },
        { label: "Топ 250", run: () => clickByText(["Топ 250"]) },
        { label: "Популярное", run: () => clickByText(["Популярное"]) }
      ]);
      diagnoseNoResults(query);
      return;
    }

    const intro = options.intro || "Вот что я бы выбрал:";
    items.forEach((item, i) => addRecommendationCard(item, i === 0 ? intro : "Ещё вариант:", query, cls.kind, i + 1));
  }

  function isVagueQuery(text) {
    const q = compact(text);
    const vague = ["что посмотреть", "посоветуй", "подбери", "дай что нибудь", "дай что-нибудь", "не знаю что смотреть", "скучно"];
    return vague.includes(q) || (toks(q).length <= 1 && !/аниме|фильм|сериал|мульт|топ|новин/.test(q));
  }

  function askClarify() {
    addBotWithActions("Запрос слишком общий. Выбери настроение — так я попаду точнее:", [
      { label: ORACLE_PROFILES.wife_evening.label, run: () => recommendFromProfile("wife_evening") },
      { label: ORACLE_PROFILES.isekai_op.label, run: () => recommendFromProfile("isekai_op") },
      { label: ORACLE_PROFILES.brain.label, run: () => recommendFromProfile("brain") },
      { label: ORACLE_PROFILES.no_stress.label, run: () => recommendFromProfile("no_stress") },
      { label: ORACLE_PROFILES.survival.label, run: () => recommendFromProfile("survival") }
    ]);
  }

  function recommendFromProfile(name) {
    const p = ORACLE_PROFILES[name];
    if (!p) return;
    recommendFromQuery(p.query, { kind: p.kind, tags: p.tags || [], intro: "Режим «" + p.label + "»:" });
  }

  function itemMiniLine(item) {
    const r = Number(getRating(item) || 0);
    const v = Number(getVotes(item) || 0);
    return `${titleOf(item)} (${getYear(item) || "—"}) · ${getType(item) || "—"} · ${r ? r.toFixed(1) : "—"} · ${v ? v + " голосов" : "без голосов"}`;
  }

  async function findByTitleLoose(name) {
    const idx = await ensureSearchIndex();
    const qTokens = toks(name);
    if (!qTokens.length) return null;

    let best = null;
    let bestScore = -999;

    pools(idx).forEach(item => {
      const title = compact([titleOf(item), item.en, item.title, item.name].join(" "));
      const full = textOfItem(item);
      let s = 0;
      qTokens.forEach(t => {
        if (title.includes(t)) s += 24;
        if (full.includes(t)) s += 6;
      });
      s += Number(getRating(item) || 0);
      s += Math.min(Number(getVotes(item) || 0), 100000) / 100000 * 3;
      if (s > bestScore) {
        best = item;
        bestScore = s;
      }
    });

    return bestScore > 10 ? best : null;
  }

  async function compareTitles(text) {
    const clean = text.replace(/сравни|что лучше|какой лучше|какая лучше|кто лучше/gi, "").trim();
    let parts = clean.split(/\s+(?:и|или|vs|против)\s+/i).map(x => x.trim()).filter(Boolean);

    if (parts.length < 2) {
      addBotWithActions("Для сравнения напиши два названия через «и». Например: «сравни Наруто и Блич».", [
        { label: "Топ аниме", run: () => recommendFromQuery("топ аниме рейтинг 8+ голосов 1000+", { kind: "anime" }) }
      ]);
      return;
    }

    parts = parts.slice(0, 2);
    const a = await findByTitleLoose(parts[0]);
    const b = await findByTitleLoose(parts[1]);

    if (!a || !b) {
      addBotWithActions("Не нашёл одно из названий точно. Могу кинуть их в поиск.", [
        { label: "Искать первое", run: () => setSearch(parts[0]) },
        { label: "Искать второе", run: () => setSearch(parts[1]) }
      ]);
      return;
    }

    const scoreA = quality(a) + Number(getRating(a) || 0) * 8 + Math.min(Number(getVotes(a) || 0), 300000) / 300000 * 20;
    const scoreB = quality(b) + Number(getRating(b) || 0) * 8 + Math.min(Number(getVotes(b) || 0), 300000) / 300000 * 20;
    const winner = scoreA >= scoreB ? a : b;

    addBotWithActions("Сравнил по базе. Я бы выбрал: " + titleOf(winner) + ".", [
      { label: "Открыть победителя", run: () => openItemCard(winner) },
      { label: "Похожие", run: () => recommendFromQuery("похожее на " + titleOf(winner), { kind: kindFromItem(winner) }) }
    ]);

    addRecommendationCard(a, "Первый вариант:", text, kindFromItem(a), 1);
    addRecommendationCard(b, "Второй вариант:", text, kindFromItem(b), 2);
  }

  function markLastAsDisliked() {
    const ctx = getAiContext();
    if (!ctx || !ctx.lastTitle) return false;
    findByTitleLoose(ctx.lastTitle).then(item => {
      if (item) markAiFeedback(item, false);
    });
    return true;
  }

  function greeting() {
    addBotWithActions("Здарова, брат. Я бесплатный помощник по твоей базе. Напиши: «аниме про попаданцев», «фильм на вечер», «мрачный детектив», «сериал про выживание» — покажу варианты с постерами.", [
      { label: "Аниме про попаданцев", run: () => recommendFromQuery("аниме про попаданцев исекай", { kind: "anime", tags: ["isekai"], intro: "Вот исекай/попаданцы:" }) },
      { label: "Фильм на вечер", run: () => recommendFromQuery("фильм на вечер популярный", { kind: "movies", intro: "Вот фильмы на вечер:" }) },
      { label: "Сильный ГГ", run: () => recommendFromQuery("аниме с сильным главным героем", { kind: "anime", tags: ["opmc"], intro: "Вот аниме с сильным ГГ:" }) }
    ]);
  }

  function helperAnswer(text) {
    const originalText = text;
    text = mergeWithContext(text);
    const cls = classify(text);
    addMsg(originalText, "user");

    if (/что\s+ты\s+понял|как\s+понял|разбор\s+запроса/i.test(text)) {
      addUnderstanding(text);
      return;
    }

    if (/apex|апекс|квиз|настрой\\s+вкус|опрос/i.test(text)) {
      startApexQuiz();
      return;
    }

    if (/мой\\s+профиль|профиль\\s+вкуса|apex\\s+profile/i.test(text)) {
      showApexProfile();
      return;
    }

    if (/сбрось\\s+профиль|очисти\\s+профиль/i.test(text)) {
      resetApexProfile();
      return;
    }

    if (/анти\\s*мусор|без\\s+мусора|только\\s+годное/i.test(text)) {
      recommendFromQuery(text + " без шлака рейтинг 8+ голосов 1000+", { intro: "APEX анти-мусор, режимы компании/соло/с женой:" });
      return;
    }

    if (/omega|омега|финал|ультра\s+умн|максимум/i.test(text)) {
      addBotWithActions("OMEGA включён. Это самый жирный бесплатный режим.", [
        { label: "По времени суток", run: () => recommendFromQuery(omegaTimePreset(), { intro: "OMEGA по времени суток:" }) },
        { label: "Марафон", run: () => recommendFromQuery("сериал или аниме марафон рейтинг 8+ много серий", { intro: "OMEGA марафон:" }) },
        { label: "Быстро на вечер", run: () => recommendFromQuery("короткий фильм на вечер рейтинг 8+ без жести", { kind: "movies", intro: "OMEGA быстро на вечер:" }) },
        { label: "Экспорт", run: () => exportPlaylistText() }
      ]);
      return;
    }

    if (/экспорт|скопируй\s+подборку|дай\s+списком|списком/i.test(text)) {
      exportPlaylistText();
      return;
    }

    if (/почему\s+не\s+нашел|почему\s+мало|диагност/i.test(text)) {
      diagnoseNoResults(getAiContext().lastQuery || text);
      return;
    }

    if (/neuro|нейро|режим\s+нейро|ультра\s+режим/i.test(text)) {
      addBotWithActions("NEURO включён. Я могу: план подбора, минус-слова, плейлист, вкус, сравнение, контекст.", [
        { label: "План подбора", run: () => neuroPlan(getAiContext().lastQuery || "аниме попаданцы рейтинг 8+") },
        { label: "Аниме попаданцы", run: () => recommendFromQuery("5 аниме про попаданцев рейтинг 8+ без гарема", { kind: "anime", tags: ["isekai"] }) },
        { label: "Показать вкус", run: () => showTasteStats() },
        { label: "Плейлист", run: () => showPlaylist() }
      ]);
      return;
    }

    if (/план\s+подбора|как\s+подбираешь|объясни\s+подбор/i.test(text)) {
      neuroPlan(text);
      return;
    }

    if (/заблокируй|не\s+показывай|убери\s+из\s+советов|минус\s+\w+/i.test(text)) {
      addBlacklistWords(text);
      return;
    }

    if (/очисти\s+минус|сбрось\s+минус|очисти\s+блок/i.test(text)) {
      clearBlacklistWords();
      return;
    }

    if (/сохрани\s+плейлист|сохрани\s+подборку/i.test(text)) {
      savePlaylist(window.GKM_AI_LAST_ITEMS || [], "last");
      return;
    }

    if (/покажи\s+плейлист|мой\s+плейлист|открой\s+плейлист/i.test(text)) {
      showPlaylist();
      return;
    }

    if (/godmode|режим\s+бог|макс\s+умн|мах\s+умн/i.test(text)) {
      addBotWithActions("GODMODE включён. Выбери готовый умный режим:", [
        { label: "Аниме попаданцы", run: () => recommendFromQuery(GODMODE_PRESETS["аниме попаданцы"], { kind: "anime", tags: ["isekai", "opmc"], intro: "GODMODE: попаданцы/исекай:" }) },
        { label: "Сильный ГГ", run: () => recommendFromQuery(GODMODE_PRESETS["сильный гг"], { kind: "anime", tags: ["opmc"], intro: "GODMODE: сильный ГГ:" }) },
        { label: "С женой", run: () => recommendFromQuery(GODMODE_PRESETS["с женой"], { kind: "movies", intro: "GODMODE: с женой вечером:" }) },
        { label: "Мрачное", run: () => recommendFromQuery(GODMODE_PRESETS["мрачное"], { kind: "any", tags: ["dark", "smart"], intro: "GODMODE: мрачное/умное:" }) },
        { label: "Космос", run: () => recommendFromQuery(GODMODE_PRESETS["космос"], { kind: "movies", tags: ["space"], intro: "GODMODE: космос:" }) }
      ]);
      return;
    }

    if (/сброс.*(обуч|лайк|памят)|забудь.*(вкус|лайк|обуч)/i.test(text)) {
      localStorage.removeItem("gkm_ai_likes");
      localStorage.removeItem("gkm_ai_dislikes");
      addMsg("Сбросил обучение помощника. Начинаю советы с чистого листа.", "bot");
      return;
    }

    if (/очисти\s+чат|почисти\s+чат|clear\s+chat/i.test(text)) {
      clearAiChat();
      return;
    }

    if (/мой\s+вкус|что\s+я\s+лайкал|мои\s+лайки|статистика\s+вкуса/i.test(text)) {
      showTasteStats();
      return;
    }

    if (/рандом|случайн|удиви\s+меня|что-нибудь\s+необыч/i.test(text)) {
      addBotWithActions("Включаю режим случайного, но не мусорного совета.", [
        { label: "Случайное аниме", run: () => recommendFromQuery("случайное аниме рейтинг 8+ голосов 300+", { kind: "anime", tags: ["top"], intro: "Случайное, но нормальное аниме:" }) },
        { label: "Случайный фильм", run: () => recommendFromQuery("случайный фильм рейтинг 8+ голосов 1000+", { kind: "movies", tags: ["top"], intro: "Случайный, но нормальный фильм:" }) },
        { label: "Удиви меня", run: () => recommendFromQuery("необычное хорошее рейтинг 8+ без шлака", { kind: "any", tags: ["top"], intro: "Лови необычное:" }) }
      ]);
      recommendFromQuery("случайное хорошее рейтинг 8+ голосов 300+", { kind: "any", tags: ["top"], intro: "Вот случайный нормальный вариант:" });
      return;
    }

    if (/сравни|что\s+лучше|какой\s+лучше|какая\s+лучше|vs|против/i.test(text)) {
      compareTitles(text);
      return;
    }

    if (/^(не то|не это|другое|другие|не подходит|не зашло)$/i.test(norm(text))) {
      markLastAsDisliked();
      addMsg("Окей, прошлое опустил ниже. Подбираю другие варианты по тому же запросу.", "bot");
      recommendFromQuery(text, { fresh: true });
      return;
    }

    if (/что\s+ты\s+умеешь|помощь|команды|как\s+работаешь/i.test(text)) {
      addBotWithActions("Я умею подбирать по типу, жанру, настроению и ограничениям. Понимаю продолжения: «ещё», «не это», «без романтики», «похожие». Примеры: «5 аниме про попаданцев без романтики рейтинг 8+», «фильм на вечер после 2015», «мрачный детектив без ужасов». Ещё понимаю «без шлака», «без просмотренного», «голосов 1000+», «рандом», «мой вкус», «очисти чат».", [
        { label: "5 исекай 8+", run: () => recommendFromQuery("5 аниме про попаданцев рейтинг 8+ голосов 300+", { kind: "anime", tags: ["isekai"] }) },
        { label: "Фильм после 2015", run: () => recommendFromQuery("фильм на вечер после 2015 рейтинг 8+ без жести", { kind: "movies" }) },
        { label: "Мрачный детектив", run: () => recommendFromQuery("мрачный умный детектив без романтики рейтинг 7.5+", { kind: "any", tags: ["smart", "dark"] }) }
      ]);
      return;
    }

    if (cls.type === "greeting") return greeting();

    if (isVagueQuery(text)) {
      askClarify();
      return;
    }

    if (cls.type === "smalltalk") {
      addBotWithActions("Принял. Дай жанр/настроение — подберу по базе.", [
        { label: "Топ аниме", run: () => recommendFromQuery("топ аниме", { kind: "anime", tags: ["top"] }) },
        { label: "Что посмотреть", run: () => recommendFromQuery("что посмотреть вечером", { kind: "movies" }) }
      ]);
      return;
    }

    if (cls.type === "search") {
      setSearch(text.replace(/найди|поиск|искать|поищи/gi, "").trim() || text);
      addBotWithActions("Поставил запрос в поиск и параллельно подбираю рекомендации.", [
        { label: "Ещё подборка", run: () => recommendFromQuery(text, { kind: cls.kind }) }
      ]);
      recommendFromQuery(text, { kind: cls.kind, tags: cls.tags, intro: "Вот что подходит:" });
      return;
    }

    if (cls.type === "new") clickByText(["Новинки"]);
    if (cls.type === "top") clickByText(["Топ 250"]);
    if (cls.type === "popular") clickByText(["Популярное"]);

    const intro = cls.kind === "anime" ? "Вот аниме под запрос:" :
      cls.kind === "movies" ? "Вот фильмы под запрос:" :
      cls.kind === "series" ? "Вот сериалы под запрос:" :
      cls.kind === "cartoons" ? "Вот мультфильмы под запрос:" :
      "Вот что подходит:";

    addBotWithActions("Понял. Считаю жанры, ключевые слова, рейтинг, голоса и похожесть.", [
      { label: "Искать", run: () => setSearch(text) },
      { label: "Ещё варианты", run: () => recommendFromQuery(text, { kind: cls.kind, tags: cls.tags, intro: "Лови ещё:" }) },
      { label: "Популярное", run: () => clickByText(["Популярное"]) }
    ]);

    recommendFromQuery(text, { kind: cls.kind, tags: cls.tags, intro });
  }

  function initAiChat() {
    const top = $("gkmAiTopBtn");
    const float = $("gkmAiFloatBtn");
    const close = $("gkmAiCloseBtn");
    const form = $("gkmAiForm");
    const input = $("gkmAiInput");

    const title = document.querySelector(".ai-title");
    const subtitle = document.querySelector(".ai-subtitle");
    const note = document.querySelector(".ai-note");

    if (title) title.textContent = "Голубь помощник";
    if (subtitle) subtitle.textContent = "Бесплатно: ABSOLUTE подбор + мини-постеры";
    if (note) note.textContent = "";

    const first = document.querySelector("#gkmAiMessages .ai-bot");
    if (first) {
      first.textContent = "Я SUPREME: умею автопилот вкуса, режимы для компании, точный список, исключения, профиль, плейлист и анти-мусор, режимы компании/соло/с женой без API.";
    }

    if (top) top.addEventListener("click", openAi);
    if (float) float.addEventListener("click", openAi);
    if (close) close.addEventListener("click", closeAi);

    document.querySelectorAll("[data-ai-prompt]").forEach(btn => {
      btn.addEventListener("click", () => helperAnswer(btn.getAttribute("data-ai-prompt") || btn.textContent || ""));
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = (input && input.value || "").trim();
        if (!text) return;
        input.value = "";
        helperAnswer(text);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAiChat);
  else initAiChat();

  window.GKM_AI_CHAT_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
})();


/* === GKM V34 MOBILE POSTER-WRAP REAL FIX === */
(function () {
  const FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="48%" fill="#8bdcff" font-size="22" text-anchor="middle" font-family="Arial">Нет постера</text></svg>'
  );

  function isMobile() {
    return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  }

  function getBgUrl(el) {
    const bg = (el && getComputedStyle(el).backgroundImage) || (el && el.style && el.style.backgroundImage) || "";
    const m = bg.match(/url\(["']?(.+?)["']?\)/);
    return m && m[1] ? m[1] : "";
  }

  function fixPosterWraps() {
    if (!isMobile()) return;

    document.querySelectorAll(".card").forEach(card => {
      card.style.contentVisibility = "visible";
      card.style.containIntrinsicSize = "auto";

      let wrap = card.querySelector(".poster-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "poster-wrap";
        card.prepend(wrap);
      }

      wrap.style.display = "block";
      wrap.style.visibility = "visible";
      wrap.style.opacity = "1";
      wrap.style.minHeight = "190px";

      let img = wrap.querySelector("img");

      if (!img) {
        img = document.createElement("img");
        img.className = "gkm-mobile-poster-real";
        img.alt = "";
        wrap.appendChild(img);
      }

      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        card.getAttribute("data-poster") ||
        card.getAttribute("data-img") ||
        getBgUrl(wrap) ||
        getBgUrl(card) ||
        "";

      img.loading = "eager";
      img.decoding = "async";
      img.setAttribute("fetchpriority", "high");

      if (src) {
        img.src = src;
      } else if (!img.src) {
        img.src = FALLBACK;
      }

      img.onerror = function () {
        this.onerror = null;
        this.src = FALLBACK;
      };

      img.style.display = "block";
      img.style.visibility = "visible";
      img.style.opacity = "1";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
    });
  }

  let t = 0;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(fixPosterWraps, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 200), true);
  document.addEventListener("scroll", schedule, { passive: true });
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  window.GKM_MOBILE_POSTER_WRAP_FIX_VERSION = "v34-mobile-poster-wrap-fix-2026-06-13";
})();

/* === GKM V37 REAL RU TITLES APPLY === */
(function () {

  const RU_TITLE_ON_KEY = "gkm_ru_titles_on_v37";
  const RU_BUILTIN_MAP = {
  "demon slayer": "Истребитель демонов",
  "kimetsu no yaiba": "Истребитель демонов",
  "demon slayer kimetsu no yaiba": "Истребитель демонов",
  "one piece": "Ван-Пис",
  "naruto": "Наруто",
  "naruto shippuden": "Наруто: Ураганные хроники",
  "boruto": "Боруто",
  "boruto naruto next generations": "Боруто: Новое поколение Наруто",
  "bleach": "Блич",
  "bleach thousand year blood war": "Блич: Тысячелетняя кровавая война",
  "attack on titan": "Атака титанов",
  "shingeki no kyojin": "Атака титанов",
  "jujutsu kaisen": "Магическая битва",
  "solo leveling": "Поднятие уровня в одиночку",
  "chainsaw man": "Человек-бензопила",
  "death note": "Тетрадь смерти",
  "one punch man": "Ванпанчмен",
  "my hero academia": "Моя геройская академия",
  "boku no hero academia": "Моя геройская академия",
  "dragon ball": "Драконий жемчуг",
  "dragon ball z": "Драконий жемчуг Z",
  "dragon ball super": "Драконий жемчуг Супер",
  "black clover": "Чёрный клевер",
  "tokyo ghoul": "Токийский гуль",
  "hunter x hunter": "Охотник х Охотник",
  "fullmetal alchemist": "Стальной алхимик",
  "fullmetal alchemist brotherhood": "Стальной алхимик: Братство",
  "fairy tail": "Хвост Феи",
  "sword art online": "Мастера меча онлайн",
  "that time i got reincarnated as a slime": "О моём перерождении в слизь",
  "tensei shitara slime datta ken": "О моём перерождении в слизь",
  "reincarnated as a slime": "О моём перерождении в слизь",
  "mushoku tensei": "Реинкарнация безработного",
  "overlord": "Повелитель",
  "konosuba": "Этот замечательный мир!",
  "kono subarashii sekai ni shukufuku wo": "Этот замечательный мир!",
  "re zero": "Re:Zero. Жизнь с нуля в альтернативном мире",
  "re:zero": "Re:Zero. Жизнь с нуля в альтернативном мире",
  "spy x family": "Семья шпиона",
  "classroom of the elite": "Добро пожаловать в класс превосходства",
  "youkoso jitsuryoku shijou shugi no kyoushitsu e": "Добро пожаловать в класс превосходства",
  "tokyo revengers": "Токийские мстители",
  "blue lock": "Синяя тюрьма",
  "haikyuu": "Волейбол!!",
  "black butler": "Тёмный дворецкий",
  "vinland saga": "Сага о Винланде",
  "dr stone": "Доктор Стоун",
  "frieren": "Провожающая в последний путь Фрирен",
  "sousou no frieren": "Провожающая в последний путь Фрирен",
  "hells paradise": "Адский рай",
  "hell's paradise": "Адский рай",
  "jigokuraku": "Адский рай",
  "goblin slayer": "Убийца гоблинов",
  "the eminence in shadow": "Восхождение в тени",
  "kage no jitsuryokusha ni naritakute": "Восхождение в тени",
  "danmachi": "Может, я встречу тебя в подземелье?",
  "made in abyss": "Созданный в Бездне",
  "violet evergarden": "Вайолет Эвергарден",
  "your name": "Твоё имя",
  "kimi no na wa": "Твоё имя",
  "weathering with you": "Дитя погоды",
  "tenki no ko": "Дитя погоды",
  "suzume": "Судзумэ, закрывающая двери",
  "mob psycho": "Моб Психо 100",
  "mob psycho 100": "Моб Психо 100",
  "jojo": "Невероятные приключения ДжоДжо",
  "jojos bizarre adventure": "Невероятные приключения ДжоДжо",
  "jojo's bizarre adventure": "Невероятные приключения ДжоДжо",
  "berserk": "Берсерк",
  "monster": "Монстр",
  "cowboy bebop": "Ковбой Бибоп",
  "samurai champloo": "Самурай Чамплу",
  "neon genesis evangelion": "Евангелион",
  "code geass": "Код Гиас",
  "steins gate": "Врата Штейна",
  "steins;gate": "Врата Штейна",
  "erased": "Город, в котором меня нет",
  "boku dake ga inai machi": "Город, в котором меня нет",
  "parasyte": "Паразит",
  "kiseijuu": "Паразит",
  "another": "Иная",
  "angel beats": "Ангельские ритмы!",
  "clannad": "Кланнад",
  "toradora": "Торадора!",
  "your lie in april": "Твоя апрельская ложь",
  "shigatsu wa kimi no uso": "Твоя апрельская ложь",
  "kaguya sama love is war": "Госпожа Кагуя: в любви как на войне",
  "kaguya-sama love is war": "Госпожа Кагуя: в любви как на войне",
  "rent a girlfriend": "Девушка на час",
  "kanojo okarishimasu": "Девушка на час",
  "food wars": "В поисках божественного рецепта",
  "shokugeki no soma": "В поисках божественного рецепта",
  "no game no life": "Нет игры — нет жизни",
  "the rising of the shield hero": "Восхождение героя щита",
  "tate no yuusha no nariagari": "Восхождение героя щита",
  "arifureta": "Арифурэта: сильнейший ремесленник в мире",
  "the world's finest assassin": "Лучший в мире ассасин",
  "sekai saikou no ansatsusha": "Лучший в мире ассасин",
  "the daily life of the immortal king": "Повседневная жизнь бессмертного короля",
  "initial d": "Инициал Ди",
  "rurouni kenshin": "Бродяга Кэнсин",
  "inuyasha": "Инуяша",
  "ranma": "Ранма ½",
  "sailor moon": "Сейлор Мун",
  "pokemon": "Покемон",
  "digimon": "Дигимон",
  "beyblade": "Бейблэйд",
  "yu gi oh": "Югио!",
  "yu-gi-oh": "Югио!",
  "death parade": "Парад смерти",
  "akame ga kill": "Убийца Акаме!",
  "noragami": "Бездомный бог",
  "fire force": "Пламенная бригада пожарных",
  "enen no shouboutai": "Пламенная бригада пожарных",
  "soul eater": "Пожиратель душ",
  "d gray man": "Ди Грэй-мен",
  "d.gray-man": "Ди Грэй-мен",
  "magi": "Маги",
  "magi the labyrinth of magic": "Маги: Лабиринт магии",
  "seven deadly sins": "Семь смертных грехов",
  "nanatsu no taizai": "Семь смертных грехов",
  "assassination classroom": "Класс убийц",
  "ansatsu kyoushitsu": "Класс убийц"
};

  let RU_EXTERNAL_MAP = null;
  let RU_LOADING = false;

  function isOn() {
    return localStorage.getItem(RU_TITLE_ON_KEY) !== "0";
  }

  function hasRu(v) {
    return /[а-яё]/i.test(String(v || ""));
  }

  function clean(v) {
    return String(v || "")
      .replace(/\s*\(\d{4}\)\s*/g, " ")
      .replace(/\bTV\b|\bONA\b|\bOVA\b|\bMovie\b|\bSpecial\b/gi, " ")
      .replace(/[|•·]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function key(v) {
    return clean(v).toLowerCase()
      .replaceAll("ё", "е")
      .replace(/['’`]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}:]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function loadExternalMap() {
    if (RU_EXTERNAL_MAP || RU_LOADING) return RU_EXTERNAL_MAP || {};
    RU_LOADING = true;
    try {
      const r = await fetch("data/ru_titles_map.json?v=37", { cache: "no-store" });
      if (r.ok) RU_EXTERNAL_MAP = await r.json();
      else RU_EXTERNAL_MAP = {};
    } catch(e) {
      RU_EXTERNAL_MAP = {};
    }
    RU_LOADING = false;
    return RU_EXTERNAL_MAP || {};
  }

  function allMaps() {
    return Object.assign({}, RU_BUILTIN_MAP, RU_EXTERNAL_MAP || {});
  }

  function exactMap(title) {
    const k = key(title);
    const m = allMaps();
    if (m[k]) return m[k];

    for (const mk in m) {
      if (k && mk && (k.includes(mk) || mk.includes(k))) return m[mk];
    }
    return "";
  }

  function pickRu(item) {
    if (!item || typeof item !== "object") return "";

    const fields = [
      item.title_ru, item.ruTitle, item.titleRu, item.russian, item.name_ru, item.nameRu,
      item.original_title_ru, item.altTitleRu, item.titleRussian
    ];

    for (const v of fields) {
      if (v && hasRu(v)) return clean(v);
    }

    const arrays = [item.aliases, item.names, item.alt_titles, item.alternative_titles, item.synonyms];
    for (const arr of arrays) {
      if (!Array.isArray(arr)) continue;
      for (const x of arr) {
        const v = typeof x === "string" ? x : (x && (x.title || x.name || x.value || x.text));
        if (v && hasRu(v)) return clean(v);
      }
    }

    const source = [
      item.title, item.name, item.original_title, item.english,
      item.title_en, item.romaji, item.japanese
    ].filter(Boolean);

    for (const s of source) {
      const ru = exactMap(s);
      if (ru) return ru;
    }

    return "";
  }

  function applyRuToItem(item) {
    if (!isOn() || !item || typeof item !== "object") return item;

    const ru = pickRu(item);
    const current = clean(item.title || item.name || item.original_title || item.english || "");
    if (!ru || ru === current) {
      item.__gkmRuV37 = true;
      return item;
    }

    if (!item.title_original && current) item.title_original = current;
    if (!item.originalTitle && current) item.originalTitle = current;

    item.title_ru = item.title_ru || ru;
    item.ruTitle = item.ruTitle || ru;
    item.title = ru;
    item.name = ru;

    const orig = item.title_original || item.originalTitle || current;
    item.searchTitle = (ru + " " + orig + " " + (item.searchTitle || "")).trim();
    item.__gkmRuV37 = true;
    return item;
  }

  function applyRuArray(arr) {
    if (!Array.isArray(arr)) return arr;
    for (let i = 0; i < arr.length; i++) applyRuToItem(arr[i]);
    return arr;
  }

  function patchGlobalArray(name) {
    try {
      let value = window[name];
      if (Array.isArray(value)) applyRuArray(value);

      Object.defineProperty(window, name, {
        configurable: true,
        get() { return value; },
        set(v) {
          value = Array.isArray(v) ? applyRuArray(v) : v;
        }
      });
    } catch(e) {}
  }

  function patchTitleOf() {
    const oldTitleOf = window.titleOf;
    if (typeof oldTitleOf !== "function" || oldTitleOf.__gkmRuV37) return;

    const wrapped = function(item) {
      if (isOn()) applyRuToItem(item);
      const ru = isOn() ? pickRu(item) : "";
      if (ru) return ru;
      return oldTitleOf(item);
    };
    wrapped.__gkmRuV37 = true;
    window.titleOf = wrapped;
  }

  function patchRenderData() {
    ["items", "allItems", "movies", "GKM_ITEMS", "catalogItems", "DATA", "db"].forEach(patchGlobalArray);
    ["items", "allItems", "movies", "GKM_ITEMS", "catalogItems", "DATA", "db"].forEach(n => applyRuArray(window[n]));
    patchTitleOf();
  }

  function translateDomTitles() {
    if (!isOn()) return;
    const nodes = document.querySelectorAll(".card-title,.movie-title,.item-title,.detail-title,.modal-title,.details-title,h1,h2");
    nodes.forEach(node => {
      if (node.dataset.gkmRuV37 === "1") return;
      const txt = clean(node.textContent || "");
      if (!txt || hasRu(txt)) return;
      const ru = exactMap(txt);
      if (!ru) return;

      node.dataset.gkmRuV37 = "1";
      node.dataset.originalTitle = txt;
      node.textContent = ru;
      node.title = txt;

      if (!node.nextElementSibling || !node.nextElementSibling.classList.contains("gkm-original-title")) {
        const sub = document.createElement("div");
        sub.className = "gkm-original-title";
        sub.textContent = txt;
        node.insertAdjacentElement("afterend", sub);
      }
    });
  }

  function addToggle() {
    if (document.getElementById("gkmRuTitleToggle")) return;
    const btn = document.createElement("button");
    btn.id = "gkmRuTitleToggle";
    btn.type = "button";
    btn.textContent = isOn() ? "RU тайтлы" : "RU выкл";
    btn.title = "Русские названия тайтлов";
    btn.onclick = () => {
      localStorage.setItem(RU_TITLE_ON_KEY, isOn() ? "0" : "1");
      location.reload();
    };
    const place = document.querySelector(".topbar, header, .controls, .toolbar, .filters") || document.body;
    place.appendChild(btn);
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      addToggle();
      await loadExternalMap();
      patchRenderData();
      translateDomTitles();
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 150), true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

  window.GKM_REAL_RU_TITLES_VERSION = "v37-ru-titles-real-apply-2026-06-13";
  window.GKM_RU_TITLES_MAP_SIZE = Object.keys(RU_BUILTIN_MAP).length;
})();


/* === GKM V38 BUTTONS CLICK FIX === */
(function () {
  function txt(el) {
    return String(el && el.textContent || "").trim().toLowerCase().replaceAll("ё", "е");
  }

  function safeClickSelector(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) {
        el.click();
        return true;
      }
    }
    return false;
  }

  function openHelper() {
    if (typeof window.openAi === "function") {
      window.openAi();
      return true;
    }

    if (typeof window.initAiChat === "function") {
      try { window.initAiChat(); } catch(e) {}
    }

    const dlg = document.querySelector("#gkmAiDialog, .ai-dialog, #aiDialog");
    if (dlg) {
      dlg.style.display = "block";
      dlg.hidden = false;
      dlg.classList.add("open", "active", "is-open");
      if (typeof dlg.showModal === "function" && !dlg.open) {
        try { dlg.showModal(); } catch(e) {}
      }
      return true;
    }

    return safeClickSelector([
      "#gkmAiFab",
      "#aiFab",
      ".ai-fab",
      ".gkm-ai-fab",
      "[data-ai-open]",
      "[data-open-ai]"
    ]);
  }

  function showAllPopular() {
    const btns = Array.from(document.querySelectorAll("button,a"));
    const allBtn = btns.find(b => txt(b) === "все");
    if (allBtn) {
      allBtn.click();
      return true;
    }

    try {
      if (typeof window.setCategory === "function") {
        window.setCategory("all");
        return true;
      }
      if (typeof window.renderAll === "function") {
        window.renderAll();
        return true;
      }
      if (typeof window.render === "function") {
        window.render();
        return true;
      }
    } catch(e) {}

    document.querySelectorAll(".popular .card, #popular .card, [data-section='popular'] .card").forEach(card => {
      card.style.display = "";
      card.hidden = false;
    });
    return true;
  }

  document.addEventListener("click", function (ev) {
    const target = ev.target && ev.target.closest ? ev.target.closest("button,a") : null;
    if (!target) return;

    const t = txt(target);

    if (t.includes("что посмотреть")) {
      ev.preventDefault();
      ev.stopPropagation();
      setTimeout(openHelper, 0);
      return;
    }

    if (t === "смотреть все" || t.includes("смотреть все")) {
      ev.preventDefault();
      ev.stopPropagation();
      setTimeout(showAllPopular, 0);
      return;
    }
  }, true);

  function fixButtonStyles() {
    Array.from(document.querySelectorAll("button,a")).forEach(el => {
      const t = txt(el);
      if (t.includes("что посмотреть") || t.includes("смотреть все")) {
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.style.position = el.style.position || "relative";
        el.style.zIndex = "50";
      }
    });
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(fixButtonStyles, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  window.GKM_BUTTONS_FIX_VERSION = "v38-buttons-fix-2026-06-13";
})();


/* === GKM V39 CARD TITLE FULL FIX === */
(function () {
  function fixTitles() {
    const selectors = [
      ".card-title",
      ".movie-title",
      ".item-title",
      ".title",
      ".card h3",
      ".movie-card h3",
      ".item-card h3"
    ].join(",");

    document.querySelectorAll(selectors).forEach(el => {
      const card = el.closest(".card, .movie-card, .item-card, .catalog-card");
      if (!card) return;

      el.style.whiteSpace = "normal";
      el.style.overflow = "visible";
      el.style.textOverflow = "clip";
      el.style.display = "block";
      el.style.webkitLineClamp = "unset";
      el.style.lineClamp = "unset";
      el.style.maxHeight = "none";
      el.style.minHeight = "auto";
      el.style.wordBreak = "break-word";

      card.style.height = "auto";
      card.style.minHeight = card.style.minHeight || "";
    });
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(fixTitles, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 160), true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

  window.GKM_CARD_TITLES_FULL_VERSION = "v39-card-titles-full-2026-06-13";
})();


/* === GKM V40 NO TITLE CUT PATCH === */
(function () {
  function fullTitleFromNode(el) {
    const original = el && (
      el.getAttribute("data-original-title") ||
      el.getAttribute("data-originalTitle") ||
      el.getAttribute("title")
    );
    if (original && original.length > (el.textContent || "").length) return original;
    return "";
  }

  function uncutTitles() {
    const selectors = [
      ".card-title",
      ".movie-title",
      ".item-title",
      ".card-name",
      ".card__title",
      ".card h3",
      ".movie-card h3",
      ".item-card h3"
    ].join(",");

    document.querySelectorAll(selectors).forEach(el => {
      const full = fullTitleFromNode(el);
      if (full && /…|\.\.\./.test(el.textContent || "")) {
        el.textContent = full;
      }

      el.style.whiteSpace = "normal";
      el.style.overflow = "visible";
      el.style.textOverflow = "clip";
      el.style.display = "block";
      el.style.webkitLineClamp = "unset";
      el.style.lineClamp = "unset";
      el.style.maxHeight = "none";
      el.style.wordBreak = "break-word";
      el.style.overflowWrap = "anywhere";
    });
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(uncutTitles, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 160), true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

  window.GKM_NO_TITLE_CUT_VERSION = "v40-no-title-cut-2026-06-13";
})();


/* === GKM V42 REAL GLOBAL DEDUPE === */
(function () {
  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replaceAll("ё", "е")
      .replace(/\(\d{4}\)/g, " ")
      .replace(/\bseason\s*\d+\b/gi, " ")
      .replace(/\bсезон\s*\d+\b/gi, " ")
      .replace(/\bpart\s*\d+\b/gi, " ")
      .replace(/\bчасть\s*\d+\b/gi, " ")
      .replace(/\bova\b|\bona\b|\btv\b|\bmovie\b|\bspecial\b/gi, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleFromCard(card) {
    const selectors = [
      ".card-title", ".movie-title", ".item-title", ".card-name", ".card__title",
      ".title", "h3", "h2"
    ];
    for (const s of selectors) {
      const el = card.querySelector(s);
      if (!el) continue;
      const raw = el.getAttribute("data-original-title") || el.getAttribute("title") || el.textContent || "";
      const t = norm(raw);
      if (t && t.length > 2) return t;
    }

    // запасной вариант: первая жирная строка в карточке
    const lines = String(card.textContent || "")
      .split("\n")
      .map(x => norm(x))
      .filter(Boolean)
      .filter(x => !/^(аниме|сериал|мультфильм|фильм|топ|новинка|s класс|a класс|новый мало оценок)/.test(x));
    return lines[0] || "";
  }

  function yearFromCard(card) {
    const txt = String(card.textContent || "");
    const m = txt.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? m[1] : "";
  }

  function posterFromCard(card) {
    const img = card.querySelector("img");
    let src = img && (img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original"));
    if (!src) {
      const bg = getComputedStyle(card).backgroundImage || "";
      const m = bg.match(/url\(["']?(.+?)["']?\)/);
      src = m && m[1] ? m[1] : "";
    }
    return String(src || "").split("?")[0].replace(/\/w\d+\//, "/").slice(-90);
  }

  function typeScore(card) {
    const t = String(card.textContent || "").toLowerCase();
    let s = 0;
    if (t.includes("аниме")) s += 5;
    if (t.includes("сериал")) s += 4;
    if (t.includes("фильм")) s += 3;
    if (t.includes("мультфильм")) s += 1;
    if (t.includes("s-класс")) s += 8;
    if (t.includes("a-класс")) s += 6;
    if (t.includes("новый - мало оценок")) s -= 4;
    if (card.querySelector("img")) s += 2;
    return s;
  }

  function keyFromCard(card) {
    const title = titleFromCard(card);
    const year = yearFromCard(card);
    const poster = posterFromCard(card);

    // Главный ключ: рус/англ название + год. Тип не учитываем специально,
    // чтобы убрать "одно и то же" как Аниме/Мультфильм.
    if (title && title.length > 2) return "t|" + title + "|" + year;

    if (poster && poster.length > 10) return "p|" + poster;
    return "";
  }

  function getAllCards() {
    return Array.from(document.querySelectorAll(".card, .movie-card, .item-card, .catalog-card"))
      .filter(card => {
        const t = String(card.textContent || "").trim();
        return t.length > 5 || card.querySelector("img");
      });
  }

  function dedupeDomGlobal() {
    const cards = getAllCards();
    if (cards.length < 2) return;

    const groups = new Map();

    for (const card of cards) {
      const key = keyFromCard(card);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    }

    let removed = 0;

    for (const [key, list] of groups.entries()) {
      if (list.length < 2) continue;

      // Оставляем лучшую карточку: чаще всего аниме/сериал с рейтингом важнее, чем дубль-мультфильм.
      list.sort((a, b) => typeScore(b) - typeScore(a));
      const keep = list[0];

      for (let i = 1; i < list.length; i++) {
        const card = list[i];
        if (card === keep) continue;
        card.remove();
        removed++;
      }
    }

    window.GKM_LAST_DEDUPE_REMOVED = removed;
  }

  function itemTitle(item) {
    return norm(
      item && (
        item.title_ru || item.ruTitle || item.title || item.name ||
        item.original_title || item.english || item.japanese || item.romaji || ""
      )
    );
  }

  function itemYear(item) {
    return String(item && (item.year || item.release_year || item.start_year || item.date || "") || "").match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
  }

  function itemPoster(item) {
    return String(item && (item.poster || item.poster_path || item.image || item.cover || "") || "")
      .split("?")[0]
      .replace(/\/w\d+\//, "/")
      .slice(-90);
  }

  function itemScore(item) {
    let s = 0;
    const txt = String(JSON.stringify(item || {})).toLowerCase();
    if (txt.includes("аниме") || txt.includes("anime")) s += 5;
    if (txt.includes("сериал") || txt.includes("series")) s += 4;
    if (txt.includes("мультфильм") || txt.includes("cartoon")) s += 1;
    const rating = Number(item && (item.rating || item.score || item.vote_average || 0)) || 0;
    s += rating;
    const votes = Number(item && (item.votes || item.vote_count || item.scored_by || 0)) || 0;
    if (votes > 1000) s += 4;
    if (item && (item.poster || item.poster_path || item.image)) s += 2;
    return s;
  }

  function dedupeArray(arr) {
    if (!Array.isArray(arr)) return arr;

    const map = new Map();

    for (const item of arr) {
      if (!item || typeof item !== "object") {
        const k = "raw|" + String(item);
        if (!map.has(k)) map.set(k, item);
        continue;
      }

      const title = itemTitle(item);
      const year = itemYear(item);
      const poster = itemPoster(item);

      let k = title && title.length > 2 ? ("t|" + title + "|" + year) : "";
      if (!k && poster) k = "p|" + poster;
      if (!k) k = "id|" + (item.id || item.mal_id || item.tmdb_id || Math.random());

      const old = map.get(k);
      if (!old || itemScore(item) > itemScore(old)) {
        map.set(k, item);
      }
    }

    return Array.from(map.values());
  }

  function patchGlobalArray(name) {
    try {
      let val = window[name];
      if (Array.isArray(val)) val = dedupeArray(val);

      Object.defineProperty(window, name, {
        configurable: true,
        get() { return val; },
        set(v) { val = Array.isArray(v) ? dedupeArray(v) : v; }
      });
    } catch(e) {}
  }

  function patchGlobals() {
    ["items","allItems","movies","GKM_ITEMS","catalogItems","DATA","db"].forEach(patchGlobalArray);
    ["items","allItems","movies","GKM_ITEMS","catalogItems","DATA","db"].forEach(n => {
      if (Array.isArray(window[n])) window[n] = dedupeArray(window[n]);
    });
  }

  // Патчим fetch, чтобы JSON-массивы и chunks сразу чистились при загрузке.
  const oldFetch = window.fetch;
  if (typeof oldFetch === "function" && !oldFetch.__gkmDedupeV42) {
    const wrappedFetch = async function(...args) {
      const res = await oldFetch.apply(this, args);
      try {
        const url = String(args[0] && (args[0].url || args[0]) || "");
        if (!/\.json(\?|$)|\/data\//i.test(url)) return res;

        const clone = res.clone();
        const data = await clone.json();

        let changed = false;
        let out = data;

        if (Array.isArray(data)) {
          out = dedupeArray(data);
          changed = out.length !== data.length;
        } else if (data && typeof data === "object") {
          for (const k of ["items","movies","results","data","records"]) {
            if (Array.isArray(data[k])) {
              const before = data[k].length;
              data[k] = dedupeArray(data[k]);
              if (data[k].length !== before) changed = true;
            }
          }
          out = data;
        }

        if (!changed) return res;

        return new Response(JSON.stringify(out), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers
        });
      } catch(e) {
        return res;
      }
    };
    wrappedFetch.__gkmDedupeV42 = true;
    window.fetch = wrappedFetch;
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      patchGlobals();
      dedupeDomGlobal();
    }, 120);
  }

  patchGlobals();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 160), true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  window.GKM_REAL_DEDUPE_VERSION = "v42-real-global-dedupe-2026-06-13";
})();


/* === GKM V44 FORCE ANIME-SITES FOR ALL ANIME-LIKE DETAILS === */
(function () {
  const YUMMY_SLIME_URL = "https://yummyanime.tv/1204-o-moem-pererozhdenii-v-sliz-film-g1.html";

  const ANIME_HINTS = [
    "аниме", "jikan", "myanimelist", "shikimori", "anilist", "anidb",
    "naruto", "наруто", "boruto", "боруто", "one piece", "ван-пис", "ван пис",
    "bleach", "блич", "demon slayer", "kimetsu", "истребитель демонов",
    "jujutsu", "магическая битва", "attack on titan", "атака титанов",
    "hunter x hunter", "охотник", "gintama", "гинтама", "frieren", "фрирен",
    "fullmetal", "стальной алхимик", "chainsaw", "человек-бензопила",
    "dragon ball", "драконий жемчуг", "re:zero", "re zero", "ре зеро",
    "mushoku", "slime", "слизь", "jojo", "джоджо", "sword art online",
    "sao", "one punch", "ванпанч", "tokyo ghoul", "токийский гуль",
    "black clover", "fairy tail", "haikyuu", "волейбол", "pokemon", "покемон",
    "berserk", "берсерк", "death note", "тетрадь смерти"
  ];

  function norm(v) {
    return String(v || "").toLowerCase().replaceAll("ё", "е").trim();
  }

  function cleanTitle(v) {
    return String(v || "")
      .replace(/\(\d{4}\)/g, "")
      .replace(/\bTV\b|\bONA\b|\bOVA\b|\bMovie\b|\bSpecial\b/gi, "")
      .replace(/[|•·]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detailRoot() {
    return document.querySelector("dialog[open]") ||
      document.querySelector(".detail-modal[open], .modal[open], #detailsModal, #detailModal, .details-modal, .detail-view") ||
      document.body;
  }

  function detailTitle(root) {
    const selectors = [".detail-title", ".modal-title", ".details-title", ".movie-title", "[data-title]", "h1", "h2"];
    for (const s of selectors) {
      const el = root.querySelector && root.querySelector(s);
      if (!el) continue;
      const t = cleanTitle(el.getAttribute("data-title") || el.textContent || "");
      if (t && !/смотреть|искать|аниме-сайты|найти на сайтах/i.test(t)) return t;
    }
    return "";
  }

  function isAnimeLike(root) {
    const text = norm((root.textContent || "") + " " + detailTitle(root));
    if (/тип\s*аниме/.test(text)) return true;
    if (text.includes("источник") && (text.includes("jikan") || text.includes("myanimelist"))) return true;
    if (text.includes("аниме-сайты")) return true;

    // ВАЖНО: у тебя часть аниме помечена как "Мультфильм" через TMDB.
    // Поэтому проверяем не только тип, но и название/франшизу.
    return ANIME_HINTS.some(h => text.includes(norm(h)));
  }

  function titleQuery(root) {
    return encodeURIComponent(detailTitle(root) || "anime");
  }

  function linkSet(root) {
    const q = titleQuery(root);
    const titleText = norm((root.textContent || "") + " " + detailTitle(root));
    const isSlime = titleText.includes("слизь") || titleText.includes("slime") || titleText.includes("tensei shitara slime");

    return [
      ["Shikimori", "https://shikimori.one/animes/search?search=" + q],
      ["MyAnimeList", "https://myanimelist.net/anime.php?q=" + q],
      ["AniList", "https://anilist.co/search/anime?search=" + q],
      ["Anime-Planet", "https://www.anime-planet.com/anime/all?name=" + q],
      ["AniDB", "https://anidb.net/anime/?adb.search=" + q],
      ["YummyAnime", isSlime ? YUMMY_SLIME_URL : "https://yummyanime.tv/index.php?do=search&subaction=search&story=" + q]
    ];
  }

  function findBlockByHeader(root, headerText) {
    const headers = Array.from(root.querySelectorAll("h1,h2,h3,h4,.links-title,.section-title,b,strong"));
    const h = headers.find(el => norm(el.textContent).includes(norm(headerText)));
    if (!h) return null;
    return h.closest("section,.links-block,.detail-block,.detail-section,div") || h.parentElement;
  }

  function findOrCreateAnimeBlock(root) {
    let block = findBlockByHeader(root, "аниме-сайты");
    if (block) return block;

    const findSitesBlock = findBlockByHeader(root, "найти на сайтах");
    const watchBlock = findBlockByHeader(root, "смотреть / искать видео");

    const section = document.createElement("section");
    section.className = "links-block gkm-force-anime-sites";
    section.innerHTML = '<h3 class="links-title">Аниме-сайты</h3><div class="detail-buttons"></div>';

    if (findSitesBlock && findSitesBlock.parentNode) {
      findSitesBlock.parentNode.insertBefore(section, findSitesBlock);
    } else if (watchBlock && watchBlock.parentNode) {
      watchBlock.parentNode.insertBefore(section, watchBlock.nextSibling);
    } else {
      root.appendChild(section);
    }

    return section;
  }

  function buttonBox(block) {
    let box = block.querySelector(".detail-buttons,.links-row,.buttons-row");
    if (!box) {
      box = document.createElement("div");
      box.className = "detail-buttons";
      block.appendChild(box);
    }
    return box;
  }

  function ensureAnimeSites() {
    const root = detailRoot();
    if (!root || !isAnimeLike(root)) return;

    const block = findOrCreateAnimeBlock(root);
    if (!block) return;

    const box = buttonBox(block);
    const links = linkSet(root);

    links.forEach(([name, url]) => {
      let a = Array.from(box.querySelectorAll("a,button")).find(x => norm(x.textContent) === norm(name));
      if (!a || a.tagName !== "A") {
        a = document.createElement("a");
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = name;
        box.appendChild(a);
      }
      a.href = url;
    });
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(ensureAnimeSites, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();

  window.addEventListener("load", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 180), true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

  window.GKM_FORCE_ANIME_SITES_VERSION = "v44-force-anime-sites-2026-06-13";
})();


/* GKM V63: removed duplicate V45 search input bind */
/* === GKM V46 STRICT TITLE SEARCH GUARD === */
(function () {
  window.GKM_STRICT_TITLE_SEARCH_VERSION = "v46-strict-title-search-2026-06-13";
})();




window.GKM_DETAIL_ANIME_SITES_VERSION = "v48-detail-anime-sites-real-2026-06-13";

/* GKM V63: removed duplicate V49 search input bind */
window.GKM_STRICT_VISIBLE_TITLE_SEARCH_VERSION = "v50-strict-visible-title-search-2026-06-13";


window.GKM_BUILD_DATA_FIX_VERSION = "v56-clean-builder-data-fix-2026-06-13";


window.GKM_FORCE_POSTFIX_BUILD_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


window.GKM_HELPER_RESTORED_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


window.GKM_TESTED_RELEASE_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


window.GKM_RUNTIME_GUARD_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


window.GKM_MORE_BUTTONS_FIX_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";

window.GKM_CLEAN_ONLY_PACKAGE_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";

window.GKM_NO_SCROLL_BUTTONS_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";



/* === GKM V63 MORE BUTTONS CAPTURE OVERRIDE === */
(function () {
  function bindMoreButtonsCaptureV63() {
    if (document.documentElement.dataset.gkmMoreButtonsV63 === "1") return;
    document.documentElement.dataset.gkmMoreButtonsV63 = "1";

    document.addEventListener("click", function (e) {
      const btn = e.target && e.target.closest ? e.target.closest("[data-open-tab], .home-more-btn") : null;
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      const tabName = btn.getAttribute("data-open-tab") || btn.dataset.openTab || "all";
      if (typeof gkmOpenDepartmentV61 === "function") {
        gkmOpenDepartmentV61(tabName, { keepPosition: false });
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindMoreButtonsCaptureV63);
  else bindMoreButtonsCaptureV63();

  window.GKM_MORE_BUTTONS_CAPTURE_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
})();



/* === GKM V64 HELPER CLOSE HARD FIX === */
(function () {
  function closeAiDialogV64() {
    const dialog = document.getElementById("gkmAiDialog");
    if (!dialog) return false;
    try {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    } catch {}
    dialog.removeAttribute("open");
    dialog.style.display = "none";
    document.body.classList.remove("ai-open", "gkm-ai-open");
    return true;
  }

  function openAiDialogV64() {
    const dialog = document.getElementById("gkmAiDialog");
    if (!dialog) return false;
    dialog.style.display = "";
    try {
      if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("gkm-ai-open");
    return true;
  }

  function bindAiCloseV64() {
    if (document.documentElement.dataset.gkmAiCloseV64 === "1") return;
    document.documentElement.dataset.gkmAiCloseV64 = "1";

    document.addEventListener("click", function (e) {
      const closeBtn = e.target && e.target.closest ? e.target.closest("#gkmAiCloseBtn, .ai-close") : null;
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        closeAiDialogV64();
        return;
      }

      const openBtn = e.target && e.target.closest ? e.target.closest("#gkmAiFloatBtn, #gkmAiTopBtn, .ai-float-btn, .ai-top-btn") : null;
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        openAiDialogV64();
        return;
      }
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAiDialogV64();
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAiCloseV64);
  else bindAiCloseV64();

  window.GKM_HELPER_CLOSE_FIX_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";
})();


window.GKM_BALANCED_HOME_VERSION = "v69-fast-pages-no-freeze-tested-2026-06-13";


window.GKM_LIST_SORT_POLICY_VERSION = "votes_first_then_rating_v67";


window.GKM_FAST_PAGES_POLICY_VERSION = "departments_use_prebuilt_pages_no_full_index_v69";
