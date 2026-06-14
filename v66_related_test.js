
globalThis.window = globalThis;
function titleOf(m){ return m.ru || m.title || m.name || m.en || "Без названия"; }
function getType(m){ return m.type || "Фильм"; }
function getYear(m){ return String(m.year || ""); }
function getRating(m){ return Number(m.rating || 0); }
function getVotes(m){ return Number(m.votes || 0); }
function getGenres(m){ return Array.isArray(m.genres) ? m.genres : []; }
function gkmCleanListV60(list){ return Array.isArray(list) ? list : []; }
function rankOf(m){ return {rank:"a"}; }
function ratingLabel(m){ return "A-класс · " + getRating(m).toFixed(1); }
function escapeHtml(s){ return String(s); }
function escapeAttr(s){ return String(s); }
function ensureSearchIndex(){ return Promise.resolve([]); }
let currentItems = [];
let lastSearchResults = [];
let searchIndex = [];
let homeData = {sections:{}};
const document = { getElementById(){return null}, createElement(){return {innerHTML:"",style:{},querySelectorAll(){return[]},addEventListener(){}}}, querySelector(){return null} };
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

  if (items.length < 6) {
    try {
      const idx = await ensureSearchIndex();
      pool = gkmCleanListV60([...(pool || []), ...(idx || [])]);
      items = gkmPickRelatedV66(baseItem, pool, 10);
    } catch (e) {
      console.warn("related search index failed", e);
    }
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

window.GKM_RELATED_CARDS_VERSION = "v66-related-cards-tested-2026-06-13";
/* === /GKM V66 RELATED CARDS IN DETAILS === */
const base = {id:"naruto", ru:"Наруто", en:"Naruto", type:"Аниме", year:"2002", rating:8.0, votes:2000000, genres:["Аниме","Экшен","Боевой"], poster:"p"};
const pool = [
  base,
  {id:"boruto", ru:"Боруто", en:"Boruto", type:"Аниме", year:"2017", rating:7.2, votes:500000, genres:["Аниме","Экшен","Боевой"], poster:"p"},
  {id:"bleach", ru:"Блич", en:"Bleach", type:"Аниме", year:"2004", rating:8.2, votes:1000000, genres:["Аниме","Экшен"], poster:"p"},
  {id:"low", ru:"Мусор без голосов", en:"Low", type:"Аниме", year:"2026", rating:10, votes:2, genres:["Аниме","Экшен"], poster:"p"},
  {id:"film", ru:"Фильм", en:"Movie", type:"Фильм", year:"2020", rating:9, votes:1000000, genres:["Экшен"], poster:"p"}
];
const picked = gkmPickRelatedV66(base, pool, 10);
console.log(JSON.stringify({count:picked.length, ids:picked.map(x=>x.id)}));
if (picked.some(x => x.id === "naruto")) process.exit(2);
if (picked.some(x => x.id === "low")) process.exit(3);
if (picked.some(x => x.id === "film")) process.exit(4);
if (!picked.some(x => x.id === "boruto")) process.exit(5);
if (!picked.some(x => x.id === "bleach")) process.exit(6);
