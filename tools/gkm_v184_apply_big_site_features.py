#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V184 AUTO — большой пакет фич сайта без изменения франшиз.

Запуск:
python tools/gkm_v184_apply_big_site_features.py
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"

V184_BLOCK = r"""/* GKM V184 BIG SITE FEATURES START */
(function () {
  "use strict";

  window.GKM_V184_BIG_SITE_FEATURES_VERSION = "v184-big-site-features-2026-06-24";

  /*
    V184 — большой пакет фич сайта, без трогания франшиз:
    1) сохранение поиска/фильтров/страницы;
    2) качество выдачи: мусор вниз;
    3) умные постеры/заглушки;
    4) быстрые фильтры качества;
    5) мини-подробности на карточке;
    6) похожее по типу/жанрам;
    7) избранное по папкам;
    8) улучшенная история;
    9) умное случайное.
  */

  const LS = {
    state: "GKM_V184_STATE",
    favFolders: "GKM_V184_FAV_FOLDERS",
    history: "GKM_V184_HISTORY",
    lastOpened: "GKM_V184_LAST_OPENED",
    quickFilter: "GKM_V184_QUICK_FILTER"
  };

  const DEFAULT_FOLDERS = ["Смотреть позже", "Любимое", "Уже смотрел", "Брошено", "Для жены", "Аниме", "Фильмы на вечер"];

  function safeJsonParse(v, fallback) {
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadJson(key, fallback) {
    try { return safeJsonParse(localStorage.getItem(key), fallback); } catch (e) { return fallback; }
  }

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"']/g, "")
      .replace(/\s+/g, " ")
      .trim();
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

  function isCard(el) {
    if (!el || el.nodeType !== 1) return false;
    const t = norm(el.textContent);
    if (t.length < 20 || t.length > 1400) return false;
    return !!el.querySelector("img") && (
      t.includes("★") ||
      t.includes("фильм") ||
      t.includes("аниме") ||
      t.includes("сериал") ||
      t.includes("мультфильм")
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
    return bestCards.length ? { grid: best, cards: bestCards } : null;
  }

  function findCards() {
    const found = findGrid();
    return found ? found.cards : [];
  }

  function parseRating(card) {
    const t = text(card);
    const m = t.match(/★\s*([0-9]+(?:[.,][0-9]+)?)/) || t.match(/рейтинг[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
    const r = m ? parseFloat(m[1].replace(",", ".")) : 0;
    return Number.isFinite(r) ? r : 0;
  }

  function parseVotes(card) {
    const t = text(card).replace(/\u00a0/g, " ");
    const m = t.match(/([0-9]+(?:[.,][0-9]+)?)\s*(млн|тыс|голос)/i);
    if (!m) return 0;
    let n = parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(n)) return 0;
    const unit = (m[2] || "").toLowerCase();
    if (unit.includes("млн")) n *= 1000000;
    else if (unit.includes("тыс")) n *= 1000;
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
    return !!src && !src.includes("placeholder") && !src.includes("data:image/svg");
  }

  function cardType(card) {
    const t = norm(text(card));
    if (t.includes("аниме")) return "Аниме";
    if (t.includes("мультсериал")) return "Мультсериал";
    if (t.includes("мультфильм")) return "Мультфильм";
    if (t.includes("сериал")) return "Сериал";
    if (t.includes("фильм")) return "Фильм";
    return "—";
  }

  function cardTitle(card) {
    const selectors = [".title", ".card-title", ".movie-title", ".name", "[class*='title']", "h3", "h2", "b"];
    for (const s of selectors) {
      const el = card.querySelector(s);
      if (el) {
        const v = String(el.textContent || "").trim();
        if (v && v.length < 120 && !/^(фильм|аниме|сериал|мультфильм)$/i.test(v)) return v;
      }
    }
    const lines = String(card.textContent || "").split("\n").map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length > 2 && line.length < 90 && !line.includes("★") && !/^\d{4}/.test(line)) return line;
    }
    return "Без названия";
  }

  function cardGenres(card) {
    const t = text(card);
    const known = ["боевик","комедия","драма","криминал","фантастика","фэнтези","ужасы","триллер","детектив","приключения","мелодрама","документальный","история","спорт","военный","семейный","аниме","экшен"];
    return known.filter(g => norm(t).includes(g));
  }

  function qualityScore(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const y = parseYear(card);
    let s = 0;

    if (hasPoster(card)) s += 450; else s -= 550;
    s += Math.min(v, 2000000) / 4500;
    s += r * 70;

    if (r >= 9.8 && v < 100) s -= 850;
    if (r >= 9.5 && v < 500) s -= 450;
    if (v < 10) s -= 550;
    if (v < 100) s -= 240;
    if (y >= 2020) s += 35;
    if (y >= 2026 && v < 100) s -= 120;

    const title = norm(cardTitle(card));
    if (title.length <= 2) s -= 600;
    if (/^[a-z0-9]{1,3}$/.test(title)) s -= 650;
    if (title.includes("untitled") || title.includes("без названия")) s -= 300;
    if (norm(text(card)).includes("жанры не указаны")) s -= 150;

    return s;
  }

  function isTrash(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const title = norm(cardTitle(card));
    if (!hasPoster(card) && v < 300) return true;
    if (r >= 9.8 && v < 100) return true;
    if (v <= 10) return true;
    if (title.length <= 2) return true;
    if (/^[a-z0-9]{1,3}$/.test(title)) return true;
    return false;
  }

  function sortQuality() {
    const found = findGrid();
    if (!found || !found.cards.length) return;

    const rows = found.cards.map((card, idx) => ({ card, idx, score: qualityScore(card) }));
    rows.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);

    rows.forEach(r => {
      r.card.dataset.gkmV184QualityScore = String(Math.round(r.score));
      r.card.classList.toggle("gkm-v184-trash-card", isTrash(r.card));
    });
  }

  function improvePosters() {
    findCards().forEach(card => {
      if (hasPoster(card)) return;

      const img = card.querySelector("img");
      const candidates = [];
      card.querySelectorAll("[data-poster],[data-image],[data-src],[data-backdrop]").forEach(el => {
        candidates.push(el.dataset.poster, el.dataset.image, el.dataset.src, el.dataset.backdrop);
      });

      const bg = getComputedStyle(card).backgroundImage || "";
      const bgUrl = (bg.match(/url\(["']?(.+?)["']?\)/) || [])[1];
      if (bgUrl) candidates.push(bgUrl);

      const good = candidates.find(x => x && /^https?:\/\//.test(String(x)));
      if (good && img) {
        img.src = good;
        card.classList.remove("gkm-v184-no-poster");
      } else {
        card.classList.add("gkm-v184-no-poster");
      }
    });
  }

  function getState() {
    const input = getSearchInput();
    const selects = Array.from(document.querySelectorAll("select")).map(s => s.value);
    return {
      q: input ? input.value : "",
      selects,
      scrollY: window.scrollY || 0,
      pageText: getPageText(),
      ts: Date.now()
    };
  }

  function saveState() {
    saveJson(LS.state, getState());
  }

  function restoreState() {
    const st = loadJson(LS.state, null);
    if (!st || Date.now() - (st.ts || 0) > 1000 * 60 * 60 * 24 * 14) return;

    const input = getSearchInput();
    if (input && st.q && !input.value) {
      input.value = st.q;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const selects = Array.from(document.querySelectorAll("select"));
    if (Array.isArray(st.selects)) {
      selects.forEach((s, i) => {
        if (st.selects[i] != null && s.value !== st.selects[i]) {
          s.value = st.selects[i];
          s.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    if (st.scrollY) setTimeout(() => window.scrollTo(0, st.scrollY), 900);
  }

  function getPageText() {
    const body = text(document.body);
    const m = body.match(/Страница\s+([0-9]+)\s+из\s+([0-9]+)/i) || body.match(/([0-9]+)\s*\/\s*([0-9]+)/);
    return m ? `${m[1]}/${m[2]}` : "";
  }

  function addHistory(type, value, extra) {
    if (!value) return;
    const h = loadJson(LS.history, []);
    const item = {
      type,
      value: String(value).slice(0, 160),
      extra: extra || {},
      ts: Date.now()
    };
    const clean = h.filter(x => !(x.type === item.type && x.value === item.value));
    clean.unshift(item);
    saveJson(LS.history, clean.slice(0, 80));
  }

  function trackSearchHistory() {
    const input = getSearchInput();
    if (!input) return;
    const q = input.value.trim();
    if (q.length >= 2) addHistory("search", q);
  }

  function trackOpenHistory(e) {
    const card = e.target && e.target.closest && e.target.closest("*");
    const cards = findCards();
    const real = cards.find(c => c.contains(e.target));
    if (!real) return;
    const title = cardTitle(real);
    addHistory("open", title, { type: cardType(real), year: parseYear(real), rating: parseRating(real), votes: parseVotes(real) });
    saveJson(LS.lastOpened, { title, ts: Date.now() });
  }

  function applyQuickFilter() {
    const mode = localStorage.getItem(LS.quickFilter) || "";
    findCards().forEach(card => {
      let show = true;
      const r = parseRating(card);
      const v = parseVotes(card);

      if (mode === "normal") show = !isTrash(card) && hasPoster(card) && v >= 100;
      if (mode === "poster") show = hasPoster(card);
      if (mode === "popular") show = v >= 10000;
      if (mode === "hide-trash") show = !isTrash(card);
      if (mode === "rating7") show = r >= 7;
      if (mode === "votes1000") show = v >= 1000;

      card.style.display = show ? "" : "none";
    });

    document.querySelectorAll("[data-gkm-v184-filter]").forEach(b => {
      b.classList.toggle("active", b.dataset.gkmV184Filter === mode);
    });
  }

  function addQuickFilters() {
    if (document.querySelector(".gkm-v184-quickbar")) return;

    const bar = document.createElement("div");
    bar.className = "gkm-v184-quickbar";
    bar.innerHTML = `
      <button data-gkm-v184-filter="normal">🔥 Только норм</button>
      <button data-gkm-v184-filter="poster">🎬 С постером</button>
      <button data-gkm-v184-filter="popular">👑 Популярное</button>
      <button data-gkm-v184-filter="hide-trash">🧹 Скрыть мусор</button>
      <button data-gkm-v184-filter="rating7">⭐ 7+</button>
      <button data-gkm-v184-filter="votes1000">🗳 от 1000</button>
      <button data-gkm-v184-filter="">Сброс качества</button>
      <button data-gkm-v184-random="1">🎲 Умное случайное</button>
      <button data-gkm-v184-history="1">🕘 История+</button>
    `;

    const target = document.querySelector(".controls")
      || document.querySelector(".filters")
      || document.querySelector("header")
      || document.querySelector("main")
      || document.body;

    target.appendChild(bar);

    bar.querySelectorAll("[data-gkm-v184-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        localStorage.setItem(LS.quickFilter, btn.dataset.gkmV184Filter || "");
        applyQuickFilter();
      });
    });

    bar.querySelector("[data-gkm-v184-random]").addEventListener("click", smartRandom);
    bar.querySelector("[data-gkm-v184-history]").addEventListener("click", showHistoryPanel);
  }

  function addMiniDetails() {
    findCards().forEach(card => {
      if (card.querySelector(".gkm-v184-mini")) return;

      const mini = document.createElement("div");
      mini.className = "gkm-v184-mini";
      mini.innerHTML = `
        <b>${escapeHtml(cardTitle(card))}</b>
        <span>${parseYear(card) || "—"} · ${cardType(card)} · ★ ${parseRating(card) || "—"}</span>
        <span>${parseVotes(card).toLocaleString("ru-RU")} голосов</span>
        <small>${escapeHtml(cardGenres(card).join(" · ") || "жанры не найдены")}</small>
      `;

      card.style.position = card.style.position || "relative";
      card.appendChild(mini);
    });
  }

  function escapeHtml(v) {
    return String(v || "").replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
  }

  function smartRandom() {
    const cards = findCards().filter(card => {
      const mode = localStorage.getItem(LS.quickFilter) || "";
      if (card.style.display === "none") return false;
      if (isTrash(card)) return false;
      if (!hasPoster(card)) return false;
      if (parseVotes(card) < 100) return false;
      return true;
    });

    const pool = cards.length ? cards : findCards().filter(c => c.style.display !== "none");
    if (!pool.length) return;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    pick.scrollIntoView({ behavior: "smooth", block: "center" });
    pick.classList.add("gkm-v184-random-pick");
    setTimeout(() => pick.classList.remove("gkm-v184-random-pick"), 2200);

    addHistory("random", cardTitle(pick), { type: cardType(pick), year: parseYear(pick), rating: parseRating(pick), votes: parseVotes(pick) });
  }

  function showHistoryPanel() {
    closePanel();
    const h = loadJson(LS.history, []);
    const wrap = document.createElement("div");
    wrap.className = "gkm-v184-panel";
    wrap.innerHTML = `
      <div class="gkm-v184-panel-box">
        <div class="gkm-v184-panel-head">
          <h2>🕘 История+</h2>
          <button data-close="1">✕</button>
        </div>
        <div class="gkm-v184-panel-actions">
          <button data-clear="1">Очистить историю</button>
        </div>
        <div class="gkm-v184-history-list">
          ${h.length ? h.map(item => `
            <button data-history-value="${escapeHtml(item.value)}">
              <b>${item.type === "search" ? "Поиск" : item.type === "random" ? "Случайное" : "Открыто"}</b>
              <span>${escapeHtml(item.value)}</span>
              <em>${new Date(item.ts).toLocaleString("ru-RU")}</em>
            </button>
          `).join("") : `<p>История пока пустая.</p>`}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector("[data-close]").addEventListener("click", closePanel);
    wrap.querySelector("[data-clear]").addEventListener("click", () => {
      saveJson(LS.history, []);
      closePanel();
    });
    wrap.querySelectorAll("[data-history-value]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = getSearchInput();
        if (input) {
          input.value = btn.dataset.historyValue || "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closePanel();
      });
    });
  }

  function closePanel() {
    document.querySelectorAll(".gkm-v184-panel").forEach(x => x.remove());
  }

  function getFolders() {
    const x = loadJson(LS.favFolders, null);
    if (x && typeof x === "object") return x;
    const init = {};
    DEFAULT_FOLDERS.forEach(f => init[f] = []);
    saveJson(LS.favFolders, init);
    return init;
  }

  function saveToFolder(title, folder) {
    const data = getFolders();
    if (!data[folder]) data[folder] = [];
    if (!data[folder].includes(title)) data[folder].unshift(title);
    data[folder] = data[folder].slice(0, 250);
    saveJson(LS.favFolders, data);
    addHistory("folder", `${title} → ${folder}`);
  }

  function addFolderButtons() {
    findCards().forEach(card => {
      if (card.querySelector(".gkm-v184-folder-btn")) return;

      const btn = document.createElement("button");
      btn.className = "gkm-v184-folder-btn";
      btn.type = "button";
      btn.textContent = "＋";
      btn.title = "Добавить в папку";
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        showFolderMenu(card, btn);
      });

      card.style.position = card.style.position || "relative";
      card.appendChild(btn);
    });
  }

  function showFolderMenu(card, btn) {
    document.querySelectorAll(".gkm-v184-folder-menu").forEach(x => x.remove());

    const title = cardTitle(card);
    const data = getFolders();
    const menu = document.createElement("div");
    menu.className = "gkm-v184-folder-menu";
    menu.innerHTML = `
      <b>Добавить:</b>
      ${Object.keys(data).map(f => `<button data-folder="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join("")}
    `;
    document.body.appendChild(menu);

    const rect = btn.getBoundingClientRect();
    menu.style.left = Math.max(8, rect.left - 150) + "px";
    menu.style.top = (rect.bottom + 8) + "px";

    menu.querySelectorAll("[data-folder]").forEach(x => {
      x.addEventListener("click", () => {
        saveToFolder(title, x.dataset.folder);
        menu.remove();
      });
    });

    setTimeout(() => {
      document.addEventListener("click", function once() {
        menu.remove();
        document.removeEventListener("click", once, true);
      }, true);
    }, 50);
  }

  function fixSimilarInModal() {
    // Универсальный мягкий фикс: если открыта модалка и есть блок похожего,
    // карточки другого типа и явный мусор уводим вниз/приглушаем.
    const modal = Array.from(document.querySelectorAll("[role='dialog'],.modal,.popup,.overlay,dialog")).find(x => x.offsetParent !== null);
    if (!modal) return;

    const allCards = Array.from(modal.querySelectorAll("*")).filter(isCard);
    if (allCards.length < 2) return;

    const mainText = norm(text(modal).slice(0, 2500));
    let want = "";
    if (mainText.includes("аниме")) want = "Аниме";
    else if (mainText.includes("мультфильм")) want = "Мультфильм";
    else if (mainText.includes("сериал")) want = "Сериал";
    else if (mainText.includes("фильм")) want = "Фильм";

    allCards.forEach(card => {
      const badType = want && cardType(card) !== "—" && cardType(card) !== want;
      const bad = badType || isTrash(card);
      card.classList.toggle("gkm-v184-similar-down", bad);
    });
  }

  function cycle() {
    improvePosters();
    sortQuality();
    addQuickFilters();
    addMiniDetails();
    addFolderButtons();
    applyQuickFilter();
    fixSimilarInModal();
  }

  function scheduleCycle() {
    clearTimeout(window.__gkmV184Timer);
    window.__gkmV184Timer = setTimeout(cycle, 350);
  }

  function init() {
    addStyles();
    addQuickFilters();
    restoreState();

    document.addEventListener("input", () => { saveState(); scheduleCycle(); }, true);
    document.addEventListener("change", () => { saveState(); scheduleCycle(); }, true);
    document.addEventListener("click", e => { saveState(); trackOpenHistory(e); scheduleCycle(); }, true);

    const input = getSearchInput();
    if (input) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") setTimeout(trackSearchHistory, 50);
      }, true);
      input.addEventListener("blur", trackSearchHistory, true);
    }

    window.addEventListener("beforeunload", saveState);
    window.addEventListener("scroll", () => {
      clearTimeout(window.__gkmV184ScrollTimer);
      window.__gkmV184ScrollTimer = setTimeout(saveState, 250);
    }, { passive: true });

    const observer = new MutationObserver(scheduleCycle);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(scheduleCycle, 500);
    setTimeout(scheduleCycle, 1400);
    setTimeout(scheduleCycle, 2600);

    console.log("GKM: v184-big-site-features-2026-06-24");
  }

  function addStyles() {
    if (document.querySelector("#gkm-v184-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v184-style";
    style.textContent = `
      .gkm-v184-quickbar {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:10px 8px;
        border-top:1px solid rgba(0,216,255,.25);
        border-bottom:1px solid rgba(120,60,255,.25);
      }
      .gkm-v184-quickbar button,
      .gkm-v184-panel button,
      .gkm-v184-folder-menu button {
        border:1px solid #00d8ff;
        background:linear-gradient(135deg,#5a25d6,#04c9f4);
        color:#fff;
        border-radius:14px;
        padding:10px 14px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 0 14px rgba(0,216,255,.22);
      }
      .gkm-v184-quickbar button.active {
        background:linear-gradient(135deg,#ffae00,#b13cff);
      }
      .gkm-v184-trash-card {
        opacity:.62;
      }
      .gkm-v184-no-poster::before {
        content:"Нет постера";
        position:absolute;
        left:0;
        right:0;
        top:38%;
        text-align:center;
        z-index:3;
        color:#fff;
        font-weight:1000;
        text-shadow:0 0 10px #000;
      }
      .gkm-v184-mini {
        display:none;
        position:absolute;
        left:8px;
        right:8px;
        bottom:8px;
        z-index:60;
        padding:10px;
        border:1px solid rgba(0,216,255,.6);
        border-radius:14px;
        background:rgba(5,7,25,.94);
        color:#fff;
        box-shadow:0 0 20px rgba(0,216,255,.25);
        pointer-events:none;
      }
      *:hover > .gkm-v184-mini {
        display:flex;
        flex-direction:column;
        gap:4px;
      }
      .gkm-v184-mini b {font-size:14px}
      .gkm-v184-mini span,.gkm-v184-mini small {font-size:12px;color:#d7d2ff}
      .gkm-v184-random-pick {
        outline:4px solid #00d8ff !important;
        box-shadow:0 0 35px rgba(0,216,255,.85) !important;
      }
      .gkm-v184-folder-btn {
        position:absolute;
        right:9px;
        top:42px;
        z-index:65;
        width:32px;
        height:32px;
        border-radius:50%;
        border:1px solid #00d8ff;
        background:linear-gradient(135deg,#5a25d6,#04c9f4);
        color:#fff;
        font-weight:1000;
        cursor:pointer;
      }
      .gkm-v184-folder-menu {
        position:fixed;
        z-index:9999999;
        width:230px;
        display:flex;
        flex-direction:column;
        gap:7px;
        padding:12px;
        border:1px solid rgba(0,216,255,.55);
        border-radius:16px;
        background:rgba(7,8,28,.96);
        color:#fff;
        box-shadow:0 0 24px rgba(0,216,255,.3);
      }
      .gkm-v184-folder-menu b {margin-bottom:4px}
      .gkm-v184-panel {
        position:fixed;
        inset:0;
        z-index:9999998;
        overflow:auto;
        padding:28px;
        background:rgba(2,4,16,.78);
        backdrop-filter:blur(4px);
      }
      .gkm-v184-panel-box {
        max-width:900px;
        margin:0 auto;
        padding:18px;
        border:1px solid rgba(0,216,255,.4);
        border-radius:18px;
        background:rgba(10,8,35,.96);
        color:#fff;
      }
      .gkm-v184-panel-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      }
      .gkm-v184-panel-head h2 {margin:0}
      .gkm-v184-panel-actions {margin:14px 0}
      .gkm-v184-history-list {
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .gkm-v184-history-list button {
        display:grid;
        grid-template-columns:100px 1fr auto;
        gap:10px;
        align-items:center;
        text-align:left;
      }
      .gkm-v184-history-list em {
        color:#cfc9ff;
        font-style:normal;
        font-size:12px;
      }
      .gkm-v184-similar-down {
        opacity:.45;
        filter:grayscale(.6);
        order:9999;
      }
      @media(max-width:760px) {
        .gkm-v184-history-list button {grid-template-columns:1fr}
        .gkm-v184-panel {padding:10px}
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V184_APPLY_BIG_SITE_FEATURES = cycle;
  window.GKM_V184_SMART_RANDOM = smartRandom;
  window.GKM_V184_SHOW_HISTORY_PLUS = showHistoryPanel;
})();
/* GKM V184 BIG SITE FEATURES END */"""

def log(msg: str) -> None:
    print(f"[GKM V184 AUTO] {msg}", flush=True)

def remove_block(text: str, start: str, end: str) -> str:
    return re.sub(re.escape(start) + r".*?" + re.escape(end), "", text, flags=re.S)

def patch_app() -> None:
    if not APP.exists():
        raise SystemExit(f"app.js not found: {APP}")
    text = APP.read_text(encoding="utf-8", errors="replace")
    text = remove_block(text, "/* GKM V184 BIG SITE FEATURES START */", "/* GKM V184 BIG SITE FEATURES END */")
    text = text.rstrip() + "\n\n" + V184_BLOCK.strip() + "\n"
    APP.write_text(text, encoding="utf-8")
    log("app.js patched with V184")

def patch_html() -> None:
    for rel in ["index.html", "film/index.html", "downloads/index.html"]:
        path = ROOT / rel
        if not path.exists():
            log(f"skip missing {rel}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r'app\.js\?v=\d+', 'app.js?v=184', text)
        text = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=184', text)
        if "app.js?v=184" not in text and "app.js" in text:
            text = text.replace("app.js", "app.js?v=184", 1)
        path.write_text(text, encoding="utf-8")
        log(f"updated {rel}")

def node_check() -> None:
    if shutil.which("node") is None:
        log("node not found, skip")
        return
    res = subprocess.run(["node", "--check", str(APP)], cwd=ROOT, text=True, capture_output=True)
    if res.returncode:
        print(res.stdout)
        print(res.stderr)
        raise SystemExit(res.returncode)
    log("node --check OK")

def main() -> int:
    patch_app()
    patch_html()
    node_check()
    log("DONE")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
