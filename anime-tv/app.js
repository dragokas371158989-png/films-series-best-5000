const DATA_URL = "anime_data.json";

const PAGE_SIZE = 24;

let allAnime = [];
let filteredAnime = [];
let currentPage = 1;
let currentTab = "all";
let selectedAnime = null;

const favKey = "golub_anime_tv_favorites";
const historyKey = "golub_anime_tv_history";

function $(id) {
  return document.getElementById(id);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();
}

function getTitle(item) {
  return item.ru || item.title_ru || item.name_ru || item.title || item.name || item.en || "Без названия";
}

function getEnTitle(item) {
  return item.en || item.title_en || item.name_en || item.english || "";
}

function getYear(item) {
  return item["год"] || item.year || "";
}

function getType(item) {
  return item["тип"] || item.type || "";
}

function getEpisodes(item) {
  return item["эпизоды"] || item.episodes || "";
}

function getStatus(item) {
  return item["статус"] || item.status || "";
}

function getStudio(item) {
  return item["студия"] || item.studio || "";
}

function getRating(item) {
  const rating = Number(item["рейтинг"] || item.rating || item.score || 0);
  return Number.isFinite(rating) ? rating : 0;
}

function getPoster(item) {
  return item["постер"] || item.poster || item.image || item.image_url || "";
}

function getGenres(item) {
  const genres = item["жанры"] || item.genres || [];

  if (Array.isArray(genres)) {
    return genres.filter(Boolean);
  }

  if (typeof genres === "string") {
    return genres
      .split(/[;,•]/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  return [];
}

function getOverview(item) {
  return item["описание"] || item.description || item.overview || item.synopsis || "Описание пока не добавлено.";
}

function getId(item) {
  return String(item.id || item.mal_id || `${getTitle(item)}-${getYear(item)}`);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function addToHistory(item) {
  const id = getId(item);
  const history = [...loadSet(historyKey)].filter(x => x !== id);

  history.unshift(id);

  localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 150)));
}

function isFavorite(item) {
  return loadSet(favKey).has(getId(item));
}

function toggleFavorite(item) {
  const id = getId(item);
  const fav = loadSet(favKey);

  if (fav.has(id)) {
    fav.delete(id);
  } else {
    fav.add(id);
  }

  saveSet(favKey, fav);
  updateFavButton();
  applyFilters();
}

function scoreSmart(item) {
  const rating = getRating(item);
  const year = Number(getYear(item)) || 0;

  return rating * 1000 + year;
}

function shuffle(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

async function loadData() {
  try {
    $("statusText").textContent = "Загрузка базы аниме...";

    const response = await fetch(DATA_URL + "?v=" + Date.now());

    if (!response.ok) {
      throw new Error("Не удалось загрузить anime_data.json");
    }

    const data = await response.json();

    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data.anime)
        ? data.anime
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.movies)
            ? data.movies
            : [];

    allAnime = rawList.filter(item => getTitle(item) !== "Без названия");

    fillFilters();
    applyFilters();

    $("statusText").textContent = `База загружена: ${allAnime.length} аниме`;
  } catch (error) {
    console.error(error);
    $("statusText").textContent = "Ошибка загрузки базы. Проверь anime_data.json";
    $("grid").innerHTML = `<div class="empty">Не удалось загрузить базу аниме</div>`;
  }
}

function fillFilters() {
  const years = [...new Set(allAnime.map(getYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));

  const types = [...new Set(allAnime.map(getType).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "ru"));

  $("yearFilter").innerHTML =
    `<option value="">Все годы</option>` +
    years.map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("");

  $("typeFilter").innerHTML =
    `<option value="">Все типы</option>` +
    types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
}

function applyFilters() {
  const searchInput = $("searchInput");
  const yearFilter = $("yearFilter");
  const typeFilter = $("typeFilter");

  const q = normalize(searchInput ? searchInput.value : "");
  const year = yearFilter ? yearFilter.value : "";
  const type = typeFilter ? typeFilter.value : "";

  let list = [...allAnime];

  if (currentTab === "new") {
    list = list.filter(item => Number(getYear(item)) >= 2024);
  }

  if (currentTab === "top") {
    list = list
      .filter(item => getRating(item) >= 7.5)
      .sort((a, b) => getRating(b) - getRating(a));
  }

  if (currentTab === "fav") {
    const fav = loadSet(favKey);
    list = list.filter(item => fav.has(getId(item)));
  }

  if (currentTab === "history") {
    const history = [...loadSet(historyKey)];
    const map = new Map(allAnime.map(item => [getId(item), item]));

    list = history.map(id => map.get(id)).filter(Boolean);
  }

  if (currentTab === "random") {
    list = shuffle(list).slice(0, 120);
  }

  if (year) {
    list = list.filter(item => String(getYear(item)) === String(year));
  }

  if (type) {
    list = list.filter(item => getType(item) === type);
  }

  if (q) {
    const words = q.split(/\s+/).filter(Boolean);

    list = list
      .map(item => {
        const title = normalize(getTitle(item));
        const en = normalize(getEnTitle(item));

        const hay = normalize([
          getTitle(item),
          getEnTitle(item),
          getYear(item),
          getType(item),
          getStatus(item),
          getStudio(item),
          getGenres(item).join(" "),
          getOverview(item)
        ].join(" "));

        let score = 0;

        if (hay.includes(q)) score += 1000;
        if (title.startsWith(q)) score += 700;
        if (en.startsWith(q)) score += 600;

        for (const word of words) {
          if (hay.includes(word)) score += 220;
        }

        score += getRating(item);

        return { item, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);
  } else if (currentTab !== "history" && currentTab !== "random" && currentTab !== "top") {
    list = list.sort((a, b) => scoreSmart(b) - scoreSmart(a));
  }

  filteredAnime = list;
  currentPage = 1;

  render();
}

function render() {
  const totalPages = Math.max(1, Math.ceil(filteredAnime.length / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredAnime.slice(start, start + PAGE_SIZE);

  $("countText").textContent = `Найдено: ${filteredAnime.length}`;
  $("pageText").textContent = `Страница ${currentPage} из ${totalPages}`;

  if (!pageItems.length) {
    $("grid").innerHTML = `<div class="empty">Ничего не найдено</div>`;
    return;
  }

  $("grid").innerHTML = pageItems.map(cardHtml).join("");

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const item = allAnime.find(x => getId(x) === id);

      if (item) openDetails(item);
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        const id = card.dataset.id;
        const item = allAnime.find(x => getId(x) === id);

        if (item) openDetails(item);
      }
    });
  });

  const firstCard = document.querySelector(".card");

  if (firstCard) {
    firstCard.focus();
  }
}

function cardHtml(item) {
  const id = escapeHtml(getId(item));
  const title = escapeHtml(getTitle(item));
  const en = escapeHtml(getEnTitle(item));
  const poster = escapeHtml(getPoster(item));
  const rating = getRating(item);
  const year = escapeHtml(getYear(item));
  const type = escapeHtml(getType(item));
  const episodes = escapeHtml(getEpisodes(item));
  const genres = escapeHtml(getGenres(item).slice(0, 6).join(" • "));

  const ratingText = rating > 0 ? rating.toFixed(2).replace(".", ",") : "—";

  return `
    <article class="card" tabindex="0" data-id="${id}">
      <div class="card-poster-wrap">
        <img class="card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.style.display='none';">
        <div class="card-rating">${ratingText}</div>
      </div>

      <div class="card-info">
        <h2 class="card-title">${title}</h2>
        <p class="card-en">${en}</p>
        <p class="card-meta">${year} • ${type}${episodes ? " • Эп:" + episodes : ""}</p>
        <p class="card-genres">${genres}</p>
        <div class="card-hint">OK — детали</div>
      </div>
    </article>
  `;
}

function openDetails(item) {
  selectedAnime = item;

  addToHistory(item);

  $("detailPoster").src = getPoster(item);
  $("detailPoster").alt = getTitle(item);

  $("detailTitle").textContent = getTitle(item);

  $("detailMeta").textContent = [
    getEnTitle(item),
    getYear(item),
    getType(item),
    getEpisodes(item) ? `Эпизоды: ${getEpisodes(item)}` : "",
    getStatus(item),
    getStudio(item)
  ].filter(Boolean).join(" • ");

  $("detailGenres").textContent = getGenres(item).join(" • ");
  $("detailOverview").textContent = getOverview(item);

  updateFavButton();

  const dialog = $("detailDialog");

  if (!dialog.open) {
    dialog.showModal();
  }

  setTimeout(() => $("closeDialog").focus(), 50);
}

function updateFavButton() {
  if (!selectedAnime) return;

  $("favBtn").textContent = isFavorite(selectedAnime)
    ? "★ Убрать из избранного"
    : "★ В избранное";
}

function closeDetails() {
  const dialog = $("detailDialog");

  if (dialog.open) dialog.close();

  selectedAnime = null;

  applyFilters();
}

function goPage(delta) {
  const totalPages = Math.max(1, Math.ceil(filteredAnime.length / PAGE_SIZE));

  currentPage += delta;

  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  render();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupEvents() {
  $("searchBtn").addEventListener("click", applyFilters);

  $("resetBtn").addEventListener("click", () => {
    $("searchInput").value = "";
    $("yearFilter").value = "";
    $("typeFilter").value = "";
    currentTab = "all";

    document.querySelectorAll(".tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "all");
    });

    applyFilters();
  });

  $("searchInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      applyFilters();
    }
  });

  $("yearFilter").addEventListener("change", applyFilters);
  $("typeFilter").addEventListener("change", applyFilters);

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;

      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      applyFilters();
    });
  });

  $("prevBtn").addEventListener("click", () => goPage(-1));
  $("nextBtn").addEventListener("click", () => goPage(1));

  $("closeDialog").addEventListener("click", closeDetails);

  $("favBtn").addEventListener("click", () => {
    if (selectedAnime) toggleFavorite(selectedAnime);
  });

  $("watchBtn").addEventListener("click", () => {
    if (!selectedAnime) return;

    const title = encodeURIComponent(getTitle(selectedAnime));

    window.open(`https://www.google.com/search?q=${title}+аниме+смотреть`, "_blank");
  });

  $("similarBtn").addEventListener("click", () => {
    if (!selectedAnime) return;

    const genres = getGenres(selectedAnime);
    const firstGenre = genres[0];

    closeDetails();

    $("searchInput").value = firstGenre || getTitle(selectedAnime);

    applyFilters();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" || event.key === "Backspace") {
      if ($("detailDialog").open) {
        event.preventDefault();
        closeDetails();
      }
    }
  });
}
/* ===== КНОПКА ANIME TV НА ГЛАВНОЙ — АВТОДОБАВЛЕНИЕ ===== */

function addAnimeTvButtonToMainSite() {
  if (document.getElementById("animeTvMainLink")) return;

  const link = document.createElement("a");
  link.id = "animeTvMainLink";
  link.href = "anime-tv/";
  link.textContent = "🐉 Anime TV";
  link.className = "tab anime-tv-main-link";

  link.style.display = "inline-flex";
  link.style.alignItems = "center";
  link.style.justifyContent = "center";
  link.style.gap = "8px";
  link.style.textDecoration = "none";
  link.style.color = "#fff";
  link.style.fontWeight = "900";
  link.style.background = "linear-gradient(135deg, #7c3aed, #06b6d4)";
  link.style.border = "1px solid rgba(0, 229, 255, 0.55)";
  link.style.boxShadow = "0 0 18px rgba(124, 58, 237, 0.45)";
  link.style.borderRadius = "14px";
  link.style.padding = "10px 16px";
  link.style.minHeight = "44px";
  link.style.cursor = "pointer";

  const tabBar =
    document.querySelector(".tabs") ||
    document.querySelector(".tabbar") ||
    document.querySelector(".nav-tabs") ||
    document.querySelector(".filters") ||
    document.querySelector("nav") ||
    document.querySelector("header");

  if (tabBar) {
    tabBar.appendChild(link);
  } else {
    link.style.position = "fixed";
    link.style.right = "16px";
    link.style.bottom = "16px";
    link.style.zIndex = "9999";
    document.body.appendChild(link);
  }
}

document.addEventListener("DOMContentLoaded", addAnimeTvButtonToMainSite);

setTimeout(addAnimeTvButtonToMainSite, 500);
setTimeout(addAnimeTvButtonToMainSite, 1500);
setupEvents();
loadData();
