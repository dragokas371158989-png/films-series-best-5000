const GKM_APP_CLEAN_VERSION = "v144-kinopoisk-only-auto-catalog-2026-06-24";
window.GKM_V144_KINOPOISK_AUTO_CATALOG_VERSION = "v144-kinopoisk-only-auto-catalog-2026-06-24";
window.GKM_V136_SAFE_ANIME_TITLE_FIX_VERSION = "v136-safe-anime-franchise-title-fix-2026-06-24";
window.GKM_V137_SAFE_ALL_FRANCHISE_TITLE_FIX_VERSION = "v137-safe-all-franchise-title-fix-2026-06-24";
window.GKM_V114_RUSSIAN_POSTERS_VERSION = "v114-kinopoisk-russian-posters-2026-06-20";
window.GKM_V116_ANIME_TOP_100_VERSION = "v116-anime-top-100-rating-2026-06-23";
window.GKM_V117_ANIME_TOP_100_PEOPLE_VERSION = "v117-anime-top-100-people-rating-2026-06-23";
window.GKM_V119_ANIME_TOP_ADAPTIVE_9M_VERSION = "v119-anime-top-adaptive-9m-2026-06-23";
window.GKM_V120_ANIME_TOP_POPULAR_9M_VERSION = "v120-anime-top-popular-adaptive-9m-2026-06-23";
window.GKM_V121_ANIME_TOP_FILL_100_VERSION = "v121-anime-top-popular-fill-100-2026-06-23";
window.GKM_V122_ANIME_TOP_RU_ONE_FRANCHISE_VERSION = "v122-anime-top-ru-title-one-franchise-2026-06-23";
window.GKM_V125_ANIME_TITLE_ALIAS_FIX_VERSION = "v125-anime-title-alias-nanatsu-fix-2026-06-23";
window.GKM_V126_MANUAL_TOP_100_RU_DETAILS_VERSION = "v126-manual-top-100-ru-details-clean-2026-06-23";
window.GKM_V127_ANIME_DETAIL_FACTS_VERSION = "v127-anime-detail-facts-enriched-2026-06-23";
window.GKM_V128_WORKER_HASALIAS_FIX_VERSION = "v128-worker-hasalias-fix-2026-06-23";
window.GKM_V129_NARUTO_SHIPPUDEN_FIX_VERSION = "v130-anime-top-rank-page-cache-fix-2026-06-24";
window.GKM_V130_ANIME_TOP_RANK_PAGE_CACHE_FIX_VERSION = "v130-anime-top-rank-page-cache-fix-2026-06-24";
window.GKM_V131_STATIC_ANIME_TOP_FAST_VERSION = "v131-static-anime-top-fast-no-worker-hang-2026-06-24";
window.GKM_V132_ANIME_STUDIOS_TOP_VERSION = "v132-anime-studios-required-top-2026-06-24";
window.GKM_V134_STUDIO_TOP_WIDE_RU_VERSION = "v134-studio-top-wide-ru-titles-2026-06-24";
window.GKM_V135_STUDIO_ANIME_LIST_VERSION = "v135-studio-anime-list-click-2026-06-24";
window.GKM_V146_VOTES_9000000_SORT_VERSION = "v146-votes-9000000-sort-2026-06-24";
window.GKM_V147_INFER_ANIME_STUDIO_FIX_VERSION = "v147-infer-anime-studio-safe-fix-2026-06-24";
window.GKM_V148_ANTITRASH_GENRE_TOP_VERSION = "v148-antitrash-genre-top-2026-06-24";
window.GKM_V149_GENRE_TOP_FILMS_ONLY_VERSION = "v149-genre-top-films-only-2026-06-24";
window.GKM_V150_CARD_POSTER_RAW_FIX_VERSION = "v150-card-poster-raw-fix-2026-06-24";
window.GKM_V151_RELATED_SAME_TYPE_VERSION = "v151-related-same-type-2026-06-24";
window.GKM_V152_STRICT_SMART_TOP_VERSION = "v152-strict-smart-top-no-trash-2026-06-24";
window.GKM_V153_STRICT_SECTION_TOP_VERSION = "v153-strict-section-top-no-low-votes-2026-06-24";
window.GKM_V154_FORCE_SEARCH_SECTIONS_VERSION = "v154-force-search-for-sections-2026-06-24";
window.GKM_V155_SMART_TOP_REAL_VOTES_VERSION = "v155-smart-top-real-votes-fix-2026-06-24";
window.GKM_V156_NEW_2026_ONLY_VERSION = "v156-new-current-year-only-2026-06-24";
window.GKM_V157_CLEAN_TRASH_TOGGLE_VERSION = "v157-clean-trash-toggle-2026-06-24";
window.GKM_V158_NEW_RELEASE_GROUPS_VERSION = "v158-new-release-groups-2026-06-24";
window.GKM_V159_COMPACT_TRASH_BUTTON_VERSION = "v159-compact-trash-button-2026-06-24";
console.log("GKM: v159-compact-trash-button-2026-06-24");
window.GKM_V160_CONTROLS_LAYOUT_FIX_VERSION = "v160-controls-trash-button-layout-fix-2026-06-24";
console.log("GKM: v160-controls-trash-button-layout-fix-2026-06-24");
window.GKM_V161_DECADE_TOPS_VERSION = "v161-decade-and-year-tops-2026-06-24";
console.log("GKM: v161-decade-and-year-tops-2026-06-24");

const TMDB_ENABLED = false;
const KINOPOISK_ENABLED = false;

const FAST_BASE = "data/fast";
const HOME_URL = `${FAST_BASE}/home.json`;
const META_URL = `${FAST_BASE}/meta.json`;
const SEARCH_URL = `${FAST_BASE}/search_index.json`;
const SEARCH_LITE_URL = `${FAST_BASE}/search_lite.json`;
const SEARCH_SHARDS_BASE = `${FAST_BASE}/search_shards`;
const ANIME_TOP_MANUAL_URL = `${FAST_BASE}/anime_top_manual.json`;
const ANIME_STUDIOS_TOP_URL = `${FAST_BASE}/anime_studios_top.json`;
const ANIME_STUDIOS_DETAIL_URL = `${FAST_BASE}/anime_studios_detail.json`;
const PAGE_SIZE = 60;

let currentTab = "all";
let currentPage = 1;
let currentPages = 1;
let currentCount = 0;
let currentItems = [];
let currentMode = "home";
let homeData = null;
let metaData = null;
let searchWorker = null;
let searchReq = 0;
let searchTimer = 0;
let selectedItem = null;

const $ = (id) => document.getElementById(id);
const favKey = "gkm_favorites";
const historyKey = "gkm_history";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function norm(value) {
  return String(value || "").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}:]+/gu, " ").replace(/\s+/g, " ").trim();
}


function isAnimeItem(item) {
  const text = norm([
    item && item.type,
    item && item.category,
    item && item.ru,
    item && item.en,
    item && item.title,
    item && item.name,
    item && item.source
  ].filter(Boolean).join(" "));
  return text.includes("аниме") || text.includes("anime") || text.includes("jikan") || text.includes("myanimelist");
}

function inferAnimeStudio(item) {
  if (!item || !isAnimeItem(item)) return "";
  const raw = norm([
    item.ru,
    item.en,
    item.title,
    item.name,
    item.original_title,
    item.original_name,
    item.__manualTopTitle
  ].filter(Boolean).join(" "));
  const rules = [
    [/attack on titan|shingeki|атака титанов|jujutsu|магическая битва|chainsaw|человек бензопила|vinland|сага о винланде/i, "MAPPA"],
    [/death note|one punch|ванпанч|hunter|охотник|паразит|parasyte|frieren|фрирен/i, "Madhouse"],
    [/sword art|семь смертных|seven deadly|erased|город в котором меня нет|kaguya|госпожа кагуя/i, "A-1 Pictures"],
    [/naruto|boruto|bleach|блич|tokyo ghoul|токийский гуль|black clover|черный клевер|чёрный клевер/i, "Pierrot"],
    [/fullmetal|стальной алхимик|my hero|моя геройская|mob psycho|моб психо|boku no hero/i, "Bones"],
    [/demon slayer|истребитель демонов|fate|судьба/i, "ufotable"],
    [/one piece|ван пис|dragon ball|драконий жемчуг|sailor moon|сейлор мун/i, "Toei Animation"],
    [/code geass|код гиас|cowboy bebop|ковбой бибоп|gintama|гинтама/i, "Sunrise"],
    [/steins|врата штейна|re zero|rezero|re:zero|akame|акаме/i, "White Fox"],
    [/silent voice|форма голоса|violet|вайолет|clannad|кланнад|kobayashi|dragon maid/i, "Kyoto Animation"],
    [/evangelion|евангелион/i, "Gainax / Khara"],
    [/ghibli|spirited away|мой сосед тоторо|унесенные призраками|принцесса мононоке/i, "Studio Ghibli"],
  ];
  for (const [re, studio] of rules) {
    if (re.test(raw)) return studio;
  }
  return "";
}

function votes9000000Score(item) {
  const v = Number(getVotes(item) || item?.votes || 0);
  const r = Number(getRating(item) || item?.rating || 0);
  const y = Number(getYear(item) || item?.year || 0);
  if (!v && !r) return 0;
  let score = Math.min(v, 9000000) / 9000000 * 1000;
  score += r * 12;
  if (v < 10) score -= 1000;
  else if (v < 100) score -= 600;
  else if (v < 1000) score -= 250;
  else if (v < 10000) score -= 90;
  if (!hasPoster(item)) score -= 100;
  if (y >= new Date().getFullYear() && v < 500) score -= 80;
  return score;
}

function isLowTrustTopItem(item) {
  const v = Number(getVotes(item) || item?.votes || 0);
  const r = Number(getRating(item) || item?.rating || 0);
  const t = String(item?.type || item?.category || "").toLowerCase();

  // V153: жёсткий отсев мусора для разделов Фильмы/Сериалы/Мультфильмы.
  if ((t.includes("фильм") || t.includes("сериал") || t.includes("мульт")) && v < 50000) return true;
  if (v < 10000) return true;
  if (r >= 9.0 && v < 200000) return true;
  if (r >= 9.5 && v < 500000) return true;
  if (!hasPoster(item) && v < 100000) return true;
  return false;
}

function setStatus(text) {
  const node = $("statusText");
  if (node) node.textContent = text || "";
}

async function fetchJson(url, cache = "force-cache") {
  const res = await fetch(`${url}?v=135`, { cache });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function titleOf(item) {
  return String(item && (item.ru || item.title_ru || item.name || item.title || item.en || item.original_title || item.original_name) || "Без названия");
}




// V136: exact titles for franchise movies/seasons must win before broad aliases.
const ANIME_EXACT_TITLE_RULES = [
  {re:/boruto.*naruto.*movie|boruto.*movie|боруто/iu, ru:"Боруто: Наруто. Фильм"},
  {re:/road\s*to\s*ninja|путь\s*ниндзя/iu, ru:"Наруто: Ураганные хроники — Путь ниндзя"},
  {re:/blood\s*prison|кровав/iu, ru:"Наруто: Ураганные хроники — Кровавая тюрьма"},
  {re:/lost\s*tower|потерянн.*баш/iu, ru:"Наруто: Ураганные хроники — Потерянная башня"},
  {re:/will\s*of\s*fire|вол[ия]\s*огн/iu, ru:"Наруто: Ураганные хроники — Наследники воли огня"},
  {re:/\bbonds\b|\bсвязи\b|\bузы\b/iu, ru:"Наруто: Ураганные хроники — Узы"},
  {re:/the\s*last.*naruto|последн.*наруто/iu, ru:"Последний: Наруто. Фильм"},
  {re:/naruto.*shippuuden.*movie|naruto.*shippuden.*movie|shippuden.*movie|疾風伝.*劇場版/iu, ru:"Наруто: Ураганные хроники — Фильм"},
  {re:/ninja\s*clash|land\s*of\s*snow|стране\s*снег/iu, ru:"Наруто: Битва ниндзя в Стране Снега"},
  {re:/legend\s*of\s*the\s*stone|stone\s*of\s*gelel|камн.*гелел/iu, ru:"Наруто: Легенда о камне Гелела"},
  {re:/crescent\s*moon|полумесяц/iu, ru:"Наруто: Стражи Королевства Полумесяца"},
  {re:/memories\s*of\s*nobody/iu, ru:"Блич: Воспоминания ни о ком"},
  {re:/diamonddust|diamond\s*dust|алмазн/iu, ru:"Блич: Восстание Алмазной Пыли"},
  {re:/fade\s*to\s*black|уходя\s*в\s*темнот/iu, ru:"Блич: Уходя в темноту"},
  {re:/hell\s*verse|адск/iu, ru:"Блич: Адская глава"},
  {re:/sennen\s*kessen|thousand\s*year\s*blood|тысячелетн/iu, ru:"Блич: Тысячелетняя кровавая война"},
  {re:/sacred\s*star\s*of\s*milos|milos|милос/iu, ru:"Стальной алхимик: Священная звезда Милоса"},
  {re:/conqueror\s*of\s*shamballa|shamballa|шамбал/iu, ru:"Стальной алхимик: Завоеватель Шамбалы"},
  {re:/brotherhood|братств/iu, ru:"Стальной алхимик: Братство"},
  {re:/final\s*transmutation|финальн.*трансмутац/iu, ru:"Стальной алхимик: Финальная трансмутация"},
  {re:/revenge\s*of\s*scar|месть\s*шрама/iu, ru:"Стальной алхимик: Месть Шрама"},
  {re:/strong\s*world/iu, ru:"Ван-Пис: Сильный мир"},
  {re:/film\s*z|one\s*piece\s*film\s*z/iu, ru:"Ван-Пис: Фильм Z"},
  {re:/film\s*gold|one\s*piece\s*film\s*gold/iu, ru:"Ван-Пис: Золото"},
  {re:/stampede/iu, ru:"Ван-Пис: Бегство"},
  {re:/film\s*red|one\s*piece\s*film\s*red/iu, ru:"Ван-Пис: Красный"},

  {re:/tokyo\s*ghoul\s*:?re\s*2|tokyo\s*ghoul.*re.*2|東京喰種.*re.*2/iu, ru:"Токийский гуль:re 2"},
  {re:/tokyo\s*ghoul\s*:?re|東京喰種.*re/iu, ru:"Токийский гуль:re"},
  {re:/tokyo\s*ghoul\s*(?:√|v)\s*a|tokyo\s*ghoul\s*root\s*a|東京喰種.*√a/iu, ru:"Токийский гуль √A"},
  {re:/tokyo\s*ghoul|東京喰種|токийск.*гул/iu, ru:"Токийский гуль"},
  {re:/dragon\s*ball\s*super|драконий\s*жемчуг\s*супер/iu, ru:"Драконий жемчуг Супер"},
  {re:/dragon\s*ball\s*z|doragon\s*bo?ru\s*zetto|драконий\s*жемчуг\s*зет/iu, ru:"Драконий жемчуг Зет"},
  {re:/gintama.*semi|gintama.*final|gintama.*movie|гинтама.*полуфин|гинтама.*финал/iu, ru:"Гинтама — отдельная часть"},
  {re:/jojo.*stardust|stardust\s*crusaders/iu, ru:"Невероятные приключения ДжоДжо: Рыцари звёздной пыли"},
  {re:/fate\/?zero|судьба.*начало/iu, ru:"Судьба: Начало"},
  {re:/fate\/?stay|fate.*night|судьба.*ноч/iu, ru:"Судьба: Ночь схватки"},
  {re:/detective\s*conan.*movie|meitantei\s*conan.*movie|конан.*фильм/iu, ru:"Детектив Конан — фильм"},
];
const BROAD_FRANCHISE_KEYS = new Set(["naruto","bleach","one piece","fullmetal alchemist","tokyo ghoul","dragon ball","gintama","hunter x hunter","my hero academia","one punch man","jojo","fate","detective conan","sword art online"]);
function rawAnimeTitleText(item) {
  return [item && item.ru, item && item.title_ru, item && item.__manualTopTitle, item && item.en, item && item.title, item && item.name, item && item.original_title, item && item.original_name].filter(Boolean).join(" ");
}
function specificAnimeTitle(item) {
  const raw = rawAnimeTitleText(item);
  for (const rule of ANIME_EXACT_TITLE_RULES) {
    if (rule.re.test(raw)) return rule.ru;
  }
  return "";
}
function isBroadFranchiseOnlyKey(key) {
  key = norm(key);
  return BROAD_FRANCHISE_KEYS.has(key);
}
function hasExtraFranchiseTitleWords(item, key) {
  const raw = norm(rawAnimeTitleText(item));
  key = norm(key);
  if (!raw || !key || raw === key) return false;
  if (key === "naruto" && (raw.includes("boruto") || raw.includes("movie") || raw.includes("gekijouban") || raw.includes("shippuden") || raw.includes("shippuuden") || raw.includes("疾風伝") || raw.includes("road to ninja") || raw.includes("blood prison") || raw.includes("last"))) return true;
  if (key === "bleach" && (raw.includes("movie") || raw.includes("memories") || raw.includes("diamonddust") || raw.includes("fade to black") || raw.includes("hell verse") || raw.includes("sennen") || raw.includes("thousand year"))) return true;
  if (key === "one piece" && (raw.includes("movie") || raw.includes("film") || raw.includes("strong world") || raw.includes("stampede") || raw.includes("red") || raw.includes("gold"))) return true;
  if (key === "fullmetal alchemist" && (raw.includes("brotherhood") || raw.includes("shamballa") || raw.includes("milos") || raw.includes("scar") || raw.includes("transmutation"))) return true;
  if (key === "tokyo ghoul" && (raw.includes("re") || raw.includes("root") || raw.includes("√") || raw.includes("ova") || raw.includes("jack") || raw.includes("pinto"))) return true;
  if (key === "dragon ball" && (raw.includes("z") || raw.includes("super") || raw.includes("gt") || raw.includes("movie") || raw.includes("kai"))) return true;
  if (key === "gintama" && (raw.includes("season") || raw.includes("movie") || raw.includes("semi") || raw.includes("final") || raw.includes("porori") || raw.includes("enchousen"))) return true;
  if (key === "hunter x hunter" && (raw.includes("1999") || raw.includes("movie") || raw.includes("phantom") || raw.includes("last mission"))) return true;
  if (key === "my hero academia" && (raw.includes("season") || raw.includes("movie") || raw.includes("heroes") || raw.includes("academia 2") || raw.includes("academia 3") || raw.includes("academia 4") || raw.includes("academia 5") || raw.includes("academia 6") || raw.includes("academia 7"))) return true;
  if (key === "one punch man" && (raw.includes("season") || raw.includes("ova") || raw.includes("special"))) return true;
  if (key === "jojo" && (raw.includes("stardust") || raw.includes("diamond") || raw.includes("golden") || raw.includes("stone") || raw.includes("crusaders"))) return true;
  if (key === "fate" && (raw.includes("zero") || raw.includes("stay") || raw.includes("night") || raw.includes("grand") || raw.includes("apocrypha"))) return true;
  if (key === "detective conan" && (raw.includes("movie") || raw.includes("film") || raw.includes("case closed"))) return true;
  if (key === "sword art online" && (raw.includes("ii") || raw.includes("alicization") || raw.includes("ordinal") || raw.includes("progressive") || raw.includes("movie"))) return true;
  return false;
}

const ANIME_RU_MAP = new Map(Object.entries({
  "attack on titan":"Атака титанов",
  "shingeki no kyojin":"Атака титанов",
  "death note":"Тетрадь смерти",
  "one-punch man":"Ванпанчмен",
  "one punch man":"Ванпанчмен",
  "demon slayer kimetsu no yaiba":"Истребитель демонов",
  "demon slayer":"Истребитель демонов",
  "fullmetal alchemist brotherhood":"Стальной алхимик: Братство",
  "fullmetal alchemist":"Стальной алхимик",
  "sword art online":"Мастера меча онлайн",
  "my hero academia":"Моя геройская академия",
  "boku no hero academia":"Моя геройская академия",
  "naruto":"Наруто",
  "naruto shippuden":"Наруто: Ураганные хроники",
  "your name":"Твоё имя",
  "kimi no na wa":"Твоё имя",
  "jujutsu kaisen":"Магическая битва",
  "tokyo ghoul":"Токийский гуль",
  "tokyo ghoul root a":"Токийский гуль √A",
  "tokyo ghoul va":"Токийский гуль √A",
  "tokyo ghoul re":"Токийский гуль:re",
  "tokyo ghoul re 2":"Токийский гуль:re 2",
  "hunter x hunter":"Охотник х Охотник",
  "a silent voice":"Форма голоса",
  "koe no katachi":"Форма голоса",
  "vinland saga":"Сага о Винланде",
  "frieren beyond journey s end":"Провожающая в последний путь Фрирен",
  "sousou no frieren":"Провожающая в последний путь Фрирен",
  "steins gate":"Врата Штейна",
  "code geass":"Код Гиас",
  "one piece":"Ван-Пис",
  "bleach":"Блич",
  "dragon ball":"Драконий жемчуг",
  "nanatsu no taizai":"Семь смертных грехов",
  "seven deadly sins":"Семь смертных грехов",
  "cowboy bebop":"Ковбой Бибоп",
  "monster":"Монстр",
  "berserk":"Берсерк",
  "gintama":"Гинтама",
  "dr stone":"Доктор Стоун",
  "re zero":"Re:Zero — жизнь с нуля в другом мире",
  "re:zero":"Re:Zero — жизнь с нуля в другом мире",
  "86 eighty six":"86: Восемьдесят шесть",
  "86 eighty-six":"86: Восемьдесят шесть",
  "91 days":"91 день",
  "dororo":"Дороро",
  "black clover":"Чёрный клевер",
  "chainsaw man":"Человек-бензопила",
  "spy x family":"Семья шпиона",
  "haikyuu":"Волейбол!!",
  "mob psycho 100":"Моб Психо 100",
  "violet evergarden":"Вайолет Эвергарден",
  "neon genesis evangelion":"Евангелион",
  "made in abyss":"Созданный в Бездне",
  "samurai champloo":"Самурай Чамплу",
  "jojo":"Невероятные приключения ДжоДжо",
  "jojo s bizarre adventure":"Невероятные приключения ДжоДжо",
  "mushoku tensei":"Реинкарнация безработного",
  "clannad":"Кланнад",
  "kaguya sama love is war":"Госпожа Кагуя: в любви как на войне"
  ,"hagane no renkinjutsushi":"Стальной алхимик"
  ,"bleach sennen kessen hen":"Блич: Тысячелетняя кровавая война"
  ,"legend of the galactic heroes":"Легенда о героях Галактики"
  ,"ginga eiyu densetsu":"Легенда о героях Галактики"
  ,"mushishi zoku sho":"Мастер Муси 2"
  ,"kingdom":"Королевство"
  ,"ginga nagareboshi gin":"Серебряный клык"
  ,"dragon ball z":"Драконий жемчуг Зет"
  ,"mirai shonen konan":"Конан — мальчик из будущего"
  ,"gintama":"Гинтама"
  ,"takopii no genzai":"Первородный грех Такопи"
  ,"code geass lelouch of the rebellion":"Код Гиас: Восставший Лелуш"
  ,"kenpu denki beruseruku":"Берсерк"
  ,"kusuriya no hitorigoto":"Монолог фармацевта"
  ,"jojo no kimyo na boken":"Невероятные приключения ДжоДжо"
  ,"shigatsu wa kimi no uso":"Твоя апрельская ложь"
  ,"clannad after story":"Кланнад: Продолжение истории"
  ,"initial d":"Инициал Ди"
  ,"rurouni kenshin":"Бродяга Кэнсин"
  ,"yu yu hakusho":"Отчёт о буйстве духов"
  ,"nana":"Нана"
  ,"meitantei conan":"Детектив Конан"
  ,"ghost in the shell stand alone complex":"Призрак в доспехах: Синдром одиночки"
  ,"samurai chanpuru":"Самурай Чамплу"
  ,"violet evergarden":"Вайолет Эвергарден"
  ,"erased":"Город, в котором меня нет"
  ,"dandadan":"Дандадан"
  ,"bocchi the rock":"Одинокий рокер"
  ,"to your eternity":"Для тебя, Бессмертный"
  ,"dragon ball super":"Драконий жемчуг Супер"
  ,"gurren lagann":"Гуррен Лаганн"
  ,"barakamon":"Баракамон"
  ,"kaiju no 8":"Кайдзю № 8"
  ,"oshi no ko":"Ребёнок айдола"
  ,"summer time rendering":"Летнее время"
  ,"yuri on ice":"Юри на льду"
  ,"fate zero":"Судьба: Начало"
  ,"kuroko no basket":"Баскетбол Куроко"
  ,"mushoku tensei jobless reincarnation":"Реинкарнация безработного"
  ,"re zero starting life in another world":"Re:Zero — жизнь с нуля в другом мире"
  ,"parasyte the maxim":"Паразит"
  ,"trigun":"Триган"
  ,"hellsing ultimate":"Хеллсинг Ultimate"
}));

// V126: additional title aliases
Object.entries({
  "nanatsu no taizai":"Семь смертных грехов",
  "seven deadly sins":"Семь смертных грехов",
  "shingeki no kyojin":"Атака титанов",
  "attack on titan":"Атака титанов",
  "death note":"Тетрадь смерти",
  "jujutsu kaisen":"Магическая битва",
  "a silent voice":"Форма голоса",
  "koe no katachi":"Форма голоса",
  "your name":"Твоё имя",
  "kimi no na wa":"Твоё имя"
}).forEach(([k,v]) => ANIME_RU_MAP.set(norm(k), v));

// V129: exact Naruto/Shippuden aliases must win before broad "naruto"
Object.entries({
  "naruto shippuden":"Наруто: Ураганные хроники",
  "naruto shippuuden":"Наруто: Ураганные хроники",
  "ナルト 疾風伝":"Наруто: Ураганные хроники",
  "naruto hurricane chronicles":"Наруто: Ураганные хроники",
  "наруто ураганные хроники":"Наруто: Ураганные хроники",
  "наруто: ураганные хроники":"Наруто: Ураганные хроники",
  "naruto":"Наруто",
  "ナルト":"Наруто"
}).forEach(([k,v]) => ANIME_RU_MAP.set(norm(k), v));

const ANIME_RU_OVERVIEW = new Map(Object.entries({
  "attack on titan":"Человечество вынуждено жить за огромными стенами, спасаясь от титанов. После нападения на родной город Эрен Йегер клянётся уничтожить титанов и вступает в разведкорпус.",
  "death note":"Старшеклассник Лайт Ягами находит тетрадь смерти, способную убивать людей по имени. Его новая власть запускает опасную игру с гениальным детективом L.",
  "naruto":"Наруто Узумаки мечтает стать Хокаге и добиться признания деревни. Внутри него запечатан Девятихвостый лис, из-за чего путь ниндзя становится особенно тяжёлым.",
  "naruto shippuden":"Повзрослевший Наруто возвращается в деревню и продолжает путь ниндзя, сталкиваясь с Акацуки, судьбой Саске и угрозой большой войны.",
  "vinland saga":"Юный Торфинн оказывается втянут в жестокий мир викингов, мести и войны. Его путь постепенно превращается в историю взросления и поиска настоящей свободы.",
  "frieren beyond journey s end":"После победы над Королём демонов эльфийка Фрирен отправляется в новое путешествие, чтобы понять людей, время и чувства, которые раньше казались ей далёкими.",
  "sousou no frieren":"После победы над Королём демонов эльфийка Фрирен отправляется в новое путешествие, чтобы понять людей, время и чувства, которые раньше казались ей далёкими.",
  "fullmetal alchemist brotherhood":"Братья Элрики нарушают запрет алхимии и платят страшную цену. Чтобы вернуть утраченное, они отправляются на поиски философского камня.",
  "one-punch man":"Сайтама стал настолько сильным, что побеждает любого врага одним ударом. Теперь ему приходится искать смысл геройства в мире монстров и рейтингов.",
  "one punch man":"Сайтама стал настолько сильным, что побеждает любого врага одним ударом. Теперь ему приходится искать смысл геройства в мире монстров и рейтингов.",
  "demon slayer":"Тандзиро Камадо становится истребителем демонов, чтобы спасти сестру Нэдзуко и отомстить за семью, уничтоженную демоном.",
  "demon slayer kimetsu no yaiba":"Тандзиро Камадо становится истребителем демонов, чтобы спасти сестру Нэдзуко и отомстить за семью, уничтоженную демоном.",
  "jujutsu kaisen":"Юдзи Итадори проглатывает проклятый палец и оказывается связан с королём проклятий Сукуной. Теперь он учится сражаться с проклятиями в школе магии.",
  "tokyo ghoul":"Канэки становится полугулем после трагического случая и вынужден жить между человеческим миром и жестокой реальностью гулей.",
  "hunter x hunter":"Гон отправляется сдавать экзамен охотника, чтобы найти отца. На пути его ждут друзья, опасные противники и испытания, меняющие взгляд на мир.",
  "your name":"Парень из Токио и девушка из провинции начинают загадочно меняться телами. Их связь приводит к истории о времени, памяти и судьбе.",
  "a silent voice":"Бывший школьный хулиган пытается искупить вину перед глухой девочкой, которую когда-то обижал. История о прощении, боли и взрослении.",
  "code geass":"Лелуш получает силу абсолютного приказа и начинает восстание против империи, скрываясь под маской Zero.",
  "steins gate":"Группа друзей случайно открывает способ отправлять сообщения в прошлое. Игры со временем быстро приводят к тяжёлым последствиям.",
  "one piece":"Монки Д. Луффи собирает команду и отправляется за легендарным сокровищем Ван-Пис, мечтая стать королём пиратов.",
  "bleach":"Ичиго Куросаки получает силу синигами и начинает защищать людей от духовных чудовищ, постепенно втягиваясь в войны мира душ.",
  "sword art online":"Игроки оказываются заперты в виртуальной MMO, где смерть в игре означает смерть в реальности. Кирито пытается пройти игру и выжить.",
  "my hero academia":"В мире, где сверхспособности стали нормой, Изуку Мидория мечтает стать героем, несмотря на рождение без причуды.",
  "dragon ball":"Сон Гоку проходит путь воина, сражаясь с сильнейшими противниками и защищая Землю вместе с друзьями.",
  "cowboy bebop":"Команда охотников за головами путешествует по космосу, сталкиваясь с прошлым, преступниками и одиночеством.",
  "monster":"Доктор Тэнма спасает мальчика, который позже становится чудовищным преступником. Чтобы исправить ошибку, он начинает опасное расследование.",
  "black clover":"Аста родился без магии, но мечтает стать Королём магов. Упрямство и антимагический меч становятся его главным оружием.",
  "chainsaw man":"Дэндзи заключает контракт с демоном-бензопилой и попадает в мир охотников на демонов, где желания стоят слишком дорого.",
  "spy x family":"Шпион, киллер и девочка-телепат создают фальшивую семью, не зная настоящих секретов друг друга.",
  "86 eighty six":"Республика ведёт войну беспилотниками, скрывая, что за машинами стоят живые подростки из отверженного сектора 86.",
  "86 eighty-six":"Республика ведёт войну беспилотниками, скрывая, что за машинами стоят живые подростки из отверженного сектора 86."
}));

// V126: Russian descriptions for manual anime top details
Object.entries({
  "атака титанов":"Люди живут за огромными стенами, спасаясь от титанов. После падения стены Мария Эрен Йегер вступает в разведкорпус и начинает войну за свободу человечества.",
  "сага о винланде":"Юный Торфинн растёт среди викингов, войны и мести. Его путь постепенно превращается в историю взросления, потерь и поиска земли без насилия.",
  "ковбой бибоп":"Команда охотников за головами путешествует по космосу, ловит преступников и пытается сбежать от прошлого, которое всё равно догоняет каждого из них.",
  "гуррен лаганн":"Симон и Камина вырываются из подземного мира и начинают безумную битву за будущее человечества, где сила духа важнее любых границ.",
  "семь смертных грехов":"Отряд легендарных рыцарей, объявленных предателями, возвращается, чтобы спасти королевство и раскрыть заговор, угрожающий всему миру.",
  "инициал ди":"Такуми Фудзивара случайно становится легендой уличных гонок, когда его ночные доставки тофу превращаются в школу идеального дрифта.",
  "монстр":"Гениальный хирург спасает мальчика, который позже становится опаснейшим преступником. Доктор Тэнма отправляется на поиски, чтобы исправить ошибку прошлого.",
  "берсерк":"Наёмник Гатс проходит через войны, предательство и тьму, пытаясь выжить в жестоком мире и сохранить человечность.",
  "евангелион":"Подростки пилотируют гигантских Евангелионов, защищая человечество от Ангелов, пока война постепенно вскрывает страхи, одиночество и тайны мира.",
  "самурай чамплу":"Трое странников отправляются в путь по Японии эпохи Эдо. Их путешествие смешивает самурайскую драму, комедию и хип-хоп стиль.",
  "ван-пис":"Луффи собирает команду пиратов и отправляется на поиски легендарного сокровища Ван-Пис, чтобы стать королём пиратов.",
  "блич: тысячелетняя кровавая война":"Ичиго и Общество душ сталкиваются с древним врагом — квинси. Начинается кровавая война, раскрывающая тайны прошлого и истинную силу героев.",
  "блич":"Ичиго Куросаки получает силу синигами и оказывается втянут в битвы с пустыми, заговоры Общества душ и войны духовного мира.",
  "охотник х охотник":"Гон Фрикс отправляется сдавать экзамен охотника, чтобы найти отца. На пути его ждут друзья, опасные враги и суровые испытания.",
  "провожающая в последний путь фрирен":"Эльфийка Фрирен после победы над Королём демонов отправляется в новое путешествие, чтобы понять людей, время и ценность прожитых мгновений.",
  "наруто":"Наруто Узумаки мечтает стать Хокаге и добиться признания деревни, несмотря на одиночество и запечатанного внутри Девятихвостого лиса.",
  "наруто: ураганные хроники":"Повзрослевший Наруто возвращается после тренировок и сталкивается с Акацуки, судьбой Саске и войной, которая изменит мир шиноби.",
  "тетрадь смерти":"Лайт Ягами получает тетрадь, способную убивать людей по имени, и начинает собственный суд над миром, вступая в битву умов с детективом L.",
  "стальной алхимик: братство":"Братья Элрики нарушают запрет алхимии и платят страшную цену. Чтобы вернуть утраченное, они ищут философский камень и правду о стране.",
  "ванпанчмен":"Сайтама стал настолько сильным, что побеждает любого врага одним ударом. Теперь ему приходится искать смысл геройства в мире монстров и рейтингов.",
  "истребитель демонов":"Тандзиро становится истребителем демонов, чтобы спасти сестру Нэдзуко и отомстить за семью, уничтоженную демоном.",
  "моя геройская академия":"Изуку Мидория родился без причуды, но мечтает стать героем. Встреча с Всемогущим даёт ему шанс поступить в академию героев.",
  "твоё имя":"Парень из Токио и девушка из провинции начинают загадочно меняться телами. Их связь превращается в историю о времени, памяти и судьбе.",
  "форма голоса":"Бывший школьный хулиган пытается искупить вину перед глухой девочкой, которую когда-то обижал. История о боли, прощении и взрослении.",
  "код гиас: восставший лелуш":"Лелуш получает силу абсолютного приказа и начинает восстание против империи, скрываясь под маской Zero.",
  "магическая битва":"Юдзи Итадори проглатывает проклятый палец и оказывается связан с Сукуной. Теперь он учится сражаться с проклятиями в школе магии.",
  "токийский гуль":"Канэки становится полугулем после трагического случая и вынужден жить между человеческим миром и жестокой реальностью гулей.",
  "чёрный клевер":"Аста родился без магии, но мечтает стать Королём магов. Его упорство и антимагический меч становятся главным оружием.",
  "реинкарнация безработного":"Безработный мужчина перерождается в магическом мире и получает шанс прожить новую жизнь, используя знания прошлого и талант к магии.",
  "паразит":"Инопланетные паразиты захватывают тела людей. Старшеклассник Синъити выживает после частичного заражения и вынужден сосуществовать с паразитом Миги.",
  "триган":"Стрелок Вэш Ураган путешествует по пустынной планете, стараясь никого не убивать, хотя за ним тянется разрушительная репутация.",
  "хеллсинг ultimate":"Организация Хеллсинг защищает Британию от сверхъестественных угроз, используя своего главного оружия — вампира Алукарда."
}).forEach(([k,v]) => ANIME_RU_OVERVIEW.set(norm(k), v));

// V129: separate Russian descriptions for Naruto and Naruto Shippuden
Object.entries({
  "naruto":"Наруто Узумаки — шумный и упрямый ниндзя, внутри которого запечатан Девятихвостый лис. Он мечтает стать Хокаге, доказать всем свою силу и получить признание деревни, которая долго считала его изгоем.",
  "наруто":"Наруто Узумаки — шумный и упрямый ниндзя, внутри которого запечатан Девятихвостый лис. Он мечтает стать Хокаге, доказать всем свою силу и получить признание деревни, которая долго считала его изгоем.",
  "naruto shippuden":"Наруто возвращается в Коноху после долгих тренировок и сталкивается с куда более серьёзными угрозами: организацией Акацуки, судьбой Саске, тайнами хвостатых зверей и войной, которая решит будущее мира шиноби.",
  "naruto shippuuden":"Наруто возвращается в Коноху после долгих тренировок и сталкивается с куда более серьёзными угрозами: организацией Акацуки, судьбой Саске, тайнами хвостатых зверей и войной, которая решит будущее мира шиноби.",
  "наруто ураганные хроники":"Наруто возвращается в Коноху после долгих тренировок и сталкивается с куда более серьёзными угрозами: организацией Акацуки, судьбой Саске, тайнами хвостатых зверей и войной, которая решит будущее мира шиноби.",
  "наруто: ураганные хроники":"Наруто возвращается в Коноху после долгих тренировок и сталкивается с куда более серьёзными угрозами: организацией Акацуки, судьбой Саске, тайнами хвостатых зверей и войной, которая решит будущее мира шиноби."
}).forEach(([k,v]) => ANIME_RU_OVERVIEW.set(norm(k), v));

function hasAliasText(h, a) {
  h = norm(h);
  a = norm(a);
  if (!h || !a) return false;
  if (h === a) return true;
  if (a.length <= 4) return (" " + h + " ").includes(" " + a + " ");
  return h.includes(a) || a.includes(h);
}

function animeKey(item) {
  const raw = norm([item && item.ru, item && item.title_ru, item && item.__manualTopTitle, item && item.en, item && item.title, item && item.name, item && item.original_title, item && item.original_name].filter(Boolean).join(" "));

  // V129: broad alias "naruto" must not catch Naruto Shippuden.
  if (hasAliasText(raw, "naruto shippuden") || hasAliasText(raw, "naruto shippuuden") || hasAliasText(raw, "наруто ураганные хроники") || hasAliasText(raw, "наруто: ураганные хроники") || hasAliasText(raw, "ナルト 疾風伝")) {
    return norm("naruto shippuden");
  }
  if (hasAliasText(raw, "naruto") || hasAliasText(raw, "наруто") || hasAliasText(raw, "ナルト")) {
    return norm("naruto");
  }

  const keys = [...ANIME_RU_MAP.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (hasAliasText(raw, key)) return key;
  }
  return raw;
}

function displayTitle(item) {
  if (getType(item) === "Аниме") {
    const exact = specificAnimeTitle(item);
    if (exact) return exact;
    const key = animeKey(item);
    if (ANIME_RU_MAP.has(key)) {
      if (isBroadFranchiseOnlyKey(key) && hasExtraFranchiseTitleWords(item, key)) {
        return titleOf(item);
      }
      return ANIME_RU_MAP.get(key);
    }
  }
  const base = titleOf(item);
  return base;
}


// V139: compatibility alias for helper/older code paths.
function getRuTitle(item) {
  try { return displayTitle(item); } catch (e) { return titleOf(item); }
}

function displayOverview(item) {
  if (getType(item) === "Аниме") {
    const exactTitle = specificAnimeTitle(item);
    const candidates = [item && item.__manualTopTitle, item && item.ru, item && item.title_ru, exactTitle, displayTitle(item), animeKey(item)].filter(Boolean).map(norm);
    for (const k of candidates) {
      if (ANIME_RU_OVERVIEW.has(k)) return ANIME_RU_OVERVIEW.get(k);
    }
  }
  const text = item && (item.overview_ru || item.description_ru || item.overview || item.description);
  return text || "Описание пока не добавлено.";
}

function getYear(item) {
  const raw = String(item && (item.year || item.release_date || item.first_air_date) || "");
  const found = raw.match(/(19\d{2}|20\d{2})/);
  return found ? found[1] : raw;
}

function getType(item) {
  return String(item && (item.type || item.category) || "Фильм");
}

function getRating(item) {
  return Number(item && (item.rating || item.vote_average) || 0);
}

function getVotes(item) {
  return Number(item && (item.votes || item.vote_count || item.scored_by) || 0);
}

// V140: helper compatibility aliases. Older helper code calls ratingOf/votesOf.
function ratingOf(item) {
  return getRating(item);
}

function votesOf(item) {
  return getVotes(item);
}

window.GKM_V140_HELPER_VOTESOF_FIX_VERSION = "v140-helper-votesof-fix-2026-06-24";

function formatVotes(value) {
  const votes = Number(value || 0);
  if (!Number.isFinite(votes) || votes <= 0) return "0";
  if (votes >= 1000000) {
    const short = votes >= 10000000 ? Math.round(votes / 1000000) : (votes / 1000000).toFixed(1).replace(/\.0$/, "");
    return `${short} млн`;
  }
  if (votes >= 1000) return `${Math.round(votes / 1000)} тыс`;
  return String(votes);
}

function getGenres(item) {
  const genres = item && item.genres;
  if (Array.isArray(genres)) return genres.filter(Boolean).map(String);
  if (typeof genres === "string") return genres.split(/[,|/]+/).map(x => x.trim()).filter(Boolean);
  return [];
}

function hasPoster(item) {
  const raw = String(item && (item.poster || item.posterUrl || item.poster_url || item.image || item.cover || item.img) || "").trim();
  const low = raw.toLowerCase();
  return Boolean(raw && low !== "null" && low !== "undefined" && low !== "n/a" && !low.includes("dummyimage") && !low.includes("placeholder") && !low.includes("no-poster") && !low.includes("noposter"));
}

function posterRawSrc(item) {
  const raw = String(item && (item.poster || item.posterUrl || item.poster_url || item.image || item.cover || item.img) || "").trim();
  if (!hasPoster(item)) return "";
  return raw.replace(/^http:/i, "https:");
}

function posterProxySrc(src) {
  const raw = String(src || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, location.href);
    const host = url.hostname.toLowerCase();
    if (host.includes("images.weserv.nl")) return "";
    if (host === location.hostname) return "";
    const clean = url.href.replace(/^https?:\/\//i, "");
    return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=342&output=webp";
  } catch (_) {
    return "";
  }
}

function shouldProxyFirst(src) {
  // V150: для карточек не гоняем TMDB/постеры через images.weserv.nl первым ходом.
  // У тебя была ситуация: в карточке "Нет постера", а в модалке постер есть.
  // Причина — прокси/ленивая загрузка мог падать на карточке, хотя оригинальная ссылка живая.
  return false;
}

function posterSrc(item) {
  const raw = posterRawSrc(item);
  if (!raw) return "";
  return shouldProxyFirst(raw) ? (posterProxySrc(raw) || raw) : raw;
}

function posterOriginalSrc(item) {
  return posterRawSrc(item);
}

function posterPlaceholderHtml() {
  return `<div class="poster-placeholder">Нет постера</div>`;
}

function recoverPosterImage(img) {
  if (!img || img.dataset.posterDone === "1") return;
  const original = img.dataset.originalSrc || "";
  const proxy = posterProxySrc(original || img.currentSrc || img.src);
  if (img.dataset.proxyTried !== "1" && proxy && img.src !== proxy) {
    img.dataset.proxyTried = "1";
    img.src = proxy;
    return;
  }
  if (img.dataset.originalTried !== "1" && original && img.src !== original) {
    img.dataset.originalTried = "1";
    img.src = original;
    return;
  }
  img.dataset.posterDone = "1";
  const wrap = img.closest && img.closest(".poster-wrap");
  if (wrap && !wrap.querySelector(".poster-placeholder")) wrap.insertAdjacentHTML("beforeend", posterPlaceholderHtml());
  img.style.display = "none";
}

function schedulePosterRecovery(root = document) {
  const imgs = Array.from(root.querySelectorAll ? root.querySelectorAll(".poster-wrap img, .related-poster, #detailPoster") : []);
  for (const img of imgs) {
    if (img.dataset.posterWatch === "1") continue;
    img.dataset.posterWatch = "1";
    img.addEventListener("error", () => recoverPosterImage(img));
    img.addEventListener("load", () => {
      if (img.naturalWidth > 0) {
        img.dataset.posterDone = "1";
        img.style.display = "";
        const wrap = img.closest && img.closest(".poster-wrap");
        const ph = wrap && wrap.querySelector(".poster-placeholder");
        if (ph) ph.remove();
      }
    });
    setTimeout(() => {
      if (!img.dataset.posterDone && (!img.complete || img.naturalWidth === 0)) recoverPosterImage(img);
    }, 1800);
    setTimeout(() => {
      if (!img.dataset.posterDone && (!img.complete || img.naturalWidth === 0)) recoverPosterImage(img);
    }, 4200);
  }
}

function qualityScore(item) {
  return (hasPoster(item) ? 1e10 : 0) + getRating(item) * 1000000 + Math.min(getVotes(item), 250000) + Number(getYear(item) || 0);
}

function rankLabel(item) {
  const rating = getRating(item);
  if (rating >= 9) return "S-класс";
  if (rating >= 8) return "A-класс";
  if (rating >= 7) return "B-класс";
  if (rating >= 6) return "C-класс";
  return "D-класс";
}

function typeClass(item) {
  const type = getType(item);
  if (type === "Аниме") return "anime";
  if (type === "Мультфильм") return "cartoon";
  if (type === "Сериал") return "series";
  return "movie";
}

function cardHtml(item) {
  const title = displayTitle(item);
  const rating = getRating(item);
  const votes = getVotes(item);
  const fav = loadSet(favKey);
  const id = String(item.id || `${title}|${getYear(item)}`);
  const img = posterSrc(item);
  const poster = img
    ? `<img src="${escapeAttr(img)}" data-original-src="${escapeAttr(posterOriginalSrc(item))}" data-proxy-tried="${shouldProxyFirst(posterOriginalSrc(item)) ? "1" : "0"}" loading="lazy" decoding="async" alt="">`
    : `<div class="poster-placeholder">Нет постера</div>`;

  return `
    <article class="card" data-id="${escapeAttr(id)}">
      <div class="poster-wrap">
        <div class="card-badges">
          <span class="card-badge badge-${typeClass(item)}">${escapeHtml(getType(item))}</span>
        </div>
        <button class="card-fav-btn ${fav.has(id) ? "active" : ""}" data-fav-id="${escapeAttr(id)}" type="button">${fav.has(id) ? "♥" : "♡"}</button>
        ${item.__rank ? `<div class="anime-rank-badge">#${escapeHtml(item.__rank)}</div>` : ""}
        ${poster}
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(title)}</h3>
        <div class="card-meta">${escapeHtml(getYear(item) || "—")} · ${escapeHtml(getType(item))}</div>
        <div class="card-genres">${escapeHtml(getGenres(item).slice(0, 2).join(" · ") || "Жанры не указаны")}</div>
        <div class="card-rating">★ ${rating ? rating.toFixed(1) : "—"} · ${formatVotes(votes)}</div>
      </div>
    </article>
  `;
}


const GKM_CLEAN_TRASH_STORAGE_KEY = "gkm_clean_trash_v157";

function isCleanTrashEnabled() {
  try {
    const saved = localStorage.getItem(GKM_CLEAN_TRASH_STORAGE_KEY);
    if (saved === null) return true;
    return saved !== "0";
  } catch {
    return true;
  }
}

function setCleanTrashEnabled(value) {
  try {
    localStorage.setItem(GKM_CLEAN_TRASH_STORAGE_KEY, value ? "1" : "0");
  } catch {}
  updateCleanTrashButton();
}

function updateCleanTrashButton() {
  const btn = $("cleanTrashBtn");
  if (!btn) return;
  const enabled = isCleanTrashEnabled();
  btn.classList.toggle("active", enabled);
  btn.textContent = enabled ? "🧹 Чисто" : "🧹 Всё";
  btn.title = enabled
    ? "Сейчас скрываются ноунеймы с малым числом голосов, пустые карточки и подозрительные 9.5/10.0"
    : "Сейчас показывается всё, включая мусорные карточки";
}

function renderList(items, label) {
  const safeItems = (Array.isArray(items) ? items : []).slice(0, PAGE_SIZE);
  currentItems = safeItems;
  const grid = $("grid");
  const count = $("countText");
  const page = $("pageText");
  const prev = $("prevBtn");
  const next = $("nextBtn");
  if (count) count.textContent = label || "";
  if (grid) { grid.innerHTML = safeItems.map(cardHtml).join(""); schedulePosterRecovery(grid); }
  if (page) page.textContent = `${currentPage} / ${currentPages}`;
  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= currentPages;
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab[data-tab]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

function controls() {
  return {
    q: $("searchInput") ? $("searchInput").value : "",
    type: $("typeFilter") ? $("typeFilter").value : "",
    genre: $("genreFilter") ? $("genreFilter").value : "",
    year: $("yearFilter") ? $("yearFilter").value : "",
    minRating: Number($("ratingFilter") ? $("ratingFilter").value || 0 : 0),
    sort: $("sortFilter") ? $("sortFilter").value || "smart" : "smart",
    cleanTrash: isCleanTrashEnabled(),
    tab: currentTab
  };
}

function hasActiveControls(c = controls()) {
  return Boolean(norm(c.q) || c.type || c.genre || c.year || c.minRating || (c.sort && c.sort !== "smart"));
}

function tabToPage(tab) {
  if (["movies", "series", "anime", "cartoons", "top", "new", "popular"].includes(tab)) return tab;
  return "all";
}

async function initMeta() {
  metaData = await fetchJson(META_URL);
  const year = $("yearFilter");
  const genre = $("genreFilter");
  if (year && Array.isArray(metaData.years)) {
    const cur = year.value;
    year.innerHTML = `<option value="">Все годы</option>` + metaData.years.map(y => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join("");
    year.value = cur;
  }
  if (genre && Array.isArray(metaData.genres)) {
    const cur = genre.value;
    genre.innerHTML = `<option value="">Все жанры</option>` + metaData.genres.map(g => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("");
    genre.value = cur;
  }
}

async function renderHome() {
  currentMode = "home";
  currentTab = "all";
  currentPage = 1;
  currentPages = 1;
  setActiveTab("all");
  setStatus("Загружаю главную...");
  homeData = homeData || await fetchJson(HOME_URL);
  const sections = homeData.sections || {};
  const homePool = [];
  const order = [
    ["popular", "Популярное"],
    ["top", "Топ"],
    ["new", "Новинки"],
    ["movies", "Фильмы"],
    ["series", "Сериалы"],
    ["anime", "Аниме"],
    ["cartoons", "Мультфильмы"]
  ];
  const grid = $("grid");
  const count = $("countText");
  const page = $("pageText");
  const prev = $("prevBtn");
  const next = $("nextBtn");
  if (count) count.textContent = `Главная · всего ${homeData.total || 0}`;
  if (page) page.textContent = "1 / 1";
  if (prev) prev.disabled = true;
  if (next) next.disabled = true;
  if (grid) {
    grid.innerHTML = order.map(([key, title]) => {
      const list = (sections[key] || []).filter(hasPoster).slice(0, 18);
      homePool.push(...list);
      return `
        <section class="home-section">
          <div class="home-section-head">
            <h3>${escapeHtml(title)}</h3>
            <button class="home-more-btn" data-open-tab="${escapeAttr(key)}" type="button">Открыть</button>
          </div>
          <div class="home-row">${list.map(cardHtml).join("")}</div>
        </section>
      `;
    }).join("");
  }
  const seen = new Set();
  currentItems = homePool.filter(item => {
    const key = String(item && (item.id || `${titleOf(item)}|${getYear(item)}`));
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  setStatus(`Готово · ${homeData.total || 0} записей`);
}

async function loadFastPage(tab, page = 1) {
  currentMode = "page";
  currentTab = tabToPage(tab);
  currentPage = Math.max(1, Number(page || 1));
  setActiveTab(tab);
  setStatus("Открываю раздел...");
  const url = `${FAST_BASE}/pages/${currentTab}/page_${String(currentPage).padStart(4, "0")}.json`;
  const data = await fetchJson(url);
  currentPage = data.page || currentPage;
  currentPages = data.pages || 1;
  currentCount = data.count || 0;
  const label = `Раздел: ${currentCount} · Страница ${currentPage} из ${currentPages}`;
  renderList(data.items || [], label);
  setStatus(label);
}

function makeSearchWorker() {
  if (searchWorker) return searchWorker;
  const absoluteSearchLiteUrl = new URL(`${SEARCH_LITE_URL}?v=131`, window.location.href).href;
  const absoluteSearchFullUrl = new URL(`${SEARCH_URL}?v=131`, window.location.href).href;
  const absoluteShardBase = new URL(`${SEARCH_SHARDS_BASE}/`, window.location.href).href;
  const code = `
    const SEARCH_LITE_URL = ${JSON.stringify(absoluteSearchLiteUrl)};
    const SEARCH_FULL_URL = ${JSON.stringify(absoluteSearchFullUrl)};
    const SHARD_BASE = ${JSON.stringify(absoluteShardBase)};
    const PAGE_SIZE = ${PAGE_SIZE};
    let indexPromise = null;
    const shardPromises = new Map();
    let rows = [];
    let animeTopCache = null;
    function norm(v){return String(v||"").toLowerCase().replaceAll("ё","е").replace(/&/g," and ").replace(/['’\\\`]/g,"").replace(/[^\\p{L}\\p{N}:]+/gu," ").replace(/\\s+/g," ").trim();}
    function hasAliasText(h,a){h=norm(h);a=norm(a);if(!h||!a)return false;if(h===a)return true;if(a.length<=4)return (" "+h+" ").includes(" "+a+" ");return h.includes(a)||a.includes(h);}
    function squeeze(v){return norm(v).replace(/(.)\\1+/g,"$1");}
    function keyfix(s){const m={"q":"й","w":"ц","e":"у","r":"к","t":"е","y":"н","u":"г","i":"ш","o":"щ","p":"з","[":"х","]":"ъ","a":"ф","s":"ы","d":"в","f":"а","g":"п","h":"р","j":"о","k":"л","l":"д",";":"ж","'":"э","z":"я","x":"ч","c":"с","v":"м","b":"и","n":"т","m":"ь",",":"б",".":"ю"};return String(s||"").split("").map(ch=>m[ch.toLowerCase()]||ch).join("");}
    function title(x){return String((x&&(x.ru||x.en||x.title||x.name))||"");}
    function year(x){return String((x&&x.year)||"");}
    function type(x){return String((x&&x.type)||"");}
    function rating(x){return Number((x&&x.rating)||0);}
    function votes(x){return Number((x&&x.votes)||0);}
    function genres(x){return Array.isArray(x&&x.genres)?x.genres.map(String):[];}
    function poster(x){const raw=String((x&&x.poster)||"").trim();const low=raw.toLowerCase();return raw&&low!=="null"&&low!=="undefined"&&!low.includes("dummyimage")&&!low.includes("placeholder")&&!low.includes("no-poster")?1:0;}
    function isAnimeTopCandidate(x){const t=type(x);if(t!=="Аниме")return false;const v=votes(x);const r=rating(x);const y=Number(year(x)||0);if(v<100000||r<7.4)return false;if(y&&y>2024)return false;const h=hay(x);const banned=[" fan letter","fanletter"," ova"," ova ","special"," recap","summary","pilot","preview","trailer","teaser","music video","soundtrack","concert","stage play","live action","спешл","ова","рекап","краткое содержание","фан письмо","превью","трейлер","мюзикл"];return !banned.some(b=>h.includes(b));}
    function tabPass(x,tab){
      const t=type(x);
      const y=Number(year(x)||0);
      const v=votes(x);
      const cy=new Date().getFullYear();
      if(!tab||tab==="all")return true;
      if(tab==="movies")return t==="Фильм";
      if(tab==="series")return t==="Сериал";
      if(tab==="anime")return t==="Аниме";
      if(tab==="cartoons")return t==="Мультфильм";
      if(tab==="top")return rating(x)>=7&&v>=300;
      if(tab==="anime_top")return t==="Аниме";
      // V158: нормальные новинки по текущему году.
      // Новинки = только текущий год и будущие проекты, а не 2024/2025.
      if(tab==="new")return y>=cy;
      // Скоро выйдет = будущий год или текущий год с ещё малым числом голосов.
      if(tab==="new_soon")return y>cy || (y===cy && v<500);
      // Уже вышло = текущий год и уже есть нормальный след зрителей.
      if(tab==="new_released")return y===cy && v>=500;
      // Популярное текущего года.
      if(tab==="new_popular")return y===cy && v>=1000;
      // V161: отдельные топы по текущему году и эпохам.
      // Они идут через общую умную сортировку: голоса главный вес, рейтинг второй.
      if(tab==="top_current_year")return y===cy;
      if(tab==="top_2020s")return y>=2020 && y<=2029;
      if(tab==="top_2010s")return y>=2010 && y<=2019;
      if(tab==="top_2000s")return y>=2000 && y<=2009;
      if(tab==="top_1990s")return y>=1990 && y<=1999;
      if(tab==="popular")return v>=1000;
      return true;
    }
    function pass(x,c){if(!tabPass(x,c.tab))return false;const t=type(x);if(c.type&&t!==c.type)return false;if(c.genre&&!genres(x).includes(c.genre))return false;if(c.year&&year(x)!==String(c.year))return false;if(c.minRating&&rating(x)<Number(c.minRating))return false;return true;}
    function queryList(raw){const base=norm(raw);const out=new Set(base?[base]:[]);const squ=squeeze(base);if(squ&&squ!==base)out.add(squ);const fixed=norm(keyfix(base));if(fixed&&fixed!==base)out.add(fixed);const fixedSqu=squeeze(fixed);if(fixedSqu&&fixedSqu!==fixed)out.add(fixedSqu);const syn={"матрица":["matrix","the matrix"],"шазам":["shazam"],"наруто":["naruto"],"ван пис":["one piece","ванпис"],"ванпис":["one piece","ван пис"],"дэдпул":["deadpool","дедпул"],"дедпул":["deadpool","дэдпул"],"интерстеллар":["interstellar"]};[...out].forEach(value=>{Object.entries(syn).forEach(([k,a])=>{if(value===k||value.includes(k))a.forEach(x=>out.add(norm(x)));});});return [...out].filter(Boolean);}
    function hay(x){return x.__hay||(x.__hay=norm([x.search,title(x),x.ru,x.en,(x.genres||[]).join(" ")].join(" ")));}
    function score(x,queries){if(!queries.length)return 1;const h=hay(x);const wh=" "+h+" ";let best=0;for(const q of queries){if(h===q)best=Math.max(best,10000000);else if(h.startsWith(q+" "))best=Math.max(best,9000000);else if(wh.includes(" "+q+" "))best=Math.max(best,8000000);else if(h.includes(q))best=Math.max(best,7000000);else{const parts=q.split(" ").filter(p=>p.length>1);if(parts.length&&parts.every(p=>h.includes(p)))best=Math.max(best,6000000+parts.length*1000);}}return best?best+poster(x)*5000+Math.min(votes(x),1000000)/10+rating(x)*100:0;}
    function franchiseKey(x){
      let s=norm([title(x),x&&x.ru,x&&x.en].join(" "));
      const pairs=[
        ["attack on titan",["attack on titan","shingeki no kyojin","атака титанов"]],
        ["naruto",["naruto","наруто"]],
        ["fullmetal alchemist",["fullmetal alchemist","сталной алхимик","стальной алхимик"]],
        ["my hero academia",["my hero academia","boku no hero academia","моя геройская академия"]],
        ["demon slayer",["demon slayer","kimetsu no yaiba","истребитель демонов"]],
        ["jujutsu kaisen",["jujutsu kaisen","магическая битва"]],
        ["bleach",["bleach","блич"]],
        ["one piece",["one piece","ван пис","ванпис"]],
        ["hunter x hunter",["hunter x hunter","охотник"]],
        ["code geass",["code geass","код гиас"]],
        ["steins gate",["steins gate","steins:gate","врата штейна"]],
        ["86",["86 eighty six","86 eighty-six"]],
        ["gintama",["gintama","гинтама"]],
        ["dragon ball",["dragon ball","драконий жемчуг"]],
        ["sword art online",["sword art online","мастера меча онлайн"]],
        ["tokyo ghoul",["tokyo ghoul","токийский гуль"]],
        ["one punch man",["one punch man","one-punch man","ванпанчмен"]]
      ];
      for(const [key,arr] of pairs){ if(arr.some(v=>s.includes(norm(v)))) return key; }
      s=s.replace(/\b(season|part|cour|movie|final|ova|special|recap|arc|chapter)\b/g," ");
      s=s.replace(/\b(сезон|часть|фильм|финал|арка|глава|спешл|ова)\b/g," ");
      s=s.replace(/[0-9]+/g," ").replace(/[:\-–—].*$/," ").replace(/\s+/g," ").trim();
      return s.split(" ").slice(0,3).join(" ")||s;
    }
    function animeTopScore(x){const v=votes(x);const r=rating(x);const y=Number(year(x)||0);return v*1000 + r*10000 + Math.max(0,2100-y);}
    function isAnimeTopBad(x){const h=hay(x);const banned=[" fan letter","fanletter"," ova"," ova ","special"," recap","summary","pilot","preview","trailer","teaser","music video","soundtrack","concert","stage play","live action","спешл","ова","рекап","краткое содержание","фан письмо","превью","трейлер","мюзикл"];return banned.some(b=>h.includes(b));}
    function applyAnimeTopDedupe(){
      const manual=[
        {ru:"Атака титанов", aliases:["attack on titan","shingeki no kyojin","атака титанов"]},
        {ru:"Стальной алхимик: Братство", aliases:["fullmetal alchemist brotherhood","hagane no renkinjutsushi","стальной алхимик братство"]},
        {ru:"Блич: Тысячелетняя кровавая война", aliases:["bleach thousand-year blood war","bleach sennen kessen hen","тысячелетняя кровавая война"]},
        {ru:"Легенда о героях Галактики", aliases:["legend of the galactic heroes","ginga eiyu densetsu","легенда о героях галактики"]},
        {ru:"Ван-Пис", aliases:["one piece","ван пис","ван-пис"]},
        {ru:"Охотник х Охотник", aliases:["hunter x hunter","hunter hunter","охотник х охотник"]},
        {ru:"Провожающая в последний путь Фрирен", aliases:["frieren beyond journey s end","sousou no frieren","frieren","фрирен"]},
        {ru:"Сага о Винланде", aliases:["vinland saga","сага о винланде"]},
        {ru:"Ковбой Бибоп", aliases:["cowboy bebop","kauboi bibappu","ковбой бибоп"]},
        {ru:"Мастер Муси 2", aliases:["mushishi zoku-sho","mushishi zoku sho","мастер муси 2"]},
        {ru:"Королевство", aliases:["kingdom","королевство"]},
        {ru:"Серебряный клык", aliases:["ginga nagareboshi gin","silver fang","серебряный клык"]},
        {ru:"Драконий жемчуг Зет", aliases:["dragon ball z","doragon boru zetto","драконий жемчуг зет"]},
        {ru:"Конан — мальчик из будущего", aliases:["future boy conan","mirai shonen conan","конан мальчик из будущего"]},
        {ru:"Ателье колдовских колпаков", aliases:["witch hat atelier","tongari boushi no atelier","とんがり帽子のアトリエ","ателье колдовских колпаков"]},
        {ru:"Гинтама", aliases:["gintama","гинтама"]},
        {ru:"Первородный грех Такопи", aliases:["takopi original sin","takopii no genzai","первородный грех такопи"]},
        {ru:"Наруто: Ураганные хроники", aliases:["naruto shippuden","наруто ураганные хроники","ナルト 疾風伝"]},
        {ru:"Код Гиас: Восставший Лелуш", aliases:["code geass lelouch of the rebellion","code geass","код гиас"]},
        {ru:"Голубые небеса Ромео", aliases:["romeo blue skies","romio no aoi sora","голубые небеса ромео"]},
        {ru:"Монстр", aliases:["monster","монстр"]},
        {ru:"Берсерк", aliases:["berserk","kenpu denki beruseruku","берсерк"]},
        {ru:"Истребитель демонов", aliases:["demon slayer","kimetsu no yaiba","истребитель демонов"]},
        {ru:"Монолог фармацевта", aliases:["the apothecary diaries","kusuriya no hitorigoto","монолог фармацевта"]},
        {ru:"Звёзды Айкацу!", aliases:["aikatsu stars","アイカツスターズ","звезды айкацу","звёзды айкацу"]},
        {ru:"Невероятные приключения ДжоДжо", aliases:["jojo s bizarre adventure","jojo no kimyo na boken","jojo","джоджо"]},
        {ru:"Ванпанчмен", aliases:["one punch man","one-punch man","ванпанчмен"]},
        {ru:"Твоя апрельская ложь", aliases:["your lie in april","shigatsu wa kimi no uso","твоя апрельская ложь"]},
        {ru:"Охотник х Охотник", aliases:["hunter x hunter 1999","hunter x hunter","охотник х охотник"]},
        {ru:"Кланнад: Продолжение истории", aliases:["clannad after story","кланнад продолжение истории"]},
        {ru:"Госпожа Кагуя: В любви как на войне", aliases:["kaguya sama love is war","kaguya-sama","госпожа кагуя"]},
        {ru:"Инициал Ди", aliases:["initial d","инициал d","инициал ди","頭文字 d"]},
        {ru:"Бродяга Кэнсин", aliases:["rurouni kenshin","samurai x","бродяга кэнсин"]},
        {ru:"Моб Психо 100", aliases:["mob psycho 100","моб психо 100"]},
        {ru:"Евангелион", aliases:["neon genesis evangelion","shin seiki evangelion","evangelion","евангелион"]},
        {ru:"Крутой учитель Онидзука", aliases:["great teacher onizuka","gto","крутой учитель онидзука"]},
        {ru:"Отчёт о буйстве духов", aliases:["yu yu hakusho","yuu yuu hakusho","отчет о буйстве духов","отчёт о буйстве духов"]},
        {ru:"Драконий жемчуг", aliases:["dragon ball","doragon boru","драконий жемчуг"]},
        {ru:"Нана", aliases:["nana","нана"]},
        {ru:"Мастер Муси", aliases:["mushishi","мастер муси"]},
        {ru:"Детектив Конан", aliases:["detective conan","meitantei conan","детектив конан"]},
        {ru:"Призрак в доспехах: Синдром одиночки", aliases:["ghost in the shell stand alone complex","призрак в доспехах синдром одиночки"]},
        {ru:"Самурай Чамплу", aliases:["samurai champloo","samurai chanpuru","самурай чамплу"]},
        {ru:"О движении Земли", aliases:["chi chikyuu no undou ni tsuite","chi chikyû no undô ni tsuite","orb on the movements of the earth","о движении земли"]},
        {ru:"Рейтинг короля", aliases:["ranking of kings","ousama ranking","рейтинг короля"]},
        {ru:"Врата Штейна 0", aliases:["steins gate 0","steins;gate 0","врата штейна 0"]},
        {ru:"Дораэмон", aliases:["doraemon","дораэмон"]},
        {ru:"Сказ о четырёх с половиной татами", aliases:["tatami galaxy","yojouhan shinwa taikei","сказ о четырех с половиной татами","сказ о четырёх с половиной татами"]},
        {ru:"Вайолет Эвергарден", aliases:["violet evergarden","вайолет эвергарден"]},
        {ru:"Город, в котором меня нет", aliases:["erased","boku dake ga inai machi","город в котором меня нет"]},
        {ru:"Наруто", aliases:["naruto","наруто"]},
        {ru:"Инуяся: Последняя глава", aliases:["inuyasha kanketsu hen","inuyasha the final act","инуяся последняя глава"]},
        {ru:"Красавица-воин Сейлор Мун: Сейлор-звёзды", aliases:["sailor moon sailor stars","bishojo senshi sera mun sera stasu","sailor stars","сейлор звезды","сейлор звёзды"]},
        {ru:"Дандадан", aliases:["dandadan","дандадан"]},
        {ru:"Одинокий рокер", aliases:["bocchi the rock","одинокий рокер"]},
        {ru:"Человек-бензопила", aliases:["chainsaw man","человек бензопила"]},
        {ru:"Необычное такси", aliases:["odd taxi","необычное такси"]},
        {ru:"Гинтама: Полуфинал", aliases:["gintama the semi final","gintama semi-final","гинтама полуфинал"]},
        {ru:"Для тебя, Бессмертный", aliases:["to your eternity","fumetsu no anata e","для тебя бессмертный"]},
        {ru:"Ох, уж этот экстрасенс Сайки Кусуо!", aliases:["saiki kusuo","saiki k","экстрасенс сайки"]},
        {ru:"Драконий жемчуг Супер", aliases:["dragon ball super","драконий жемчуг супер"]},
        {ru:"Одиннадцать молний", aliases:["inazuma eleven","одиннадцать молний"]},
        {ru:"Космические приключения Кобры", aliases:["space cobra","cobra the animation","космические приключения кобры"]},
        {ru:"Путешествие Кино", aliases:["kino no tabi","kino's journey","путешествие кино"]},
        {ru:"Роза Версаля", aliases:["rose of versailles","berusaiyu no bara","роза версаля"]},
        {ru:"Гуррен Лаганн", aliases:["gurren lagann","tengen toppa gurren lagann","гуррен лаганн"]},
        {ru:"Баракамон", aliases:["barakamon","баракамон"]},
        {ru:"Май Мелоди и Куроми", aliases:["my melody kuromi","my melody and kuromi","май мелоди куроми"]},
        {ru:"Кайдзю № 8", aliases:["kaiju no 8","kaiju no. 8","кайдзю 8"]},
        {ru:"Ребёнок айдола", aliases:["oshi no ko","ребенок айдола","ребёнок айдола"]},
        {ru:"Летнее время", aliases:["summer time rendering","летнее время"]},
        {ru:"Юри на льду", aliases:["yuri on ice","юри на льду"]},
        {ru:"Семья шпиона", aliases:["spy x family","семья шпиона"]},
        {ru:"Дороро", aliases:["dororo","дороро"]},
        {ru:"Мартовский лев", aliases:["march comes in like a lion","3-gatsu no lion","мартовский лев"]},
        {ru:"Судьба: Начало", aliases:["fate zero","fate/zero","судьба начало"]},
        {ru:"Баскетбол Куроко", aliases:["kuroko no basket","баскетбол куроко"]},
        {ru:"Выжить на необитаемой планете", aliases:["mujin wakusei survive","uninhabited planet survive","выжить на необитаемой планете"]},
        {ru:"Реинкарнация безработного", aliases:["mushoku tensei","jobless reincarnation","реинкарнация безработного"]},
        {ru:"Чёрный клевер", aliases:["black clover","черный клевер","чёрный клевер"]},
        {ru:"Дарованный", aliases:["given","дарованный"]},
        {ru:"Моя геройская академия", aliases:["my hero academia","boku no hero academia","моя геройская академия"]},
        {ru:"Re:Zero — жизнь с нуля в другом мире", aliases:["re zero","re:zero","starting life in another world"]},
        {ru:"Паразит", aliases:["parasyte","kiseijuu","паразит"]},
        {ru:"Невероятные приключения ДжоДжо 2", aliases:["jojo stardust crusaders","stardust crusaders","невероятные приключения джоджо 2"]},
        {ru:"Добро пожаловать в N.H.K.", aliases:["welcome to the nhk","n h k ni yokoso","добро пожаловать в n h k"]},
        {ru:"Брошенный кролик", aliases:["usagi drop","usagi droppu","брошенный кролик"]},
        {ru:"Триган", aliases:["trigun","триган"]},
        {ru:"Хранитель священного духа", aliases:["seirei no moribito","moribito guardian of the spirit","хранитель священного духа"]},
        {ru:"Школьный переполох", aliases:["school rumble","школьный переполох"]},
        {ru:"Девочка-волшебница Мадока Магика", aliases:["madoka magica","mahou shoujo madoka magica","девочка волшебница мадока магика"]},
        {ru:"Бездомная девочка Реми", aliases:["ie naki ko remi","remi nobody's girl","бездомная девочка реми"]},
        {ru:"Хикару и Го", aliases:["hikaru no go","хикару и го"]},

        {ru:"Тетрадь смерти", aliases:["death note","тетрадь смерти"]},
        {ru:"Врата Штейна", aliases:["steins gate","steins;gate","врата штейна"]},
        {ru:"Семь смертных грехов", aliases:["seven deadly sins","nanatsu no taizai","семь смертных грехов"]},
        {ru:"Магическая битва", aliases:["jujutsu kaisen","магическая битва"]},
        {ru:"Твоё имя", aliases:["your name","kimi no na wa","твое имя","твоё имя"]},
        {ru:"Форма голоса", aliases:["a silent voice","koe no katachi","форма голоса"]},
        {ru:"Хеллсинг Ultimate", aliases:["hellsing ultimate","хеллсинг ultimate"]}
      ];
      const pool=rows.slice().filter(r=>type(r.item)==="Аниме"&&poster(r.item)&&!isAnimeTopBad(r.item));
      const used=new Set();
      const out=[];
      function rowText(row){return norm([title(row.item),row.item&&row.item.ru,row.item&&row.item.en,row.item&&row.item.original_title,row.item&&row.item.original_name,row.item&&row.item.search].filter(Boolean).join(" "));}
      function rowId(row){return String((row.item&&row.item.id)||title(row.item)+"|"+year(row.item));}
      for(const spec of manual){
        const aliases=spec.aliases.map(norm);
        const candidates=pool.filter(row=>!used.has(rowId(row))&&aliases.some(a=>hasAliasText(rowText(row), a)));
        if(!candidates.length) continue;
        candidates.sort((a,b)=>poster(b.item)-poster(a.item)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0));
        const best=candidates[0];
        best.item=Object.assign({},best.item,{ru:spec.ru,title_ru:spec.ru,__manualTopTitle:spec.ru});
        used.add(rowId(best));
        out.push(best);
        if(out.length>=100) break;
      }
      rows=out;
      self.__animeTopThreshold="manual-user-list-sorted-by-votes";
      out.sort((a,b)=>votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0));
    }
    function lowTrust(item,tab){
      const v=votes(item); const r=rating(item); const t=type(item);
      // V155: пороги под реальные данные базы. У фильмов/сериалов голоса TMDB обычно 0-40k,
      // поэтому 50k убивало весь раздел. Аниме из MAL оставляем с более высоким порогом.
      if(t==="Аниме"){
        if(v<10000)return true;
        if(r>=9.0&&v<100000)return true;
      }else if(t==="Сериал"){
        if(v<300)return true;
        if(r>=9.0&&v<1000)return true;
      }else if(t==="Фильм"||t==="Мультфильм"){
        if(v<500)return true;
        if(r>=9.0&&v<5000)return true;
      }else{
        if(v<500)return true;
      }
      if(!poster(item)&&v<1000)return true;
      return false;
    }
    function votes9000000Score(item){
      const v=votes(item); const r=rating(item); const y=Number(year(item)||0); const t=type(item);
      // V155: основа — голоса, рейтинг только как второй вес.
      // Для аниме голосов миллионы, для фильмов/сериалов TMDB голоса десятки тысяч,
      // поэтому используем разные "верхние планки", но логика одна: больше голосов = выше.
      let cap=9000000;
      if(t==="Фильм")cap=40000;
      else if(t==="Сериал")cap=27000;
      else if(t==="Мультфильм")cap=24000;
      else if(t==="Аниме")cap=9000000;
      let score=Math.min(v,cap)/cap*100000 + r*100;
      if(t==="Сериал"){
        if(v<300)score-=100000;
        else if(v<1000)score-=5000;
      }else if(t==="Фильм"||t==="Мультфильм"){
        if(v<500)score-=100000;
        else if(v<1500)score-=3500;
      }else if(t==="Аниме"){
        if(v<10000)score-=100000;
        else if(v<100000)score-=5000;
      }
      if(!poster(item))score-=2000;
      const cy=new Date().getFullYear();
      if(y>=cy&&v<1000)score-=1000;
      return score;
    }
    function sortRows(sort, hasQuery, tab, cleanTrash){
      const pr=(a,b)=>poster(b.item)-poster(a.item);
      const canClean = cleanTrash !== false && !["new","new_soon","new_released","new_popular","anime_top"].includes(tab);
      if(canClean){
        rows = rows.filter(x=>!lowTrust(x.item,tab));
      }
      if(tab==="anime_top"){
        rows.sort((a,b)=>pr(a,b)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0));
        applyAnimeTopDedupe();
      }else if(tab==="new"||tab==="new_soon"||tab==="new_released"){
        rows.sort((a,b)=>Number(year(b.item)||0)-Number(year(a.item)||0)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||pr(a,b));
      }else if(tab==="new_popular"){
        rows.sort((a,b)=>votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0)||pr(a,b));
      }else if(sort==="rating"){
        rows.sort((a,b)=>rating(b.item)-rating(a.item)||votes(b.item)-votes(a.item)||pr(a,b));
      }else if(sort==="votes"){
        rows.sort((a,b)=>votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||pr(a,b));
      }else if(sort==="year"){
        rows.sort((a,b)=>Number(year(b.item)||0)-Number(year(a.item)||0)||votes(b.item)-votes(a.item)||pr(a,b));
      }else if(sort==="year_old"){
        rows.sort((a,b)=>Number(year(a.item)||9999)-Number(year(b.item)||9999)||votes(b.item)-votes(a.item)||pr(a,b));
      }else if(sort==="title"){
        rows.sort((a,b)=>title(a.item).localeCompare(title(b.item),"ru")||pr(a,b));
      }else if(hasQuery){
        rows.sort((a,b)=>b.score-a.score||pr(a,b)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item));
      }else{
        rows.sort((a,b)=>(votes9000000Score(b.item)-votes9000000Score(a.item))||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||pr(a,b)||Number(year(b.item)||0)-Number(year(a.item)||0));
      }
    }
    async function loadIndex(){if(!indexPromise)indexPromise=fetch(SEARCH_LITE_URL,{cache:"force-cache"}).then(r=>{if(r.ok)return r.json();return fetch(SEARCH_FULL_URL,{cache:"force-cache"}).then(full=>{if(!full.ok)throw new Error("search_lite "+r.status+" / search_index "+full.status);return full.json();});});return indexPromise;}
    function shardKey(q){const c=String(q||"").trim()[0]||"";return /^[0-9a-zа-я]$/i.test(c)?c.toLowerCase():"";}
    async function loadShard(key){if(!key)return [];if(!shardPromises.has(key)){const url=SHARD_BASE+encodeURIComponent(key)+".json?v=131";shardPromises.set(key,fetch(url,{cache:"force-cache"}).then(r=>{if(r.status===404)return [];if(!r.ok)return [];return r.json();}).catch(()=>[]));}return shardPromises.get(key);}
    async function candidateIndex(queries){if(!queries.length)return loadIndex();const keys=[...new Set(queries.map(shardKey).filter(Boolean))];if(!keys.length)return loadIndex();const lists=await Promise.all(keys.map(loadShard));const seen=new Set();const out=[];for(const list of lists){for(const item of list||[]){const id=String((item&&item.id)||title(item)+"|"+year(item));if(seen.has(id))continue;seen.add(id);out.push(item);}}return out;}
    function buildRows(index, c, queries){const out=[];for(const item of index){if(!pass(item,c))continue;const s=score(item,queries);if(!queries.length||s>0)out.push({item,score:s});}return out;}
    function pageItems(page, tab){const p=Math.max(1,Number(page||1));const start=(p-1)*PAGE_SIZE;return rows.slice(start,p*PAGE_SIZE).map((x,i)=>{const item=Object.assign({},x.item); if(tab==="anime_top") item.__rank=start+i+1; return item;});}
    self.onmessage=async e=>{const msg=e.data||{};try{if(msg.mode==="page"){self.postMessage({id:msg.id,ok:true,page:msg.page,count:rows.length,items:pageItems(msg.page,msg.controls&&msg.controls.tab),ms:0,cached:true});return;}const started=Date.now();self.postMessage({id:msg.id,loading:true});const c=msg.controls||{};const queries=queryList(c.q);let index=[];let fallback=false;let cached=false;if(c.tab==="anime_top"&&!queries.length&&animeTopCache){rows=animeTopCache.slice();cached=true;}else{index=await candidateIndex(queries);rows=buildRows(index,c,queries);if(queries.length&&rows.length===0){index=await loadIndex();rows=buildRows(index,c,queries);fallback=true;}sortRows(c.sort||"smart",Boolean(queries.length),c.tab,c.cleanTrash);if(c.tab==="anime_top"){rows=rows.slice(0,100);animeTopCache=rows.slice();}}self.postMessage({id:msg.id,ok:true,page:1,count:rows.length,items:pageItems(1,c.tab),ms:Date.now()-started,indexTotal:index.length||rows.length,indexPosters:index.length?index.reduce((n,x)=>n+poster(x),0):rows.reduce((n,x)=>n+poster(x.item||x),0),sharded:Boolean(queries.length),fallback,cached});}catch(err){self.postMessage({id:msg.id,ok:false,error:String(err&&err.message||err)});}};
  `;
  searchWorker = new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
  searchWorker.onmessage = event => {
    const msg = event.data || {};
    if (msg.id !== searchReq) return;
    if (msg.loading) {
      setStatus("Ищу в быстрой базе...");
      return;
    }
    if (!msg.ok) {
      setStatus(`Ошибка фильтра: ${msg.error || "неизвестно"}`);
      return;
    }
    currentMode = "search";
    currentPage = Number(msg.page || 1);
    currentCount = Number(msg.count || 0);
    currentPages = Math.max(1, Math.ceil(currentCount / PAGE_SIZE));
    window.GKM_V106_LAST_SEARCH_STATS = msg;
    const tabLabels = {
      anime_top: `🏆 Топ аниме 100 · твой список · по голосам · Страница ${currentPage} из ${currentPages}`,
      new: `🆕 Новинки ${new Date().getFullYear()}+ · Страница ${currentPage} из ${currentPages}`,
      new_soon: `⏳ Скоро выйдет · Страница ${currentPage} из ${currentPages}`,
      new_released: `✅ Уже вышло ${new Date().getFullYear()} · Страница ${currentPage} из ${currentPages}`,
      new_popular: `🔥 Популярное ${new Date().getFullYear()} · Страница ${currentPage} из ${currentPages}`,
      top_current_year: `🏅 Топ ${new Date().getFullYear()} · Страница ${currentPage} из ${currentPages}`,
      top_2020s: `🏅 Топ 2020-х · Страница ${currentPage} из ${currentPages}`,
      top_2010s: `🏅 Топ 2010-х · Страница ${currentPage} из ${currentPages}`,
      top_2000s: `🏅 Топ 2000-х · Страница ${currentPage} из ${currentPages}`,
      top_1990s: `🏅 Топ 90-х · Страница ${currentPage} из ${currentPages}`
    };
    const listLabel = tabLabels[currentTab] || `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`;
    renderList(msg.items || [], listLabel);
    setStatus(`Готово · ${currentCount} · ${msg.ms || 0} мс`);
  };
  return searchWorker;
}

let animeTopStaticData = null;

async function loadAnimeTopStatic() {
  if (!animeTopStaticData) {
    animeTopStaticData = await fetchJson(ANIME_TOP_MANUAL_URL, "reload");
  }
  return animeTopStaticData;
}

async function renderAnimeTopStatic(page = 1) {
  try {
    currentMode = "anime_top_static";
    currentTab = "anime_top";
    setActiveTab("anime_top");
    setStatus("Открываю топ аниме...");
    const data = await loadAnimeTopStatic();
    const all = Array.isArray(data && data.items) ? data.items : [];
    currentCount = all.length;
    currentPages = Math.max(1, Math.ceil(currentCount / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, Number(page || 1)), currentPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const items = all.slice(start, start + PAGE_SIZE).map((item, i) => Object.assign({}, item, { __rank: start + i + 1 }));
    renderList(items, `🏆 Топ аниме 100 · твой список · по голосам · Страница ${currentPage} из ${currentPages}`);
    setStatus(`Готово · топ ${currentCount} · мгновенно`);
  } catch (err) {
    console.error(err);
    setStatus(`Ошибка топа: ${err && err.message ? err.message : err}`);
  }
}


let animeStudiosTopData = null;
let animeStudiosDetailData = null;
let currentStudioName = "";
let currentStudioItems = [];

async function loadAnimeStudiosTop() {
  if (!animeStudiosTopData) animeStudiosTopData = await fetchJson(ANIME_STUDIOS_TOP_URL, "reload");
  return animeStudiosTopData;
}

async function loadAnimeStudiosDetail() {
  if (!animeStudiosDetailData) animeStudiosDetailData = await fetchJson(ANIME_STUDIOS_DETAIL_URL, "reload");
  return animeStudiosDetailData;
}

function studioCardHtml(row, idx) {
  const studio = row && row.studio ? row.studio : "Студия";
  const count = Number(row && row.count || 0);
  const avg = Number(row && row.avgRating || 0);
  const votes = Number(row && row.votes || 0);
  const titles = Array.isArray(row && row.topTitles) ? row.topTitles.slice(0, 6) : [];
  return `
    <article class="studio-top-card" data-studio-name="${escapeAttr(studio)}" title="Открыть все аниме студии ${escapeAttr(studio)}">
      <div class="studio-rank">#${idx + 1}</div>
      <h3>${escapeHtml(studio)}</h3>
      <div class="studio-stats">
        <span>🎬 ${escapeHtml(count)} аниме</span>
        <span>★ ${avg ? avg.toFixed(1) : "—"}</span>
        <span>👥 ${escapeHtml(formatVotes(votes))}</span>
      </div>
      <div class="studio-titles">${titles.map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      <button class="studio-open-btn" type="button">Открыть все ${escapeHtml(count)} аниме</button>
    </article>
  `;
}

async function renderAnimeStudiosTop() {
  try {
    currentMode = "anime_studios";
    currentTab = "anime_studios";
    currentPage = 1;
    currentPages = 1;
    setActiveTab("anime_studios");
    setStatus("Открываю топ студий...");
    const data = await loadAnimeStudiosTop();
    const rows = Array.isArray(data && data.studios) ? data.studios : [];
    currentItems = [];
    currentCount = rows.length;
    const grid = $("grid");
    const count = $("countText");
    const page = $("pageText");
    const prev = $("prevBtn");
    const next = $("nextBtn");
    if (count) count.textContent = `🏭 Топ аниме-студий · ${rows.length} студий`;
    if (grid) grid.innerHTML = `<section class="studio-top-grid">${rows.map(studioCardHtml).join("")}</section>`;
    if (page) page.textContent = "1 / 1";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    setStatus(`Готово · топ студий ${rows.length}`);
  } catch (err) {
    console.error(err);
    setStatus(`Ошибка топа студий: ${err && err.message ? err.message : err}`);
  }
}

async function renderStudioAnimeList(studio, page = 1) {
  try {
    currentMode = "studio_items";
    currentTab = "anime_studios";
    currentStudioName = studio || "";
    setActiveTab("anime_studios");
    setStatus(`Открываю аниме студии ${studio}...`);
    const data = await loadAnimeStudiosDetail();
    const map = data && data.studios ? data.studios : {};
    const rows = Array.isArray(map[studio]) ? map[studio] : [];
    currentStudioItems = rows;
    currentCount = rows.length;
    currentPage = Math.max(1, Number(page || 1));
    currentPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > currentPages) currentPage = currentPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const list = rows.slice(start, start + PAGE_SIZE);
    renderList(list, `🏭 ${studio} · ${rows.length} аниме · Страница ${currentPage} из ${currentPages}`);
    setStatus(`Готово · ${studio} · ${rows.length} аниме`);
  } catch (err) {
    console.error(err);
    setStatus(`Ошибка студии: ${err && err.message ? err.message : err}`);
  }
}

function runSearch(page = 1) {
  const c = controls();
  if (c.tab === "anime_top" && !norm(c.q)) {
    renderAnimeTopStatic(page);
    return;
  }
  if (c.tab === "anime_studios" && !norm(c.q)) {
    renderAnimeStudiosTop();
    return;
  }
  if (!hasActiveControls(c) && c.tab === "all") {
    renderHome();
    return;
  }
  // V154: разделы Фильмы/Сериалы/Мультфильмы/Аниме НЕ грузим из старых fast pages,
  // потому что fast pages уже заранее отсортированы и тащат наверх мусор 9.7 / 55 голосов.
  // Для этих разделов всегда запускаем search-worker, где работает строгий V153/V154 антимусор.
  // Fast pages оставляем только для служебных разделов top/new/popular.
  if (!hasActiveControls(c) && ["top", "popular"].includes(c.tab)) {
    loadFastPage(c.tab, page);
    return;
  }
  if (norm(c.q) && norm(c.q).replace(/\s+/g, "").length < 2) {
    setStatus("Введите минимум 2 символа для поиска");
    return;
  }
  currentMode = "search";
  searchReq += 1;
  makeSearchWorker().postMessage({ id: searchReq, controls: c });
}

function renderSearchPage(page) {
  currentMode = "search";
  currentPage = Math.max(1, Number(page || 1));
  searchReq += 1;
  makeSearchWorker().postMessage({ id: searchReq, mode: "page", page: currentPage, controls: controls() });
}

function renderFavorites() {
  currentMode = "local";
  currentTab = "fav";
  setActiveTab("fav");
  const fav = loadSet(favKey);
  const pool = collectVisiblePool();
  const items = pool.filter(item => fav.has(String(item.id || `${titleOf(item)}|${getYear(item)}`)));
  currentPage = 1;
  currentPages = 1;
  renderList(items, `Избранное: ${items.length}`);
}

function renderHistory() {
  currentMode = "local";
  currentTab = "history";
  setActiveTab("history");
  let items = [];
  try { items = JSON.parse(localStorage.getItem(historyKey) || "[]"); }
  catch { items = []; }
  currentPage = 1;
  currentPages = 1;
  renderList(items.slice(0, PAGE_SIZE), `История: ${items.length}`);
}

function renderRandom() {
  const pool = collectVisiblePool();
  const item = pool[Math.floor(Math.random() * pool.length)];
  if (item) openDetails(item);
}

function collectVisiblePool() {
  const out = [...currentItems];
  if (homeData && homeData.sections) Object.values(homeData.sections).forEach(list => out.push(...(list || [])));
  const seen = new Set();
  return out.filter(item => {
    const key = String(item.id || `${titleOf(item)}|${getYear(item)}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function showFatalError(err) {
  const message = err && (err.message || err.stack) || String(err || "Неизвестная ошибка");
  console.error(err);
  setStatus("Ошибка загрузки сайта");
  const count = $("countText");
  const grid = $("grid");
  if (count) count.textContent = "Сайт не смог загрузить данные";
  if (grid) {
    grid.innerHTML = `
      <section class="home-section">
        <div class="home-section-head"><h3>Ошибка загрузки</h3></div>
        <p style="color:#f8fbff;line-height:1.5">
          Не загрузились файлы базы или скрипт. Проверь, что в репозитории есть
          <b>data/fast/home.json</b>, <b>data/fast/meta.json</b> и <b>data/fast/search_index.json</b>.
        </p>
        <pre style="white-space:pre-wrap;color:#ffb4b4;background:#120b16;border:1px solid #5b2230;border-radius:10px;padding:12px;overflow:auto">${escapeHtml(message)}</pre>
      </section>
    `;
  }
}



// V127: detail facts enrichment for anime where base has empty Jikan/MAL fields
const ANIME_DETAIL_FACTS = new Map(Object.entries({
  "атака титанов": {studio:"Wit Studio / MAPPA", country:"Япония", age:"18+", status:"Завершён", episodes:"94"},
  "тетрадь смерти": {studio:"Madhouse", country:"Япония", age:"16+", status:"Завершён", episodes:"37"},
  "ванпанчмен": {studio:"Madhouse / J.C.Staff", country:"Япония", age:"16+", status:"Онгоинг", episodes:"24+"},
  "истребитель демонов": {studio:"ufotable", country:"Япония", age:"16+", status:"Онгоинг", episodes:"55+"},
  "стальной алхимик: братство": {studio:"Bones", country:"Япония", age:"16+", status:"Завершён", episodes:"64"},
  "стальной алхимик": {studio:"Bones", country:"Япония", age:"16+", status:"Завершён", episodes:"51"},
  "мастера меча онлайн": {studio:"A-1 Pictures", country:"Япония", age:"16+", status:"Завершён", episodes:"96+"},
  "моя геройская академия": {studio:"Bones", country:"Япония", age:"16+", status:"Онгоинг", episodes:"150+"},
  "наруто": {studio:"Pierrot", country:"Япония", age:"16+", status:"Завершён", episodes:"220"},
  "наруто: ураганные хроники": {studio:"Pierrot", country:"Япония", age:"16+", status:"Завершён", episodes:"500"},
  "naruto shippuden": {studio:"Pierrot", country:"Япония", age:"16+", status:"Завершён", episodes:"500"},
  "ナルト 疾風伝": {studio:"Pierrot", country:"Япония", age:"16+", status:"Завершён", episodes:"500"},
  "твоё имя": {studio:"CoMix Wave Films", country:"Япония", age:"12+", status:"Фильм", episodes:"1"},
  "магическая битва": {studio:"MAPPA", country:"Япония", age:"18+", status:"Онгоинг", episodes:"47+"},
  "токийский гуль": {studio:"Pierrot", country:"Япония", age:"18+", status:"Завершён", episodes:"48"},
  "охотник х охотник": {studio:"Madhouse", country:"Япония", age:"16+", status:"Завершён", episodes:"148"},
  "форма голоса": {studio:"Kyoto Animation", country:"Япония", age:"12+", status:"Фильм", episodes:"1"},
  "сага о винланде": {studio:"Wit Studio / MAPPA", country:"Япония", age:"18+", status:"Онгоинг", episodes:"48"},
  "провожающая в последний путь фрирен": {studio:"Madhouse", country:"Япония", age:"16+", status:"Онгоинг", episodes:"28+"},
  "врата штейна": {studio:"White Fox", country:"Япония", age:"16+", status:"Завершён", episodes:"24"},
  "код гиас: восставший лелуш": {studio:"Sunrise", country:"Япония", age:"16+", status:"Завершён", episodes:"50"},
  "ван-пис": {studio:"Toei Animation", country:"Япония", age:"16+", status:"Онгоинг", episodes:"1100+"},
  "блич": {studio:"Pierrot", country:"Япония", age:"16+", status:"Завершён", episodes:"366"},
  "блич: тысячелетняя кровавая война": {studio:"Pierrot", country:"Япония", age:"16+", status:"Онгоинг", episodes:"40+"},
  "драконий жемчуг": {studio:"Toei Animation", country:"Япония", age:"12+", status:"Завершён", episodes:"153"},
  "драконий жемчуг зет": {studio:"Toei Animation", country:"Япония", age:"12+", status:"Завершён", episodes:"291"},
  "драконий жемчуг супер": {studio:"Toei Animation", country:"Япония", age:"12+", status:"Завершён", episodes:"131"},
  "семь смертных грехов": {studio:"A-1 Pictures / Studio Deen", country:"Япония", age:"16+", status:"Завершён", episodes:"100"},
  "ковбой бибоп": {studio:"Sunrise", country:"Япония", age:"16+", status:"Завершён", episodes:"26"},
  "монстр": {studio:"Madhouse", country:"Япония", age:"18+", status:"Завершён", episodes:"74"},
  "берсерк": {studio:"OLM", country:"Япония", age:"18+", status:"Завершён", episodes:"25"},
  "гинтама": {studio:"Sunrise / Bandai Namco Pictures", country:"Япония", age:"16+", status:"Завершён", episodes:"367"},
  "доктор стоун": {studio:"TMS Entertainment", country:"Япония", age:"12+", status:"Онгоинг", episodes:"57+"},
  "re:zero — жизнь с нуля в другом мире": {studio:"White Fox", country:"Япония", age:"16+", status:"Онгоинг", episodes:"50+"},
  "86: восемьдесят шесть": {studio:"A-1 Pictures", country:"Япония", age:"16+", status:"Завершён", episodes:"23"},
  "дороро": {studio:"MAPPA / Tezuka Productions", country:"Япония", age:"16+", status:"Завершён", episodes:"24"},
  "чёрный клевер": {studio:"Pierrot", country:"Япония", age:"12+", status:"Завершён", episodes:"170"},
  "человек-бензопила": {studio:"MAPPA", country:"Япония", age:"18+", status:"Онгоинг", episodes:"12+"},
  "семья шпиона": {studio:"Wit Studio / CloverWorks", country:"Япония", age:"12+", status:"Онгоинг", episodes:"37+"},
  "волейбол!!": {studio:"Production I.G", country:"Япония", age:"12+", status:"Завершён", episodes:"85"},
  "моб психо 100": {studio:"Bones", country:"Япония", age:"16+", status:"Завершён", episodes:"37"},
  "вайолет эвергарден": {studio:"Kyoto Animation", country:"Япония", age:"12+", status:"Завершён", episodes:"13"},
  "евангелион": {studio:"Gainax / Tatsunoko", country:"Япония", age:"16+", status:"Завершён", episodes:"26"},
  "созданный в бездне": {studio:"Kinema Citrus", country:"Япония", age:"18+", status:"Онгоинг", episodes:"25+"},
  "самурай чамплу": {studio:"Manglobe", country:"Япония", age:"16+", status:"Завершён", episodes:"26"},
  "невероятные приключения джоджо": {studio:"David Production", country:"Япония", age:"16+", status:"Онгоинг", episodes:"190+"},
  "реинкарнация безработного": {studio:"Studio Bind", country:"Япония", age:"18+", status:"Онгоинг", episodes:"48+"},
  "кланнад": {studio:"Kyoto Animation", country:"Япония", age:"12+", status:"Завершён", episodes:"47"},
  "госпожа кагуя: в любви как на войне": {studio:"A-1 Pictures", country:"Япония", age:"16+", status:"Завершён", episodes:"37"},
  "монолог фармацевта": {studio:"Toho Animation Studio / OLM", country:"Япония", age:"16+", status:"Онгоинг", episodes:"24+"},
  "паразит": {studio:"Madhouse", country:"Япония", age:"18+", status:"Завершён", episodes:"24"},
  "триган": {studio:"Madhouse", country:"Япония", age:"16+", status:"Завершён", episodes:"26"},
  "хеллсинг ultimate": {studio:"Satelight / Madhouse / Graphinica", country:"Япония", age:"18+", status:"Завершён", episodes:"10"}
}));

function animeFactsKey(item) {
  const candidates = [displayTitle(item), item && item.__manualTopTitle, item && item.ru, item && item.title_ru, item && item.en, item && item.title, item && item.name, item && item.original_title, item && item.original_name].filter(Boolean).map(norm);
  for (const c of candidates) {
    if (ANIME_DETAIL_FACTS.has(c)) return c;
    for (const key of ANIME_DETAIL_FACTS.keys()) if (hasAliasText(c, key) || hasAliasText(key, c)) return key;
  }
  return "";
}

function cleanFactValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "null" || text === "undefined") return "";
  return text;
}

function detailFactValue(item, field) {
  const key = getType(item) === "Аниме" ? animeFactsKey(item) : "";
  const facts = key ? ANIME_DETAIL_FACTS.get(key) : null;
  if (field === "status") return cleanFactValue(item.status) || (facts && facts.status) || "";
  if (field === "episodes") return cleanFactValue(item.episodes || item.episodeCount) || (facts && facts.episodes) || "";
  if (field === "studio") return cleanFactValue(item.studio || item.studios) || (facts && facts.studio) || inferAnimeStudio(item) || (isAnimeItem(item) ? "Студия не указана в источнике" : "");
  if (field === "country") return cleanFactValue(item.country || item.countries) || (facts && facts.country) || (getType(item) === "Аниме" ? "Япония" : "");
  if (field === "age") return cleanFactValue(item.ageRating || item.age) || (facts && facts.age) || "";
  return "";
}

function factHtml(label, value) {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "").trim();
  if (!text || text === "—" || text === "null" || text === "undefined") return "";
  return `<div class="fact-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`;
}

function setLink(id, url) {
  const node = $(id);
  if (node) node.href = url;
}

function openDetails(item) {
  selectedItem = item;
  const id = String(item.id || `${titleOf(item)}|${getYear(item)}`);
  const history = (() => {
    try { return JSON.parse(localStorage.getItem(historyKey) || "[]"); }
    catch { return []; }
  })().filter(x => String(x.id || `${titleOf(x)}|${getYear(x)}`) !== id);
  history.unshift(item);
  localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 80)));

  const dialog = $("detailsDialog");
  const poster = $("detailPoster");
  const title = $("detailTitle");
  const meta = $("detailMeta");
  const detailGenres = $("detailGenres");
  const overview = $("detailOverview");
  if (poster) { poster.dataset.originalSrc = posterOriginalSrc(item) || ""; poster.dataset.proxyTried = shouldProxyFirst(poster.dataset.originalSrc) ? "1" : "0"; poster.src = posterSrc(item) || ""; schedulePosterRecovery(document); }
  if (title) title.textContent = displayTitle(item);
  if (meta) meta.textContent = `${getType(item)} · ${getYear(item) || "—"} · ${rankLabel(item)} · ${getRating(item) || "—"} · ${getVotes(item)} голосов`;
  if (detailGenres) detailGenres.textContent = getGenres(item).join(" · ");
  if (overview) overview.textContent = displayOverview(item);

  const facts = $("detailFacts");
  if (facts) {
    facts.innerHTML = [
      factHtml("Тип", getType(item)),
      factHtml("Год", getYear(item)),
      factHtml("Рейтинг", getRating(item) || "—"),
      factHtml("Голосов", getVotes(item) || "—"),
      factHtml("Статус", detailFactValue(item, "status")),
      factHtml("Эпизоды", detailFactValue(item, "episodes")),
      factHtml("Студия", detailFactValue(item, "studio")),
      factHtml("Страна", detailFactValue(item, "country")),
      factHtml("Возраст", detailFactValue(item, "age")),
      factHtml("Источник", item.source)
    ].join("");
  }

  const q = encodeURIComponent(`${displayTitle(item)} ${getYear(item) || ""}`.trim());
  setLink("yandexLink", `https://yandex.ru/search/?text=${q}`);
  setLink("yandexVideoLink", `https://yandex.ru/video/search?text=${q}`);
  setLink("kinopoiskLink", `https://www.kinopoisk.ru/index.php?kp_query=${q}`);
  setLink("youtubeLink", `https://www.youtube.com/results?search_query=${q}`);
  setLink("vkLink", `https://vk.com/video?q=${q}`);
  setLink("rutubeLink", `https://rutube.ru/search/?query=${q}`);
  setLink("googleLink", `https://www.google.com/search?q=${q}`);

  const favBtn = $("favBtn");
  if (favBtn) {
    const fav = loadSet(favKey);
    favBtn.textContent = fav.has(id) ? "В избранном" : "В избранное";
    favBtn.onclick = () => {
      const next = loadSet(favKey);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet(favKey, next);
      favBtn.textContent = next.has(id) ? "В избранном" : "В избранное";
    };
  }

  renderRelated(item);
  if (dialog && typeof dialog.showModal === "function") dialog.showModal();
  else if (dialog) dialog.setAttribute("open", "open");
}

function franchiseKey(item) {
  const raw = norm([titleOf(item), item.ru, item.en].join(" "));
  const groups = [
    ["shazam", "шазам"], ["matrix", "матрица"], ["interstellar", "интерстеллар"], ["deadpool", "дэдпул", "дедпул"],
    ["harry potter", "гарри поттер"], ["john wick", "джон уик"], ["naruto", "наруто"], ["one piece", "ван пис", "ванпис"],
    ["bleach", "блич"], ["jujutsu kaisen", "магическая битва"], ["demon slayer", "истребитель демонов"]
  ];
  for (const group of groups) if (group.some(key => raw.includes(norm(key)))) return group[0];
  return raw.replace(/\b(часть|глава|фильм|сезон|season|part|movie|episode|эпизод)\b/g, " ").replace(/\b([ivxlcdm]+|\d+)\b/g, " ").split(" ").filter(x => x.length > 2).slice(0, 3).join(" ");
}

function relatedCardHtml(item) {
  const img = posterSrc(item);
  return `
    <article class="related-card" data-related-id="${escapeAttr(item.id || `${titleOf(item)}|${getYear(item)}`)}">
      ${img ? `<img class="related-poster" src="${escapeAttr(img)}" data-original-src="${escapeAttr(posterOriginalSrc(item))}" data-proxy-tried="${shouldProxyFirst(posterOriginalSrc(item)) ? "1" : "0"}" loading="lazy" decoding="async" alt="">` : ""}
      <div class="related-info">
        <div class="related-title">${escapeHtml(titleOf(item))}</div>
        <div class="related-meta">${escapeHtml(getYear(item) || "—")} · ${escapeHtml(getType(item))}</div>
        <div class="related-rating">★ ${escapeHtml(getRating(item) || "—")} · ${escapeHtml(formatVotes(getVotes(item)))}</div>
      </div>
    </article>
  `;
}

function ensureRelatedBlock() {
  let block = $("relatedBlock");
  if (block) return block;
  block = document.createElement("section");
  block.id = "relatedBlock";
  block.className = "links-block related-block";
  block.innerHTML = `<h3 class="links-title">Что посмотреть похожее</h3><div id="relatedCards" class="related-cards"></div>`;
  const player = $("playerBlock");
  if (player && player.parentNode) player.parentNode.insertBefore(block, player);
  return block;
}

function relatedTypeFamily(item) {
  const t = norm(getType(item) || item.type || item.category || "");
  if (t.includes("аниме") || t.includes("anime")) return "anime";
  if (t.includes("сериал") && !t.includes("мульт")) return "series";
  if (t.includes("мульт") || t.includes("cartoon") || t.includes("animated")) return "cartoon";
  if (t.includes("фильм") || t.includes("movie")) return "movie";
  return t || "other";
}

function relatedTypeLabel(family) {
  if (family === "movie") return "фильмы";
  if (family === "series") return "сериалы";
  if (family === "cartoon") return "мультфильмы";
  if (family === "anime") return "аниме";
  return "похожее";
}

function renderRelated(base) {
  const block = ensureRelatedBlock();
  const box = $("relatedCards");
  if (!box) return;

  // V151: рекомендации строго в рамках того же типа.
  // Фильм показывает фильмы, сериал — сериалы, мультфильм — мультфильмы, аниме — аниме.
  const baseFamily = relatedTypeFamily(base);
  const title = block.querySelector(".links-title");
  if (title) title.textContent = `Что посмотреть похожее · ${relatedTypeLabel(baseFamily)}`;

  const pool = collectVisiblePool();
  const baseId = String(base.id || "");
  const baseKey = franchiseKey(base);
  const baseGenres = getGenres(base);

  const rows = pool
    .filter(item => {
      if (!item) return false;
      if (String(item.id || "") === baseId) return false;
      if (!hasPoster(item)) return false;
      return relatedTypeFamily(item) === baseFamily;
    })
    .map(item => {
      const same = baseKey && franchiseKey(item) === baseKey ? 100000 : 0;
      const genreScore = baseGenres.filter(g => getGenres(item).includes(g)).length * 700;
      const votesScore = Math.min(Number(getVotes(item) || 0), 9000000) / 90;
      const ratingScore = Number(getRating(item) || 0) * 1000;
      return { item, score: same + genreScore + ratingScore + votesScore };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(x => x.item);

  block.style.display = rows.length ? "" : "none";
  box.innerHTML = rows.map(relatedCardHtml).join("");
}

function scheduleSearch(delay = 160) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(1), delay);
}


function installGenreTopButtons() {
  if (document.querySelector(".gkm-genre-top-btn")) return;
  const tabs = document.querySelector(".tabs");
  if (!tabs) return;
  const genres = ["Боевик", "Комедия", "Драма", "Криминал", "Фантастика", "Ужасы"];
  genres.forEach(genre => {
    const btn = document.createElement("button");
    btn.className = "tab gkm-genre-top-btn";
    btn.type = "button";
    btn.dataset.genreTop = genre;
    btn.textContent = "Топ " + genre.toLowerCase();
    tabs.appendChild(btn);
  });
}

function applyGenreTop(genre) {
  // V149: genre top buttons are FILM tops, not mixed all-types tops.
  // Before this fix anime with millions of votes dominated "Топ боевик/драма/криминал".
  currentTab = "movies";
  setActiveTab("movies");

  const q = $("searchInput");
  const type = $("typeFilter");
  const gf = $("genreFilter");
  const sort = $("sortFilter");
  const rating = $("ratingFilter");

  if (q) q.value = "";
  if (type) type.value = "Фильм";
  if (gf) gf.value = genre;
  if (sort) sort.value = "smart";
  if (rating) rating.value = "0";

  runSearch(1);
}

function bindEvents() {
  document.querySelectorAll(".gkm-genre-top-btn[data-genre-top]").forEach(btn => {
    btn.addEventListener("click", () => applyGenreTop(btn.dataset.genreTop || ""));
  });
  $("searchInput")?.addEventListener("input", () => scheduleSearch(220));
  ["typeFilter", "genreFilter", "yearFilter", "ratingFilter", "sortFilter"].forEach(id => {
    $(id)?.addEventListener("change", () => scheduleSearch(60));
  });
  $("cleanTrashBtn")?.addEventListener("click", () => {
    setCleanTrashEnabled(!isCleanTrashEnabled());
    scheduleSearch(60);
  });
  updateCleanTrashButton();
  $("resetBtn")?.addEventListener("click", () => {
    ["searchInput", "typeFilter", "genreFilter", "yearFilter", "ratingFilter"].forEach(id => {
      const node = $(id);
      if (node) node.value = id === "ratingFilter" ? "0" : "";
    });
    const sort = $("sortFilter");
    if (sort) sort.value = "smart";
    renderHome();
  });
  document.querySelectorAll(".tab[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab || "all";
      currentTab = tab;
      setActiveTab(tab);
      if (tab === "fav") return renderFavorites();
      if (tab === "history") return renderHistory();
      if (tab === "random") return renderRandom();
      if (tab === "anime_studios") return renderAnimeStudiosTop();
      if (tab === "all" && !hasActiveControls({ ...controls(), tab })) return renderHome();
      runSearch(1);
    });
  });
  $("prevBtn")?.addEventListener("click", () => {
    if (currentPage <= 1) return;
    if (currentMode === "anime_top_static") return renderAnimeTopStatic(currentPage - 1);
    if (currentMode === "studio_items") return renderStudioAnimeList(currentStudioName, currentPage - 1);
    if (currentMode === "search") return renderSearchPage(currentPage - 1);
    if (currentMode === "page") return loadFastPage(currentTab, currentPage - 1);
  });
  $("nextBtn")?.addEventListener("click", () => {
    if (currentPage >= currentPages) return;
    if (currentMode === "anime_top_static") return renderAnimeTopStatic(currentPage + 1);
    if (currentMode === "studio_items") return renderStudioAnimeList(currentStudioName, currentPage + 1);
    if (currentMode === "search") return renderSearchPage(currentPage + 1);
    if (currentMode === "page") return loadFastPage(currentTab, currentPage + 1);
  });
  $("grid")?.addEventListener("click", event => {
    const favBtn = event.target.closest("[data-fav-id]");
    if (favBtn) {
      event.stopPropagation();
      const fav = loadSet(favKey);
      const id = favBtn.dataset.favId;
      if (fav.has(id)) fav.delete(id);
      else fav.add(id);
      saveSet(favKey, fav);
      favBtn.textContent = fav.has(id) ? "♥" : "♡";
      favBtn.classList.toggle("active", fav.has(id));
      return;
    }
    const studioCard = event.target.closest(".studio-top-card[data-studio-name]");
    if (studioCard) {
      const studio = studioCard.dataset.studioName || "";
      if (studio) renderStudioAnimeList(studio, 1);
      return;
    }
    const card = event.target.closest(".card");
    if (!card) return;
    const item = currentItems.find(x => String(x.id || `${titleOf(x)}|${getYear(x)}`) === String(card.dataset.id));
    if (item) openDetails(item);
  });
  document.addEventListener("click", event => {
    const more = event.target.closest("[data-open-tab]");
    if (more) {
      currentTab = more.dataset.openTab || "all";
      setActiveTab(currentTab);
      runSearch(1);
    }
    const related = event.target.closest(".related-card");
    if (related) {
      const pool = collectVisiblePool();
      const item = pool.find(x => String(x.id || `${titleOf(x)}|${getYear(x)}`) === String(related.dataset.relatedId));
      if (item) openDetails(item);
    }
  });
  $("closeDialog")?.addEventListener("click", () => $("detailsDialog")?.close());
  $("gkmAiFloatBtn")?.addEventListener("click", () => $("gkmAiDialog")?.showModal?.());
  $("gkmAiTopBtn")?.addEventListener("click", () => $("gkmAiDialog")?.showModal?.());
  $("gkmAiCloseBtn")?.addEventListener("click", () => $("gkmAiDialog")?.close());
}

async function boot() {
  window.GKM_V106_CLEAN_APP_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V107_STABLE_APP_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V108_FIX_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V109_FAST_SEARCH_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V110_SEARCH_FALLBACK_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V111_SEARCH_LITE_404_FALLBACK_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_V113_POSTER_PROXY_RECOVERY_VERSION = GKM_APP_CLEAN_VERSION;
  window.GKM_COUNT_POSTERS = async () => {
    let data;
    try {
      data = await fetchJson(SEARCH_LITE_URL);
    } catch {
      data = await fetchJson(SEARCH_URL);
    }
    const total = Array.isArray(data) ? data.length : 0;
    const withPoster = Array.isArray(data) ? data.filter(hasPoster).length : 0;
    return { total, withPoster, withoutPoster: total - withPoster };
  };
  installGenreTopButtons();
  bindEvents();
  try {
    await initMeta();
    await renderHome();
    console.log("GKM:", GKM_APP_CLEAN_VERSION);
  } catch (err) {
    showFatalError(err);
  }
}

window.addEventListener("error", event => showFatalError(event.error || event.message));
window.addEventListener("unhandledrejection", event => showFatalError(event.reason));

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();


// V130 EOF lock
window.GKM_V130_ANIME_TOP_RANK_PAGE_CACHE_EOF_LOCK_VERSION = "v130-anime-top-rank-page-cache-fix-2026-06-24";


// V131 EOF lock
window.GKM_V131_STATIC_ANIME_TOP_FAST_EOF_LOCK_VERSION = "v131-static-anime-top-fast-no-worker-hang-2026-06-24";

window.GKM_V133_MISSING_TOP_FILE_FIX_VERSION = "v133-missing-anime-top-file-fix-2026-06-24";
console.log("GKM: v133-missing-anime-top-file-fix-2026-06-24");

/* === GKM V138 LOCAL HELPER WORKING === */
window.GKM_V138_LOCAL_HELPER_VERSION = "v138-local-helper-working-2026-06-24";
window.GKM_V139_HELPER_GETRUTITLE_FIX_VERSION = "v139-helper-getrutitle-fix-2026-06-24";
window.GKM_V140_HELPER_VOTESOF_FIX_VERSION = "v140-helper-votesof-fix-2026-06-24";
window.GKM_V141_HELPER_GREETING_FIX_VERSION = "v141-helper-greeting-no-random-list-2026-06-24";

function gkmHelperReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
}

function gkmHelperAddMessage(role, text) {
  const box = document.getElementById("gkmAiMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "ai-msg " + (role === "user" ? "ai-user" : "ai-bot");
  div.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function gkmHelperNormalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/[^a-zа-я0-9\s:.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gkmHelperVisiblePool() {
  const pool = [];
  const seen = new Set();
  function add(item) {
    if (!item || typeof item !== "object") return;
    const key = String(item.id || titleOf(item) + "|" + getYear(item));
    if (seen.has(key)) return;
    seen.add(key);
    pool.push(item);
  }
  try { (currentItems || []).forEach(add); } catch {}
  try {
    Object.values(homeData || {}).forEach(v => {
      if (Array.isArray(v)) v.forEach(add);
      else if (v && Array.isArray(v.items)) v.items.forEach(add);
    });
  } catch {}
  return pool;
}

function gkmHelperFormatList(items) {
  return items.slice(0, 8).map((it, idx) => {
    const title = displayTitle(it) || titleOf(it) || "Без названия";
    const year = getYear(it) || "—";
    const rating = ratingOf(it) || "—";
    return `${idx + 1}. ${title} (${year}) — ★ ${rating}`;
  }).join("\n");
}

function gkmHelperPickByWords(words, limit = 8) {
  const q = gkmHelperNormalizeText(words);
  const tokens = q.split(" ").filter(Boolean).filter(t => t.length >= 3);
  if (!tokens.length) return [];
  const pool = gkmHelperVisiblePool();
  const scored = pool.map(it => {
    const txt = gkmHelperNormalizeText([
      displayTitle(it), titleOf(it), it.title_en, it.original_title, it.name, it.overview,
      Array.isArray(it.genres) ? it.genres.join(" ") : it.genres
    ].join(" "));
    let matchScore = 0;
    tokens.forEach(t => { if (txt.includes(t)) matchScore += t.length >= 4 ? 3 : 1; });
    if (matchScore <= 0) return { it, score: 0 };
    let score = matchScore * 10;
    score += Math.min(10, Math.log10((votesOf(it) || 0) + 1));
    score += Number(ratingOf(it) || 0) / 2;
    return { it, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.it);
  return scored.slice(0, limit);
}

function gkmHelperIsGreeting(q) {
  return /^(привет|прив|здарова|здорово|ку|хай|hello|hi|добрый день|добрый вечер|доброе утро)$/i.test(String(q || "").trim());
}

function gkmHelperAnswer(raw) {
  const q = gkmHelperNormalizeText(raw);
  if (!q) return "Напиши, что хочется посмотреть: жанр, настроение или пример тайтла.";

  if (gkmHelperIsGreeting(q)) {
    return "Привет! Я помогу подобрать фильм, сериал, аниме или мультфильм. Напиши, что хочется: например «мрачное аниме», «фильм на вечер», «как Наруто», «топ студий» или «порядок просмотра Блич».";
  }

  if (q.includes("топ студ")) {
    try { renderAnimeStudiosTop(); } catch {}
    return "Открыл раздел «Топ студий». Там можно смотреть студии и их аниме.";
  }

  if (q.includes("топ аним") || q.includes("лучшие аним")) {
    try { renderAnimeTopManual(1); } catch {}
    return "Открыл «Топ аниме 100». Это твой ручной список, отсортированный по голосам.";
  }

  if (q.includes("интерстел") || q.includes("космос")) {
    const items = gkmHelperPickByWords("космос фантастика драма interstellar space sci-fi", 6);
    return items.length ? "Вот что можно попробовать в таком духе:\n" + gkmHelperFormatList(items) : "Попробуй: Интерстеллар, Начало, Прибытие, Марсианин, Гравитация.";
  }

  if (q.includes("наруто")) {
    const items = gkmHelperPickByWords("naruto нaруто shippuden ninja боевые искусства приключения", 8);
    return items.length ? "Похоже на Наруто / из этой темы:\n" + gkmHelperFormatList(items) : "Попробуй: Наруто, Наруто: Ураганные хроники, Блич, Ван-Пис, Магическая битва, Чёрный клевер.";
  }

  if (q.includes("вечер") || q.includes("посмотреть") || q.includes("посовет")) {
    const items = gkmHelperPickByWords(q + " популярное драма боевик приключения", 8);
    return items.length ? "Я бы выбрал вот это:\n" + gkmHelperFormatList(items) : "Скажи жанр: аниме, фильм, сериал, драма, фантастика, комедия, жёсткое или лёгкое.";
  }

  const items = gkmHelperPickByWords(q, 8);
  if (items.length) return "Нашёл подходящие варианты:\n" + gkmHelperFormatList(items);

  return "Пока не понял запрос. Напиши проще, например: «аниме как Наруто», «фильм вечером», «топ студий», «мрачное аниме».";
}



/* === GKM V142 HELPER INTENT FIX === */
window.GKM_V142_HELPER_INTENT_FIX_VERSION = "v142-helper-intent-no-random-results-2026-06-24";

function gkmHelperItemType(item) {
  try { return getType(item); } catch { return String(item && (item.type || item.category) || ""); }
}

function gkmHelperIsAnimeQuery(q) {
  return /(^|\s)(аниме|анимэ|anime)(\s|$)/i.test(String(q || ""));
}

function gkmHelperIsFilmQuery(q) {
  return /(^|\s)(фильм|кино|movie|film)(\s|$)/i.test(String(q || ""));
}

function gkmHelperIsSeriesQuery(q) {
  return /(^|\s)(сериал|series|show)(\s|$)/i.test(String(q || ""));
}

function gkmHelperCleanCandidate(item) {
  if (!item) return false;
  const y = Number(getYear(item) || 0);
  const currentYear = new Date().getFullYear();
  if (y && y > currentYear) return false;
  const title = gkmHelperNormalizeText([displayTitle(item), titleOf(item), item.title_en, item.original_title].join(" "));
  const banned = ["fan letter", "recap", "summary", "preview", "trailer", "teaser", "music video", "soundtrack", "stage play", "concert", "фан письмо", "рекап", "трейлер", "превью"];
  return !banned.some(x => title.includes(x));
}

function gkmHelperPickPopularByType(type, limit = 8) {
  const pool = gkmHelperVisiblePool();
  return pool
    .filter(it => !type || gkmHelperItemType(it) === type)
    .filter(gkmHelperCleanCandidate)
    .sort((a, b) => (votesOf(b) - votesOf(a)) || (ratingOf(b) - ratingOf(a)) || (Number(getYear(b)||0) - Number(getYear(a)||0)))
    .slice(0, limit);
}

function gkmHelperPickByWords(words, limit = 8, opts = {}) {
  const q = gkmHelperNormalizeText(words);
  const type = opts.type || "";
  const tokens = q.split(" ").filter(Boolean).filter(t => t.length >= 3);
  if (!tokens.length && !type) return [];
  const weakWords = new Set(["подбери", "подобрать", "посоветуй", "посмотреть", "вечером", "вечер", "хочу", "что", "мне", "дай", "это"]);
  const strongTokens = tokens.filter(t => !weakWords.has(t));
  if (!strongTokens.length && type) return gkmHelperPickPopularByType(type, limit);
  if (!strongTokens.length) return [];
  const pool = gkmHelperVisiblePool();
  const scored = pool.map(it => {
    if (type && gkmHelperItemType(it) !== type) return { it, score: 0 };
    if (!gkmHelperCleanCandidate(it)) return { it, score: 0 };
    const txt = gkmHelperNormalizeText([
      displayTitle(it), titleOf(it), it.title_en, it.original_title, it.name, it.overview,
      Array.isArray(it.genres) ? it.genres.join(" ") : it.genres
    ].join(" "));
    let matchScore = 0;
    strongTokens.forEach(t => {
      if (txt.includes(t)) matchScore += t.length >= 5 ? 4 : 2;
    });
    if (matchScore <= 0) return { it, score: 0 };
    let score = matchScore * 10;
    score += Math.min(12, Math.log10((votesOf(it) || 0) + 1));
    score += Number(ratingOf(it) || 0) / 2;
    return { it, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.it);
  return scored.slice(0, limit);
}

function gkmHelperAnswer(raw) {
  const q = gkmHelperNormalizeText(raw);
  if (!q) return "Напиши, что хочется посмотреть: фильм, сериал, аниме, жанр или пример тайтла.";

  if (gkmHelperIsGreeting(q)) {
    return "Привет! Я помогу подобрать фильм, сериал, аниме или мультфильм. Напиши, например: «подбери фильм», «посоветуй аниме», «как Наруто», «топ аниме», «топ студий».";
  }

  if (q.includes("топ студ")) {
    try { renderAnimeStudiosTop(); } catch {}
    return "Открыл раздел «Топ студий». Кликни на студию, чтобы увидеть все её аниме.";
  }

  if (q.includes("топ аним") || q.includes("лучшие аним")) {
    try { renderAnimeTopManual(1); } catch {}
    return "Открыл «Топ аниме 100». Там твой список, отсортированный по голосам.";
  }

  if (q.includes("интерстел") || q.includes("космос")) {
    const items = gkmHelperPickByWords("космос фантастика драма interstellar space sci-fi", 6, { type: "Фильм" });
    return items.length ? "В духе космоса/фантастики:\n" + gkmHelperFormatList(items) : "Попробуй: Интерстеллар, Начало, Прибытие, Марсианин, Гравитация.";
  }

  if (q.includes("наруто")) {
    const items = gkmHelperPickByWords("naruto shippuden ninja боевые искусства приключения", 8, { type: "Аниме" });
    return items.length ? "Похоже на Наруто или из этой темы:\n" + gkmHelperFormatList(items) : "Попробуй: Наруто, Наруто: Ураганные хроники, Блич, Ван-Пис, Магическая битва, Чёрный клевер.";
  }

  if (gkmHelperIsAnimeQuery(q)) {
    const items = gkmHelperPickByWords(q, 8, { type: "Аниме" });
    const list = items.length ? items : gkmHelperPickPopularByType("Аниме", 8);
    return list.length ? "Вот популярные аниме:\n" + gkmHelperFormatList(list) : "Скажи жанр аниме: экшен, драма, романтика, мистика, спорт или что-то как Наруто.";
  }

  if (gkmHelperIsFilmQuery(q) || q.includes("вечер")) {
    const items = gkmHelperPickByWords(q, 8, { type: "Фильм" });
    const list = items.length ? items : gkmHelperPickPopularByType("Фильм", 8);
    return list.length ? "Вот фильмы, которые можно посмотреть:\n" + gkmHelperFormatList(list) : "Скажи жанр фильма: фантастика, боевик, драма, комедия, ужасы.";
  }

  if (gkmHelperIsSeriesQuery(q)) {
    const items = gkmHelperPickByWords(q, 8, { type: "Сериал" });
    const list = items.length ? items : gkmHelperPickPopularByType("Сериал", 8);
    return list.length ? "Вот сериалы, которые можно посмотреть:\n" + gkmHelperFormatList(list) : "Скажи жанр сериала: детектив, драма, фантастика, комедия.";
  }

  if (q.includes("посовет") || q.includes("подбери") || q.includes("посмотреть")) {
    return "Уточни, что подобрать: фильм, сериал или аниме? Например: «подбери фильм фантастику» или «посоветуй мрачное аниме».";
  }

  const items = gkmHelperPickByWords(q, 8);
  if (items.length) return "Нашёл подходящие варианты:\n" + gkmHelperFormatList(items);

  return "Пока не понял запрос. Напиши проще: «подбери фильм», «посоветуй аниме», «как Наруто», «топ студий».";
}

console.log("GKM:", window.GKM_V142_HELPER_INTENT_FIX_VERSION);

function setupGkmLocalHelper() {
  const floatBtn = document.getElementById("gkmAiFloatBtn");
  const dialog = document.getElementById("gkmAiDialog");
  const closeBtn = document.getElementById("gkmAiCloseBtn");
  const form = document.getElementById("gkmAiForm");
  const input = document.getElementById("gkmAiInput");
  if (!floatBtn || !dialog || !form || !input) return;

  floatBtn.onclick = () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    setTimeout(() => input.focus(), 50);
  };
  if (closeBtn) closeBtn.onclick = () => dialog.close ? dialog.close() : dialog.removeAttribute("open");

  document.querySelectorAll("[data-ai-prompt]").forEach(btn => {
    btn.onclick = () => {
      input.value = btn.dataset.aiPrompt || "";
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
  });

  form.onsubmit = (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    gkmHelperAddMessage("user", text);
    setTimeout(() => gkmHelperAddMessage("bot", gkmHelperAnswer(text)), 120);
  };
}

gkmHelperReady(setupGkmLocalHelper);
console.log("GKM:", window.GKM_V141_HELPER_GREETING_FIX_VERSION);

/* GKM V174 FAST CLEAN FRANCHISES START */
(function () {
  "use strict";

  window.GKM_V174_FAST_CLEAN_FRANCHISES_VERSION = "v174-fast-clean-franchises-no-garbage-2026-06-24";

  // V174: убрал тяжёлую "полную базу франшизы".
  // Больше НЕ грузим все chunk-файлы и НЕ собираем мусор по словам Predator / Alien / Naruto.
  // Франшиза = быстрый понятный порядок просмотра + кнопки "Найти эту часть" и "Открыть обычным поиском".

  const FRANCHISES = [
    {
      key: "naruto",
      title: "Наруто",
      query: "наруто",
      note: "Порядок без мусора. Сначала сериал, потом фильмы, потом Shippuden, The Last и Boruto.",
      order: [
        ["Наруто", "наруто"],
        ["Наруто: Битва ниндзя в Стране Снега", "наруто страна снега"],
        ["Наруто: Легенда о камне Гелела", "наруто камень гелела"],
        ["Наруто: Стражи королевства Полумесяца", "наруто полумесяц"],
        ["Наруто: Ураганные хроники", "наруто ураганные хроники"],
        ["Наруто: Ураганные хроники — Фильм", "наруто ураганные хроники фильм"],
        ["Наруто: Узы", "наруто узы"],
        ["Наруто: Наследники воли огня", "наруто наследники воли огня"],
        ["Наруто: Потерянная башня", "наруто потерянная башня"],
        ["Наруто: Кровавая тюрьма", "наруто кровавая тюрьма"],
        ["Наруто: Путь ниндзя", "наруто путь ниндзя"],
        ["Последний: Наруто. Фильм", "последний наруто фильм"],
        ["Боруто", "боруто"]
      ]
    },
    {
      key: "mcu",
      title: "Мстители / MCU",
      query: "мстители",
      note: "Основная линия MCU. Это порядок просмотра, а не грязный поиск всей базы.",
      order: [
        ["Железный человек", "железный человек"],
        ["Невероятный Халк", "невероятный халк"],
        ["Железный человек 2", "железный человек 2"],
        ["Тор", "тор"],
        ["Первый мститель", "первый мститель"],
        ["Мстители", "мстители"],
        ["Железный человек 3", "железный человек 3"],
        ["Тор 2: Царство тьмы", "тор царство тьмы"],
        ["Первый мститель: Другая война", "первый мститель другая война"],
        ["Стражи Галактики", "стражи галактики"],
        ["Мстители: Эра Альтрона", "мстители эра альтрона"],
        ["Первый мститель: Противостояние", "первый мститель противостояние"],
        ["Доктор Стрэндж", "доктор стрэндж"],
        ["Стражи Галактики. Часть 2", "стражи галактики часть 2"],
        ["Человек-паук: Возвращение домой", "человек паук возвращение домой"],
        ["Тор: Рагнарёк", "тор рагнарек"],
        ["Чёрная Пантера", "черная пантера"],
        ["Мстители: Война бесконечности", "мстители война бесконечности"],
        ["Человек-муравей и Оса", "человек муравей и оса"],
        ["Капитан Марвел", "капитан марвел"],
        ["Мстители: Финал", "мстители финал"],
        ["Человек-паук: Вдали от дома", "человек паук вдали от дома"],
        ["Чёрная вдова", "черная вдова"],
        ["Шан-Чи", "шан-чи"],
        ["Вечные", "вечные"],
        ["Человек-паук: Нет пути домой", "человек паук нет пути домой"],
        ["Доктор Стрэндж: В мультивселенной безумия", "доктор стрэндж мультивселенной безумия"],
        ["Тор: Любовь и гром", "тор любовь и гром"],
        ["Чёрная Пантера: Ваканда навеки", "черная пантера ваканда навеки"],
        ["Стражи Галактики. Часть 3", "стражи галактики часть 3"],
        ["Человек-муравей и Оса: Квантомания", "человек муравей оса квантомания"]
      ]
    },
    {
      key: "harry",
      title: "Гарри Поттер",
      query: "гарри поттер",
      note: "Порядок выхода.",
      order: [
        ["Гарри Поттер и философский камень", "гарри поттер философский камень"],
        ["Гарри Поттер и Тайная комната", "гарри поттер тайная комната"],
        ["Гарри Поттер и узник Азкабана", "гарри поттер узник азкабана"],
        ["Гарри Поттер и Кубок огня", "гарри поттер кубок огня"],
        ["Гарри Поттер и Орден Феникса", "гарри поттер орден феникса"],
        ["Гарри Поттер и Принц-полукровка", "гарри поттер принц полукровка"],
        ["Гарри Поттер и Дары смерти: Часть 1", "гарри поттер дары смерти часть 1"],
        ["Гарри Поттер и Дары смерти: Часть 2", "гарри поттер дары смерти часть 2"],
        ["Фантастические твари и где они обитают", "фантастические твари"],
        ["Фантастические твари: Преступления Грин-де-Вальда", "фантастические твари преступления грин де вальда"],
        ["Фантастические твари: Тайны Дамблдора", "фантастические твари тайны дамблдора"]
      ]
    },
    {
      key: "alien",
      title: "Чужой",
      query: "чужой",
      note: "Только настоящая франшиза. Без Бена 10, Алиениста и прочего мусора.",
      order: [
        ["Чужой", "чужой 1979"],
        ["Чужие", "чужие 1986"],
        ["Чужой 3", "чужой 3"],
        ["Чужой: Воскрешение", "чужой воскрешение"],
        ["Прометей", "прометей"],
        ["Чужой: Завет", "чужой завет"],
        ["Чужой: Ромул", "чужой ромул"],
        ["Чужой против Хищника", "чужой против хищника"],
        ["Чужие против Хищника: Реквием", "чужие против хищника реквием"]
      ]
    },
    {
      key: "predator",
      title: "Хищник",
      query: "хищник",
      note: "Только основная франшиза и кроссоверы. Без сексуальных predator, National Geographic и прочего мусора.",
      order: [
        ["Хищник", "хищник 1987"],
        ["Хищник 2", "хищник 2"],
        ["Чужой против Хищника", "чужой против хищника"],
        ["Чужие против Хищника: Реквием", "чужие против хищника реквием"],
        ["Хищники", "хищники 2010"],
        ["Хищник", "хищник 2018"],
        ["Добыча", "добыча prey"],
        ["Хищник: Убийца убийц", "хищник убийца убийц"],
        ["Хищник: Планета смерти", "хищник планета смерти"]
      ]
    },
    {
      key: "matrix",
      title: "Матрица",
      query: "матрица",
      note: "Основной порядок.",
      order: [
        ["Матрица", "матрица 1999"],
        ["Аниматрица", "аниматрица"],
        ["Матрица: Перезагрузка", "матрица перезагрузка"],
        ["Матрица: Революция", "матрица революция"],
        ["Матрица: Воскрешение", "матрица воскрешение"]
      ]
    },
    {
      key: "bleach",
      title: "Блич",
      query: "блич",
      note: "Основной сериал, фильмы, затем TYBW.",
      order: [
        ["Блич", "блич"],
        ["Блич: Воспоминания ни о ком", "блич воспоминания ни о ком"],
        ["Блич: Восстание алмазной пыли", "блич восстание алмазной пыли"],
        ["Блич: Уходя в темноту", "блич уходя в темноту"],
        ["Блич: Врата ада", "блич врата ада"],
        ["Блич: Тысячелетняя кровавая война", "блич тысячелетняя кровавая война"]
      ]
    },
    {
      key: "aot",
      title: "Атака титанов",
      query: "атака титанов",
      note: "Сезоны по порядку.",
      order: [
        ["Атака титанов", "атака титанов"],
        ["Атака титанов 2", "атака титанов 2"],
        ["Атака титанов 3", "атака титанов 3"],
        ["Атака титанов: Финал", "атака титанов финал"],
        ["Атака титанов: Последняя атака", "атака титанов последняя атака"]
      ]
    },
    {
      key: "tokyo",
      title: "Токийский гуль",
      query: "токийский гуль",
      note: "Основной порядок.",
      order: [
        ["Токийский гуль", "токийский гуль"],
        ["Токийский гуль √A", "токийский гуль root a"],
        ["Токийский гуль: re", "токийский гуль re"]
      ]
    },
    {
      key: "onepiece",
      title: "Ван-Пис",
      query: "ван-пис",
      note: "Сериал главный, фильмы отдельно после знакомства с командой.",
      order: [
        ["Ван-Пис", "ван-пис"],
        ["One Piece: Strong World", "one piece strong world"],
        ["One Piece Film Z", "one piece film z"],
        ["One Piece Film Gold", "one piece film gold"],
        ["One Piece: Stampede", "one piece stampede"],
        ["One Piece Film Red", "one piece film red"]
      ]
    },
    {
      key: "fast",
      title: "Форсаж",
      query: "форсаж",
      note: "Порядок выхода.",
      order: [
        ["Форсаж", "форсаж"],
        ["Двойной форсаж", "двойной форсаж"],
        ["Тройной форсаж: Токийский дрифт", "тройной форсаж токийский дрифт"],
        ["Форсаж 4", "форсаж 4"],
        ["Форсаж 5", "форсаж 5"],
        ["Форсаж 6", "форсаж 6"],
        ["Форсаж 7", "форсаж 7"],
        ["Форсаж 8", "форсаж 8"],
        ["Хоббс и Шоу", "хоббс шоу"],
        ["Форсаж 9", "форсаж 9"],
        ["Форсаж 10", "форсаж 10"]
      ]
    },
    {
      key: "lotr",
      title: "Властелин колец",
      query: "властелин колец",
      note: "Хронологически: Хоббит → Властелин колец.",
      order: [
        ["Хоббит: Нежданное путешествие", "хоббит нежданное путешествие"],
        ["Хоббит: Пустошь Смауга", "хоббит пустошь смауга"],
        ["Хоббит: Битва пяти воинств", "хоббит битва пяти воинств"],
        ["Властелин колец: Братство кольца", "властелин колец братство кольца"],
        ["Властелин колец: Две крепости", "властелин колец две крепости"],
        ["Властелин колец: Возвращение короля", "властелин колец возвращение короля"],
        ["Кольца власти", "кольца власти"]
      ]
    },
    {
      key: "terminator",
      title: "Терминатор",
      query: "терминатор",
      note: "Лучше смотреть по выходу.",
      order: [
        ["Терминатор", "терминатор"],
        ["Терминатор 2: Судный день", "терминатор 2"],
        ["Терминатор 3: Восстание машин", "терминатор 3"],
        ["Терминатор: Да придёт спаситель", "терминатор да придет спаситель"],
        ["Терминатор: Генезис", "терминатор генезис"],
        ["Терминатор: Тёмные судьбы", "терминатор темные судьбы"]
      ]
    },
    {
      key: "dragonball",
      title: "Драконий жемчуг",
      query: "драконий жемчуг",
      note: "Простой порядок аниме-линии.",
      order: [
        ["Dragon Ball", "dragon ball"],
        ["Dragon Ball Z", "dragon ball z"],
        ["Dragon Ball GT", "dragon ball gt"],
        ["Dragon Ball Kai", "dragon ball kai"],
        ["Dragon Ball Super", "dragon ball super"]
      ]
    },
    {
      key: "fate",
      title: "Fate",
      query: "fate",
      note: "Простой порядок для входа.",
      order: [
        ["Fate/Zero", "fate zero"],
        ["Fate/stay night", "fate stay night"],
        ["Fate/stay night: Unlimited Blade Works", "fate unlimited blade works"],
        ["Fate/stay night: Heaven's Feel", "fate heaven feel"],
        ["Fate/Apocrypha", "fate apocrypha"],
        ["Fate/Grand Order", "fate grand order"]
      ]
    }
  ];

  function esc(v) {
    return String(v || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function findSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function resetSelects() {
    document.querySelectorAll("select").forEach(sel => {
      try {
        sel.selectedIndex = 0;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {}
    });
  }

  function nativeSearch(query) {
    closeOverlay();

    const input = findSearchInput();
    if (input) {
      input.focus();
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    resetSelects();

    setTimeout(() => {
      try {
        if (typeof window.runSearch === "function") {
          window.runSearch(1);
          return;
        }
      } catch (e) {}

      try {
        if (input) {
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
        }
      } catch (e) {}
    }, 80);
  }

  function closeOverlay() {
    document.querySelectorAll(".gkm-v174-overlay").forEach(x => x.remove());
  }

  function panel() {
    let overlay = document.querySelector(".gkm-v174-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "gkm-v174-overlay";
      overlay.innerHTML = `<div class="gkm-v174-panel"></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e => {
        if (e.target === overlay) closeOverlay();
      });
    }
    return overlay.querySelector(".gkm-v174-panel");
  }

  function openHub() {
    const p = panel();
    p.innerHTML = `
      <div class="gkm-v174-head">
        <div>
          <h2>🧬 Франшизы</h2>
          <p>V174: быстро и чисто. Без загрузки всей базы и без мусорных карточек. Тут только порядок просмотра.</p>
        </div>
        <button class="gkm-v174-close">✕</button>
      </div>
      <div class="gkm-v174-grid">
        ${FRANCHISES.map(fr => `
          <button class="gkm-v174-tile" data-fr="${fr.key}">
            <b>${esc(fr.title)}</b>
            <span>Порядок просмотра</span>
          </button>
        `).join("")}
      </div>
    `;

    p.querySelector(".gkm-v174-close").addEventListener("click", closeOverlay);
    p.querySelectorAll("[data-fr]").forEach(btn => {
      btn.addEventListener("click", () => openFranchise(btn.dataset.fr));
    });
  }

  function openFranchise(key) {
    const fr = FRANCHISES.find(x => x.key === key) || FRANCHISES[0];
    const p = panel();

    p.innerHTML = `
      <div class="gkm-v174-head">
        <div>
          <h2>🧬 ${esc(fr.title)}</h2>
          <p>${esc(fr.note)}<br><b>${fr.order.length} пунктов в порядке просмотра.</b></p>
        </div>
        <div class="gkm-v174-actions">
          <button class="gkm-v174-btn" data-back="1">Назад</button>
          <button class="gkm-v174-close">✕</button>
        </div>
      </div>

      <div class="gkm-v174-order-list">
        ${fr.order.map((row, idx) => `
          <div class="gkm-v174-order-row">
            <div class="gkm-v174-num">${idx + 1}</div>
            <div class="gkm-v174-order-title">${esc(row[0])}</div>
            <button class="gkm-v174-small" data-search="${esc(row[1])}">Найти эту часть</button>
          </div>
        `).join("")}
      </div>

      <div class="gkm-v174-bottom">
        <button class="gkm-v174-btn" data-search="${esc(fr.query)}">Открыть обычным поиском</button>
        <span>Обычный поиск может показать лишнее — порядок выше чистый.</span>
      </div>
    `;

    p.querySelector(".gkm-v174-close").addEventListener("click", closeOverlay);
    p.querySelector("[data-back]").addEventListener("click", openHub);
    p.querySelectorAll("[data-search]").forEach(btn => {
      btn.addEventListener("click", () => nativeSearch(btn.dataset.search || ""));
    });
  }

  function addButton() {
    document.querySelectorAll(
      "[data-gkm-v162-franchise-btn],[data-gkm-v163-franchise-btn],[data-gkm-v164-franchise-btn],[data-gkm-v165-franchise-btn],[data-gkm-v166-franchise-btn],[data-gkm-v167-franchise-btn],[data-gkm-v168-franchise-btn],[data-gkm-v172-franchise-btn],[data-gkm-v173-franchise-btn],[data-gkm-v174-franchise-btn]"
    ).forEach(x => x.remove());

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "🧬 Франшизы";
    btn.dataset.gkmV174FranchiseBtn = "1";
    btn.className = "btn gkm-v174-main-btn";
    btn.addEventListener("click", openHub);

    const target = document.querySelector(".tabs")
      || document.querySelector(".nav")
      || document.querySelector(".buttons")
      || document.querySelector(".filter-buttons")
      || document.querySelector(".controls")
      || document.querySelector("header")
      || document.body;

    target.appendChild(btn);
  }

  function addStyles() {
    if (document.querySelector("#gkm-v174-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v174-style";
    style.textContent = `
      .gkm-v174-main-btn,.gkm-v174-btn,.gkm-v174-small,.gkm-v174-tile {
        border:1px solid #00d8ff;
        background:linear-gradient(135deg,#5a25d6,#04c9f4);
        color:#fff;
        border-radius:14px;
        padding:12px 18px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 0 18px rgba(0,216,255,.25);
        margin:6px;
      }
      .gkm-v174-overlay {
        position:fixed;
        inset:0;
        z-index:999999;
        background:rgba(2,4,16,.78);
        backdrop-filter:blur(4px);
        overflow:auto;
        padding:28px;
      }
      .gkm-v174-panel {
        max-width:1450px;
        margin:0 auto;
        color:#fff;
      }
      .gkm-v174-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:16px;
        padding:18px;
        margin:0 0 18px;
        border:1px solid rgba(0,216,255,.35);
        border-radius:18px;
        background:rgba(10,8,35,.94);
        box-shadow:0 0 24px rgba(0,216,255,.12);
      }
      .gkm-v174-head h2 {
        margin:0 0 8px;
        font-size:30px;
        text-shadow:0 0 16px rgba(185,125,255,.65);
      }
      .gkm-v174-head p {
        margin:0;
        color:#cfc9ff;
        line-height:1.45;
      }
      .gkm-v174-close {
        min-width:54px;
        min-height:48px;
        border:1px solid #00d8ff;
        background:linear-gradient(135deg,#5a25d6,#04c9f4);
        color:#fff;
        border-radius:14px;
        font-size:24px;
        font-weight:900;
        cursor:pointer;
      }
      .gkm-v174-actions { display:flex; align-items:center; gap:8px; }
      .gkm-v174-grid {
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
        gap:14px;
      }
      .gkm-v174-tile {
        text-align:left;
        min-height:112px;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }
      .gkm-v174-tile b {
        font-size:22px;
        line-height:1.1;
        margin-bottom:10px;
      }
      .gkm-v174-tile span {
        color:#f0ecff;
        font-size:15px;
      }
      .gkm-v174-order-list {
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .gkm-v174-order-row {
        display:grid;
        grid-template-columns:60px 1fr auto;
        gap:12px;
        align-items:center;
        border:1px solid rgba(0,216,255,.28);
        border-radius:16px;
        background:rgba(10,8,35,.86);
        padding:12px;
      }
      .gkm-v174-num {
        width:44px;
        height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:linear-gradient(135deg,#ffae00,#b13cff);
        color:#fff;
        font-weight:1000;
        font-size:20px;
      }
      .gkm-v174-order-title {
        font-size:19px;
        font-weight:900;
        line-height:1.25;
      }
      .gkm-v174-small {
        margin:0;
      }
      .gkm-v174-bottom {
        margin-top:18px;
        padding:14px;
        border:1px solid rgba(0,216,255,.25);
        border-radius:16px;
        background:rgba(10,8,35,.72);
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:12px;
      }
      .gkm-v174-bottom span {
        color:#cfc9ff;
        font-weight:700;
      }
      @media(max-width:720px) {
        .gkm-v174-overlay { padding:12px; }
        .gkm-v174-head { flex-direction:column; }
        .gkm-v174-grid { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); }
        .gkm-v174-order-row { grid-template-columns:44px 1fr; }
        .gkm-v174-small { grid-column:1 / -1; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    addButton();
    console.log("GKM: v174-fast-clean-franchises-no-garbage-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V174_OPEN_FRANCHISES = openHub;
  window.GKM_V174_CLOSE_FRANCHISES = closeOverlay;
})();
/* GKM V174 FAST CLEAN FRANCHISES END */

/* GKM V175 WATCH ORDER GRID SORT START */
(function () {
  "use strict";

  window.GKM_V175_WATCH_ORDER_GRID_SORT_VERSION = "v175-watch-order-grid-sort-2026-06-24";

  // V175: порядок просмотра применяется к обычной сетке поиска.
  // Без загрузки всей базы. Только сортировка уже найденных карточек.
  // Смысл: поиск "наруто" / "хищник" / "гарри поттер" не должен показывать рандом,
  // а должен переставлять карточки в порядок просмотра.

  const FRANCHISE_RULES = [
    {
      key: "naruto",
      detect: ["наруто", "naruto", "боруто", "boruto"],
      rules: [
        { n: 13, label: "Боруто", must: ["боруто", "boruto"] },
        { n: 12, label: "Последний: Наруто. Фильм", must: ["последний", "the last"] },
        { n: 11, label: "Наруто: Путь ниндзя", must: ["путь", "road to ninja"] },
        { n: 10, label: "Наруто: Кровавая тюрьма", must: ["кровавая", "blood prison"] },
        { n: 9, label: "Наруто: Потерянная башня", must: ["потерянная", "lost tower"] },
        { n: 8, label: "Наруто: Наследники воли огня", must: ["наследники", "will of fire"] },
        { n: 7, label: "Наруто: Узы", must: ["узы", "bonds"] },
        { n: 6, label: "Наруто: Ураганные хроники — Фильм", must: ["ураганные", "фильм"], not: ["узы", "наследники", "потерянная", "кровавая", "путь", "последний"] },
        { n: 5, label: "Наруто: Ураганные хроники", must: ["ураганные хроники", "shippuden"], not: ["фильм", "movie", "узы", "bonds", "наследники", "lost", "tower", "blood", "prison", "road", "путь", "последний"] },
        { n: 4, label: "Наруто: Стражи королевства Полумесяца", must: ["полумесяц", "crescent"] },
        { n: 3, label: "Наруто: Легенда о камне Гелела", must: ["камн", "gelel", "大激突"] },
        { n: 2, label: "Наруто: Битва ниндзя в Стране Снега", must: ["стране снега", "land of snow", "snow", "雪姫"] },
        { n: 1, label: "Наруто", must: ["наруто", "naruto"], not: ["ураганные", "shippuden", "боруто", "boruto", "последний", "the last", "узы", "bonds", "путь", "road", "кровавая", "blood", "потерянная", "lost", "наследники", "will", "стране снега", "snow", "камн", "gelel", "полумесяц", "crescent"] }
      ]
    },
    {
      key: "mcu",
      detect: ["мстители", "avengers", "железный человек", "iron man", "тор", "thor", "первый мститель", "captain america", "стражи галактики", "доктор стрэндж", "человек-паук"],
      rules: [
        { n: 31, label: "Человек-муравей и Оса: Квантомания", must: ["квантомания", "quantumania"] },
        { n: 30, label: "Стражи Галактики. Часть 3", must: ["стражи", "часть 3", "vol. 3", "vol 3"] },
        { n: 29, label: "Чёрная Пантера: Ваканда навеки", must: ["ваканда", "wakanda"] },
        { n: 28, label: "Тор: Любовь и гром", must: ["любовь", "гром", "love", "thunder"] },
        { n: 27, label: "Доктор Стрэндж: В мультивселенной безумия", must: ["мультивселен", "madness"] },
        { n: 26, label: "Человек-паук: Нет пути домой", must: ["нет пути домой", "no way home"] },
        { n: 25, label: "Вечные", must: ["вечные", "eternals"] },
        { n: 24, label: "Шан-Чи", must: ["шан-чи", "shang-chi"] },
        { n: 23, label: "Чёрная вдова", must: ["черная вдова", "чёрная вдова", "black widow"] },
        { n: 22, label: "Человек-паук: Вдали от дома", must: ["вдали от дома", "far from home"] },
        { n: 21, label: "Мстители: Финал", must: ["финал", "endgame"] },
        { n: 20, label: "Капитан Марвел", must: ["капитан марвел", "captain marvel"] },
        { n: 19, label: "Человек-муравей и Оса", must: ["человек-муравей и оса", "человек муравей и оса", "ant-man and the wasp"], not: ["квантомания", "quantumania"] },
        { n: 18, label: "Мстители: Война бесконечности", must: ["война бесконечности", "infinity war"] },
        { n: 17, label: "Чёрная Пантера", must: ["черная пантера", "чёрная пантера", "black panther"], not: ["ваканда", "wakanda"] },
        { n: 16, label: "Тор: Рагнарёк", must: ["рагнарек", "ragnarok"] },
        { n: 15, label: "Человек-паук: Возвращение домой", must: ["возвращение домой", "homecoming"] },
        { n: 14, label: "Стражи Галактики. Часть 2", must: ["стражи", "часть 2", "vol. 2", "vol 2"] },
        { n: 13, label: "Доктор Стрэндж", must: ["доктор стрэндж", "doctor strange"], not: ["мультивселен", "madness"] },
        { n: 12, label: "Первый мститель: Противостояние", must: ["противостояние", "civil war"] },
        { n: 11, label: "Мстители: Эра Альтрона", must: ["эра альтрона", "age of ultron"] },
        { n: 10, label: "Стражи Галактики", must: ["стражи галактики", "guardians of the galaxy"], not: ["часть 2", "vol. 2", "vol 2", "часть 3", "vol. 3", "vol 3"] },
        { n: 9, label: "Первый мститель: Другая война", must: ["другая война", "winter soldier"] },
        { n: 8, label: "Тор 2: Царство тьмы", must: ["царство тьмы", "dark world", "тор 2", "thor 2"] },
        { n: 7, label: "Железный человек 3", must: ["железный человек 3", "iron man 3"] },
        { n: 6, label: "Мстители", must: ["мстители", "avengers"], not: ["эра", "альтрона", "война", "бесконечности", "финал", "endgame", "ultron", "infinity", "команда", "величайшие"] },
        { n: 5, label: "Первый мститель", must: ["первый мститель", "captain america"], not: ["другая", "противостояние", "winter", "civil"] },
        { n: 4, label: "Тор", must: ["тор", "thor"], not: ["рагнарек", "ragnarok", "царство", "dark world", "любовь", "thunder"] },
        { n: 3, label: "Железный человек 2", must: ["железный человек 2", "iron man 2"] },
        { n: 2, label: "Невероятный Халк", must: ["невероятный халк", "incredible hulk"] },
        { n: 1, label: "Железный человек", must: ["железный человек", "iron man"], not: [" 2", " 3", "2", "3"] }
      ]
    },
    {
      key: "harry",
      detect: ["гарри поттер", "harry potter", "фантастические твари"],
      rules: [
        { n: 11, label: "Фантастические твари: Тайны Дамблдора", must: ["тайны дамблдора", "secrets of dumbledore"] },
        { n: 10, label: "Фантастические твари: Преступления Грин-де-Вальда", must: ["преступления", "grindelwald"] },
        { n: 9, label: "Фантастические твари", must: ["фантастические твари", "fantastic beasts"] },
        { n: 8, label: "Дары смерти: Часть 2", must: ["дары смерти часть 2", "deathly hallows part 2"] },
        { n: 7, label: "Дары смерти: Часть 1", must: ["дары смерти часть 1", "deathly hallows part 1"] },
        { n: 6, label: "Принц-полукровка", must: ["принц-полукровка", "принц полукровка", "half-blood"] },
        { n: 5, label: "Орден Феникса", must: ["орден феникса", "order of the phoenix"] },
        { n: 4, label: "Кубок огня", must: ["кубок огня", "goblet"] },
        { n: 3, label: "Узник Азкабана", must: ["узник азкабана", "prisoner"] },
        { n: 2, label: "Тайная комната", must: ["тайная комната", "chamber"] },
        { n: 1, label: "Философский камень", must: ["философ", "philosopher", "sorcerer", "камень"] }
      ]
    },
    {
      key: "predator",
      detect: ["хищник", "predator", "predators", "prey", "добыча"],
      rules: [
        { n: 9, label: "Хищник: Планета смерти", must: ["планета смерти", "badlands"] },
        { n: 8, label: "Хищник: Убийца убийц", must: ["убийца убийц", "killer of killers"] },
        { n: 7, label: "Добыча", must: ["добыча", "prey"] },
        { n: 6, label: "Хищник", must: ["хищник", "the predator"], not: [" 2", "2", "против", "убийца", "планета", "реквием", "добыча", "prey", "predators"] },
        { n: 5, label: "Хищники", must: ["хищники", "predators"], not: ["sexual", "fail", "moments", "crucified"] },
        { n: 4, label: "Чужие против Хищника: Реквием", must: ["реквием", "requiem"] },
        { n: 3, label: "Чужой против Хищника", must: ["чужой против хищника", "alien vs predator", "avp"], not: ["реквием"] },
        { n: 2, label: "Хищник 2", must: ["хищник 2", "predator 2"] },
        { n: 1, label: "Хищник", must: ["хищник", "predator"], not: [" 2", "2", "против", "убийца", "планета", "реквием", "добыча", "prey", "predators", "sexual", "fail", "moments", "crucified", "последний крик"] }
      ],
      garbage: ["sexual predator", "predator fail", "predators moments", "predators crucified", "последний крик", "national geographic"]
    },
    {
      key: "alien",
      detect: ["чужой", "alien", "aliens", "прометей", "prometheus", "ромул", "romulus"],
      rules: [
        { n: 9, label: "Чужие против Хищника: Реквием", must: ["реквием", "requiem"] },
        { n: 8, label: "Чужой против Хищника", must: ["чужой против хищника", "alien vs predator", "avp"], not: ["реквием"] },
        { n: 7, label: "Чужой: Ромул", must: ["ромул", "romulus"] },
        { n: 6, label: "Чужой: Завет", must: ["завет", "covenant"] },
        { n: 5, label: "Прометей", must: ["прометей", "prometheus"] },
        { n: 4, label: "Чужой: Воскрешение", must: ["воскрешение", "resurrection"] },
        { n: 3, label: "Чужой 3", must: ["чужой 3", "alien 3"] },
        { n: 2, label: "Чужие", must: ["чужие", "aliens"], not: ["против"] },
        { n: 1, label: "Чужой", must: ["чужой", "alien"], not: ["против", "воскрешение", "завет", "ромул", "земля", "3", "prometheus", "covenant", "romulus"] }
      ],
      garbage: ["бен 10", "ben 10", "алиенист", "alienist", "ancient aliens", "древние пришельцы"]
    },
    {
      key: "matrix",
      detect: ["матрица", "matrix"],
      rules: [
        { n: 5, label: "Матрица: Воскрешение", must: ["воскрешение", "resurrections"] },
        { n: 4, label: "Матрица: Революция", must: ["революция", "revolutions"] },
        { n: 3, label: "Матрица: Перезагрузка", must: ["перезагрузка", "reloaded"] },
        { n: 2, label: "Аниматрица", must: ["аниматрица", "animatrix"] },
        { n: 1, label: "Матрица", must: ["матрица", "the matrix"], not: ["времени", "перезагрузка", "революция", "воскрешение"] }
      ]
    },
    {
      key: "fast",
      detect: ["форсаж", "fast furious", "fast & furious", "fast x"],
      rules: [
        { n: 11, label: "Форсаж 10", must: ["форсаж 10", "fast x"] },
        { n: 10, label: "Форсаж 9", must: ["форсаж 9", "f9"] },
        { n: 9, label: "Хоббс и Шоу", must: ["хоббс", "hobbs", "shaw"] },
        { n: 8, label: "Форсаж 8", must: ["форсаж 8", "fate of the furious"] },
        { n: 7, label: "Форсаж 7", must: ["форсаж 7", "furious 7"] },
        { n: 6, label: "Форсаж 6", must: ["форсаж 6"] },
        { n: 5, label: "Форсаж 5", must: ["форсаж 5", "fast five"] },
        { n: 4, label: "Форсаж 4", must: ["форсаж 4"] },
        { n: 3, label: "Токийский дрифт", must: ["токийский дрифт", "tokyo drift"] },
        { n: 2, label: "Двойной форсаж", must: ["двойной", "2 fast"] },
        { n: 1, label: "Форсаж", must: ["форсаж", "fast furious"], not: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "x", "хоббс", "shaw"] }
      ]
    }
  ];

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"']/g, "")
      .replace(/[^\p{L}\p{N}:&/\-. ]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function getQuery() {
    const input = getSearchInput();
    return norm(input && input.value);
  }

  function detectFranchise() {
    const q = getQuery();
    if (!q) return null;
    return FRANCHISE_RULES.find(fr => fr.detect.some(x => q.includes(norm(x))));
  }

  function hasAny(text, list) {
    return (list || []).some(x => text.includes(norm(x)));
  }

  function isGarbage(text, fr) {
    return hasAny(text, fr.garbage || []);
  }

  function scoreText(text, fr) {
    if (isGarbage(text, fr)) return { score: 99999, label: "", garbage: true };

    for (const rule of fr.rules) {
      if (hasAny(text, rule.must) && !hasAny(text, rule.not || [])) {
        return { score: rule.n, label: rule.label, garbage: false };
      }
    }

    return { score: 9999, label: "", garbage: false };
  }

  function isCard(el) {
    if (!el || el.nodeType !== 1) return false;
    const text = norm(el.textContent);
    if (text.length < 25 || text.length > 1100) return false;
    return !!el.querySelector("img") && (
      text.includes("★") ||
      text.includes("фильм") ||
      text.includes("аниме") ||
      text.includes("сериал") ||
      text.includes("мультфильм")
    );
  }

  function findGrid() {
    const possible = Array.from(document.querySelectorAll("main,#results,#catalog,.grid,.cards,.results,section,div"));
    let best = null;
    let bestCards = [];

    for (const el of possible) {
      const cards = Array.from(el.children || []).filter(isCard);
      if (cards.length > bestCards.length) {
        best = el;
        bestCards = cards;
      }
    }

    return bestCards.length >= 2 ? { grid: best, cards: bestCards } : null;
  }

  function addBadge(card, n, label) {
    card.querySelectorAll(".gkm-v175-order-badge,.gkm-v173-order-badge,.gkm-v171-order-badge,.gkm-v170-order-badge,.gkm-v169-order-badge").forEach(x => x.remove());

    const badge = document.createElement("div");
    badge.className = "gkm-v175-order-badge";
    badge.textContent = "#" + n + " смотреть";

    card.style.position = card.style.position || "relative";
    card.appendChild(badge);
    card.title = "Порядок просмотра: " + n + ". " + label;
  }

  function clearOldBadges(card) {
    card.querySelectorAll(".gkm-v175-order-badge,.gkm-v173-order-badge,.gkm-v171-order-badge,.gkm-v170-order-badge,.gkm-v169-order-badge").forEach(x => x.remove());
  }

  function applyOrder() {
    const fr = detectFranchise();
    const found = findGrid();

    if (!found) return;

    // Если запрос не франшизный — просто убираем старые бейджи.
    if (!fr) {
      found.cards.forEach(clearOldBadges);
      return;
    }

    const rows = found.cards.map((card, idx) => {
      const text = norm(card.textContent || "");
      const s = scoreText(text, fr);
      return { card, idx, score: s.score, label: s.label, garbage: s.garbage };
    });

    const matched = rows.filter(r => r.score < 9999);
    if (!matched.length) return;

    rows.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.idx - b.idx;
    });

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);

    rows.forEach(r => {
      clearOldBadges(r.card);

      if (r.score < 9999) {
        addBadge(r.card, r.score, r.label);
      }

      // Мусор полностью не удаляем, но гасим и кидаем в самый низ.
      if (r.garbage) {
        r.card.style.opacity = "0.35";
        r.card.style.filter = "grayscale(0.8)";
        r.card.title = "Похоже на мусорный результат, не часть франшизы";
      } else {
        r.card.style.opacity = "";
        r.card.style.filter = "";
      }
    });

    console.log("GKM V175 order applied:", fr.key, matched.map(x => [x.score, x.label]));
  }

  function addStyles() {
    if (document.querySelector("#gkm-v175-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v175-style";
    style.textContent = `
      .gkm-v175-order-badge {
        position:absolute;
        left:8px;
        top:42px;
        z-index:45;
        padding:7px 10px;
        border-radius:999px;
        background:linear-gradient(135deg,#ffae00,#b13cff);
        color:#fff;
        font-weight:1000;
        font-size:13px;
        line-height:1;
        box-shadow:0 0 14px rgba(255,160,0,.45);
        pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  }

  function schedule() {
    clearTimeout(window.__gkmV175Timer);
    window.__gkmV175Timer = setTimeout(applyOrder, 300);
  }

  function init() {
    addStyles();

    document.addEventListener("input", schedule, true);
    document.addEventListener("change", schedule, true);
    document.addEventListener("click", schedule, true);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(schedule, 500);
    setTimeout(schedule, 1200);
    setTimeout(schedule, 2200);

    console.log("GKM: v175-watch-order-grid-sort-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V175_APPLY_WATCH_ORDER_GRID_SORT = applyOrder;
})();
/* GKM V175 WATCH ORDER GRID SORT END */

/* GKM V191 SMART CATALOG SEARCH START */
(function () {
  "use strict";

  window.GKM_V191_SMART_CATALOG_SEARCH_VERSION = "v191-smart-catalog-search-all-features-2026-06-24";

  /*
    V191 — стоящая фича без лишних кнопок:
    1) Умная выдача по умолчанию:
       - популярное выше;
       - мусор ниже;
       - без постера ниже;
       - 10.0 при 2 голосах ниже;
       - короткие левые названия ниже.
    2) Умный поиск RU/EN:
       - Naruto/Наруто, Avengers/Мстители, Harry Potter/Гарри Поттер и т.д.;
       - частые опечатки и транслит.
    3) Анти-дубли:
       - одинаковое название+год+тип оставляет лучший вариант выше;
       - дубли мягко уводятся вниз.
    4) Похожие в модалке:
       - мусор и другой тип приглушаются/уходят вниз.
    5) Никаких новых кнопок, ничего не засоряет верх сайта.
  */

  const LS_DISABLED = "GKM_V191_DISABLED";
  const VERSION_TEXT = "v191-smart-catalog-search-all-features-2026-06-24";

  const SEARCH_ALIASES = [
    ["наруто", "naruto"],
    ["нарута", "naruto"],
    ["naruto", "наруто"],
    ["боруто", "boruto"],
    ["boruto", "боруто"],
    ["блич", "bleach"],
    ["bleach", "блич"],
    ["ван пис", "one piece"],
    ["ван-пис", "one piece"],
    ["one piece", "ван пис"],
    ["атака титанов", "attack on titan"],
    ["атака титан", "attack on titan"],
    ["attack on titan", "атака титанов"],
    ["токийский гуль", "tokyo ghoul"],
    ["tokyo ghoul", "токийский гуль"],
    ["тетрадь смерти", "death note"],
    ["death note", "тетрадь смерти"],
    ["стальной алхимик", "fullmetal alchemist"],
    ["fullmetal alchemist", "стальной алхимик"],
    ["охотник х охотник", "hunter x hunter"],
    ["хантер хантер", "hunter x hunter"],
    ["hunter x hunter", "охотник х охотник"],
    ["клинок рассекающий демонов", "demon slayer"],
    ["истребитель демонов", "demon slayer"],
    ["demon slayer", "истребитель демонов"],
    ["магическая битва", "jujutsu kaisen"],
    ["jujutsu kaisen", "магическая битва"],
    ["моя геройская академия", "my hero academia"],
    ["my hero academia", "моя геройская академия"],

    ["мстители", "avengers"],
    ["avengers", "мстители"],
    ["мстители финал", "avengers endgame"],
    ["avengers endgame", "мстители финал"],
    ["война бесконечности", "infinity war"],
    ["infinity war", "война бесконечности"],
    ["железный человек", "iron man"],
    ["iron man", "железный человек"],
    ["капитан америка", "captain america"],
    ["captain america", "капитан америка"],
    ["тор", "thor"],
    ["thor", "тор"],
    ["человек паук", "spider-man"],
    ["человек-паук", "spider-man"],
    ["spider man", "человек паук"],
    ["spider-man", "человек паук"],
    ["доктор стрэндж", "doctor strange"],
    ["doctor strange", "доктор стрэндж"],
    ["стражи галактики", "guardians of the galaxy"],
    ["guardians of the galaxy", "стражи галактики"],
    ["черная пантера", "black panther"],
    ["чёрная пантера", "black panther"],
    ["black panther", "черная пантера"],

    ["гарри поттер", "harry potter"],
    ["гари потер", "harry potter"],
    ["гари поттер", "harry potter"],
    ["гарри потер", "harry potter"],
    ["harry potter", "гарри поттер"],
    ["философский камень", "philosopher stone sorcerer stone"],
    ["тайная комната", "chamber of secrets"],
    ["узник азкабана", "prisoner of azkaban"],
    ["кубок огня", "goblet of fire"],
    ["орден феникса", "order of the phoenix"],
    ["принц полукровка", "half-blood prince"],
    ["дары смерти", "deathly hallows"],

    ["матрица", "matrix"],
    ["matrix", "матрица"],
    ["властелин колец", "lord of the rings"],
    ["lord of the rings", "властелин колец"],
    ["хоббит", "hobbit"],
    ["hobbit", "хоббит"],
    ["звездные войны", "star wars"],
    ["звёздные войны", "star wars"],
    ["star wars", "звездные войны"],
    ["форсаж", "fast furious"],
    ["fast furious", "форсаж"],
    ["терминатор", "terminator"],
    ["terminator", "терминатор"],
    ["чужой", "alien"],
    ["alien", "чужой"],
    ["хищник", "predator"],
    ["predator", "хищник"],
    ["пила", "saw"],
    ["saw", "пила"],
    ["заклятие", "conjuring"],
    ["conjuring", "заклятие"],
    ["тихое место", "quiet place"],
    ["quiet place", "тихое место"],
    ["пираты карибского моря", "pirates of the caribbean"],
    ["pirates of the caribbean", "пираты карибского моря"],
    ["парк юрского периода", "jurassic park"],
    ["мир юрского периода", "jurassic world"],
    ["jurassic", "юрский период"],
    ["драконий жемчуг", "dragon ball"],
    ["dragon ball", "драконий жемчуг"]
  ];

  const TYPO_FIXES = [
    [/гар+и\s+пот+ер+/g, "гарри поттер"],
    [/гари\s+поттер/g, "гарри поттер"],
    [/гарри\s+потер/g, "гарри поттер"],
    [/нарута/g, "наруто"],
    [/мстител[ие]?\s+финал/g, "мстители финал"],
    [/человек\s*паук/g, "человек паук"],
    [/ван\s*пис/g, "ван пис"],
    [/атака\s+титан(?!ов)/g, "атака титанов"],
    [/токийский\s+гул/g, "токийский гуль"]
  ];

  function isDisabled() {
    try { return localStorage.getItem(LS_DISABLED) === "1"; } catch (e) { return false; }
  }

  function safe(name, fn) {
    if (isDisabled()) return null;
    try { return fn(); } catch (e) { console.warn("GKM V191:", name, e); return null; }
  }

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"']/g, "")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/[^a-zа-я0-9\s:.\-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compact(v) {
    return norm(v).replace(/[^a-zа-я0-9]/g, "");
  }

  function text(el) {
    return String(el && el.textContent || "");
  }

  function getSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function parseRating(card) {
    const t = text(card);
    const m = t.match(/★\s*([0-9]+(?:[.,][0-9]+)?)/) || t.match(/рейтинг[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
    const n = m ? parseFloat(m[1].replace(",", ".")) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function parseVotes(card) {
    const t = text(card).replace(/\u00a0/g, " ");
    const m = t.match(/([0-9]+(?:[.,][0-9]+)?)\s*(млн|тыс|голос)/i);
    if (!m) return 0;
    let n = parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(n)) return 0;
    const u = String(m[2] || "").toLowerCase();
    if (u.includes("млн")) n *= 1000000;
    else if (u.includes("тыс")) n *= 1000;
    return Math.round(n);
  }

  function parseYear(card) {
    const m = text(card).match(/\b(19[0-9]{2}|20[0-9]{2}|203[0-9])\b/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function hasPoster(card) {
    if (norm(text(card)).includes("нет постера")) return false;
    const img = card.querySelector("img");
    if (!img) return false;
    const src = String(img.currentSrc || img.src || img.getAttribute("src") || "");
    if (!src) return false;
    return !src.includes("placeholder") && !src.includes("data:image/svg");
  }

  function titleOf(card) {
    const sels = [".title", ".card-title", ".movie-title", ".name", "[class*='title']", "h3", "h2", "b", "strong"];
    for (const s of sels) {
      const el = card.querySelector(s);
      const v = el && String(el.textContent || "").trim();
      if (v && v.length > 1 && v.length < 120 && !/^(фильм|аниме|сериал|мультфильм)$/i.test(v)) return v;
    }

    const lines = String(card.textContent || "").split("\n").map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length > 1 && line.length < 90 && !line.includes("★") && !/^\d{4}/.test(line)) return line;
    }
    return "Без названия";
  }

  function typeOf(card) {
    const t = norm(text(card));
    if (t.includes("аниме")) return "anime";
    if (t.includes("мультсериал")) return "cartoon_series";
    if (t.includes("мультфильм")) return "cartoon";
    if (t.includes("сериал")) return "series";
    if (t.includes("фильм")) return "movie";
    return "";
  }

  function genreTokens(card) {
    const t = norm(text(card));
    const known = ["боевик","комедия","драма","криминал","фантастика","фэнтези","ужасы","триллер","детектив","приключения","мелодрама","документальный","история","спорт","военный","семейный","экшен"];
    return known.filter(g => t.includes(g));
  }

  function isVisibleBasic(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 70 && r.height > 100 && st.display !== "none" && st.visibility !== "hidden";
  }

  function isCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && (
      el.closest(".gkm-v191-badge") ||
      el.closest(".gkm-v191-panel") ||
      el.closest(".gkm-v191-toast")
    )) return false;

    const t = norm(el.textContent);
    if (t.length < 18 || t.length > 1900) return false;
    if (!el.querySelector("img")) return false;
    if (!(t.includes("★") || t.includes("фильм") || t.includes("аниме") || t.includes("сериал") || t.includes("мультфильм"))) return false;

    return isVisibleBasic(el);
  }

  function allCards() {
    const selectors = [
      "article", ".card", ".movie-card", ".item", ".catalog-card", ".poster-card",
      "[class*='card']", "[class*='movie']", "[class*='item']",
      "main div", "section div"
    ].join(",");

    const raw = Array.from(document.querySelectorAll(selectors)).filter(isCard);
    const filtered = raw.filter(c => !raw.some(o => o !== c && o.contains(c) && isCard(o)));
    return Array.from(new Set(filtered)).slice(0, 5000);
  }

  function findMainGrid() {
    const cs = allCards();
    if (!cs.length) return null;

    const parents = new Map();
    cs.forEach(c => {
      const p = c.parentElement;
      if (p) parents.set(p, (parents.get(p) || 0) + 1);
    });

    let best = null, max = 0;
    parents.forEach((n, p) => {
      if (n > max) { max = n; best = p; }
    });

    if (!best) return null;
    return { grid: best, cards: cs.filter(c => c.parentElement === best) };
  }

  function titleKey(card) {
    let t = norm(titleOf(card));

    // Убираем мусорные хвосты, которые часто плодят дубли.
    t = t
      .replace(/\b\d{4}\b/g, "")
      .replace(/\b(фильм|сериал|аниме|мультфильм|мультсериал)\b/g, "")
      .replace(/\bhd\b|\bfull\b|\bseason\b|\bсезон\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return compact(t);
  }

  function trashPenalty(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const title = norm(titleOf(card));
    let p = 0;

    if (!hasPoster(card)) p += 900;
    if (r >= 9.8 && v < 100) p += 1200;
    if (r >= 9.5 && v < 500) p += 550;
    if (v > 0 && v <= 10) p += 700;
    if (v > 0 && v < 50) p += 300;
    if (title.length <= 2) p += 900;
    if (/^[a-z0-9]{1,3}$/.test(title)) p += 900;
    if (title.includes("untitled") || title.includes("без названия")) p += 400;
    if (norm(text(card)).includes("жанры не указаны")) p += 160;

    return p;
  }

  function qualityScore(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const y = parseYear(card);
    let s = 0;

    s += hasPoster(card) ? 700 : -500;
    s += Math.min(v, 3000000) / 3500;
    s += r * 85;

    if (y >= 2020) s += 40;
    if (y >= 2026 && v < 100) s -= 200;

    s -= trashPenalty(card);

    return s;
  }

  function dedupePenalty(card, seen) {
    const key = [titleKey(card), parseYear(card), typeOf(card)].join("|");
    if (!key || key.length < 5) return 0;

    if (!seen[key]) {
      seen[key] = 1;
      return 0;
    }

    seen[key]++;
    return 7000 + seen[key] * 20;
  }

  function sortGridSmart() {
    const found = findMainGrid();
    if (!found || !found.cards.length) return;

    const seen = Object.create(null);
    const rows = found.cards.map((card, idx) => {
      const score = qualityScore(card) - dedupePenalty(card, seen);
      return { card, idx, score };
    });

    rows.sort((a,b) => (b.score - a.score) || (a.idx - b.idx));

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);

    rows.forEach(r => {
      const isTrash = trashPenalty(r.card) >= 700;
      r.card.classList.toggle("gkm-v191-soft-trash", isTrash);
      r.card.dataset.gkmV191Score = String(Math.round(r.score));
    });
  }

  function currentQuery() {
    const input = getSearchInput();
    return input ? String(input.value || "").trim() : "";
  }

  function fixedQuery(q) {
    let x = norm(q);
    for (const [rx, repl] of TYPO_FIXES) x = x.replace(rx, repl);
    return x.trim();
  }

  function queryVariants(q) {
    const base = fixedQuery(q);
    const out = new Set();

    if (base) out.add(base);

    for (const [from, to] of SEARCH_ALIASES) {
      const nf = norm(from);
      if (!nf) continue;
      if (base === nf || base.includes(nf) || nf.includes(base)) {
        String(to).split("|").forEach(v => out.add(norm(v)));
      }
    }

    // Разбиваем английские запросы вроде harry potter philosopher
    if (base.includes("harry") && base.includes("potter")) out.add("гарри поттер");
    if (base.includes("avengers")) out.add("мстители");
    if (base.includes("naruto")) out.add("наруто");
    if (base.includes("dragon") && base.includes("ball")) out.add("драконий жемчуг");

    return Array.from(out).filter(Boolean).slice(0, 12);
  }

  function searchBoostScore(card, variants) {
    if (!variants || !variants.length) return 0;

    const t = norm(text(card));
    const title = norm(titleOf(card));
    const cTitle = compact(title);
    let s = 0;

    variants.forEach(q => {
      const cq = compact(q);
      if (!q || !cq) return;

      if (title === q) s += 100000;
      else if (title.includes(q)) s += 60000;
      else if (q.includes(title) && title.length > 3) s += 30000;
      else if (cTitle.includes(cq)) s += 26000;
      else if (t.includes(q)) s += 12000;
      else if (compact(t).includes(cq)) s += 8000;
    });

    return s;
  }

  function sortSearchSmart() {
    const q = currentQuery();
    if (!q || q.length < 2) return sortGridSmart();

    const found = findMainGrid();
    if (!found || !found.cards.length) return;

    const variants = queryVariants(q);
    const seen = Object.create(null);

    const rows = found.cards.map((card, idx) => {
      let score = qualityScore(card);
      score += searchBoostScore(card, variants);
      score -= dedupePenalty(card, seen);

      // Если есть запрос и карточка вообще не похожа — вниз.
      if (searchBoostScore(card, variants) <= 0) score -= 25000;

      return { card, idx, score };
    });

    rows.sort((a,b) => (b.score - a.score) || (a.idx - b.idx));

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);

    rows.forEach((r, i) => {
      r.card.classList.toggle("gkm-v191-soft-trash", trashPenalty(r.card) >= 700);
      r.card.classList.toggle("gkm-v191-search-best", i < 3 && searchBoostScore(r.card, variants) > 0);
      r.card.dataset.gkmV191Score = String(Math.round(r.score));
    });

    showSearchHint(q, variants);
  }

  function showSearchHint(q, variants) {
    if (!q || !variants || variants.length <= 1) return;

    let box = document.querySelector(".gkm-v191-search-hint");
    if (!box) {
      box = document.createElement("div");
      box.className = "gkm-v191-search-hint";
      const input = getSearchInput();
      const parent = input && input.parentElement;
      if (parent) parent.appendChild(box);
      else document.body.appendChild(box);
    }

    const visible = variants.filter(v => v !== norm(q)).slice(0, 4);
    if (!visible.length) {
      box.remove();
      return;
    }

    box.textContent = "Умный поиск: " + visible.join(" · ");
  }

  function improveSimilarModal() {
    const modals = Array.from(document.querySelectorAll("[role='dialog'],.modal,.popup,.overlay,dialog"))
      .filter(el => {
        const st = getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden" && el.getBoundingClientRect().height > 120;
      });

    if (!modals.length) return;

    modals.forEach(modal => {
      const modalCards = Array.from(modal.querySelectorAll("article,.card,.movie-card,.item,[class*='card'],[class*='movie'],[class*='item'],div"))
        .filter(isCard);

      if (modalCards.length < 2) return;

      const headText = norm(text(modal).slice(0, 2500));
      let wanted = "";
      if (headText.includes("аниме")) wanted = "anime";
      else if (headText.includes("мультфильм")) wanted = "cartoon";
      else if (headText.includes("сериал")) wanted = "series";
      else if (headText.includes("фильм")) wanted = "movie";

      modalCards.forEach(card => {
        const wrongType = wanted && typeOf(card) && typeOf(card) !== wanted;
        const bad = wrongType || trashPenalty(card) >= 700;
        card.classList.toggle("gkm-v191-similar-down", bad);
      });
    });
  }

  function cleanOldBadUI() {
    [
      ".gkm-v184-quickbar",".gkm-v185-quickbar",".gkm-v186-quickbar",".gkm-v187-quickbar",
      ".gkm-v184-panel",".gkm-v185-panel",".gkm-v186-panel",".gkm-v187-panel",
      ".gkm-v184-folder-btn",".gkm-v185-folder-btn",".gkm-v186-folder-btn",".gkm-v187-folder-btn",
      ".gkm-v184-folder-menu",".gkm-v185-folder-menu",".gkm-v186-folder-menu",".gkm-v187-folder-menu",
      ".gkm-v184-mini",".gkm-v185-mini",".gkm-v186-mini",".gkm-v187-mini"
    ].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { try { el.remove(); } catch(e) {} });
    });

    document.querySelectorAll(".gkm-v184-hidden,.gkm-v185-hidden,.gkm-v186-hidden,.gkm-v187-hidden").forEach(el => {
      el.classList.remove("gkm-v184-hidden","gkm-v185-hidden","gkm-v186-hidden","gkm-v187-hidden");
      el.style.removeProperty("display");
    });
  }

  function addBadge() {
    // GKM V194: badge disabled, smart logic stays enabled.
    document.querySelectorAll(".gkm-v191-badge,.gkm-v192-clickable-badge").forEach(function(el){ try { el.remove(); } catch(e){} });
    return;
  }

  function addStyles() {
    if (document.querySelector("#gkm-v191-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v191-style";
    style.textContent = `
      .gkm-v191-soft-trash {
        opacity:.78;
      }
      .gkm-v191-similar-down {
        opacity:.45;
        filter:grayscale(.65);
        order:9999;
      }
      .gkm-v191-search-best {
        outline:2px solid rgba(0,216,255,.65);
        box-shadow:0 0 18px rgba(0,216,255,.22);
      }
      .gkm-v191-badge {
        position:fixed;
        right:14px;
        bottom:86px;
        z-index:99990;
        padding:8px 11px;
        border:1px solid rgba(0,216,255,.55);
        border-radius:999px;
        background:linear-gradient(135deg,rgba(87,36,214,.9),rgba(0,190,230,.9));
        color:#fff;
        font-weight:900;
        font-size:12px;
        box-shadow:0 0 18px rgba(0,216,255,.25);
        cursor:default;
        user-select:none;
      }
      .gkm-v191-search-hint {
        margin-top:6px;
        color:#aeefff;
        font-size:12px;
        font-weight:800;
        opacity:.9;
      }
      @media(max-width:760px) {
        .gkm-v191-badge {display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function run() {
    cleanOldBadUI();
    addStyles();
    addBadge();

    const q = currentQuery();
    if (q && q.length >= 2) sortSearchSmart();
    else sortGridSmart();

    improveSimilarModal();
  }

  function schedule() {
    clearTimeout(window.__gkmV191Timer);
    window.__gkmV191Timer = setTimeout(function () {
      safe("run", run);
    }, 500);
  }

  function init() {
    try {
      ["GKM_V184_STATE","GKM_V184_QUICK_FILTER","GKM_V185_QUICK_FILTER","GKM_V186_QUICK_FILTER","GKM_V187_QUICK_FILTER"].forEach(k => localStorage.removeItem(k));
    } catch(e) {}

    addStyles();
    addBadge();

    document.addEventListener("input", schedule, true);
    document.addEventListener("change", schedule, true);
    document.addEventListener("click", schedule, true);

    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList:true, subtree:true });

    setTimeout(schedule, 700);
    setTimeout(schedule, 1700);
    setTimeout(schedule, 3200);

    console.log("GKM: " + VERSION_TEXT);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V191_APPLY = function () { return safe("manual", run); };
  window.GKM_V191_QUERY_VARIANTS = queryVariants;
  window.GKM_V191_DISABLE = function () { localStorage.setItem(LS_DISABLED, "1"); location.reload(); };
  window.GKM_V191_ENABLE = function () { localStorage.removeItem(LS_DISABLED); location.reload(); };
})();
/* GKM V191 SMART CATALOG SEARCH END */

/* GKM V194 KILL V191 BADGE START */
(function () {
  "use strict";

  window.GKM_V194_KILL_V191_BADGE_VERSION = "v194-kill-v191-badge-keep-smart-2026-06-24";

  /*
    V194:
    - Жёстко убирает старую плашку V191.
    - Отключает её повторное появление.
    - Умная выдача/поиск V191 остаются.
    - Авто-спасение 0 результатов остаётся.
  */

  const ALIAS_HINTS = [
    "наруто","naruto","боруто","boruto","блич","bleach","ван пис","one piece",
    "атака титанов","attack on titan","токийский гуль","tokyo ghoul",
    "тетрадь смерти","death note","драконий жемчуг","dragon ball",
    "мстители","avengers","гарри поттер","harry potter","человек паук","spider",
    "матрица","matrix","чужой","alien","хищник","predator"
  ];

  function norm(v) {
    return String(v || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  }

  function getSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function currentQuery() {
    const input = getSearchInput();
    return input ? norm(input.value) : "";
  }

  function looksZeroResults() {
    const t = norm(document.body && document.body.textContent || "");
    return t.includes("найдено: 0") || t.includes("найдено 0");
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 20 && r.height > 15 && st.display !== "none" && st.visibility !== "hidden";
  }

  function findAllButton() {
    const candidates = Array.from(document.querySelectorAll("button,a,[role='button'],.btn,div,span"))
      .filter(isVisible)
      .filter(el => norm(el.textContent) === "все");

    candidates.sort((a,b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });

    return candidates[0] || null;
  }

  function queryLooksKnown(q) {
    if (!q) return false;
    return ALIAS_HINTS.some(x => q.includes(norm(x)) || norm(x).includes(q));
  }

  function killBadge() {
    document.querySelectorAll(".gkm-v191-badge,.gkm-v192-clickable-badge,.gkm-v192-toast,.gkm-v193-toast").forEach(el => {
      try { el.remove(); } catch(e) {}
    });
  }

  function applySmart() {
    killBadge();
    try {
      if (typeof window.GKM_V191_APPLY === "function") window.GKM_V191_APPLY();
    } catch (e) {
      console.warn("GKM V194 apply V191 failed", e);
    }
    setTimeout(killBadge, 50);
    setTimeout(function () {
      killBadge();
      try {
        if (typeof window.GKM_V191_APPLY === "function") window.GKM_V191_APPLY();
      } catch (e) {}
      killBadge();
    }, 600);
  }

  function rescueZeroResults() {
    killBadge();

    const q = currentQuery();
    if (!queryLooksKnown(q)) return false;
    if (!looksZeroResults()) return false;

    const allBtn = findAllButton();
    if (!allBtn) return false;

    allBtn.click();
    setTimeout(applySmart, 900);
    return true;
  }

  function tick() {
    killBadge();
    rescueZeroResults();
  }

  function addStyles() {
    if (document.querySelector("#gkm-v194-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v194-style";
    style.textContent = `
      .gkm-v191-badge,
      .gkm-v192-clickable-badge,
      .gkm-v192-toast,
      .gkm-v193-toast {
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    tick();

    document.addEventListener("input", function () {
      clearTimeout(window.__gkmV194Input);
      window.__gkmV194Input = setTimeout(tick, 700);
    }, true);

    document.addEventListener("change", function () {
      clearTimeout(window.__gkmV194Change);
      window.__gkmV194Change = setTimeout(tick, 700);
    }, true);

    document.addEventListener("click", function () {
      clearTimeout(window.__gkmV194Click);
      window.__gkmV194Click = setTimeout(tick, 250);
    }, true);

    const obs = new MutationObserver(function () {
      clearTimeout(window.__gkmV194Obs);
      window.__gkmV194Obs = setTimeout(tick, 250);
    });
    obs.observe(document.body, {childList:true, subtree:true});

    setTimeout(tick, 200);
    setTimeout(tick, 700);
    setTimeout(tick, 1700);
    setTimeout(tick, 3200);

    console.log("GKM: v194-kill-v191-badge-keep-smart-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V194_APPLY_SMART = function () {
    const rescued = rescueZeroResults();
    if (!rescued) applySmart();
    killBadge();
    return "V194 smart applied, badge killed";
  };

  window.GKM_V194_KILL_BADGE = killBadge;
})();
/* GKM V194 KILL V191 BADGE END */
