globalThis.window = globalThis;

const FAST_BASE = "data/fast";
const pages = {
  "data/fast/pages/movies/page_0001.json": {items:[
    {ru:"Фильм много голосов",en:"Movie Big",type:"Фильм",year:"2024",rating:8.2,votes:5000,poster:"p",genres:["Драма"]},
    {ru:"Фильм мало голосов",en:"Movie Low",type:"Фильм",year:"2026",rating:9.9,votes:2,poster:"p",genres:["Драма"]}
  ]},
  "data/fast/pages/series/page_0001.json": {items:[
    {ru:"Сериал норм",en:"Series Big",type:"Сериал",year:"2025",rating:8.1,votes:3000,poster:"p",genres:["Драма"]}
  ]},
  "data/fast/pages/cartoons/page_0001.json": {items:[
    {ru:"Мульт норм",en:"Cartoon Big",type:"Мультфильм",year:"2024",rating:8.0,votes:2000,poster:"p",genres:["Мультфильм"]}
  ]},
  "data/fast/pages/anime/page_0001.json": {items:[
    {ru:"Наруто",en:"Naruto",type:"Аниме",year:"2002",rating:8.0,votes:2000000,poster:"p",genres:["Аниме"]},
    {ru:"Scooby-Doo! Behind the Scenes",en:"Scooby",type:"Аниме",year:"1998",rating:9.9,votes:10,poster:"p",genres:["Аниме"]}
  ]},
  "data/fast/pages/popular/page_0001.json": {items:[
    {ru:"Популярный фильм",en:"Popular Movie",type:"Фильм",year:"2014",rating:8.7,votes:900000,poster:"p",genres:["Фантастика"]}
  ]},
  "data/fast/pages/top/page_0001.json": {items:[
    {ru:"Топ сериал",en:"Top Series",type:"Сериал",year:"2020",rating:9.1,votes:800000,poster:"p",genres:["Драма"]}
  ]},
  "data/fast/pages/new/page_0001.json": {items:[
    {ru:"Новая новинка",en:"New Movie",type:"Фильм",year:"2026",rating:7.8,votes:500,poster:"p",genres:["Боевик"]},
    {ru:"Слабая новинка",en:"New Low",type:"Фильм",year:"2026",rating:10,votes:1,poster:"p",genres:["Боевик"]}
  ]}
};
async function fetchJsonQuiet(url){ return pages[url] || {items:[]}; }
function getType(m){ return gkmTypeV60(m); }
let homeData = { sections:{
  popular:[{ru:"Только аниме",en:"Anime Big",type:"Аниме",year:"2020",rating:8.5,votes:100000,poster:"p",genres:["Аниме"]}],
  top:[],
  new:[],
  movies:[],
  series:[],
  cartoons:[],
  anime:[]
}};
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
(async()=>{
  await gkmBuildBalancedHomeV65();
  const s = homeData.sections;
  const lowVotesOnHome = Object.values(s).flat().filter(x => Number(x.votes||0) < 80).length;
  const types = {
    movies:s.movies.length,
    series:s.series.length,
    cartoons:s.cartoons.length,
    anime:s.anime.length,
    new:s.new.length,
    popular:s.popular.length,
    top:s.top.length
  };
  const scoobyAnime = s.anime.filter(x => (x.ru+x.en).toLowerCase().includes("scooby")).length;
  console.log(JSON.stringify({types, lowVotesOnHome, scoobyAnime, stats:globalThis.GKM_BALANCED_HOME_STATS || window.GKM_BALANCED_HOME_STATS}));
  if(types.movies < 1) process.exit(2);
  if(types.series < 1) process.exit(3);
  if(types.cartoons < 1) process.exit(4);
  if(types.anime < 1) process.exit(5);
  if(types.new < 1) process.exit(6);
  if(lowVotesOnHome !== 0) process.exit(7);
  if(scoobyAnime !== 0) process.exit(8);
})();
