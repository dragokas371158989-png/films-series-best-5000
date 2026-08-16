/* GKM V383 — lightweight feature center: calendar, taste, sync, routes, roulette,
   compare, statistics, automatic repairs, AI collections and shared watch rooms. */
(() => {
  "use strict";

  if (window.GKM_V382_FEATURE_CENTER) return;

  const VERSION = "v383-auto-repair-and-working-compare-2026-08-16";
  const PROFILE_STORE = "gkm_v326_local_profiles";
  const PROFILE_CURRENT = "gkm_v326_current_profile";
  const MY_GOLUB_STORE = "gkm_my_golub_v379";
  const PREFS_STORE = "gkm_v382_taste";
  const REMINDERS_STORE = "gkm_v382_reminders";
  const COMPARE_STORE = "gkm_v382_compare";
  const COLLECTIONS_STORE = "gkm_v382_ai_collections";
  const CLIENT_STORE = "gkm_v382_client";
  const LOCAL_ROOMS_STORE = "gkm_v382_local_rooms";
  const AUTO_REPAIRS_STORE = "gkm_v383_auto_repairs";
  const REPAIR_QUEUE_STORE = "gkm_v383_repair_queue";
  const REPAIR_HISTORY_STORE = "gkm_v383_repair_history";
  const MAX_COMPARE = 4;
  const reminderTimers = new Map();
  const STATUS_LABELS = Object.freeze({
    want: "Хочу посмотреть",
    watching: "Смотрю",
    completed: "Просмотрено",
    paused: "Отложено",
    dropped: "Брошено"
  });
  const VIEWS = Object.freeze([
    ["home", "🚀 Обзор"],
    ["calendar", "📅 Календарь"],
    ["taste", "🧠 Вкус"],
    ["sync", "☁️ Синхронизация"],
    ["route", "🧭 Порядок"],
    ["roulette", "🎲 Рулетка"],
    ["compare", "⚖️ Сравнение"],
    ["stats", "📊 Статистика"],
    ["report", "🛠 Автоисправление"],
    ["ai", "✨ AI-подборки"],
    ["room", "👥 Комната"]
  ]);

  const state = {
    view: "home",
    lastItem: null,
    itemMap: new Map(),
    extraPool: [],
    compare: readJson(COMPARE_STORE, []),
    compareSearch: [],
    routeRows: [],
    rouletteItem: null,
    aiRows: [],
    aiPrompt: "",
    room: null,
    roomTimer: 0,
    syncCode: "",
    syncMessage: "",
    repairBusy: false,
    repairResult: null,
    repairAutoKey: "",
    repairProgress: "",
    calendarMode: "month"
  };
  let originalDisplayTitle = null;
  let originalDisplayOverview = null;
  let autoRepairCache = null;
  if (!Array.isArray(state.compare)) state.compare = [];

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }
  function norm(value) {
    return text(value).toLowerCase().replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function rawTitleOf(item) {
    return text(item && (item.ru || item.title_ru || item.__manualTopTitle || item.name || item.title || item.en || item.original_title || item.original_name));
  }
  function repairIdentity(item) {
    if (!item || typeof item !== "object") return "";
    const source = norm(item.source || item.provider || "catalog") || "catalog";
    const ids = [
      ["mal", item.mal_id || item.malId],
      ["tmdb", item.tmdbId || item.tmdb_id],
      ["kp", item.kinopoiskId || item.kinopoisk_id || item.kp_id],
      [source, item.id]
    ];
    const found = ids.find(([, value]) => text(value));
    if (found) return `${found[0]}:${text(found[1])}`;
    const original = norm(item.en || item.original_title || item.original_name || item.title || item.name || rawTitleOf(item));
    const year = text(item.year || item.release_date || item.first_air_date).match(/(18\d{2}|19\d{2}|20\d{2})/)?.[1] || "";
    const type = norm(item.type || item.category || item.kind);
    return original ? `title:${original}|${year}|${type}` : "";
  }
  function autoRepairStore() {
    if (autoRepairCache) return autoRepairCache;
    const value = readJson(AUTO_REPAIRS_STORE, {});
    autoRepairCache = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return autoRepairCache;
  }
  function applyRepairPatch(item, patch, persist = false) {
    if (!item || typeof item !== "object" || !patch || typeof patch !== "object") return [];
    const identity = repairIdentity(item);
    const changed = [];
    const oldTitle = rawTitleOf(item);
    const set = (field, value) => {
      if (value == null || (Array.isArray(value) && !value.length)) return;
      const before = Array.isArray(item[field]) ? JSON.stringify(item[field]) : text(item[field]);
      const after = Array.isArray(value) ? JSON.stringify(value) : text(value);
      if (before === after) return;
      item[field] = Array.isArray(value) ? value.slice() : value;
      changed.push(field);
    };
    if (patch.title) {
      set("ru", patch.title);
      set("title_ru", patch.title);
      ["name", "title", "__manualTopTitle"].forEach(field => {
        if (!text(item[field]) || norm(item[field]) === norm(oldTitle)) set(field, patch.title);
      });
      const aliases = Array.isArray(item.aliases) ? item.aliases.slice() : [];
      [patch.title, oldTitle, item.en, item.original_title, item.original_name].map(text).filter(Boolean).forEach(value => {
        if (!aliases.some(alias => norm(alias) === norm(value))) aliases.push(value);
      });
      set("aliases", aliases.slice(0, 24));
    }
    if (patch.type) {
      set("type", patch.type);
      if (Object.prototype.hasOwnProperty.call(item, "category")) set("category", patch.type);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "year")) set("year", patch.year);
    if (Object.prototype.hasOwnProperty.call(patch, "rating")) set("rating", patch.rating);
    if (Object.prototype.hasOwnProperty.call(patch, "votes")) set("votes", patch.votes);
    if (Object.prototype.hasOwnProperty.call(patch, "poster")) set("poster", patch.poster);
    if (patch.genres) set("genres", patch.genres);
    if (patch.overview) {
      set("overview", patch.overview); set("overview_ru", patch.overview);
      set("description", patch.overview); set("description_ru", patch.overview);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "episodes")) set("episodes", patch.episodes);
    if (patch.studio) set("studio", patch.studio);
    if (patch.status) set("status", patch.status);
    if (changed.length) {
      delete item.__hay;
      item.__gkmV383AutoRepaired = true;
      if (persist && identity) {
        const store = autoRepairStore();
        store[identity] = {...(store[identity] || {}), ...patch, savedAt: Date.now()};
        writeJson(AUTO_REPAIRS_STORE, store);
      }
    }
    return changed;
  }
  function applyStoredRepair(item) {
    if (!item || typeof item !== "object") return item;
    const identity = repairIdentity(item);
    if (!identity) return item;
    const patch = autoRepairStore()[identity];
    if (patch) applyRepairPatch(item, patch, false);
    return item;
  }
  function titleOf(item) {
    applyStoredRepair(item);
    try { if (typeof displayTitle === "function") return text(displayTitle(item)); } catch {}
    return text(item && (item.ru || item.title_ru || item.name || item.title || item.en || item.original_title)) || "Без названия";
  }
  function typeOf(item) {
    applyStoredRepair(item);
    try { if (typeof getType === "function") return text(getType(item)); } catch {}
    return text(item && (item.type || item.category || item.kind)) || "Каталог";
  }
  function yearOf(item) {
    applyStoredRepair(item);
    try { if (typeof getYear === "function") return text(getYear(item)); } catch {}
    const match = text(item && (item.year || item.release_date || item.first_air_date)).match(/(18\d{2}|19\d{2}|20\d{2})/);
    return match ? match[1] : "";
  }
  function ratingOf(item) {
    applyStoredRepair(item);
    try { if (typeof getRating === "function") return number(getRating(item)); } catch {}
    return number(item && (item.rating || item.vote_average || item.score));
  }
  function votesOf(item) {
    applyStoredRepair(item);
    try { if (typeof getVotes === "function") return number(getVotes(item)); } catch {}
    return number(item && (item.votes || item.vote_count || item.scored_by));
  }
  function genresOf(item) {
    applyStoredRepair(item);
    try {
      if (typeof getGenres === "function") {
        const result = getGenres(item);
        if (Array.isArray(result)) return result.map(text).filter(Boolean).slice(0, 10);
      }
    } catch {}
    const raw = item && (item.genres || item.genre || item.tags);
    if (Array.isArray(raw)) return raw.map(value => text(value && value.name || value)).filter(Boolean).slice(0, 10);
    return typeof raw === "string" ? raw.split(/[,|/;]+/).map(text).filter(Boolean).slice(0, 10) : [];
  }
  function posterOf(item) {
    applyStoredRepair(item);
    try { if (typeof posterSrc === "function") return text(posterSrc(item, 342)); } catch {}
    return text(item && (item.poster || item.poster_url || item.image || item.cover || item.thumbnail));
  }
  function keyOf(item) {
    if (!item) return "";
    const supplied = text(item.key);
    if (supplied) return supplied;
    try { if (typeof gkmV362StableKey === "function") return text(gkmV362StableKey(item)); } catch {}
    const id = text(item.id || item.tmdbId || item.kinopoiskId || item.mal_id);
    return id ? `${norm(typeOf(item))}|${norm(item.source || "catalog")}|${id}` : `${norm(typeOf(item))}|${norm(titleOf(item))}|${yearOf(item)}`;
  }
  function itemSnapshot(item) {
    return {
      key: keyOf(item), id: item && item.id, ru: titleOf(item), en: text(item && item.en),
      type: typeOf(item), year: yearOf(item), rating: ratingOf(item), votes: votesOf(item),
      genres: genresOf(item), poster: posterOf(item), source: text(item && item.source),
      episodes: number(item && (item.episodes || item.episode_count || item.number_of_episodes)),
      runtime: number(item && (item.runtime || item.duration)), studio: text(item && (item.studio || item.studios)),
      status: text(item && item.status)
    };
  }
  function repairSnapshot(item) {
    applyStoredRepair(item);
    return {
      title: rawTitleOf(item), displayTitle: titleOf(item), type: typeOf(item), year: yearOf(item),
      rating: ratingOf(item), votes: votesOf(item), genres: genresOf(item), poster: posterOf(item),
      overview: text(item && (item.overview_ru || item.description_ru || item.overview || item.description)),
      episodes: number(item && (item.episodes || item.episode_count || item.number_of_episodes)),
      studio: text(item && (item.studio || item.studios)), status: text(item && item.status)
    };
  }
  function canonicalDisplayTitle(item) {
    try {
      const value = originalDisplayTitle ? originalDisplayTitle(item) : (typeof displayTitle === "function" ? displayTitle(item) : "");
      return text(value);
    } catch { return rawTitleOf(item); }
  }
  function canonicalOverview(item) {
    try {
      const value = originalDisplayOverview ? originalDisplayOverview(item) : (typeof displayOverview === "function" ? displayOverview(item) : "");
      return text(value);
    } catch { return ""; }
  }
  function isGenericTitle(value) {
    return !text(value) || /^(?:без названия|untitled|null|undefined|аниме|фильм|сериал|мультфильм)(?:\s+\d+)?$/iu.test(text(value));
  }
  function sourceTrust(item) {
    const source = norm(item && item.source);
    if (/manual|official|shikimori/.test(source)) return 8;
    if (/jikan|myanimelist|kinopoisk/.test(source)) return 7;
    if (/tmdb/.test(source)) return 6;
    return source ? 4 : 2;
  }
  function originalNames(item) {
    return [item && item.en, item && item.original_title, item && item.original_name, item && item.title, item && item.name]
      .map(norm).filter(value => value && value !== norm(rawTitleOf(item)));
  }
  function identityStrength(a, b) {
    if (!a || !b) return 0;
    const pairs = [
      [a.mal_id || a.malId, b.mal_id || b.malId],
      [a.tmdbId || a.tmdb_id, b.tmdbId || b.tmdb_id],
      [a.kinopoiskId || a.kinopoisk_id || a.kp_id, b.kinopoiskId || b.kinopoisk_id || b.kp_id]
    ];
    if (pairs.some(([left, right]) => text(left) && text(left) === text(right))) return 5;
    if (norm(a.source) && norm(a.source) === norm(b.source) && text(a.id) && text(a.id) === text(b.id)) return 5;
    const leftNames = originalNames(a), rightNames = originalNames(b);
    if (leftNames.some(left => rightNames.includes(left))) {
      const sameYear = !yearOf(a) || !yearOf(b) || yearOf(a) === yearOf(b);
      return sameYear ? 4 : 2;
    }
    return 0;
  }
  function repairQuality(item) {
    const snapshot = repairSnapshot(item);
    return sourceTrust(item) * 100 + (snapshot.poster ? 30 : 0) + (snapshot.overview.length > 80 ? 20 : 0) +
      (snapshot.year ? 10 : 0) + (snapshot.genres.length ? 10 : 0) + Math.min(20, Math.log10(snapshot.votes + 1) * 4);
  }
  function localRepairPatch(item) {
    const patch = {};
    const issues = new Set(Array.isArray(item && item.__gkmV362CatalogIssues) ? item.__gkmV362CatalogIssues : []);
    const before = repairSnapshot(item);
    const canonicalTitle = canonicalDisplayTitle(item);
    if (canonicalTitle && !isGenericTitle(canonicalTitle) && norm(canonicalTitle) !== norm(before.title)) {
      patch.title = canonicalTitle;
      issues.add("title-mismatch");
    }
    const rawYear = text(item && (item.year || item.release_date || item.first_air_date));
    const yearMatch = rawYear.match(/(?:^|\D)(18\d{2}|19\d{2}|20\d{2})(?:\D|$)/);
    if (rawYear && (!yearMatch || number(yearMatch[1]) > new Date().getFullYear() + 5)) {
      patch.year = "";
      issues.add("invalid-year");
    }
    const rawRating = item && (item.rating ?? item.vote_average ?? item.score);
    if (rawRating !== "" && rawRating != null && (!Number.isFinite(Number(rawRating)) || Number(rawRating) < 0 || Number(rawRating) > 10)) {
      patch.rating = 0;
      issues.add("invalid-rating");
    }
    const rawVotes = item && (item.votes ?? item.vote_count ?? item.scored_by);
    if (rawVotes !== "" && rawVotes != null && (!Number.isFinite(Number(rawVotes)) || Number(rawVotes) < 0)) {
      patch.votes = 0;
      issues.add("invalid-votes");
    }
    const rawPoster = text(item && (item.poster || item.poster_url || item.image || item.cover));
    if (/^(?:javascript|file):/i.test(rawPoster)) {
      patch.poster = "";
      issues.add("unsafe-poster");
    }
    const overview = canonicalOverview(item);
    if (before.overview.length < 35 && overview.length >= 60) {
      patch.overview = overview;
      issues.add("missing-description");
    }
    if (isGenericTitle(before.title)) issues.add("missing-title");
    if (!before.poster) issues.add("missing-poster");
    return {patch, issues: [...issues]};
  }
  async function findTrustedCandidate(item) {
    const query = text(item && (item.en || item.original_title || item.original_name || rawTitleOf(item)));
    if (!query) return null;
    const rows = (await smartSearch(query)).slice(0, 80);
    const candidates = rows.filter(candidate => candidate && candidate !== item && identityStrength(item, candidate) >= 4);
    candidates.sort((a, b) => repairQuality(b) - repairQuality(a));
    return candidates[0] || null;
  }
  function mergeCandidatePatch(item, candidate, patch, issues) {
    if (!candidate || identityStrength(item, candidate) < 4) return patch;
    const before = repairSnapshot(item), trusted = repairSnapshot(candidate);
    const betterSource = sourceTrust(candidate) >= sourceTrust(item);
    if (trusted.displayTitle && !isGenericTitle(trusted.displayTitle) && norm(trusted.displayTitle) !== norm(before.title) && betterSource) {
      patch.title = trusted.displayTitle; issues.add("trusted-title-match");
    }
    if (!before.year && trusted.year) { patch.year = trusted.year; issues.add("missing-year"); }
    if ((!before.type || norm(before.type) === "каталог") && trusted.type) { patch.type = trusted.type; issues.add("missing-type"); }
    if (!before.poster && trusted.poster) { patch.poster = trusted.poster; issues.add("missing-poster"); }
    if (!before.genres.length && trusted.genres.length) { patch.genres = trusted.genres; issues.add("missing-genres"); }
    if (before.overview.length < 35 && trusted.overview.length >= 60) { patch.overview = trusted.overview; issues.add("missing-description"); }
    if (!before.episodes && trusted.episodes) { patch.episodes = trusted.episodes; issues.add("missing-episodes"); }
    if (!before.studio && trusted.studio) { patch.studio = trusted.studio; issues.add("missing-studio"); }
    if (!before.status && trusted.status) { patch.status = trusted.status; issues.add("missing-status"); }
    return patch;
  }
  function rememberRepair(result) {
    const rows = readJson(REPAIR_HISTORY_STORE, []);
    const history = Array.isArray(rows) ? rows : [];
    history.unshift({...result, at: Date.now()});
    writeJson(REPAIR_HISTORY_STORE, history.slice(0, 80));
  }
  function queuedRepairs() {
    const rows = readJson(REPAIR_QUEUE_STORE, []);
    return Array.isArray(rows) ? rows : [];
  }
  function queueUnresolvedRepair(item, result) {
    const identity = repairIdentity(item) || `unknown:${Date.now()}`;
    const rows = queuedRepairs().filter(row => row.identity !== identity);
    const entry = {
      identity, title: titleOf(item), kind: "Автопроверка: сложный случай",
      details: `Карточка помечена пользователем. Автопроверка не нашла безопасную замену. Диагностика: ${(result.issues || []).join(", ") || "явных технических ошибок нет"}.`,
      item: itemSnapshot(item), client_id: clientId(), createdAt: Date.now(), attempts: 0
    };
    rows.unshift(entry);
    writeJson(REPAIR_QUEUE_STORE, rows.slice(0, 100));
    return entry;
  }
  async function flushRepairQueue() {
    if (!endpoint()) return 0;
    const rows = queuedRepairs();
    if (!rows.length) return 0;
    const pending = rows.slice();
    let sent = 0;
    for (const entry of rows.slice(0, 3)) {
      try {
        await api("/api/reports", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(entry)}, 4500);
        const index = pending.findIndex(row => row.identity === entry.identity);
        if (index >= 0) pending.splice(index, 1);
        sent++;
      } catch {
        entry.attempts = number(entry.attempts) + 1;
        break;
      }
    }
    writeJson(REPAIR_QUEUE_STORE, pending);
    return sent;
  }
  async function autoRepairItem(item, {deep = true, flagged = false, saveHistory = true} = {}) {
    if (!item) return {status: "empty", changes: [], issues: [], titleBefore: "", titleAfter: ""};
    applyStoredRepair(item);
    const before = repairSnapshot(item);
    try { window.GKM_V362_CATALOG_GUARD_ITEM?.(item, "feature-center-v383-auto-repair"); } catch {}
    const local = localRepairPatch(item);
    const issues = new Set(local.issues);
    let patch = {...local.patch};
    let candidate = null;
    if (deep) {
      try { candidate = await findTrustedCandidate(item); patch = mergeCandidatePatch(item, candidate, patch, issues); }
      catch (error) { console.warn("GKM V383 trusted repair search", error); }
    }
    const changedFields = applyRepairPatch(item, patch, true);
    const after = repairSnapshot(item);
    const changes = [];
    if (norm(before.title) !== norm(after.title)) changes.push(`Название: «${before.title || "—"}» → «${after.title}»`);
    if (before.type !== after.type) changes.push(`Тип: ${before.type || "—"} → ${after.type || "—"}`);
    if (before.year !== after.year) changes.push(`Год: ${before.year || "—"} → ${after.year || "—"}`);
    if (before.poster !== after.poster) changes.push(after.poster ? "Постер восстановлен" : "Опасная ссылка постера удалена");
    if (before.overview !== after.overview && after.overview) changes.push("Описание восстановлено");
    if (!before.genres.length && after.genres.length) changes.push("Жанры восстановлены");
    if (!before.episodes && after.episodes) changes.push(`Эпизоды: ${after.episodes}`);
    if (!before.studio && after.studio) changes.push(`Студия: ${after.studio}`);
    const result = {
      status: changes.length || changedFields.length ? "fixed" : flagged ? "queued" : "clean",
      identity: repairIdentity(item), titleBefore: before.title, titleAfter: after.title,
      changes, issues: [...issues], candidate: candidate ? titleOf(candidate) : ""
    };
    if (result.status === "queued") queueUnresolvedRepair(item, result);
    if (saveHistory) rememberRepair(result);
    return result;
  }
  function registerItem(item) {
    applyStoredRepair(item);
    const key = keyOf(item);
    if (key) state.itemMap.set(key, item);
    return key;
  }
  function openItem(itemOrKey) {
    const item = typeof itemOrKey === "string" ? state.itemMap.get(itemOrKey) : itemOrKey;
    if (!item) return;
    state.lastItem = item;
    closeCenter();
    setTimeout(() => {
      try { if (typeof openDetails === "function") openDetails(item); }
      catch (error) { console.warn("GKM V382 open item", error); }
    }, 40);
  }
  function currentProfile() {
    try {
      const apiProfile = window.GKM_V363_MY_LIST?.getCurrentProfile?.();
      if (apiProfile) return apiProfile;
    } catch {}
    const name = text(localStorage.getItem(PROFILE_CURRENT));
    const store = readJson(PROFILE_STORE, {profiles: {}});
    return name && store.profiles ? store.profiles[name] || null : null;
  }
  function profileEntries() {
    const profile = currentProfile();
    return profile && Array.isArray(profile.myListV2) ? profile.myListV2 : [];
  }
  function collectPool() {
    const rows = [];
    try { if (typeof currentItems !== "undefined" && Array.isArray(currentItems)) rows.push(...currentItems); } catch {}
    try {
      if (typeof homeData !== "undefined" && homeData && homeData.sections) {
        Object.values(homeData.sections).forEach(section => {
          if (Array.isArray(section)) rows.push(...section);
          else if (section && Array.isArray(section.items)) rows.push(...section.items);
        });
      }
    } catch {}
    rows.push(...state.extraPool, ...profileEntries(), ...state.compare);
    document.querySelectorAll("#grid .card").forEach(card => {
      const title = text(card.querySelector(".card-title")?.textContent);
      if (!title) return;
      const raw = text(card.innerText);
      rows.push({
        ru: title,
        year: (raw.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/) || [])[1] || "",
        type: (raw.match(/\b(Фильм|Сериал|Аниме|Мультфильм)\b/i) || [])[1] || "Каталог",
        rating: number((raw.match(/★\s*(\d+(?:[.,]\d+)?)/) || [])[1]?.replace(",", "."))
      });
    });
    const map = new Map();
    rows.forEach(raw => {
      if (!raw || typeof raw !== "object") return;
      const item = typeof window.GKM_V362_CATALOG_GUARD_ITEM === "function"
        ? window.GKM_V362_CATALOG_GUARD_ITEM(raw, "feature-center-v382") : raw;
      if (!item || item.__gkmV362Quarantine) return;
      const key = keyOf(item);
      if (key && !map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }
  async function smartSearch(query) {
    const q = text(query);
    if (!q) return collectPool();
    try {
      if (typeof window.GKM_V359_SHARED_CATALOG_SEARCH === "function") {
        const result = await window.GKM_V359_SHARED_CATALOG_SEARCH(q, {exactTitle: false});
        const rows = Array.isArray(result && result.items) ? result.items : [];
        if (rows.length) {
          state.extraPool.push(...rows.slice(0, 80));
          if (state.extraPool.length > 500) state.extraPool = state.extraPool.slice(-500);
          return rows;
        }
      }
    } catch (error) {
      console.warn("GKM V382 search fallback", error);
    }
    const words = norm(q).split(" ").filter(Boolean);
    return collectPool().filter(item => {
      const hay = norm([titleOf(item), typeOf(item), yearOf(item), genresOf(item).join(" ")].join(" "));
      return words.every(word => hay.includes(word));
    });
  }
  function endpoint() {
    return text(window.GKM_COMMUNITY_CHAT_ENDPOINT || document.querySelector('meta[name="gkm-community-endpoint"]')?.content).replace(/\/+$/, "");
  }
  function clientId() {
    let id = text(localStorage.getItem(CLIENT_STORE));
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `gkm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try { localStorage.setItem(CLIENT_STORE, id); } catch {}
    }
    return id;
  }
  async function api(path, options = {}, timeoutMs = 12000) {
    if (!endpoint()) throw new Error("Сервер ещё не подключён.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, number(timeoutMs, 12000)));
    try {
      const response = await fetch(`${endpoint()}${path}`, {cache: "no-store", ...options, signal: controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(text(data.error) || `Ошибка ${response.status}`);
      return data;
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("Сервер долго не отвечает.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  function formatDate(value, withTime = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Дата уточняется";
    return new Intl.DateTimeFormat("ru-RU", withTime
      ? {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"}
      : {day: "2-digit", month: "long", year: "numeric"}).format(date);
  }
  function formatVotes(value) {
    const votes = number(value);
    if (votes >= 1e6) return `${(votes / 1e6).toFixed(1)} млн`;
    if (votes >= 1e3) return `${Math.round(votes / 1e3)} тыс`;
    return String(Math.round(votes || 0));
  }
  function miniCard(item, actions = "open") {
    const key = registerItem(item);
    const poster = posterOf(item);
    return `<article class="gkm382-card">
      ${poster ? `<img src="${esc(poster)}" alt="" loading="lazy" decoding="async">` : `<span class="gkm382-poster"></span>`}
      <div><h3>${esc(titleOf(item))}</h3>
      <p>${esc([typeOf(item), yearOf(item), ratingOf(item) ? `★ ${ratingOf(item).toFixed(1)}` : ""].filter(Boolean).join(" · "))}</p>
      <small>${esc(genresOf(item).slice(0, 4).join(" · "))}</small>
      <div class="gkm382-card-actions">
        ${actions.includes("open") ? `<button type="button" data-v382-open="${esc(key)}">Открыть</button>` : ""}
        ${actions.includes("compare") ? `<button type="button" data-v382-compare="${esc(key)}">⚖️</button>` : ""}
        ${actions.includes("vote") ? `<button type="button" data-v382-vote="${esc(key)}">Голосовать</button>` : ""}
      </div></div></article>`;
  }
  function toast(message) {
    ensureUi();
    const node = document.getElementById("gkmV382Toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("open");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("open"), 3000);
  }

  function ensureCss() {
    if (document.getElementById("gkmV382Css")) return;
    const style = document.createElement("style");
    style.id = "gkmV382Css";
    style.textContent = `
      #gkmV382Center{position:fixed;inset:0;z-index:100020;display:none;background:rgba(1,4,15,.82);backdrop-filter:blur(9px);color:#f3f7ff}
      #gkmV382Center.open{display:block}.gkm382-box{position:absolute;inset:12px;margin:auto;max-width:1280px;overflow:auto;border:1px solid rgba(0,214,255,.38);border-radius:24px;background:radial-gradient(circle at 10% 0,rgba(120,33,255,.19),transparent 35%),linear-gradient(145deg,#051328,#10113a);box-shadow:0 30px 100px #000;padding:16px}
      .gkm382-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:-16px;z-index:4;padding:14px 0;background:linear-gradient(#08142e 75%,transparent)}.gkm382-head h2{margin:0;font-size:26px}.gkm382-head p{margin:4px 0 0;opacity:.7}
      .gkm382-close{font-size:22px!important;min-width:46px}.gkm382-nav{display:flex;gap:7px;overflow:auto;padding:4px 0 12px;scrollbar-width:thin}.gkm382-nav button{white-space:nowrap;padding:8px 11px!important}.gkm382-nav button.active{background:linear-gradient(135deg,#00c69b,#1689ef)!important}
      .gkm382-content{min-height:480px}.gkm382-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px}.gkm382-tile{padding:16px;border:1px solid rgba(0,214,255,.22);border-radius:17px;background:rgba(255,255,255,.045);cursor:pointer}.gkm382-tile b{display:block;font-size:17px;margin-bottom:7px}.gkm382-tile span{font-size:13px;opacity:.7}
      .gkm382-toolbar,.gkm382-actions,.gkm382-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gkm382-toolbar input,.gkm382-toolbar select,.gkm382-form input,.gkm382-form select,.gkm382-form textarea,.gkm382-code{border:1px solid rgba(0,214,255,.3)!important;border-radius:12px!important;background:#06132b!important;color:#fff!important;padding:10px!important;box-sizing:border-box}.gkm382-toolbar input{min-width:240px;flex:1}.gkm382-form{display:grid;gap:9px;max-width:760px}.gkm382-form textarea,.gkm382-code{width:100%;min-height:100px;resize:vertical}
      .gkm382-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:10px}.gkm382-card{display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;padding:10px;border:1px solid rgba(0,214,255,.2);border-radius:16px;background:rgba(4,18,41,.8)}.gkm382-card img,.gkm382-poster{width:76px;height:110px;object-fit:cover;border-radius:10px;background:#151b31}.gkm382-card h3{font-size:15px;margin:0 0 5px;line-height:1.2}.gkm382-card p,.gkm382-card small{display:block;margin:3px 0;font-size:12px;opacity:.72}.gkm382-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.gkm382-card-actions button{padding:6px 8px!important;font-size:11px!important}
      .gkm382-section{padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(255,255,255,.035);margin:10px 0}.gkm382-section h3{margin:0 0 10px}.gkm382-empty{padding:24px;text-align:center;border:1px dashed rgba(0,214,255,.28);border-radius:16px;opacity:.72}.gkm382-note{font-size:12px;opacity:.68}.gkm382-good{color:#75f3ca}.gkm382-warn{color:#ffc56a}
      .gkm383-repair-card{display:grid;grid-template-columns:88px minmax(0,1fr);gap:13px;align-items:start}.gkm383-repair-card img{width:88px;height:128px;object-fit:cover;border-radius:12px;background:#121a31}.gkm383-repair-card h3{margin:0 0 6px}.gkm383-repair-status{padding:13px;border-radius:14px;border:1px solid rgba(82,240,197,.34);background:rgba(11,104,92,.18)}.gkm383-repair-status.warn{border-color:rgba(255,190,82,.42);background:rgba(121,75,8,.18)}.gkm383-repair-list{display:grid;gap:6px;margin:9px 0 0;padding-left:20px}.gkm383-repair-meter{height:9px;border-radius:99px;background:#111b36;overflow:hidden}.gkm383-repair-meter span{display:block;height:100%;background:linear-gradient(90deg,#7a2cff,#00d4ff);transition:width .2s}
      .gkm382-bars{display:grid;gap:8px}.gkm382-bar{display:grid;grid-template-columns:minmax(110px,180px) 1fr 45px;gap:8px;align-items:center}.gkm382-bar-track{height:12px;border-radius:99px;background:#111b36;overflow:hidden}.gkm382-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#7a2cff,#00d4ff)}
      .gkm382-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}.gkm382-stat{padding:14px;border:1px solid rgba(0,214,255,.18);border-radius:15px;background:rgba(0,120,180,.08)}.gkm382-stat b{display:block;font-size:24px}.gkm382-stat span{font-size:12px;opacity:.68}
      .gkm382-compare{width:100%;border-collapse:separate;border-spacing:6px}.gkm382-compare th,.gkm382-compare td{min-width:145px;padding:10px;border-radius:11px;background:rgba(255,255,255,.045);text-align:left;vertical-align:top}.gkm382-compare th{color:#77f1d2}.gkm382-compare img{width:80px;height:116px;object-fit:cover;border-radius:10px}.gkm382-table-wrap{overflow:auto}
      .gkm382-chip.active{outline:2px solid #55f0cb}.gkm382-chip.avoid{outline:2px solid #ff648f}.gkm382-calendar-row{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center;padding:10px;border-bottom:1px solid rgba(255,255,255,.08)}
      #gkmV382Toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100030;display:none;max-width:min(700px,calc(100vw - 20px));padding:11px 15px;border:1px solid rgba(60,238,196,.5);border-radius:14px;background:#06162d;color:#fff;font-weight:850;box-shadow:0 0 30px rgba(0,220,190,.22)}#gkmV382Toast.open{display:block}
      #gkmV382DetailActions{display:flex;gap:6px;flex-wrap:wrap;width:100%}#gkmV382DetailActions button{padding:8px 10px!important}
      @media(max-width:700px){.gkm382-box{inset:4px;padding:10px}.gkm382-head{top:-10px}.gkm382-head h2{font-size:20px}.gkm382-content{min-height:400px}.gkm382-grid{grid-template-columns:1fr}.gkm382-calendar-row{grid-template-columns:1fr}.gkm382-compare th,.gkm382-compare td{min-width:125px}.gkm382-bar{grid-template-columns:105px 1fr 38px}.gkm383-repair-card{grid-template-columns:70px minmax(0,1fr)}.gkm383-repair-card img{width:70px;height:102px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    ensureCss();
    let root = document.getElementById("gkmV382Center");
    if (!root) {
      root = document.createElement("div");
      root.id = "gkmV382Center";
      root.innerHTML = `<section class="gkm382-box" role="dialog" aria-modal="true" aria-labelledby="gkmV382Title">
        <header class="gkm382-head"><div><h2 id="gkmV382Title">🚀 Центр возможностей V383</h2><p>Все дополнительные функции каталога в одном месте</p></div><button class="gkm382-close" type="button" aria-label="Закрыть">✕</button></header>
        <nav class="gkm382-nav">${VIEWS.map(([id, label]) => `<button type="button" data-v382-view="${id}">${label}</button>`).join("")}</nav>
        <div id="gkmV382Content" class="gkm382-content"></div>
      </section>`;
      root.addEventListener("click", event => {
        if (event.target === root || event.target.closest(".gkm382-close")) closeCenter();
        const view = event.target.closest("[data-v382-view]")?.dataset.v382View;
        if (view) { state.view = view; render(); }
        const open = event.target.closest("[data-v382-open]")?.dataset.v382Open;
        if (open) openItem(open);
        const compare = event.target.closest("[data-v382-compare]")?.dataset.v382Compare;
        if (compare) addCompare(state.itemMap.get(compare));
      });
      root.addEventListener("keydown", event => { if (event.key === "Escape") closeCenter(); });
      document.body.appendChild(root);
    }
    if (!document.getElementById("gkmV382Toast")) {
      const node = document.createElement("div"); node.id = "gkmV382Toast"; document.body.appendChild(node);
    }
    ensureLauncher();
    return root;
  }
  function ensureLauncher() {
    const grid = document.querySelector("#gkmV363Collections .gkm-v363-collections-grid");
    if (grid && !document.getElementById("gkmV382CenterBtn")) {
      const button = document.createElement("button");
      button.id = "gkmV382CenterBtn"; button.className = "tab"; button.type = "button";
      button.textContent = "🚀 Центр возможностей"; button.onclick = () => openCenter("home");
      grid.prepend(button);
    }
  }
  function ensureListLink() {
    const actions = document.querySelector("#gkmV363Panel.open .gkmV363Actions");
    if (!actions || actions.querySelector("[data-v382-center-link]")) return;
    const button = document.createElement("button");
    button.type = "button"; button.dataset.v382CenterLink = "1"; button.textContent = "🚀 Центр возможностей";
    button.onclick = () => { document.getElementById("gkmV363Panel")?.classList.remove("open"); openCenter("home"); };
    actions.prepend(button);
  }
  function openCenter(view = "home") {
    const root = ensureUi();
    state.view = VIEWS.some(([id]) => id === view) ? view : "home";
    root.classList.add("open");
    render();
  }
  function closeCenter() {
    document.getElementById("gkmV382Center")?.classList.remove("open");
    stopRoomPolling();
  }
  function content() { return document.getElementById("gkmV382Content"); }
  function render() {
    ensureUi();
    document.querySelectorAll("[data-v382-view]").forEach(button => button.classList.toggle("active", button.dataset.v382View === state.view));
    stopRoomPolling();
    const renderers = {home: renderHome, calendar: renderCalendar, taste: renderTaste, sync: renderSync, route: renderRoute, roulette: renderRoulette, compare: renderCompare, stats: renderStats, report: renderReport, ai: renderAi, room: renderRoom};
    (renderers[state.view] || renderHome)();
  }

  function renderHome() {
    const descriptions = {
      calendar: "Премьеры, будущие релизы и личные напоминания.", taste: "Любимые жанры и рекомендации с объяснениями.",
      sync: "Перенос профиля между телефоном и компьютером.", route: "Сезоны, фильмы и спешлы по порядку.",
      roulette: "Случайный выбор с фильтрами и исключениями.", compare: "Сравнение до четырёх карточек.",
      stats: "Просмотры, жанры, часы и активность.", report: "Сам проверяет и исправляет карточки без ручного описания.",
      ai: "Подборки по обычному текстовому запросу.", room: "Совместное голосование за просмотр."
    };
    content().innerHTML = `<div class="gkm382-tiles">${VIEWS.filter(([id]) => id !== "home").map(([id, label]) => `<button class="gkm382-tile" type="button" data-v382-view="${id}"><b>${label}</b><span>${descriptions[id]}</span></button>`).join("")}</div>
      <section class="gkm382-section"><b>Быстрый старт</b><div class="gkm382-actions"><button type="button" data-v382-view="roulette">🎲 Выбрать сейчас</button><button type="button" data-v382-view="calendar">📅 Что выходит</button><button type="button" data-v382-view="taste">🧠 Что мне подходит</button></div></section>`;
  }

  function releaseDate(item) {
    const raw = item && (item.next_episode_air_date || item.release_date || item.first_air_date || item.air_date || item.premiere_date || item.date);
    const date = new Date(raw || "");
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function reminders() {
    const rows = readJson(REMINDERS_STORE, []);
    return Array.isArray(rows) ? rows : [];
  }
  function saveReminders(rows) { writeJson(REMINDERS_STORE, rows.slice(0, 300)); }
  function calendarCandidates() {
    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const exact = collectPool().map(item => ({item, date: releaseDate(item)})).filter(row => row.date && row.date.getTime() >= now - 86400000);
    exact.sort((a, b) => a.date - b.date);
    if (exact.length) return exact.slice(0, 80);
    return collectPool().filter(item => number(yearOf(item)) >= currentYear)
      .sort((a, b) => number(yearOf(a)) - number(yearOf(b)) || ratingOf(b) - ratingOf(a)).slice(0, 40)
      .map(item => ({item, date: null}));
  }
  function renderCalendar() {
    checkDueReminders();
    const now = Date.now();
    const limits = {day: now + 86400000, week: now + 7 * 86400000, month: now + 31 * 86400000};
    const rows = calendarCandidates().filter(row => !row.date || row.date.getTime() <= limits[state.calendarMode]).slice(0, 30);
    const saved = reminders().sort((a, b) => number(a.at) - number(b.at));
    content().innerHTML = `<section class="gkm382-section"><h3>📅 Календарь релизов</h3>
      <div class="gkm382-actions">${[["day", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"]].map(([id, label]) => `<button type="button" data-calendar-mode="${id}" class="${state.calendarMode === id ? "active" : ""}">${label}</button>`).join("")}<button type="button" id="gkm382CalendarRefresh">Найти релизы ${new Date().getFullYear()}</button></div>
      <div>${rows.length ? rows.map(row => { const key = registerItem(row.item); return `<div class="gkm382-calendar-row"><b>${row.date ? esc(formatDate(row.date)) : esc(yearOf(row.item) || "Дата уточняется")}</b><span>${esc(titleOf(row.item))} · ${esc(typeOf(row.item))}</span><div><button type="button" data-v382-open="${esc(key)}">Открыть</button><button type="button" data-remind-item="${esc(key)}">Напомнить</button></div></div>`; }).join("") : `<div class="gkm382-empty">В загруженных карточках пока нет точных дат. Нажми «Найти релизы».</div>`}</div></section>
      <section class="gkm382-section"><h3>🔔 Мои напоминания</h3><div class="gkm382-form"><input id="gkm382ReminderTitle" placeholder="Название фильма или сериала"><input id="gkm382ReminderAt" type="datetime-local"><button type="button" id="gkm382ReminderAdd">Добавить напоминание</button></div>
      <div>${saved.length ? saved.map(row => `<div class="gkm382-calendar-row"><b>${esc(formatDate(row.at, true))}</b><span>${esc(row.title)}</span><button type="button" data-reminder-remove="${esc(row.id)}">Удалить</button></div>`).join("") : `<p class="gkm382-note">Напоминания хранятся в профиле браузера. Уведомление запрашивается только после твоего нажатия.</p>`}</div></section>`;
    document.querySelectorAll("[data-calendar-mode]").forEach(button => button.onclick = () => { state.calendarMode = button.dataset.calendarMode; renderCalendar(); });
    document.getElementById("gkm382CalendarRefresh").onclick = async () => {
      const button = document.getElementById("gkm382CalendarRefresh"); button.disabled = true; button.textContent = "Ищу…";
      const rowsFound = await smartSearch(`${new Date().getFullYear()} премьера новинка`);
      state.extraPool.push(...rowsFound.slice(0, 120)); renderCalendar();
    };
    document.querySelectorAll("[data-remind-item]").forEach(button => button.onclick = () => {
      const item = state.itemMap.get(button.dataset.remindItem);
      document.getElementById("gkm382ReminderTitle").value = titleOf(item);
      const date = releaseDate(item); if (date) document.getElementById("gkm382ReminderAt").value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById("gkm382ReminderAt").focus();
    });
    document.getElementById("gkm382ReminderAdd").onclick = addReminder;
    document.querySelectorAll("[data-reminder-remove]").forEach(button => button.onclick = () => {
      const id = button.dataset.reminderRemove;
      clearTimeout(reminderTimers.get(id)); reminderTimers.delete(id);
      saveReminders(reminders().filter(row => row.id !== id)); renderCalendar();
    });
  }
  async function addReminder() {
    const title = text(document.getElementById("gkm382ReminderTitle")?.value);
    const at = new Date(document.getElementById("gkm382ReminderAt")?.value || "").getTime();
    if (!title || !Number.isFinite(at)) { toast("Укажи название и дату."); return; }
    const rows = reminders(); rows.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, at, notified: false}); saveReminders(rows);
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    scheduleReminder(rows[rows.length - 1]); toast("Напоминание добавлено."); renderCalendar();
  }
  function scheduleReminder(row) {
    const delay = number(row.at) - Date.now();
    if (!row.id || reminderTimers.has(row.id) || !("Notification" in window) || delay <= 0 || delay > 86400000 || Notification.permission !== "granted") return;
    reminderTimers.set(row.id, setTimeout(() => {
      reminderTimers.delete(row.id);
      try { new Notification("ГОЛУБЬ Каталог Мира", {body: `Пора посмотреть: ${row.title}`, icon: "pwa-icon-192.png"}); } catch {}
      const rows = reminders(); const saved = rows.find(savedRow => savedRow.id === row.id);
      if (saved && !saved.notified) { saved.notified = true; saveReminders(rows); }
    }, delay));
  }
  function checkDueReminders() {
    const rows = reminders(); let changed = false;
    rows.forEach(row => {
      if (!row.notified && number(row.at) <= Date.now()) {
        row.notified = true; changed = true;
        if ("Notification" in window && Notification.permission === "granted") { try { new Notification("ГОЛУБЬ Каталог Мира", {body: `Пора посмотреть: ${row.title}`, icon: "pwa-icon-192.png"}); } catch {} }
      } else scheduleReminder(row);
    });
    if (changed) saveReminders(rows);
  }

  function tastePrefs() {
    const prefs = readJson(PREFS_STORE, {likeGenres: [], avoidGenres: []});
    if (!Array.isArray(prefs.likeGenres)) prefs.likeGenres = [];
    if (!Array.isArray(prefs.avoidGenres)) prefs.avoidGenres = [];
    return prefs;
  }
  function tasteWeights() {
    const genres = new Map(), types = new Map();
    const statusWeight = {completed: 4, watching: 3, want: 1, paused: 0, dropped: -4};
    profileEntries().forEach(entry => {
      const weight = (statusWeight[entry.status] ?? 1) + (entry.liked ? 5 : 0);
      genresOf(entry).forEach(genre => genres.set(genre, (genres.get(genre) || 0) + weight));
      const type = typeOf(entry); types.set(type, (types.get(type) || 0) + weight);
    });
    const prefs = tastePrefs(); prefs.likeGenres.forEach(genre => genres.set(genre, (genres.get(genre) || 0) + 8)); prefs.avoidGenres.forEach(genre => genres.set(genre, (genres.get(genre) || 0) - 12));
    return {genres: [...genres].sort((a, b) => b[1] - a[1]), types: [...types].sort((a, b) => b[1] - a[1])};
  }
  function barRows(rows, limit = 8) {
    const top = rows.filter(row => row[1] > 0).slice(0, limit); const max = Math.max(1, ...top.map(row => row[1]));
    return top.length ? `<div class="gkm382-bars">${top.map(([name, value]) => `<div class="gkm382-bar"><span>${esc(name)}</span><div class="gkm382-bar-track"><div class="gkm382-bar-fill" style="width:${Math.max(4, value / max * 100).toFixed(0)}%"></div></div><b>${value}</b></div>`).join("")}</div>` : `<div class="gkm382-empty">Добавь проекты в «Мой список» и отметь понравившиеся.</div>`;
  }
  function tasteRecommendations() {
    const prefs = tastePrefs(), entries = profileEntries(), excluded = new Set(entries.map(keyOf));
    const seeds = new Set([...prefs.likeGenres, ...tasteWeights().genres.filter(row => row[1] > 0).slice(0, 6).map(row => row[0])].map(norm));
    const avoid = new Set(prefs.avoidGenres.map(norm));
    return collectPool().filter(item => !excluded.has(keyOf(item))).map(item => {
      const gs = genresOf(item).map(norm); const common = gs.filter(genre => seeds.has(genre)).length; const blocked = gs.filter(genre => avoid.has(genre)).length;
      return {item, score: common * 100 - blocked * 250 + ratingOf(item) * 7 + Math.log10(votesOf(item) + 1) * 5, common};
    }).filter(row => row.common && row.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map(row => row.item);
  }
  function renderTaste() {
    const prefs = tastePrefs(), weights = tasteWeights();
    const genreChoices = [...new Set([...weights.genres.map(row => row[0]), ...collectPool().flatMap(genresOf)])].filter(Boolean).slice(0, 30);
    const recs = tasteRecommendations();
    content().innerHTML = `<section class="gkm382-section"><h3>🧠 Твой профиль вкуса</h3><p class="gkm382-note">Вес строится по просмотренному, текущему, лайкам и ручным настройкам.</p>${barRows(weights.genres)}</section>
      <section class="gkm382-section"><h3>Настрой жанры</h3><div class="gkm382-chips">${genreChoices.map(genre => `<button type="button" class="gkm382-chip ${prefs.likeGenres.includes(genre) ? "active" : ""} ${prefs.avoidGenres.includes(genre) ? "avoid" : ""}" data-taste-genre="${esc(genre)}">${prefs.avoidGenres.includes(genre) ? "🚫" : prefs.likeGenres.includes(genre) ? "👍" : "○"} ${esc(genre)}</button>`).join("")}</div><p class="gkm382-note">Нажатия переключают: нейтрально → нравится → не предлагать.</p></section>
      <section class="gkm382-section"><h3>Подходит тебе</h3><div class="gkm382-actions"><button type="button" id="gkm382TasteSearch">Расширить поиск</button></div><div class="gkm382-grid">${recs.length ? recs.map(item => miniCard(item, "open compare")).join("") : `<div class="gkm382-empty">Нужно несколько оценок или выбранных жанров.</div>`}</div></section>`;
    document.querySelectorAll("[data-taste-genre]").forEach(button => button.onclick = () => {
      const genre = button.dataset.tasteGenre, next = tastePrefs();
      if (next.likeGenres.includes(genre)) { next.likeGenres = next.likeGenres.filter(x => x !== genre); next.avoidGenres.push(genre); }
      else if (next.avoidGenres.includes(genre)) next.avoidGenres = next.avoidGenres.filter(x => x !== genre);
      else next.likeGenres.push(genre);
      next.likeGenres = [...new Set(next.likeGenres)].slice(0, 30); next.avoidGenres = [...new Set(next.avoidGenres)].slice(0, 30); writeJson(PREFS_STORE, next); renderTaste();
    });
    document.getElementById("gkm382TasteSearch").onclick = async () => {
      const query = tasteWeights().genres.filter(row => row[1] > 0).slice(0, 4).map(row => row[0]).join(" ") || "лучшие фильмы аниме сериалы";
      state.extraPool.push(...(await smartSearch(query)).slice(0, 100)); renderTaste();
    };
  }

  function utf8ToCode(value) {
    const bytes = new TextEncoder().encode(value); let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function codeToUtf8(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(base64); const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function syncPayload() {
    const profile = currentProfile();
    if (!profile) return null;
    const safe = JSON.parse(JSON.stringify(profile)); safe.pin = "";
    return {schema: "gkm-sync-v382", version: 382, savedAt: new Date().toISOString(), profile: safe, myGolub: readJson(MY_GOLUB_STORE, {}), taste: tastePrefs(), reminders: reminders()};
  }
  function localSyncCode(payload) { return `gkm382.${utf8ToCode(JSON.stringify(payload))}`; }
  function parseSyncCode(code) {
    const value = text(code); if (!value.startsWith("gkm382.")) throw new Error("Неверный код синхронизации.");
    const payload = JSON.parse(codeToUtf8(value.slice(7))); if (!payload || payload.schema !== "gkm-sync-v382") throw new Error("Неподдерживаемый формат."); return payload;
  }
  function applySync(payload) {
    const profile = payload && payload.profile; if (!profile || !text(profile.name)) throw new Error("В коде нет профиля.");
    const name = text(profile.name).replace(/[^\p{L}\p{N}_\- ]/gu, "").slice(0, 32) || "Синхронизация";
    profile.name = name; profile.pin = "";
    const store = readJson(PROFILE_STORE, {profiles: {}}); if (!store.profiles) store.profiles = {}; store.profiles[name] = profile;
    writeJson(PROFILE_STORE, store); localStorage.setItem(PROFILE_CURRENT, name);
    if (payload.myGolub && typeof payload.myGolub === "object") writeJson(MY_GOLUB_STORE, payload.myGolub);
    if (payload.taste) writeJson(PREFS_STORE, payload.taste); if (Array.isArray(payload.reminders)) saveReminders(payload.reminders);
    window.dispatchEvent(new CustomEvent("gkm:v363-list-updated", {detail: {profile: name}}));
    return name;
  }
  function renderSync() {
    const profile = currentProfile();
    content().innerHTML = `<section class="gkm382-section"><h3>☁️ Синхронизация профиля</h3>${profile ? `<p>Профиль: <b>${esc(profile.name)}</b> · ${profileEntries().length} записей</p>` : `<div class="gkm382-empty">Сначала создай профиль в «Моём списке 2.0».</div>`}
      <div class="gkm382-actions"><button type="button" id="gkm382CloudSave" ${profile ? "" : "disabled"}>Создать облачный код</button><button type="button" id="gkm382LocalCode" ${profile ? "" : "disabled"}>Создать резервный код</button><button type="button" id="gkm382CopyCode" ${state.syncCode ? "" : "disabled"}>Копировать код</button></div>
      <textarea id="gkm382SyncCode" class="gkm382-code" placeholder="Здесь появится код или вставь код с другого устройства">${esc(state.syncCode)}</textarea>
      <div class="gkm382-actions"><button type="button" id="gkm382CloudLoad">Загрузить облачный код</button><button type="button" id="gkm382LocalLoad">Импортировать резервный код</button></div>
      <p class="${state.syncMessage.includes("готов") ? "gkm382-good" : "gkm382-note"}">${esc(state.syncMessage || "PIN не передаётся. Облачный код случайный и действует ограниченное время.")}</p></section>`;
    document.getElementById("gkm382LocalCode").onclick = () => { const payload = syncPayload(); if (!payload) return; state.syncCode = localSyncCode(payload); state.syncMessage = "Резервный код готов. Скопируй его на другое устройство."; renderSync(); };
    document.getElementById("gkm382CopyCode").onclick = async () => { const value = text(document.getElementById("gkm382SyncCode").value); try { await navigator.clipboard.writeText(value); toast("Код скопирован."); } catch { toast("Выдели код и скопируй вручную."); } };
    document.getElementById("gkm382LocalLoad").onclick = () => { try { const name = applySync(parseSyncCode(document.getElementById("gkm382SyncCode").value)); state.syncMessage = `Профиль «${name}» загружен.`; toast(state.syncMessage); renderSync(); } catch (error) { state.syncMessage = error.message; renderSync(); } };
    document.getElementById("gkm382CloudSave").onclick = async () => {
      const payload = syncPayload(); if (!payload) return; state.syncMessage = "Сохраняю…"; renderSync();
      try { const data = await api("/api/sync", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({payload, client_id: clientId()})}); state.syncCode = text(data.code); state.syncMessage = `Облачный код готов до ${formatDate(data.expires_at, true)}.`; }
      catch (error) { state.syncCode = localSyncCode(payload); state.syncMessage = `${error.message} Создан резервный код без сервера.`; }
      renderSync();
    };
    document.getElementById("gkm382CloudLoad").onclick = async () => {
      const code = text(document.getElementById("gkm382SyncCode").value); if (!code || code.startsWith("gkm382.")) { document.getElementById("gkm382LocalLoad").click(); return; }
      state.syncMessage = "Загружаю…"; renderSync();
      try { const data = await api(`/api/sync/${encodeURIComponent(code)}`); const name = applySync(data.payload); state.syncMessage = `Профиль «${name}» загружен из облака.`; toast(state.syncMessage); }
      catch (error) { state.syncMessage = error.message; }
      renderSync();
    };
  }

  function routeOrder(item) {
    const title = titleOf(item); const numberMatch = title.match(/(?:сезон|часть|фильм|OVA|спешл)?\s*(\d{1,3})(?!\d)/i);
    const tail = numberMatch ? number(numberMatch[1]) : 0;
    return number(yearOf(item)) * 1000 + tail;
  }
  function routeSeed(item) {
    return titleOf(item)
      .replace(/\s+(?:сезон|часть|фильм|OVA|ONA|спешл)\s*\d.*$/iu, "")
      .replace(/\s+\d+(?:-й|-я|-е)?\s+сезон.*$/iu, "")
      .trim();
  }
  function renderRoute() {
    content().innerHTML = `<section class="gkm382-section"><h3>🧭 Порядок просмотра вселенной</h3><div class="gkm382-toolbar"><input id="gkm382RouteQuery" value="${esc(state.lastItem ? routeSeed(state.lastItem) : "")}" placeholder="Например: Наруто, Блич, Марвел"><button type="button" id="gkm382RouteSearch">Собрать порядок</button></div><p class="gkm382-note">Сортировка учитывает год, сезон/часть и исключает точные дубли.</p></section>
      <div id="gkm382RouteRows">${state.routeRows.length ? `<div class="gkm382-grid">${state.routeRows.map(item => miniCard(item, "open compare")).join("")}</div>` : `<div class="gkm382-empty">Введи название вселенной.</div>`}</div>`;
    document.getElementById("gkm382RouteSearch").onclick = async () => {
      const query = text(document.getElementById("gkm382RouteQuery").value); if (!query) return;
      document.getElementById("gkm382RouteRows").innerHTML = `<div class="gkm382-empty">Ищу все части…</div>`;
      const rows = await smartSearch(query); const map = new Map(); rows.forEach(item => { const key = keyOf(item); if (key && !map.has(key)) map.set(key, item); });
      state.routeRows = [...map.values()].sort((a, b) => routeOrder(a) - routeOrder(b) || ratingOf(b) - ratingOf(a)).slice(0, 60); renderRoute();
    };
  }

  function randomIndex(length) {
    if (length <= 1) return 0; try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % length; } catch { return Math.floor(Math.random() * length); }
  }
  function renderRoulette() {
    const allGenres = [...new Set(collectPool().flatMap(genresOf))].sort((a, b) => a.localeCompare(b, "ru")).slice(0, 160);
    content().innerHTML = `<section class="gkm382-section"><h3>🎲 Что посмотреть?</h3><div class="gkm382-toolbar"><select id="gkm382RouletteType"><option value="">Все типы</option><option>Фильм</option><option>Сериал</option><option>Аниме</option><option>Мультфильм</option></select><select id="gkm382RouletteGenre"><option value="">Любой жанр</option>${allGenres.map(genre => `<option>${esc(genre)}</option>`).join("")}</select><select id="gkm382RouletteRating"><option value="0">Любой рейтинг</option><option value="7">От 7</option><option value="8">От 8</option><option value="9">От 9</option></select><button type="button" id="gkm382Spin">Крутить</button></div><label><input id="gkm382ExcludeSeen" type="checkbox" checked> Не показывать просмотренное и брошенное</label></section>
      <div id="gkm382RouletteResult">${state.rouletteItem ? `<div class="gkm382-grid">${miniCard(state.rouletteItem, "open compare")}</div>` : `<div class="gkm382-empty">Настрой фильтры и нажми «Крутить».</div>`}</div>`;
    document.getElementById("gkm382Spin").onclick = async () => {
      const type = text(document.getElementById("gkm382RouletteType").value), genre = text(document.getElementById("gkm382RouletteGenre").value), min = number(document.getElementById("gkm382RouletteRating").value);
      const excluded = document.getElementById("gkm382ExcludeSeen").checked ? new Set(profileEntries().filter(row => ["completed", "dropped"].includes(row.status)).map(keyOf)) : new Set();
      let rows = collectPool().filter(item => (!type || typeOf(item) === type) && (!genre || genresOf(item).includes(genre)) && ratingOf(item) >= min && !excluded.has(keyOf(item)));
      if (rows.length < 5) rows = (await smartSearch([type, genre, min ? `рейтинг ${min}` : ""].filter(Boolean).join(" "))).filter(item => (!type || typeOf(item) === type) && (!genre || genresOf(item).map(norm).includes(norm(genre))) && ratingOf(item) >= min && !excluded.has(keyOf(item)));
      state.rouletteItem = rows[randomIndex(rows.length)] || null; renderRoulette(); if (!state.rouletteItem) toast("По этим условиям ничего не найдено.");
    };
  }

  function saveCompare() { state.compare = state.compare.slice(0, MAX_COMPARE); writeJson(COMPARE_STORE, state.compare); }
  function addCompare(item) {
    if (!item) return; const snapshot = itemSnapshot(item); if (state.compare.some(row => keyOf(row) === snapshot.key)) { toast("Карточка уже в сравнении."); return; }
    if (state.compare.length >= MAX_COMPARE) { toast("Можно сравнить не больше четырёх карточек."); return; }
    state.compare.push(snapshot); saveCompare(); toast("Добавлено в сравнение."); if (state.view === "compare" && document.getElementById("gkmV382Center")?.classList.contains("open")) renderCompare();
  }
  function renderCompare() {
    const rows = state.compare;
    const fields = [
      ["Постер", item => posterOf(item) ? `<img src="${esc(posterOf(item))}" alt="">` : "—"], ["Название", item => esc(titleOf(item))], ["Тип", item => esc(typeOf(item))], ["Год", item => esc(yearOf(item) || "—")],
      ["Рейтинг", item => ratingOf(item) ? ratingOf(item).toFixed(1) : "—"], ["Голосов", item => esc(formatVotes(votesOf(item)))], ["Жанры", item => esc(genresOf(item).slice(0, 6).join(", ") || "—")],
      ["Эпизоды", item => esc(number(item.episodes || item.episode_count || item.number_of_episodes) || "—")], ["Студия", item => esc(text(item.studio || item.studios) || "—")]
    ];
    content().innerHTML = `<section class="gkm382-section"><h3>⚖️ Сравнение карточек</h3><div class="gkm382-toolbar"><input id="gkm382CompareQuery" placeholder="Найти и добавить карточку"><button type="button" id="gkm382CompareSearch">Найти</button><button type="button" id="gkm382CompareClear">Очистить</button></div><div id="gkm382CompareFound" class="gkm382-grid">${state.compareSearch.slice(0, 8).map(item => miniCard(item, "open compare")).join("")}</div></section>
      ${rows.length ? `<div class="gkm382-table-wrap"><table class="gkm382-compare"><thead><tr><th>Параметр</th>${rows.map(item => `<th>${esc(titleOf(item))}<br><button type="button" data-compare-remove="${esc(keyOf(item))}">Убрать</button></th>`).join("")}</tr></thead><tbody>${fields.map(([label, value]) => `<tr><th>${label}</th>${rows.map(item => `<td>${value(item)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<div class="gkm382-empty">Открой карточку и нажми «⚖️ Сравнить» либо найди её здесь.</div>`}`;
    document.getElementById("gkm382CompareSearch").onclick = async () => { state.compareSearch = (await smartSearch(document.getElementById("gkm382CompareQuery").value)).slice(0, 12); renderCompare(); };
    document.getElementById("gkm382CompareClear").onclick = () => { state.compare = []; saveCompare(); renderCompare(); };
    document.querySelectorAll("[data-compare-remove]").forEach(button => button.onclick = () => { state.compare = state.compare.filter(item => keyOf(item) !== button.dataset.compareRemove); saveCompare(); renderCompare(); });
  }

  function estimateMinutes(entry) {
    const type = norm(typeOf(entry)), episodes = number(entry.episode || entry.episodes);
    if (type.includes("фильм") || type.includes("мультфильм")) return number(entry.runtime, 110);
    if (type.includes("аниме")) return Math.max(episodes, entry.status === "completed" ? 12 : 0) * 24;
    if (type.includes("сериал")) return Math.max(episodes, entry.status === "completed" ? 8 : 0) * 45;
    return 60;
  }
  function streakDays(entries) {
    const days = new Set(entries.map(row => number(row.lastWatchedAt || row.updatedAt)).filter(Boolean).map(value => new Date(value).toISOString().slice(0, 10)));
    let cursor = new Date(); cursor.setHours(0, 0, 0, 0); if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0; while (days.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setDate(cursor.getDate() - 1); } return streak;
  }
  function renderStats() {
    const entries = profileEntries(), completed = entries.filter(row => row.status === "completed"), minutes = completed.reduce((sum, row) => sum + estimateMinutes(row), 0);
    const genres = new Map(), types = new Map(); completed.forEach(row => { genresOf(row).forEach(g => genres.set(g, (genres.get(g) || 0) + 1)); types.set(typeOf(row), (types.get(typeOf(row)) || 0) + 1); });
    const statusRows = Object.entries(STATUS_LABELS).map(([key, label]) => [label, entries.filter(row => row.status === key).length]);
    content().innerHTML = `<section class="gkm382-section"><h3>📊 Личная статистика</h3>${entries.length ? `<div class="gkm382-stats"><div class="gkm382-stat"><b>${entries.length}</b><span>В списке</span></div><div class="gkm382-stat"><b>${completed.length}</b><span>Просмотрено</span></div><div class="gkm382-stat"><b>≈ ${Math.round(minutes / 60)}</b><span>Часов просмотра</span></div><div class="gkm382-stat"><b>${streakDays(entries)}</b><span>Дней подряд</span></div><div class="gkm382-stat"><b>${entries.length ? Math.round(completed.length / entries.length * 100) : 0}%</b><span>Завершено</span></div></div>` : `<div class="gkm382-empty">Статистика появится после добавления карточек в «Мой список 2.0».</div>`}</section>
      <section class="gkm382-section"><h3>Статусы</h3>${barRows(statusRows, 8)}</section><section class="gkm382-section"><h3>Любимые жанры</h3>${barRows([...genres].sort((a, b) => b[1] - a[1]), 10)}</section><section class="gkm382-section"><h3>Типы</h3>${barRows([...types].sort((a, b) => b[1] - a[1]), 8)}</section><p class="gkm382-note">Время приблизительное: фильмы считаются по средней длительности, сериалы и аниме — по отмеченным сериям.</p>`;
  }

  function idleTurn() {
    return new Promise(resolve => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => resolve(), {timeout: 120});
      else setTimeout(resolve, 0);
    });
  }
  async function runSelectedAutoRepair(item) {
    if (!item || state.repairBusy) return;
    state.repairBusy = true; state.repairResult = null; state.repairProgress = "Анализирую название, источник, год, постер, описание и дубли…"; renderReport();
    const result = await autoRepairItem(item, {deep: true, flagged: true});
    state.repairBusy = false; state.repairResult = result; state.repairProgress = ""; renderReport();
    if (result.status === "queued") setTimeout(() => flushRepairQueue().catch(() => {}), 80);
  }
  async function scanLoadedCatalog() {
    if (state.repairBusy) return;
    const map = new Map();
    collectPool().forEach(item => { const identity = repairIdentity(item) || keyOf(item); if (identity && !map.has(identity)) map.set(identity, item); });
    const rows = [...map.values()].slice(0, 2000);
    state.repairBusy = true; state.repairResult = null;
    let fixed = 0, problems = 0;
    for (let start = 0; start < rows.length; start += 80) {
      const chunk = rows.slice(start, start + 80);
      for (const item of chunk) {
        const result = await autoRepairItem(item, {deep: false, flagged: false, saveHistory: false});
        if (result.status === "fixed") fixed++;
        if (result.issues.length) problems++;
      }
      state.repairProgress = `Проверено ${Math.min(start + chunk.length, rows.length).toLocaleString("ru-RU")} из ${rows.length.toLocaleString("ru-RU")} · исправлено ${fixed}`;
      renderReport();
      await idleTurn();
    }
    state.repairBusy = false; state.repairProgress = "";
    state.repairResult = {
      status: fixed ? "fixed" : "clean", titleBefore: "Загруженный каталог", titleAfter: "Загруженный каталог",
      issues: problems ? [`Карточек с предупреждениями: ${problems}`] : [],
      changes: fixed ? [`Автоматически исправлено карточек: ${fixed}`, `Проверено без перезагрузки: ${rows.length}`] : [`Проверено карточек: ${rows.length}`, "Новых безопасных исправлений не потребовалось"]
    };
    rememberRepair(state.repairResult); renderReport();
  }
  function repairResultHtml(result) {
    if (!result) return "";
    const fixed = result.status === "fixed", queued = result.status === "queued";
    const title = fixed ? "✅ Исправлено автоматически" : queued ? "🧠 Передано автоматике" : "✅ Явных ошибок не найдено";
    const note = fixed
      ? "Исправление уже применено и сохранено в этом браузере."
      : queued
        ? "Безопасную замену нельзя угадать. Карточка сохранена в очередь и будет отправлена автоматически — ничего заполнять не нужно."
        : "Карточка прошла доступные проверки названия, источника, года, типа, постера и числовых полей.";
    const rows = [...(result.changes || []), ...(result.issues || []).map(value => `Проверка: ${value}`)];
    return `<div class="gkm383-repair-status ${queued ? "warn" : ""}"><b>${title}</b><p>${esc(note)}</p>${rows.length ? `<ul class="gkm383-repair-list">${rows.map(value => `<li>${esc(value)}</li>`).join("")}</ul>` : ""}</div>`;
  }
  function renderReport() {
    const item = state.lastItem || state.compare[0] || null;
    const queueCount = queuedRepairs().length;
    const poster = item ? posterOf(item) : "";
    content().innerHTML = `<section class="gkm382-section"><h3>🛠 Автоматическое исправление</h3>
      <p class="gkm382-good"><b>Тебе не нужно заполнять форму.</b> Открой подозрительную карточку и нажми «🛠 Ошибка» — система сама проверит и исправит всё, что можно подтвердить безопасно.</p>
      ${item ? `<div class="gkm383-repair-card">${poster ? `<img src="${esc(poster)}" alt="" loading="lazy" decoding="async">` : `<span class="gkm382-poster"></span>`}<div><h3>${esc(titleOf(item))}</h3><p>${esc([typeOf(item), yearOf(item), ratingOf(item) ? `★ ${ratingOf(item).toFixed(1)}` : "", text(item.source)].filter(Boolean).join(" · "))}</p><div class="gkm382-actions"><button type="button" id="gkm383RepairNow" ${state.repairBusy ? "disabled" : ""}>${state.repairBusy ? "Проверяю…" : "Проверить и исправить заново"}</button></div></div></div>` : `<div class="gkm382-empty">Открой карточку и нажми «🛠 Ошибка». Для уже загруженных карточек можно запустить общую проверку ниже.</div>`}
      ${state.repairProgress ? `<p class="gkm382-note">${esc(state.repairProgress)}</p><div class="gkm383-repair-meter"><span style="width:${state.repairBusy ? "65" : "100"}%"></span></div>` : ""}
      ${repairResultHtml(state.repairResult)}</section>
      <section class="gkm382-section"><h3>Проверка текущего набора</h3><p class="gkm382-note">Обрабатывает порциями до 2000 уже загруженных карточек, поэтому интерфейс не зависает.</p><button type="button" id="gkm383ScanLoaded" ${state.repairBusy ? "disabled" : ""}>🔍 Проверить загруженные карточки</button></section>
      <section class="gkm382-section"><b>Автоматическая очередь: ${queueCount}</b><p class="gkm382-note">Сложные случаи сохраняются без GitHub-форм и повторно отправляются серверу автоматически.</p></section>`;
    document.getElementById("gkm383RepairNow")?.addEventListener("click", () => runSelectedAutoRepair(item));
    document.getElementById("gkm383ScanLoaded").onclick = scanLoadedCatalog;
    const identity = item ? repairIdentity(item) : "";
    if (item && identity && state.repairAutoKey !== identity && !state.repairBusy && !state.repairResult) {
      state.repairAutoKey = identity;
      setTimeout(() => runSelectedAutoRepair(item), 20);
    }
  }

  function savedCollections() {
    const rows = readJson(COLLECTIONS_STORE, []); return Array.isArray(rows) ? rows : [];
  }
  function runAiPrompt(prompt) {
    document.getElementById("gkmAiFloatBtn")?.click();
    requestAnimationFrame(() => {
      const dialog = document.getElementById("gkmAiDialog"), input = dialog?.querySelector("#gkmAiInput,textarea,input[type='text']");
      if (!input) return; input.value = prompt; input.dispatchEvent(new Event("input", {bubbles: true}));
      const form = dialog.querySelector("form"); if (form?.requestSubmit) form.requestSubmit(); else dialog.querySelector("button[type='submit']")?.click();
    });
  }
  function filterAiRows(rows, prompt) {
    const negative = [...text(prompt).matchAll(/без\s+([\p{L}-]+)/giu)].map(match => norm(match[1])).filter(Boolean);
    const episodeLimit = number((text(prompt).match(/до\s+(\d{1,4})\s+сер/iu) || [])[1]);
    return rows.filter(item => {
      const genres = genresOf(item).map(norm);
      if (negative.some(word => genres.some(genre => genre.includes(word)))) return false;
      const episodes = number(item && (item.episodes || item.episode_count || item.number_of_episodes));
      if (episodeLimit && episodes && episodes > episodeLimit) return false;
      return true;
    });
  }
  function renderAi() {
    const saved = savedCollections();
    content().innerHTML = `<section class="gkm382-section"><h3>✨ Умные AI-подборки</h3><div class="gkm382-toolbar"><input id="gkm382AiPrompt" value="${esc(state.aiPrompt)}" placeholder="Например: мрачное аниме без романтики до 24 серий"><button type="button" id="gkm382AiBuild">Собрать</button><button type="button" id="gkm382AiAsk">Спросить Голубь AI</button></div><div class="gkm382-chips">${["Аниме с сильным героем", "Фильм на вечер без романтики", "Мрачный детектив", "Семейный мультфильм", "Короткий сериал с высоким рейтингом"].map(value => `<button type="button" data-ai-preset="${esc(value)}">${esc(value)}</button>`).join("")}</div></section>
      <section class="gkm382-section"><div class="gkm382-actions"><button type="button" id="gkm382AiSave" ${state.aiRows.length ? "" : "disabled"}>Сохранить подборку</button><button type="button" id="gkm382AiShare" ${state.aiRows.length ? "" : "disabled"}>Копировать подборку</button></div><div class="gkm382-grid">${state.aiRows.length ? state.aiRows.slice(0, 18).map(item => miniCard(item, "open compare")).join("") : `<div class="gkm382-empty">Опиши подборку обычными словами.</div>`}</div></section>
      ${saved.length ? `<section class="gkm382-section"><h3>Сохранённые подборки</h3>${saved.slice(0, 12).map(row => `<div class="gkm382-calendar-row"><b>${esc(row.name)}</b><span>${row.items.length} карточек</span><button type="button" data-ai-load="${esc(row.id)}">Открыть</button></div>`).join("")}</section>` : ""}`;
    document.querySelectorAll("[data-ai-preset]").forEach(button => button.onclick = () => { document.getElementById("gkm382AiPrompt").value = button.dataset.aiPreset; });
    document.getElementById("gkm382AiBuild").onclick = async () => { state.aiPrompt = text(document.getElementById("gkm382AiPrompt").value); if (!state.aiPrompt) return; state.aiRows = filterAiRows(await smartSearch(state.aiPrompt), state.aiPrompt).slice(0, 24); renderAi(); };
    document.getElementById("gkm382AiAsk").onclick = () => { const prompt = text(document.getElementById("gkm382AiPrompt").value); if (prompt) { closeCenter(); runAiPrompt(`Собери подборку: ${prompt}`); } };
    document.getElementById("gkm382AiSave").onclick = () => { const rows = savedCollections(); rows.unshift({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: state.aiPrompt || `Подборка ${new Date().toLocaleDateString("ru-RU")}`, createdAt: Date.now(), items: state.aiRows.slice(0, 30).map(itemSnapshot)}); writeJson(COLLECTIONS_STORE, rows.slice(0, 50)); toast("Подборка сохранена."); renderAi(); };
    document.getElementById("gkm382AiShare").onclick = async () => { const value = [state.aiPrompt || "Подборка ГОЛУБЬ", ...state.aiRows.slice(0, 20).map((item, i) => `${i + 1}. ${titleOf(item)} (${yearOf(item)})`)].join("\n"); try { await navigator.clipboard.writeText(value); toast("Подборка скопирована."); } catch { toast("Не получилось скопировать автоматически."); } };
    document.querySelectorAll("[data-ai-load]").forEach(button => button.onclick = () => { const row = savedCollections().find(x => x.id === button.dataset.aiLoad); if (row) { state.aiPrompt = row.name; state.aiRows = row.items || []; renderAi(); } });
  }

  function roomCandidates() {
    const rows = state.compare.length >= 2 ? state.compare : state.aiRows.length >= 2 ? state.aiRows : collectPool();
    const map = new Map(); rows.forEach(item => { const key = keyOf(item); if (key && !map.has(key)) map.set(key, itemSnapshot(item)); }); return [...map.values()].slice(0, 8);
  }
  function localRooms() { const rows = readJson(LOCAL_ROOMS_STORE, {}); return rows && typeof rows === "object" ? rows : {}; }
  function saveLocalRoom(room) { const rows = localRooms(); rows[room.code] = room; writeJson(LOCAL_ROOMS_STORE, rows); }
  function renderRoom() {
    if (state.room) { renderActiveRoom(); return; }
    const candidates = roomCandidates();
    content().innerHTML = `<section class="gkm382-section"><h3>👥 Комната совместного выбора</h3><div class="gkm382-form"><input id="gkm382RoomTitle" value="Что смотрим сегодня?" maxlength="80"><button type="button" id="gkm382RoomCreate" ${candidates.length >= 2 ? "" : "disabled"}>Создать комнату из ${candidates.length} карточек</button></div><p class="gkm382-note">Для своего набора сначала добавь 2–4 карточки в «Сравнение».</p></section><section class="gkm382-section"><h3>Войти по коду</h3><div class="gkm382-toolbar"><input id="gkm382RoomCode" placeholder="Код комнаты"><button type="button" id="gkm382RoomJoin">Войти</button></div></section><div class="gkm382-grid">${candidates.map(item => miniCard(item, "open")).join("")}</div>`;
    document.getElementById("gkm382RoomCreate").onclick = async () => {
      const title = text(document.getElementById("gkm382RoomTitle").value) || "Что смотрим?";
      try { const data = await api("/api/rooms", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({title, candidates, client_id: clientId()})}); state.room = data.room; }
      catch (error) { const code = `L${Math.random().toString(36).slice(2, 8).toUpperCase()}`; state.room = {code, title, candidates: candidates.map(item => ({...item, votes: 0})), local: true, message: `${error.message} Создана локальная комната.`}; saveLocalRoom(state.room); }
      renderActiveRoom();
    };
    document.getElementById("gkm382RoomJoin").onclick = async () => { const code = text(document.getElementById("gkm382RoomCode").value).toUpperCase(); if (!code) return; await loadRoom(code); };
  }
  function renderActiveRoom() {
    const room = state.room; if (!room) { renderRoom(); return; }
    content().innerHTML = `<section class="gkm382-section"><h3>👥 ${esc(room.title || "Комната")}</h3><div class="gkm382-actions"><button type="button" id="gkm382RoomCopy">Копировать код ${esc(room.code)}</button><button type="button" id="gkm382RoomRefresh">Обновить</button><button type="button" id="gkm382RoomLeave">Выйти</button></div><p class="${room.local ? "gkm382-warn" : "gkm382-good"}">${esc(room.message || (room.local ? "Локальный режим: голоса видны только на этом устройстве." : "Комната подключена. Голоса обновляются, пока окно открыто."))}</p></section><div class="gkm382-grid">${(room.candidates || []).map(item => { const key = registerItem(item); return `<article class="gkm382-card">${posterOf(item) ? `<img src="${esc(posterOf(item))}" alt="" loading="lazy">` : `<span class="gkm382-poster"></span>`}<div><h3>${esc(titleOf(item))}</h3><p>${esc([typeOf(item), yearOf(item)].filter(Boolean).join(" · "))}</p><b>${number(item.votes)} голосов</b><div class="gkm382-card-actions"><button type="button" data-v382-open="${esc(key)}">Открыть</button><button type="button" data-room-vote="${esc(key)}">Голосовать</button></div></div></article>`; }).join("")}</div>`;
    document.getElementById("gkm382RoomCopy").onclick = async () => { try { await navigator.clipboard.writeText(room.code); toast("Код комнаты скопирован."); } catch { toast(`Код: ${room.code}`); } };
    document.getElementById("gkm382RoomRefresh").onclick = () => loadRoom(room.code);
    document.getElementById("gkm382RoomLeave").onclick = () => { state.room = null; stopRoomPolling(); renderRoom(); };
    document.querySelectorAll("[data-room-vote]").forEach(button => button.onclick = () => voteRoom(button.dataset.roomVote));
    if (!room.local) startRoomPolling();
  }
  async function loadRoom(code) {
    const local = localRooms()[code];
    if (local) { state.room = local; renderActiveRoom(); return; }
    try { const data = await api(`/api/rooms/${encodeURIComponent(code)}`); state.room = data.room; renderActiveRoom(); }
    catch (error) { toast(error.message); if (state.room && !state.room.local) startRoomPolling(); }
  }
  async function voteRoom(candidateKey) {
    const room = state.room; if (!room) return;
    if (room.local) {
      room.candidates = room.candidates.map(item => ({...item, votes: number(item.votes) + (keyOf(item) === candidateKey ? 1 : 0)})); saveLocalRoom(room); renderActiveRoom(); return;
    }
    try { const data = await api(`/api/rooms/${encodeURIComponent(room.code)}/vote`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({candidate_id: candidateKey, client_id: clientId()})}); state.room = data.room; renderActiveRoom(); }
    catch (error) { toast(error.message); }
  }
  function startRoomPolling() {
    stopRoomPolling();
    state.roomTimer = setTimeout(async () => {
      if (state.view === "room" && document.getElementById("gkmV382Center")?.classList.contains("open") && state.room && !state.room.local && !document.hidden) await loadRoom(state.room.code);
    }, 12000);
  }
  function stopRoomPolling() { clearTimeout(state.roomTimer); state.roomTimer = 0; }

  function injectDetailActions(item) {
    const dialog = document.getElementById("detailsDialog"); if (!dialog || !dialog.hasAttribute("open")) return;
    applyStoredRepair(item);
    const anchor = document.getElementById("detailFacts") || dialog.querySelector(".details"); if (!anchor) return;
    let actions = document.getElementById("gkmV382DetailActions");
    if (!actions) { actions = document.createElement("div"); actions.id = "gkmV382DetailActions"; }
    if (actions.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", actions);
    actions.innerHTML = `<button type="button" data-v382-detail-compare>⚖️ Сравнить</button><button type="button" data-v382-detail-route>🧭 Порядок</button><button type="button" data-v382-detail-report>🛠 Автоисправить</button>`;
    actions.querySelector("[data-v382-detail-compare]").onclick = () => { addCompare(item); dialog.close?.(); openCenter("compare"); };
    actions.querySelector("[data-v382-detail-route]").onclick = () => { state.lastItem = item; dialog.close?.(); openCenter("route"); };
    actions.querySelector("[data-v382-detail-report]").onclick = () => { state.lastItem = item; state.repairResult = null; state.repairAutoKey = ""; dialog.close?.(); openCenter("report"); };
  }
  function patchAutoRepairAccessors() {
    if (window.GKM_V383_AUTO_REPAIR_PATCHED === "1") return;
    try {
      if (typeof displayTitle === "function") {
        originalDisplayTitle = displayTitle;
        displayTitle = function gkmV383DisplayTitle(item) { applyStoredRepair(item); return originalDisplayTitle.apply(this, arguments); };
      }
      if (typeof displayOverview === "function") {
        originalDisplayOverview = displayOverview;
        displayOverview = function gkmV383DisplayOverview(item) { applyStoredRepair(item); return originalDisplayOverview.apply(this, arguments); };
      }
      try { if (Array.isArray(currentItems)) currentItems.forEach(applyStoredRepair); } catch {}
      window.GKM_V383_AUTO_REPAIR_PATCHED = "1";
    } catch (error) { console.warn("GKM V383 repair accessors", error); }
  }
  function patchDetails() {
    if (window.GKM_V382_DETAILS_PATCHED === "1") return;
    try {
      if (typeof openDetails !== "function") return;
      const previous = openDetails;
      openDetails = function gkmV382OpenDetails(item) {
        applyStoredRepair(item);
        state.lastItem = item;
        const result = previous.apply(this, arguments);
        requestAnimationFrame(() => injectDetailActions(item));
        setTimeout(() => injectDetailActions(item), 180);
        return result;
      };
      window.GKM_V382_DETAILS_PATCHED = "1";
    } catch (error) { console.warn("GKM V382 details patch", error); }
  }
  function registerSw() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("sw.js?v=3830", {scope: "./"}).catch(error => console.warn("GKM V383 service worker", error));
  }
  function install() {
    patchAutoRepairAccessors(); ensureUi(); patchDetails(); registerSw(); checkDueReminders();
    document.addEventListener("click", event => {
      if (event.target.closest("#gkmV363ListBtn,[data-v373-nav='list']")) setTimeout(ensureListLink, 80);
    }, {passive: true});
    window.addEventListener("gkm:v363-list-updated", () => setTimeout(ensureListLink, 40));
    window.GKM_V382_FEATURE_CENTER = Object.freeze({version: VERSION, open: openCenter, close: closeCenter, addCompare, getCompare: () => [...state.compare], syncPayload, runAiPrompt, autoRepair: item => autoRepairItem(item, {deep: true, flagged: false}), scanLoaded: scanLoadedCatalog, getRepairQueue: queuedRepairs});
    window.GKM_V383_AUTO_REPAIR = window.GKM_V382_FEATURE_CENTER;
    if (queuedRepairs().length) setTimeout(() => flushRepairQueue().catch(() => {}), 2200);
    console.log("GKM V383: automatic repair and working compare installed");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once: true});
  else install();
})();
