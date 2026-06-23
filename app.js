const GKM_APP_CLEAN_VERSION = "v119-anime-top-adaptive-9m-2026-06-23";
window.GKM_V114_RUSSIAN_POSTERS_VERSION = "v114-kinopoisk-russian-posters-2026-06-20";
window.GKM_V116_ANIME_TOP_100_VERSION = "v116-anime-top-100-rating-2026-06-23";
window.GKM_V117_ANIME_TOP_100_PEOPLE_VERSION = "v117-anime-top-100-people-rating-2026-06-23";
window.GKM_V119_ANIME_TOP_ADAPTIVE_9M_VERSION = "v119-anime-top-adaptive-9m-2026-06-23";
window.GKM_V120_ANIME_TOP_POPULAR_9M_VERSION = "v120-anime-top-popular-adaptive-9m-2026-06-23";
const TMDB_ENABLED = false;
const KINOPOISK_ENABLED = false;

const FAST_BASE = "data/fast";
const HOME_URL = `${FAST_BASE}/home.json`;
const META_URL = `${FAST_BASE}/meta.json`;
const SEARCH_URL = `${FAST_BASE}/search_index.json`;
const SEARCH_LITE_URL = `${FAST_BASE}/search_lite.json`;
const SEARCH_SHARDS_BASE = `${FAST_BASE}/search_shards`;
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

function setStatus(text) {
  const node = $("statusText");
  if (node) node.textContent = text || "";
}

async function fetchJson(url, cache = "force-cache") {
  const res = await fetch(`${url}?v=117`, { cache });
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
  const low = String(src || "").toLowerCase();
  return low.includes("image.tmdb.org") || low.includes("/t/p/");
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
    img.addEventListener("load", () => { if (img.naturalWidth > 0) img.dataset.posterDone = "1"; });
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
  const title = titleOf(item);
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
  const absoluteSearchLiteUrl = new URL(`${SEARCH_LITE_URL}?v=120`, window.location.href).href;
  const absoluteSearchFullUrl = new URL(`${SEARCH_URL}?v=120`, window.location.href).href;
  const absoluteShardBase = new URL(`${SEARCH_SHARDS_BASE}/`, window.location.href).href;
  const code = `
    const SEARCH_LITE_URL = ${JSON.stringify(absoluteSearchLiteUrl)};
    const SEARCH_FULL_URL = ${JSON.stringify(absoluteSearchFullUrl)};
    const SHARD_BASE = ${JSON.stringify(absoluteShardBase)};
    const PAGE_SIZE = ${PAGE_SIZE};
    let indexPromise = null;
    const shardPromises = new Map();
    let rows = [];
    function norm(v){return String(v||"").toLowerCase().replaceAll("ё","е").replace(/&/g," and ").replace(/['’\\\`]/g,"").replace(/[^\\p{L}\\p{N}:]+/gu," ").replace(/\\s+/g," ").trim();}
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
    function tabPass(x,tab){const t=type(x);if(!tab||tab==="all")return true;if(tab==="movies")return t==="Фильм";if(tab==="series")return t==="Сериал";if(tab==="anime")return t==="Аниме";if(tab==="cartoons")return t==="Мультфильм";if(tab==="top")return rating(x)>=7&&votes(x)>=300;if(tab==="anime_top")return isAnimeTopCandidate(x);if(tab==="new")return Number(year(x)||0)>=2024;if(tab==="popular")return votes(x)>=1000;return true;}
    function pass(x,c){if(!tabPass(x,c.tab))return false;const t=type(x);if(c.type&&t!==c.type)return false;if(c.genre&&!genres(x).includes(c.genre))return false;if(c.year&&year(x)!==String(c.year))return false;if(c.minRating&&rating(x)<Number(c.minRating))return false;return true;}
    function queryList(raw){const base=norm(raw);const out=new Set(base?[base]:[]);const squ=squeeze(base);if(squ&&squ!==base)out.add(squ);const fixed=norm(keyfix(base));if(fixed&&fixed!==base)out.add(fixed);const fixedSqu=squeeze(fixed);if(fixedSqu&&fixedSqu!==fixed)out.add(fixedSqu);const syn={"матрица":["matrix","the matrix"],"шазам":["shazam"],"наруто":["naruto"],"ван пис":["one piece","ванпис"],"ванпис":["one piece","ван пис"],"дэдпул":["deadpool","дедпул"],"дедпул":["deadpool","дэдпул"],"интерстеллар":["interstellar"]};[...out].forEach(value=>{Object.entries(syn).forEach(([k,a])=>{if(value===k||value.includes(k))a.forEach(x=>out.add(norm(x)));});});return [...out].filter(Boolean);}
    function hay(x){return x.__hay||(x.__hay=norm([x.search,title(x),x.ru,x.en,(x.genres||[]).join(" ")].join(" ")));}
    function score(x,queries){if(!queries.length)return 1;const h=hay(x);const wh=" "+h+" ";let best=0;for(const q of queries){if(h===q)best=Math.max(best,10000000);else if(h.startsWith(q+" "))best=Math.max(best,9000000);else if(wh.includes(" "+q+" "))best=Math.max(best,8000000);else if(h.includes(q))best=Math.max(best,7000000);else{const parts=q.split(" ").filter(p=>p.length>1);if(parts.length&&parts.every(p=>h.includes(p)))best=Math.max(best,6000000+parts.length*1000);}}return best?best+poster(x)*5000+Math.min(votes(x),1000000)/10+rating(x)*100:0;}
    function franchiseKey(x){let s=norm(title(x));s=s.replace(/(season|part|cour|movie|final|the final|ova|special)/gi," ");s=s.replace(/(сезон|часть|фильм|финал|финальный|последняя|последний)/gi," ");s=s.replace(/\d+/g," ");s=s.replace(/[:\-–—].*$/," ");s=s.replace(/\s+/g," ").trim();const aliases=[["attack on titan","shingeki no kyojin"],["fullmetal alchemist","stalnoi alhimik"],["naruto shippuden","naruto"],["bleach thousand year blood war","bleach"],["demon slayer kimetsu no yaiba","demon slayer"],["jujutsu kaisen","jujutsu kaisen"],["one piece","one piece"],["gintama","gintama"],["code geass","code geass"],["hunter x hunter","hunter x hunter"],["steins gate","steins gate"]];for(const [a,b] of aliases){if(s.includes(a)||s.includes(b))return a;}return s.split(" ").slice(0,3).join(" ")||s;}
    function animeTopScore(x){const v=votes(x);const r=rating(x);const y=Number(year(x)||0);return v*1000 + r*10000 + Math.max(0,2100-y);}
    function applyAnimeTopDedupe(){const thresholds=[9000000,7000000,5000000,3000000,2000000,1500000,1000000,700000,500000,300000,100000];const sorted=rows.slice().sort((a,b)=>votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0));let chosen=sorted;let chosenThreshold=0;for(const th of thresholds){const part=sorted.filter(r=>votes(r.item)>=th);if(part.length>=100){chosen=part;chosenThreshold=th;break;}}if(!chosenThreshold){for(const th of thresholds.slice().reverse()){const part=sorted.filter(r=>votes(r.item)>=th);if(part.length){chosen=part;chosenThreshold=th;}}}
      function build(limitPerFranchise, source){const cap=new Map();const out=[];for(const row of source){const key=franchiseKey(row.item);const count=cap.get(key)||0;if(count>=limitPerFranchise)continue;cap.set(key,count+1);out.push(row);if(out.length>=100)break;}return out;}
      let out=build(2,chosen);if(out.length<100)out=build(2,sorted);if(out.length<100)out=build(3,sorted);rows=out.slice(0,100);self.__animeTopThreshold=chosenThreshold;}
    function sortRows(sort, hasQuery, tab){const pr=(a,b)=>poster(b.item)-poster(a.item);if(tab==="anime_top"){rows.sort((a,b)=>pr(a,b)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item)||Number(year(b.item)||0)-Number(year(a.item)||0));applyAnimeTopDedupe();}else if(sort==="rating")rows.sort((a,b)=>pr(a,b)||rating(b.item)-rating(a.item)||votes(b.item)-votes(a.item));else if(sort==="votes")rows.sort((a,b)=>pr(a,b)||votes(b.item)-votes(a.item)||rating(b.item)-rating(a.item));else if(sort==="year")rows.sort((a,b)=>pr(a,b)||Number(year(b.item)||0)-Number(year(a.item)||0)||votes(b.item)-votes(a.item));else if(sort==="year_old")rows.sort((a,b)=>pr(a,b)||Number(year(a.item)||9999)-Number(year(b.item)||9999)||votes(b.item)-votes(a.item));else if(sort==="title")rows.sort((a,b)=>pr(a,b)||title(a.item).localeCompare(title(b.item),"ru"));else if(hasQuery)rows.sort((a,b)=>pr(a,b)||b.score-a.score);else rows.sort((a,b)=>pr(a,b)||(rating(b.item)*100000+Math.min(votes(b.item),250000)+Number(year(b.item)||0))-(rating(a.item)*100000+Math.min(votes(a.item),250000)+Number(year(a.item)||0)));}
    async function loadIndex(){if(!indexPromise)indexPromise=fetch(SEARCH_LITE_URL,{cache:"force-cache"}).then(r=>{if(r.ok)return r.json();return fetch(SEARCH_FULL_URL,{cache:"force-cache"}).then(full=>{if(!full.ok)throw new Error("search_lite "+r.status+" / search_index "+full.status);return full.json();});});return indexPromise;}
    function shardKey(q){const c=String(q||"").trim()[0]||"";return /^[0-9a-zа-я]$/i.test(c)?c.toLowerCase():"";}
    async function loadShard(key){if(!key)return [];if(!shardPromises.has(key)){const url=SHARD_BASE+encodeURIComponent(key)+".json?v=120";shardPromises.set(key,fetch(url,{cache:"force-cache"}).then(r=>{if(r.status===404)return [];if(!r.ok)return [];return r.json();}).catch(()=>[]));}return shardPromises.get(key);}
    async function candidateIndex(queries){if(!queries.length)return loadIndex();const keys=[...new Set(queries.map(shardKey).filter(Boolean))];if(!keys.length)return loadIndex();const lists=await Promise.all(keys.map(loadShard));const seen=new Set();const out=[];for(const list of lists){for(const item of list||[]){const id=String((item&&item.id)||title(item)+"|"+year(item));if(seen.has(id))continue;seen.add(id);out.push(item);}}return out;}
    function buildRows(index, c, queries){const out=[];for(const item of index){if(!pass(item,c))continue;const s=score(item,queries);if(!queries.length||s>0)out.push({item,score:s});}return out;}
    function pageItems(page, tab){const p=Math.max(1,Number(page||1));const start=(p-1)*PAGE_SIZE;return rows.slice(start,p*PAGE_SIZE).map((x,i)=>{const item=Object.assign({},x.item); if(tab==="anime_top") item.__rank=start+i+1; return item;});}
    self.onmessage=async e=>{const msg=e.data||{};try{if(msg.mode==="page"){self.postMessage({id:msg.id,ok:true,page:msg.page,count:rows.length,items:pageItems(msg.page,msg.controls&&msg.controls.tab),ms:0});return;}const started=Date.now();self.postMessage({id:msg.id,loading:true});const c=msg.controls||{};const queries=queryList(c.q);let index=await candidateIndex(queries);rows=buildRows(index,c,queries);let fallback=false;if(queries.length&&rows.length===0){index=await loadIndex();rows=buildRows(index,c,queries);fallback=true;}sortRows(c.sort||"smart",Boolean(queries.length),c.tab);if(c.tab==="anime_top")rows=rows.slice(0,100);self.postMessage({id:msg.id,ok:true,page:1,count:rows.length,items:pageItems(1,c.tab),ms:Date.now()-started,indexTotal:index.length,indexPosters:index.reduce((n,x)=>n+poster(x),0),sharded:Boolean(queries.length),fallback});}catch(err){self.postMessage({id:msg.id,ok:false,error:String(err&&err.message||err)});}};
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
    const listLabel = currentTab === "anime_top" ? `🏆 Топ аниме 100 · ориентир 9M · Страница ${currentPage} из ${currentPages}` : `Найдено: ${currentCount} · Страница ${currentPage} из ${currentPages}`;
    renderList(msg.items || [], listLabel);
    setStatus(`Готово · ${currentCount} · ${msg.ms || 0} мс`);
  };
  return searchWorker;
}

function runSearch(page = 1) {
  const c = controls();
  if (!hasActiveControls(c) && c.tab === "all") {
    renderHome();
    return;
  }
  if (!hasActiveControls(c) && ["movies", "series", "anime", "cartoons", "top", "new", "popular"].includes(c.tab)) {
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
  makeSearchWorker().postMessage({ id: searchReq, mode: "page", page: currentPage });
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

function factHtml(label, value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value || "");
  return `<div class="fact-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text || "—")}</strong></div>`;
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
  if (title) title.textContent = titleOf(item);
  if (meta) meta.textContent = `${getType(item)} · ${getYear(item) || "—"} · ${rankLabel(item)} · ${getRating(item) || "—"} · ${getVotes(item)} голосов`;
  if (detailGenres) detailGenres.textContent = getGenres(item).join(" · ");
  if (overview) overview.textContent = item.overview || "Описание пока не добавлено.";

  const facts = $("detailFacts");
  if (facts) {
    facts.innerHTML = [
      factHtml("Тип", getType(item)),
      factHtml("Год", getYear(item)),
      factHtml("Рейтинг", getRating(item) || "—"),
      factHtml("Голосов", getVotes(item) || "—"),
      factHtml("Статус", item.status),
      factHtml("Эпизоды", item.episodes || item.episodeCount),
      factHtml("Студия", item.studio || item.studios),
      factHtml("Страна", item.country || item.countries),
      factHtml("Возраст", item.ageRating || item.age),
      factHtml("Источник", item.source)
    ].join("");
  }

  const q = encodeURIComponent(`${titleOf(item)} ${getYear(item) || ""}`.trim());
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

function renderRelated(base) {
  const block = ensureRelatedBlock();
  const box = $("relatedCards");
  if (!box) return;
  const pool = collectVisiblePool();
  const baseId = String(base.id || "");
  const baseKey = franchiseKey(base);
  const baseGenres = getGenres(base);
  const rows = pool
    .filter(item => item && String(item.id || "") !== baseId && hasPoster(item))
    .map(item => {
      const same = baseKey && franchiseKey(item) === baseKey ? 100000 : 0;
      const genreScore = baseGenres.filter(g => getGenres(item).includes(g)).length * 700;
      return { item, score: same + genreScore + getRating(item) * 1000 + Math.min(getVotes(item), 100000) / 20 };
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

function bindEvents() {
  $("searchInput")?.addEventListener("input", () => scheduleSearch(220));
  ["typeFilter", "genreFilter", "yearFilter", "ratingFilter", "sortFilter"].forEach(id => {
    $(id)?.addEventListener("change", () => scheduleSearch(60));
  });
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
      if (tab === "all" && !hasActiveControls({ ...controls(), tab })) return renderHome();
      runSearch(1);
    });
  });
  $("prevBtn")?.addEventListener("click", () => {
    if (currentPage <= 1) return;
    if (currentMode === "search") return renderSearchPage(currentPage - 1);
    if (currentMode === "page") return loadFastPage(currentTab, currentPage - 1);
  });
  $("nextBtn")?.addEventListener("click", () => {
    if (currentPage >= currentPages) return;
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
