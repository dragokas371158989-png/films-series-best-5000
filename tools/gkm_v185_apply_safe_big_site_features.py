#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V185 AUTO — безопасный фикс большого пакета фич.

Удаляет сломанный V184, добавляет безопасный V185.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"

V185_BLOCK = r"""/* GKM V185 SAFE BIG SITE FEATURES START */
(function () {
  "use strict";

  window.GKM_V185_SAFE_BIG_SITE_FEATURES_VERSION = "v185-safe-big-site-features-no-load-crash-2026-06-24";

  /*
    V185 FIX:
    V184 ломал загрузку, потому что слишком рано дергал input/change и сайт пытался делать .filter у null.
    Тут всё безопасно:
    - НЕТ авто-восстановления поиска при старте;
    - НЕТ принудительного input/change до загрузки базы;
    - новые кнопки работают только по уже отрисованным карточкам;
    - все функции завернуты в safeRun, чтобы не валить сайт;
    - кнопка "↩ Вернуть место" восстанавливает вручную.
  */

  const LS = {
    state: "GKM_V185_STATE",
    history: "GKM_V185_HISTORY",
    folders: "GKM_V185_FOLDERS",
    quick: "GKM_V185_QUICK_FILTER"
  };

  const FOLDERS = ["Смотреть позже", "Любимое", "Уже смотрел", "Брошено", "Для жены", "Аниме", "Фильмы на вечер"];

  function safeRun(name, fn) {
    try { return fn(); } catch (e) { console.warn("GKM V185 safe:", name, e); return null; }
  }

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
  }

  function loadJson(k, fb) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch (e) { return fb; }
  }

  function saveJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function getSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function text(el) {
    return String(el && el.textContent || "");
  }

  function isCard(el) {
    if (!el || el.nodeType !== 1) return false;
    const t = norm(el.textContent);
    if (t.length < 20 || t.length > 1500) return false;
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
    let best = null, bestCards = [];
    for (const el of possible) {
      const cards = Array.from(el.children || []).filter(isCard);
      if (cards.length > bestCards.length) {
        best = el;
        bestCards = cards;
      }
    }
    return best && bestCards.length ? { grid: best, cards: bestCards } : null;
  }

  function cards() {
    const g = findGrid();
    return g ? g.cards : [];
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
    if (u.includes("тыс")) n *= 1000;
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

  function titleOf(card) {
    const selectors = [".title", ".card-title", ".movie-title", ".name", "[class*='title']", "h3", "h2", "b"];
    for (const s of selectors) {
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
    if (t.includes("аниме")) return "Аниме";
    if (t.includes("мультсериал")) return "Мультсериал";
    if (t.includes("мультфильм")) return "Мультфильм";
    if (t.includes("сериал")) return "Сериал";
    if (t.includes("фильм")) return "Фильм";
    return "—";
  }

  function genresOf(card) {
    const t = norm(text(card));
    const known = ["боевик","комедия","драма","криминал","фантастика","фэнтези","ужасы","триллер","детектив","приключения","мелодрама","документальный","история","спорт","военный","семейный","экшен"];
    return known.filter(g => t.includes(g));
  }

  function trash(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const title = norm(titleOf(card));
    if (!hasPoster(card) && v < 300) return true;
    if (r >= 9.8 && v < 100) return true;
    if (v > 0 && v <= 10) return true;
    if (title.length <= 2) return true;
    if (/^[a-z0-9]{1,3}$/.test(title)) return true;
    if (title.includes("untitled")) return true;
    return false;
  }

  function qualityScore(card) {
    const r = parseRating(card);
    const v = parseVotes(card);
    const y = parseYear(card);
    const title = norm(titleOf(card));
    let s = 0;
    s += hasPoster(card) ? 400 : -500;
    s += Math.min(v, 2000000) / 4500;
    s += r * 60;
    if (r >= 9.8 && v < 100) s -= 800;
    if (r >= 9.5 && v < 500) s -= 400;
    if (v > 0 && v < 50) s -= 250;
    if (v === 0) s -= 80;
    if (y >= 2020) s += 25;
    if (title.length <= 2 || /^[a-z0-9]{1,3}$/.test(title)) s -= 600;
    return s;
  }

  function sortQuality() {
    const found = findGrid();
    if (!found || !found.cards.length) return;

    const rows = found.cards.map((card, idx) => ({ card, idx, score: qualityScore(card) }));
    rows.sort((a,b) => (b.score - a.score) || (a.idx - b.idx));

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);

    rows.forEach(r => {
      r.card.classList.toggle("gkm-v185-trash-card", trash(r.card));
      r.card.dataset.gkmV185Quality = String(Math.round(r.score));
    });
  }

  function applyQuickFilter() {
    const mode = localStorage.getItem(LS.quick) || "";
    cards().forEach(card => {
      let show = true;
      const r = parseRating(card);
      const v = parseVotes(card);

      if (mode === "normal") show = !trash(card) && hasPoster(card) && (v === 0 || v >= 100);
      if (mode === "poster") show = hasPoster(card);
      if (mode === "popular") show = v >= 10000;
      if (mode === "hideTrash") show = !trash(card);
      if (mode === "rating7") show = r >= 7;
      if (mode === "votes1000") show = v >= 1000;

      card.style.display = show ? "" : "none";
    });

    document.querySelectorAll("[data-gkm-v185-filter]").forEach(b => b.classList.toggle("active", (b.dataset.gkmV185Filter || "") === mode));
  }

  function addQuickBar() {
    if (document.querySelector(".gkm-v185-quickbar")) return;

    const bar = document.createElement("div");
    bar.className = "gkm-v185-quickbar";
    bar.innerHTML = `
      <button data-gkm-v185-filter="normal">🔥 Только норм</button>
      <button data-gkm-v185-filter="poster">🎬 С постером</button>
      <button data-gkm-v185-filter="popular">👑 Популярное</button>
      <button data-gkm-v185-filter="hideTrash">🧹 Скрыть мусор</button>
      <button data-gkm-v185-filter="rating7">⭐ 7+</button>
      <button data-gkm-v185-filter="votes1000">🗳 от 1000</button>
      <button data-gkm-v185-filter="">Сброс качества</button>
      <button data-gkm-v185-random="1">🎲 Умное случайное</button>
      <button data-gkm-v185-restore="1">↩ Вернуть место</button>
      <button data-gkm-v185-history="1">🕘 История+</button>
    `;

    const anchor = document.querySelector(".controls") || document.querySelector(".filters") || document.querySelector("header") || document.querySelector("main") || document.body;
    anchor.appendChild(bar);

    bar.querySelectorAll("[data-gkm-v185-filter]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem(LS.quick, btn.dataset.gkmV185Filter || "");
        safeRun("quick", () => { sortQuality(); applyQuickFilter(); });
      });
    });

    bar.querySelector("[data-gkm-v185-random]")?.addEventListener("click", e => { e.preventDefault(); safeRun("random", smartRandom); });
    bar.querySelector("[data-gkm-v185-restore]")?.addEventListener("click", e => { e.preventDefault(); safeRun("restore", restorePlaceManual); });
    bar.querySelector("[data-gkm-v185-history]")?.addEventListener("click", e => { e.preventDefault(); safeRun("history", showHistory); });
  }

  function addMiniDetails() {
    cards().forEach(card => {
      if (card.querySelector(".gkm-v185-mini")) return;
      const mini = document.createElement("div");
      mini.className = "gkm-v185-mini";
      mini.innerHTML = `
        <b>${esc(titleOf(card))}</b>
        <span>${parseYear(card) || "—"} · ${typeOf(card)} · ★ ${parseRating(card) || "—"}</span>
        <span>${parseVotes(card).toLocaleString("ru-RU")} голосов</span>
        <small>${esc(genresOf(card).join(" · ") || "жанры не найдены")}</small>
      `;
      card.style.position = card.style.position || "relative";
      card.appendChild(mini);
    });
  }

  function getFolders() {
    const data = loadJson(LS.folders, null);
    if (data && typeof data === "object") return data;
    const init = {};
    FOLDERS.forEach(f => init[f] = []);
    saveJson(LS.folders, init);
    return init;
  }

  function addFolderButtons() {
    cards().forEach(card => {
      if (card.querySelector(".gkm-v185-folder-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gkm-v185-folder-btn";
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
    document.querySelectorAll(".gkm-v185-folder-menu").forEach(x => x.remove());
    const data = getFolders();
    const title = titleOf(card);
    const menu = document.createElement("div");
    menu.className = "gkm-v185-folder-menu";
    menu.innerHTML = `<b>Добавить:</b>${Object.keys(data).map(f => `<button data-folder="${esc(f)}">${esc(f)}</button>`).join("")}`;
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    menu.style.left = Math.max(8, r.left - 170) + "px";
    menu.style.top = (r.bottom + 8) + "px";

    menu.querySelectorAll("[data-folder]").forEach(x => {
      x.addEventListener("click", e => {
        e.preventDefault();
        const folder = x.dataset.folder;
        const d = getFolders();
        d[folder] = d[folder] || [];
        if (!d[folder].includes(title)) d[folder].unshift(title);
        d[folder] = d[folder].slice(0, 250);
        saveJson(LS.folders, d);
        addHistory("folder", title + " → " + folder);
        menu.remove();
      });
    });

    setTimeout(() => document.addEventListener("click", function once() {
      menu.remove();
      document.removeEventListener("click", once, true);
    }, true), 50);
  }

  function smartRandom() {
    const pool = cards().filter(c => c.style.display !== "none" && !trash(c) && hasPoster(c) && parseVotes(c) >= 100);
    const fallback = cards().filter(c => c.style.display !== "none");
    const arr = pool.length ? pool : fallback;
    if (!arr.length) return alert("Пока нет карточек для случайного выбора.");

    const pick = arr[Math.floor(Math.random() * arr.length)];
    pick.scrollIntoView({ behavior: "smooth", block: "center" });
    pick.classList.add("gkm-v185-random-pick");
    setTimeout(() => pick.classList.remove("gkm-v185-random-pick"), 2200);
    addHistory("random", titleOf(pick));
  }

  function addHistory(type, value) {
    if (!value) return;
    const h = loadJson(LS.history, []);
    const item = { type, value: String(value).slice(0, 160), ts: Date.now() };
    const clean = h.filter(x => !(x.type === item.type && x.value === item.value));
    clean.unshift(item);
    saveJson(LS.history, clean.slice(0, 80));
  }

  function showHistory() {
    closePanel();
    const h = loadJson(LS.history, []);
    const panel = document.createElement("div");
    panel.className = "gkm-v185-panel";
    panel.innerHTML = `
      <div class="gkm-v185-box">
        <div class="gkm-v185-box-head">
          <h2>🕘 История+</h2>
          <button data-close="1">✕</button>
        </div>
        <div class="gkm-v185-box-actions">
          <button data-clear="1">Очистить</button>
        </div>
        <div class="gkm-v185-history-list">
          ${h.length ? h.map(x => `
            <button data-q="${esc(x.value)}">
              <b>${x.type}</b>
              <span>${esc(x.value)}</span>
              <em>${new Date(x.ts).toLocaleString("ru-RU")}</em>
            </button>
          `).join("") : "<p>История пока пустая.</p>"}
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("[data-close]")?.addEventListener("click", closePanel);
    panel.querySelector("[data-clear]")?.addEventListener("click", () => { saveJson(LS.history, []); closePanel(); });
    panel.querySelectorAll("[data-q]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = getSearchInput();
        if (input) {
          input.value = btn.dataset.q || "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closePanel();
      });
    });
  }

  function closePanel() {
    document.querySelectorAll(".gkm-v185-panel").forEach(x => x.remove());
  }

  function savePlace() {
    const input = getSearchInput();
    const selects = Array.from(document.querySelectorAll("select")).map(s => s.value);
    saveJson(LS.state, {
      q: input ? input.value : "",
      selects,
      scrollY: window.scrollY || 0,
      ts: Date.now()
    });
  }

  function restorePlaceManual() {
    const st = loadJson(LS.state, null);
    if (!st) return alert("Сохранённого места пока нет.");

    const input = getSearchInput();
    if (input && st.q != null) {
      input.value = st.q;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const selects = Array.from(document.querySelectorAll("select"));
    if (Array.isArray(st.selects)) {
      selects.forEach((s, i) => {
        if (st.selects[i] != null) {
          s.value = st.selects[i];
          s.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    setTimeout(() => window.scrollTo(0, st.scrollY || 0), 700);
  }

  function trackSearch() {
    const input = getSearchInput();
    const q = input && input.value && input.value.trim();
    if (q && q.length >= 2) addHistory("search", q);
  }

  function trackCardClick(e) {
    const real = cards().find(c => c.contains(e.target));
    if (!real) return;
    addHistory("open", titleOf(real));
  }

  function fixSimilar() {
    const modal = Array.from(document.querySelectorAll("[role='dialog'],.modal,.popup,.overlay,dialog")).find(x => {
      const st = getComputedStyle(x);
      return st.display !== "none" && st.visibility !== "hidden" && x.offsetHeight > 80;
    });
    if (!modal) return;

    const modalCards = Array.from(modal.querySelectorAll("*")).filter(isCard);
    if (modalCards.length < 2) return;

    const mainType = (() => {
      const t = norm(text(modal).slice(0, 2500));
      if (t.includes("аниме")) return "Аниме";
      if (t.includes("мультфильм")) return "Мультфильм";
      if (t.includes("сериал")) return "Сериал";
      if (t.includes("фильм")) return "Фильм";
      return "";
    })();

    modalCards.forEach(card => {
      const bad = trash(card) || (mainType && typeOf(card) !== "—" && typeOf(card) !== mainType);
      card.classList.toggle("gkm-v185-similar-down", bad);
    });
  }

  function cycle() {
    safeRun("addQuickBar", addQuickBar);
    safeRun("sortQuality", sortQuality);
    safeRun("quickFilter", applyQuickFilter);
    safeRun("mini", addMiniDetails);
    safeRun("folders", addFolderButtons);
    safeRun("similar", fixSimilar);
  }

  function schedule() {
    clearTimeout(window.__gkmV185Timer);
    window.__gkmV185Timer = setTimeout(cycle, 350);
  }

  function addStyles() {
    if (document.querySelector("#gkm-v185-style")) return;
    const style = document.createElement("style");
    style.id = "gkm-v185-style";
    style.textContent = `
      .gkm-v185-quickbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 8px;border-top:1px solid rgba(0,216,255,.25);border-bottom:1px solid rgba(120,60,255,.25)}
      .gkm-v185-quickbar button,.gkm-v185-panel button,.gkm-v185-folder-menu button{border:1px solid #00d8ff;background:linear-gradient(135deg,#5a25d6,#04c9f4);color:#fff;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;box-shadow:0 0 14px rgba(0,216,255,.22)}
      .gkm-v185-quickbar button.active{background:linear-gradient(135deg,#ffae00,#b13cff)}
      .gkm-v185-trash-card{opacity:.62}
      .gkm-v185-mini{display:none;position:absolute;left:8px;right:8px;bottom:8px;z-index:60;padding:10px;border:1px solid rgba(0,216,255,.6);border-radius:14px;background:rgba(5,7,25,.94);color:#fff;box-shadow:0 0 20px rgba(0,216,255,.25);pointer-events:none}
      *:hover>.gkm-v185-mini{display:flex;flex-direction:column;gap:4px}
      .gkm-v185-mini b{font-size:14px}.gkm-v185-mini span,.gkm-v185-mini small{font-size:12px;color:#d7d2ff}
      .gkm-v185-random-pick{outline:4px solid #00d8ff!important;box-shadow:0 0 35px rgba(0,216,255,.85)!important}
      .gkm-v185-folder-btn{position:absolute;right:9px;top:42px;z-index:65;width:32px;height:32px;border-radius:50%;border:1px solid #00d8ff;background:linear-gradient(135deg,#5a25d6,#04c9f4);color:#fff;font-weight:1000;cursor:pointer}
      .gkm-v185-folder-menu{position:fixed;z-index:9999999;width:230px;display:flex;flex-direction:column;gap:7px;padding:12px;border:1px solid rgba(0,216,255,.55);border-radius:16px;background:rgba(7,8,28,.96);color:#fff;box-shadow:0 0 24px rgba(0,216,255,.3)}
      .gkm-v185-panel{position:fixed;inset:0;z-index:9999998;overflow:auto;padding:28px;background:rgba(2,4,16,.78);backdrop-filter:blur(4px)}
      .gkm-v185-box{max-width:900px;margin:0 auto;padding:18px;border:1px solid rgba(0,216,255,.4);border-radius:18px;background:rgba(10,8,35,.96);color:#fff}
      .gkm-v185-box-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.gkm-v185-box-head h2{margin:0}.gkm-v185-box-actions{margin:14px 0}
      .gkm-v185-history-list{display:flex;flex-direction:column;gap:8px}.gkm-v185-history-list button{display:grid;grid-template-columns:100px 1fr auto;gap:10px;align-items:center;text-align:left}.gkm-v185-history-list em{color:#cfc9ff;font-style:normal;font-size:12px}
      .gkm-v185-similar-down{opacity:.45;filter:grayscale(.6);order:9999}
      @media(max-width:760px){.gkm-v185-history-list button{grid-template-columns:1fr}.gkm-v185-panel{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    // Чистим старый опасный state от V184, который мог ломать загрузку.
    try { localStorage.removeItem("GKM_V184_STATE"); } catch(e) {}

    addStyles();
    addQuickBar();

    document.addEventListener("input", () => { safeRun("save", savePlace); schedule(); }, true);
    document.addEventListener("change", () => { safeRun("save", savePlace); schedule(); }, true);
    document.addEventListener("click", e => { safeRun("clickHistory", () => trackCardClick(e)); safeRun("save", savePlace); schedule(); }, true);

    const input = getSearchInput();
    if (input) {
      input.addEventListener("keydown", e => { if (e.key === "Enter") setTimeout(() => safeRun("searchHistory", trackSearch), 80); }, true);
      input.addEventListener("blur", () => safeRun("searchHistory", trackSearch), true);
    }

    window.addEventListener("beforeunload", () => safeRun("save", savePlace));
    window.addEventListener("scroll", () => {
      clearTimeout(window.__gkmV185Scroll);
      window.__gkmV185Scroll = setTimeout(() => safeRun("save", savePlace), 300);
    }, { passive: true });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(schedule, 700);
    setTimeout(schedule, 1600);
    setTimeout(schedule, 3000);

    console.log("GKM: v185-safe-big-site-features-no-load-crash-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V185_APPLY_SAFE_BIG_SITE_FEATURES = cycle;
  window.GKM_V185_SMART_RANDOM = smartRandom;
  window.GKM_V185_SHOW_HISTORY_PLUS = showHistory;
  window.GKM_V185_RESTORE_PLACE = restorePlaceManual;
})();
/* GKM V185 SAFE BIG SITE FEATURES END */"""

def log(msg: str) -> None:
    print(f"[GKM V185 AUTO] {msg}", flush=True)

def remove_block(text: str, start: str, end: str) -> str:
    return re.sub(re.escape(start) + r".*?" + re.escape(end), "", text, flags=re.S)

def patch_app() -> None:
    if not APP.exists():
        raise SystemExit(f"app.js not found: {APP}")
    text = APP.read_text(encoding="utf-8", errors="replace")
    text = remove_block(text, "/* GKM V184 BIG SITE FEATURES START */", "/* GKM V184 BIG SITE FEATURES END */")
    text = remove_block(text, "/* GKM V185 SAFE BIG SITE FEATURES START */", "/* GKM V185 SAFE BIG SITE FEATURES END */")
    text = text.rstrip() + "\n\n" + V185_BLOCK.strip() + "\n"
    APP.write_text(text, encoding="utf-8")
    log("app.js patched")

def patch_html() -> None:
    for rel in ["index.html", "film/index.html", "downloads/index.html"]:
        path = ROOT / rel
        if not path.exists():
            log(f"skip missing {rel}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r'app\.js\?v=\d+', 'app.js?v=185', text)
        text = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=185', text)
        if "app.js?v=185" not in text and "app.js" in text:
            text = text.replace("app.js", "app.js?v=185", 1)
        path.write_text(text, encoding="utf-8")
        log(f"updated {rel}")

def node_check() -> None:
    if not shutil.which("node"):
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
