const INDEX_URL = "data/index.json";
const PAGE_SIZE = 40;
const MIN_VOTES_FOR_TOP = 300;

let allMovies = [];
let filtered = [];
let currentPage = 1;
let currentTab = "all";
let selectedMovie = null;
const chunkCache = new Map();

const $ = (id) => document.getElementById(id);

const favKey = "gkm_favorites";
const historyKey = "gkm_history";

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

function titleOf(m) {
  return m.ru || m.en || "Без названия";
}

function getYear(m) {
  return String(m.year || "").trim();
}

function getRating(m) {
  return Number(m.rating || 0);
}

function rankOf(m) {
  const r = getRating(m);

  if (r >= 9) return { rank: "S", label: "S-класс" };
  if (r >= 8) return { rank: "A", label: "A-класс" };
  if (r >= 7) return { rank: "B", label: "B-класс" };
  if (r >= 6) return { rank: "C", label: "C-класс" };

  return { rank: "D", label: "D-класс" };
}
function getVotes(m) {
  return Number(m.votes || 0);
}

function getGenres(m) {
  return Array.isArray(m.genres) ? m.genres.filter(Boolean) : [];
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function queryOf(m) {
  return encodeURIComponent(titleOf(m));
}

function scoreSmart(m) {
  const rating = getRating(m);
  const votes = getVotes(m);
  const year = Number(getYear(m) || 0);

  if (votes < 30) return -1;

  const voteBonus = Math.min(votes, 50000) / 50000 * 4;
  const yearBonus = year >= 2010 ? 0.4 : 0;

  return rating * 10 + voteBonus + yearBonus;
}

async function loadData() {
  $("statusText").textContent = "Загрузка базы...";

  let data;

  try {
    const indexRes = await fetch(INDEX_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (indexRes.ok) {
      data = await loadChunkedData(await indexRes.json());
    }
  } catch {}

  if (!data) {
    const res = await fetch("movies_updates.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить movies_updates.json");
    data = await res.json();
  }

  allMovies = data.movies || data.items || [];

  $("statusText").textContent = `База: ${allMovies.length} записей · версия ${data.version || "?"} · ${data.generatedAt || ""}`;

  fillFilters();
  applyFilters();
}

async function loadChunkedData(index) {
  const chunks = index.chunks || [];
  const movies = [];

  for (const chunk of chunks) {
    const url = chunk.file || chunk.url;
    if (!url) continue;

    let part = chunkCache.get(url);
    if (!part) {
      const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) continue;
      part = await res.json();
      chunkCache.set(url, part);
    }

    if (Array.isArray(part.movies)) movies.push(...part.movies);
    else if (Array.isArray(part)) movies.push(...part);
  }

  return {
    version: index.version || 1,
    generatedAt: index.generatedAt || "",
    movies
  };
}

function fillFilters() {
  const years = [...new Set(allMovies.map(getYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));

  const genres = [...new Set(allMovies.flatMap(getGenres))]
    .sort((a, b) => a.localeCompare(b, "ru"));

  $("yearFilter").innerHTML =
    `<option value="">Все годы</option>` +
    years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join("");

  $("genreFilter").innerHTML =
    `<option value="">Все жанры</option>` +
    genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

function applyFilters() {
  const q = normalize($("searchInput").value);
  const type = $("typeFilter").value;
  const genre = $("genreFilter").value;
  const year = $("yearFilter").value;
  const minRating = Number($("ratingFilter").value || 0);
  const sort = $("sortFilter") ? $("sortFilter").value : "smart";

  let list = [...allMovies];

  if (currentTab === "movies") list = list.filter(m => m.type === "Фильм");
  if (currentTab === "series") list = list.filter(m => m.type === "Сериал");
  if (currentTab === "cartoons") list = list.filter(m => getGenres(m).some(g => normalize(g).includes("мульт")));
  if (currentTab === "anime") list = list.filter(m => getGenres(m).some(g => normalize(g).includes("аниме")) || m.type === "Аниме");
  if (currentTab === "top") list = list.filter(m => getVotes(m) >= MIN_VOTES_FOR_TOP).slice(0, 250);
  if (currentTab === "new") list = list.filter(m => Number(getYear(m)) >= 2024);
  if (currentTab === "popular") list = list.filter(m => getVotes(m) >= 1000);
  if (currentTab === "fav") {
    const fav = loadSet(favKey);
    list = list.filter(m => fav.has(String(m.id)));
  }
  if (currentTab === "history") {
    const hist = [...loadSet(historyKey)];
    const map = new Map(allMovies.map(m => [String(m.id), m]));
    list = hist.map(id => map.get(id)).filter(Boolean);
  }
  if (currentTab === "random") {
    list = shuffle(list).slice(0, 200);
  }

  if (q) {
    list = list.filter(m => {
      const hay = normalize([
        m.ru,
        m.en,
        m.year,
        m.type,
        m.status,
        m.overview,
        ...getGenres(m)
      ].join(" "));
      return hay.includes(q);
    });
  }

  if (type) list = list.filter(m => m.type === type);
  if (genre) list = list.filter(m => getGenres(m).includes(genre));
  if (year) list = list.filter(m => getYear(m) === year);
  if (minRating) list = list.filter(m => getRating(m) >= minRating);

  list = sortList(list, sort);

  filtered = list;
  currentPage = 1;
  render();
}

function sortList(list, sort) {
  const a = [...list];

  if (sort === "rating") {
    a.sort((x, y) => getRating(y) - getRating(x));
  } else if (sort === "votes") {
    a.sort((x, y) => getVotes(y) - getVotes(x));
  } else if (sort === "year") {
    a.sort((x, y) => Number(getYear(y) || 0) - Number(getYear(x) || 0));
  } else if (sort === "title") {
    a.sort((x, y) => titleOf(x).localeCompare(titleOf(y), "ru"));
  } else {
    a.sort((x, y) => scoreSmart(y) - scoreSmart(x));
  }

  return a;
}

function render() {
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  $("countText").textContent = `Найдено: ${filtered.length} · Страница ${currentPage} из ${pages}`;
  $("grid").innerHTML = pageItems.map(cardHtml).join("");

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const movie = allMovies.find(m => String(m.id) === id);
      if (movie) openDetails(movie);
    });
  });

  $("prevBtn").disabled = currentPage <= 1;
  $("nextBtn").disabled = currentPage >= pages;
  $("pageText").textContent = `${currentPage} / ${pages}`;
}

function cardHtml(m) {
  const poster = m.poster
    ? `<img loading="lazy" src="${escapeAttr(m.poster)}" alt="${escapeAttr(titleOf(m))}">`
    : `<div class="no-poster">Нет постера</div>`;

  const genres = getGenres(m).slice(0, 3).join(" · ");

  return `
    <article class="card" data-id="${escapeAttr(m.id)}">
      <div class="poster-wrap">${poster}</div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(titleOf(m))}</p>
        <p class="meta">${escapeHtml(m.year || "—")} · ${escapeHtml(m.type || "—")}</p>
        <p class="meta">${escapeHtml(genres)}</p>
       <span class="rating rank-${rankOf(m).rank.toLowerCase()}">
  ${rankOf(m).rank}-класс · ${getRating(m).toFixed(1)}
</span>
      </div>
    </article>
  `;
}

function openDetails(m) {
  selectedMovie = m;

  const hist = loadSet(historyKey);
  hist.delete(String(m.id));
  const arr = [String(m.id), ...hist].slice(0, 300);
  localStorage.setItem(historyKey, JSON.stringify(arr));

  $("detailTitle").textContent = titleOf(m);
  $("detailMeta").textContent =
    `${m.year || "—"} · ${m.type || "—"} · рейтинг ${getRating(m).toFixed(1)} · голосов ${m.votes || 0}`;

  $("detailGenres").textContent = getGenres(m).join(" · ");
  $("detailOverview").textContent = m.overview || "Описание пока не добавлено.";

  $("detailPoster").src = m.poster || "";
  $("detailPoster").style.display = m.poster ? "block" : "none";

  const q = queryOf(m);
  const isAnime =
  m.type === "Аниме" ||
  getGenres(m).some(g => normalize(g).includes("аниме"));

const animeLinksBlock = document.getElementById("animeLinksBlock");
const catalogLinksBlock = document.getElementById("catalogLinksBlock");

if (animeLinksBlock) {
  animeLinksBlock.style.display = isAnime ? "block" : "none";
}

if (catalogLinksBlock) {
  catalogLinksBlock.style.display = isAnime ? "none" : "block";
}

  $("kinopoiskLink").href = `https://www.kinopoisk.ru/index.php?kp_query=${q}`;
  $("youtubeLink").href = `https://www.youtube.com/results?search_query=${q}+трейлер`;
  $("vkLink").href = `https://vk.com/video?q=${q}`;
  $("rutubeLink").href = `https://rutube.ru/search/?query=${q}`;

  updateFavBtn();
  $("detailsDialog").showModal();
}

function updateFavBtn() {
  const fav = loadSet(favKey);
  const yes = selectedMovie && fav.has(String(selectedMovie.id));
  $("favBtn").textContent = yes ? "Убрать из избранного" : "В избранное";
}

function toggleFav() {
  if (!selectedMovie) return;

  const fav = loadSet(favKey);
  const id = String(selectedMovie.id);

  if (fav.has(id)) fav.delete(id);
  else fav.add(id);

  saveSet(favKey, fav);
  updateFavBtn();

  if (currentTab === "fav") applyFilters();
}

function resetFilters() {
  $("searchInput").value = "";
  $("typeFilter").value = "";
  $("genreFilter").value = "";
  $("yearFilter").value = "";
  $("ratingFilter").value = "0";

  if ($("sortFilter")) $("sortFilter").value = "smart";

  currentTab = "all";

  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  const allTab = document.querySelector('.tab[data-tab="all"]');
  if (allTab) allTab.classList.add("active");

  applyFilters();
}

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function setupEvents() {
  [
    "searchInput",
    "typeFilter",
    "genreFilter",
    "yearFilter",
    "ratingFilter",
    "sortFilter"
  ].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  });

  const resetBtn = $("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFilters);
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      applyFilters();
    });
  });

  $("prevBtn").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  $("nextBtn").addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    if (currentPage < pages) {
      currentPage++;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  $("closeDialog").addEventListener("click", () => $("detailsDialog").close());
  $("favBtn").addEventListener("click", toggleFav);

  $("reloadBtn").addEventListener("click", () => loadData().catch(showError));

  $("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem("gkm_theme", document.body.classList.contains("light") ? "light" : "dark");
  });

  if (localStorage.getItem("gkm_theme") === "light") {
    document.body.classList.add("light");
  }
}

function showError(e) {
  console.error(e);
  $("statusText").textContent = "Ошибка: " + e.message;
  $("grid").innerHTML =
    `<div class="card"><div class="card-body">Не удалось загрузить базу. Проверь data/index.json или movies_updates.json.</div></div>`;
}

setupEvents();
loadData().catch(showError);
