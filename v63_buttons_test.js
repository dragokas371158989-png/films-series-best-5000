
globalThis.scrolledTo = null;
globalThis.window = { scrollTo: function(){ throw new Error("window.scrollTo must not be used"); } };
const elements = {
  searchInput:{value:"наруто", blur:function(){ this.blurred=true; }},
  typeFilter:{value:"Аниме"},
  genreFilter:{value:"Экшен"},
  yearFilter:{value:"2026"},
  ratingFilter:{value:"8"},
  sortFilter:{value:"rating"},
  countText:{scrollIntoView:function(arg){ globalThis.scrolledTo = {id:"countText", arg}; }},
  grid:{scrollIntoView:function(arg){ globalThis.scrolledTo = {id:"grid", arg}; }}
};
function $(id){ return elements[id] || null; }
const document = { querySelector: function(){ return null; } };
function getType(m){ return gkmTypeV60(m); }
function renderHome(){ globalThis.renderHomeCalled = true; }
async function renderFavorites(){}
async function renderHistory(){}
async function renderRandom(){}
async function loadPage(tab,page){ globalThis.loaded = {tab,page}; }
function setActiveTab(tab){ globalThis.activeTab = tab; }
function renderList(section,label){ globalThis.renderedList = {section,label}; }
function setStatus(s){ globalThis.status=s; }
let lastSearchResults = [{id:1}], currentPage = 7, currentItems = [], currentPages = 1;
let metaData = {fallback:false};
let homeData = {sections:{}};
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
(async()=>{
  const sections = {
    anime: [{ru:"Scooby-Doo! Behind the Scenes",en:"Scooby",type:"Аниме",year:"1998",genres:["Аниме"]}],
    popular: [
      {ru:"Naruto",en:"Naruto",type:"Аниме",year:"2002",genres:["Аниме"],rating:8,votes:2000},
      {ru:"Scooby-Doo! Behind the Scenes",en:"Scooby",type:"Аниме",year:"1998",genres:["Аниме"],rating:9,votes:10}
    ],
    cartoons: []
  };
  const fixed = gkmEnsureHomeSectionsV61(sections);
  const animeScooby = fixed.anime.filter(x => (x.ru+x.en).toLowerCase().includes('scooby')).length;
  const animeCount = fixed.anime.length;
  const cartoonsScooby = fixed.cartoons.filter(x => (x.ru+x.en).toLowerCase().includes('scooby')).length;
  await gkmOpenDepartmentV61("anime");
  const cleared = elements.searchInput.value==="" && elements.typeFilter.value==="" && elements.genreFilter.value==="" && elements.yearFilter.value==="" && elements.ratingFilter.value==="" && elements.sortFilter.value==="smart";
  console.log(JSON.stringify({animeScooby,animeCount,cartoonsScooby,loaded:globalThis.loaded,cleared,activeTab:globalThis.activeTab,scrolledTo:globalThis.scrolledTo,blurred:elements.searchInput.blurred,status:globalThis.status}));
  if (animeScooby !== 0) process.exit(2);
  if (animeCount < 1) process.exit(3);
  if (cartoonsScooby < 1) process.exit(4);
  if (!globalThis.loaded || globalThis.loaded.tab !== "anime" || globalThis.loaded.page !== 1) process.exit(5);
  if (!cleared) process.exit(6);
  if (!globalThis.scrolledTo || globalThis.scrolledTo.id !== "countText") process.exit(7);
  if (!elements.searchInput.blurred) process.exit(8);
})();
