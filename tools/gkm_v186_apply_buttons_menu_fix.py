#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import re, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"

V186_BLOCK = r"""/* GKM V186 BUTTONS MENU FIX START */
(function () {
  "use strict";

  window.GKM_V186_BUTTONS_MENU_FIX_VERSION = "v186-buttons-menu-fix-2026-06-24";

  const LS = {
    quick: "GKM_V186_QUICK_FILTER",
    history: "GKM_V186_HISTORY",
    state: "GKM_V186_STATE",
    folders: "GKM_V186_FOLDERS"
  };

  const FOLDERS = ["Смотреть позже", "Любимое", "Уже смотрел", "Брошено", "Для жены", "Аниме", "Фильмы на вечер"];

  function safe(name, fn) {
    try { return fn(); } catch (e) { console.warn("GKM V186:", name, e); toast("Ошибка: " + name); return null; }
  }

  function norm(v) {
    return String(v || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();
  }

  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
  }

  function load(k, fb) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e) { return fb; }
  }

  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
  }

  function text(el) { return String(el && el.textContent || ""); }

  function getSearchInput() {
    return document.querySelector("#search")
      || document.querySelector("#searchInput")
      || document.querySelector("input[type='search']")
      || document.querySelector("input[placeholder*='Поиск']")
      || document.querySelector("input");
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 50 && r.height > 80 && st.display !== "none" && st.visibility !== "hidden";
  }

  function isCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && (el.closest(".gkm-v186-quickbar") || el.closest(".gkm-v186-folder-menu") || el.closest(".gkm-v186-panel"))) return false;
    const t = norm(el.textContent);
    if (t.length < 18 || t.length > 1800) return false;
    if (!el.querySelector("img")) return false;
    if (!(t.includes("★") || t.includes("фильм") || t.includes("аниме") || t.includes("сериал") || t.includes("мультфильм"))) return false;
    return isVisible(el);
  }

  function cards() {
    const raw = Array.from(document.querySelectorAll("article,.card,.movie-card,.item,[class*='card'],[class*='movie'],main div,section div"))
      .filter(isCard);

    return raw.filter(c => !raw.some(o => o !== c && o.contains(c) && isCard(o))).slice(0, 3000);
  }

  function findGrid() {
    const cs = cards();
    if (!cs.length) return null;
    let best = null, count = 0;
    const parents = new Map();
    cs.forEach(c => {
      const p = c.parentElement;
      if (!p) return;
      parents.set(p, (parents.get(p) || 0) + 1);
    });
    parents.forEach((n,p) => { if (n > count) { count = n; best = p; } });
    return best ? { grid: best, cards: cs.filter(c => c.parentElement === best) } : null;
  }

  function parseRating(card) {
    const m = text(card).match(/★\s*([0-9]+(?:[.,][0-9]+)?)/);
    const n = m ? parseFloat(m[1].replace(",", ".")) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function parseVotes(card) {
    const m = text(card).replace(/\u00a0/g, " ").match(/([0-9]+(?:[.,][0-9]+)?)\s*(млн|тыс|голос)/i);
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
    const sels = [".title", ".card-title", ".movie-title", ".name", "[class*='title']", "h3", "h2", "b"];
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
    if (t.includes("аниме")) return "Аниме";
    if (t.includes("мультсериал")) return "Мультсериал";
    if (t.includes("мультфильм")) return "Мультфильм";
    if (t.includes("сериал")) return "Сериал";
    if (t.includes("фильм")) return "Фильм";
    return "—";
  }

  function trash(card) {
    const r = parseRating(card), v = parseVotes(card), title = norm(titleOf(card));
    if (!hasPoster(card) && v < 300) return true;
    if (r >= 9.8 && v < 100) return true;
    if (v > 0 && v <= 10) return true;
    if (title.length <= 2) return true;
    if (/^[a-z0-9]{1,3}$/.test(title)) return true;
    return false;
  }

  function qualityScore(card) {
    let s = 0;
    const r = parseRating(card), v = parseVotes(card), y = parseYear(card);
    s += hasPoster(card) ? 400 : -500;
    s += Math.min(v, 2000000) / 4500;
    s += r * 60;
    if (r >= 9.8 && v < 100) s -= 800;
    if (r >= 9.5 && v < 500) s -= 400;
    if (v > 0 && v < 50) s -= 250;
    if (y >= 2020) s += 25;
    return s;
  }

  function sortQuality() {
    const found = findGrid();
    if (!found || !found.cards.length) { toast("Карточки пока не найдены"); return; }
    const rows = found.cards.map((card, idx) => ({card, idx, score: qualityScore(card)}));
    rows.sort((a,b) => (b.score - a.score) || (a.idx - b.idx));
    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.card));
    found.grid.appendChild(frag);
    rows.forEach(r => r.card.classList.toggle("gkm-v186-trash-card", trash(r.card)));
  }

  function applyQuick(mode, silent) {
    localStorage.setItem(LS.quick, mode || "");
    const cs = cards();
    if (!cs.length) { if (!silent) toast("Карточки пока не найдены"); return; }

    cs.forEach(card => {
      let show = true;
      const r = parseRating(card), v = parseVotes(card);
      if (mode === "normal") show = !trash(card) && hasPoster(card) && (v === 0 || v >= 100);
      if (mode === "poster") show = hasPoster(card);
      if (mode === "popular") show = v >= 10000;
      if (mode === "hideTrash") show = !trash(card);
      if (mode === "rating7") show = r >= 7;
      if (mode === "votes1000") show = v >= 1000;
      card.style.display = show ? "" : "none";
    });

    document.querySelectorAll("[data-gkm-v186-filter]").forEach(b => b.classList.toggle("active", (b.dataset.gkmV186Filter || "") === (mode || "")));
    if (!silent) toast(mode ? "Фильтр применён" : "Фильтр сброшен");
  }

  function smartRandom() {
    const pool = cards().filter(c => c.style.display !== "none" && !trash(c) && hasPoster(c) && parseVotes(c) >= 100);
    const fallback = cards().filter(c => c.style.display !== "none");
    const arr = pool.length ? pool : fallback;
    if (!arr.length) { toast("Нет карточек для выбора"); return; }
    const pick = arr[Math.floor(Math.random() * arr.length)];
    pick.scrollIntoView({behavior:"smooth", block:"center"});
    pick.classList.add("gkm-v186-random-pick");
    setTimeout(() => pick.classList.remove("gkm-v186-random-pick"), 2200);
    addHistory("random", titleOf(pick));
    toast("Выбрано: " + titleOf(pick));
  }

  function savePlace() {
    const input = getSearchInput();
    save(LS.state, {
      q: input ? input.value : "",
      selects: Array.from(document.querySelectorAll("select")).map(s => s.value),
      scrollY: window.scrollY || 0,
      ts: Date.now()
    });
  }

  function restorePlace() {
    const st = load(LS.state, null);
    if (!st) { toast("Место ещё не сохранено"); return; }
    const input = getSearchInput();
    if (input && st.q != null) {
      input.value = st.q;
      input.dispatchEvent(new Event("input", {bubbles:true}));
      input.dispatchEvent(new Event("change", {bubbles:true}));
    }
    const selects = Array.from(document.querySelectorAll("select"));
    if (Array.isArray(st.selects)) {
      selects.forEach((s,i) => {
        if (st.selects[i] != null) {
          s.value = st.selects[i];
          s.dispatchEvent(new Event("change", {bubbles:true}));
        }
      });
    }
    setTimeout(() => window.scrollTo(0, st.scrollY || 0), 700);
    toast("Место возвращено");
  }

  function addHistory(type, value) {
    if (!value) return;
    const h = load(LS.history, []);
    const item = { type, value: String(value).slice(0,160), ts: Date.now() };
    const clean = h.filter(x => !(x.type === item.type && x.value === item.value));
    clean.unshift(item);
    save(LS.history, clean.slice(0,80));
  }

  function showHistory() {
    closePanel();
    const h = load(LS.history, []);
    const panel = document.createElement("div");
    panel.className = "gkm-v186-panel";
    panel.innerHTML = `
      <div class="gkm-v186-box">
        <div class="gkm-v186-box-head">
          <h2>🕘 История+</h2>
          <button data-gkm-v186-action="closePanel">✕</button>
        </div>
        <div class="gkm-v186-box-actions"><button data-gkm-v186-action="clearHistory">Очистить</button></div>
        <div class="gkm-v186-history-list">
          ${h.length ? h.map(x => `
            <button data-gkm-v186-history-q="${esc(x.value)}">
              <b>${esc(x.type)}</b><span>${esc(x.value)}</span><em>${new Date(x.ts).toLocaleString("ru-RU")}</em>
            </button>
          `).join("") : "<p>История пока пустая.</p>"}
        </div>
      </div>`;
    document.body.appendChild(panel);
    toast("История открыта");
  }

  function closePanel() { document.querySelectorAll(".gkm-v186-panel").forEach(x => x.remove()); }

  function clearHistory() { save(LS.history, []); closePanel(); toast("История очищена"); }

  function getFolders() {
    const d = load(LS.folders, null);
    if (d && typeof d === "object") return d;
    const init = {};
    FOLDERS.forEach(f => init[f] = []);
    save(LS.folders, init);
    return init;
  }

  function addFolderButtons() {
    cards().forEach(card => {
      if (card.querySelector(".gkm-v186-folder-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gkm-v186-folder-btn";
      btn.textContent = "+";
      btn.title = "Добавить в папку";
      btn.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        safe("folderMenu", () => showFolderMenu(card, btn));
      }, true);
      card.style.position = card.style.position || "relative";
      card.appendChild(btn);
    });
  }

  function showFolderMenu(card, btn) {
    document.querySelectorAll(".gkm-v186-folder-menu").forEach(x => x.remove());
    const title = titleOf(card);
    const d = getFolders();
    const menu = document.createElement("div");
    menu.className = "gkm-v186-folder-menu";
    menu.innerHTML = `<b>Добавить:</b>${Object.keys(d).map(f => `<button data-gkm-v186-folder="${esc(f)}">${esc(f)}</button>`).join("")}`;
    document.body.appendChild(menu);

    const r = btn.getBoundingClientRect();
    const w = 220;
    let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
    let top = r.bottom + 8;
    const maxH = Math.min(360, window.innerHeight - 20);
    menu.style.width = w + "px";
    menu.style.maxHeight = maxH + "px";
    menu.style.overflowY = "auto";
    menu.style.left = left + "px";
    menu.style.top = Math.min(top, window.innerHeight - maxH - 8) + "px";

    menu.querySelectorAll("[data-gkm-v186-folder]").forEach(x => {
      x.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        const folder = x.dataset.gkmV186Folder;
        const data = getFolders();
        data[folder] = data[folder] || [];
        if (!data[folder].includes(title)) data[folder].unshift(title);
        data[folder] = data[folder].slice(0,250);
        save(LS.folders, data);
        addHistory("folder", title + " → " + folder);
        menu.remove();
        toast("Добавлено: " + folder);
      }, true);
    });
  }

  function addMiniDetails() {
    cards().forEach(card => {
      if (card.querySelector(".gkm-v186-mini")) return;
      const mini = document.createElement("div");
      mini.className = "gkm-v186-mini";
      mini.innerHTML = `<b>${esc(titleOf(card))}</b><span>${parseYear(card) || "—"} · ${typeOf(card)} · ★ ${parseRating(card) || "—"}</span><span>${parseVotes(card).toLocaleString("ru-RU")} голосов</span>`;
      card.style.position = card.style.position || "relative";
      card.appendChild(mini);
    });
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

  function addQuickBar() {
    document.querySelectorAll(".gkm-v184-quickbar,.gkm-v185-quickbar,.gkm-v186-quickbar").forEach(x => x.remove());
    const bar = document.createElement("div");
    bar.className = "gkm-v186-quickbar";
    bar.innerHTML = `
      <button data-gkm-v186-filter="normal">🔥 Только норм</button>
      <button data-gkm-v186-filter="poster">🎬 С постером</button>
      <button data-gkm-v186-filter="popular">👑 Популярное</button>
      <button data-gkm-v186-filter="hideTrash">🧹 Скрыть мусор</button>
      <button data-gkm-v186-filter="rating7">⭐ 7+</button>
      <button data-gkm-v186-filter="votes1000">🗳 от 1000</button>
      <button data-gkm-v186-filter="">Сброс качества</button>
      <button data-gkm-v186-action="random">🎲 Умное случайное</button>
      <button data-gkm-v186-action="restore">↩ Вернуть место</button>
      <button data-gkm-v186-action="history">🕘 История+</button>
    `;
    const anchor = document.querySelector(".controls") || document.querySelector(".filters") || document.querySelector("header") || document.querySelector("main") || document.body;
    anchor.appendChild(bar);
  }

  function handleClick(e) {
    const filterBtn = e.target.closest && e.target.closest("[data-gkm-v186-filter]");
    if (filterBtn) {
      e.preventDefault(); e.stopPropagation();
      return safe("filter", () => { sortQuality(); applyQuick(filterBtn.dataset.gkmV186Filter || ""); });
    }

    const actionBtn = e.target.closest && e.target.closest("[data-gkm-v186-action]");
    if (actionBtn) {
      e.preventDefault(); e.stopPropagation();
      const a = actionBtn.dataset.gkmV186Action;
      if (a === "random") return safe("random", smartRandom);
      if (a === "restore") return safe("restore", restorePlace);
      if (a === "history") return safe("history", showHistory);
      if (a === "closePanel") return safe("closePanel", closePanel);
      if (a === "clearHistory") return safe("clearHistory", clearHistory);
    }

    const h = e.target.closest && e.target.closest("[data-gkm-v186-history-q]");
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const input = getSearchInput();
      if (input) {
        input.value = h.dataset.gkmV186HistoryQ || "";
        input.dispatchEvent(new Event("input", {bubbles:true}));
        input.dispatchEvent(new Event("change", {bubbles:true}));
      }
      closePanel();
      return;
    }

    if (!e.target.closest || !e.target.closest(".gkm-v186-folder-menu,.gkm-v186-folder-btn")) {
      document.querySelectorAll(".gkm-v186-folder-menu").forEach(x => x.remove());
    }
  }

  function toast(msg) {
    let t = document.querySelector(".gkm-v186-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "gkm-v186-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__gkmV186Toast);
    window.__gkmV186Toast = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function saveStateSoon() {
    clearTimeout(window.__gkmV186Save);
    window.__gkmV186Save = setTimeout(savePlace, 300);
  }

  function cycle() {
    safe("sortQuality", sortQuality);
    safe("applyQuickSilent", () => applyQuick(localStorage.getItem(LS.quick) || "", true));
    safe("mini", addMiniDetails);
    safe("folders", addFolderButtons);
  }

  function schedule() {
    clearTimeout(window.__gkmV186Cycle);
    window.__gkmV186Cycle = setTimeout(cycle, 450);
  }

  function addStyles() {
    if (document.querySelector("#gkm-v186-style")) return;
    const style = document.createElement("style");
    style.id = "gkm-v186-style";
    style.textContent = `
      .gkm-v186-quickbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 8px;border-top:1px solid rgba(0,216,255,.25);border-bottom:1px solid rgba(120,60,255,.25)}
      .gkm-v186-quickbar button,.gkm-v186-panel button,.gkm-v186-folder-menu button{border:1px solid #00d8ff;background:linear-gradient(135deg,#5a25d6,#04c9f4);color:#fff;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;box-shadow:0 0 14px rgba(0,216,255,.22)}
      .gkm-v186-quickbar button.active{background:linear-gradient(135deg,#ffae00,#b13cff)}
      .gkm-v186-trash-card{opacity:.62}
      .gkm-v186-mini{display:none;position:absolute;left:8px;right:8px;bottom:8px;z-index:60;padding:10px;border:1px solid rgba(0,216,255,.6);border-radius:14px;background:rgba(5,7,25,.94);color:#fff;box-shadow:0 0 20px rgba(0,216,255,.25);pointer-events:none}
      *:hover>.gkm-v186-mini{display:flex;flex-direction:column;gap:4px}
      .gkm-v186-mini b{font-size:14px}.gkm-v186-mini span{font-size:12px;color:#d7d2ff}
      .gkm-v186-folder-btn{position:absolute!important;right:9px!important;top:72px!important;z-index:65!important;width:32px!important;height:32px!important;border-radius:50%!important;border:1px solid #00d8ff!important;background:linear-gradient(135deg,#5a25d6,#04c9f4)!important;color:#fff!important;font-weight:1000!important;cursor:pointer!important}
      .gkm-v186-folder-menu{position:fixed!important;z-index:9999999!important;display:flex!important;flex-direction:column!important;gap:7px!important;padding:12px!important;border:1px solid rgba(0,216,255,.55)!important;border-radius:16px!important;background:rgba(7,8,28,.97)!important;color:#fff!important;box-shadow:0 0 24px rgba(0,216,255,.3)!important}
      .gkm-v186-folder-menu b{font-size:15px;margin-bottom:3px}.gkm-v186-folder-menu button{width:100%;font-size:14px;padding:9px 10px}
      .gkm-v186-panel{position:fixed;inset:0;z-index:9999998;overflow:auto;padding:28px;background:rgba(2,4,16,.78);backdrop-filter:blur(4px)}
      .gkm-v186-box{max-width:900px;margin:0 auto;padding:18px;border:1px solid rgba(0,216,255,.4);border-radius:18px;background:rgba(10,8,35,.96);color:#fff}
      .gkm-v186-box-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.gkm-v186-history-list{display:flex;flex-direction:column;gap:8px}.gkm-v186-history-list button{display:grid;grid-template-columns:100px 1fr auto;gap:10px;align-items:center;text-align:left}.gkm-v186-history-list em{color:#cfc9ff;font-style:normal;font-size:12px}
      .gkm-v186-random-pick{outline:4px solid #00d8ff!important;box-shadow:0 0 35px rgba(0,216,255,.85)!important}
      .gkm-v186-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(30px);z-index:10000000;background:linear-gradient(135deg,#5a25d6,#04c9f4);color:#fff;border:1px solid #00d8ff;border-radius:14px;padding:12px 18px;font-weight:900;box-shadow:0 0 24px rgba(0,216,255,.45);opacity:0;transition:.2s}
      .gkm-v186-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    `;
    document.head.appendChild(style);
  }

  function init() {
    try { localStorage.removeItem("GKM_V184_STATE"); } catch(e) {}
    addStyles();
    addQuickBar();

    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", () => { saveStateSoon(); schedule(); }, true);
    document.addEventListener("change", () => { saveStateSoon(); schedule(); }, true);
    window.addEventListener("scroll", saveStateSoon, {passive:true});
    window.addEventListener("beforeunload", savePlace);

    const obs = new MutationObserver(schedule);
    obs.observe(document.body, {childList:true, subtree:true});

    setTimeout(schedule, 700);
    setTimeout(schedule, 1600);
    setTimeout(schedule, 3200);

    console.log("GKM: v186-buttons-menu-fix-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GKM_V186_APPLY = cycle;
  window.GKM_V186_RANDOM = smartRandom;
  window.GKM_V186_HISTORY = showHistory;
  window.GKM_V186_RESTORE = restorePlace;
})();
/* GKM V186 BUTTONS MENU FIX END */"""

def remove_block(text: str, start: str, end: str) -> str:
    return re.sub(re.escape(start) + r".*?" + re.escape(end), "", text, flags=re.S)

def main() -> int:
    text = APP.read_text(encoding="utf-8", errors="replace")
    for s,e in [
        ("/* GKM V184 BIG SITE FEATURES START */", "/* GKM V184 BIG SITE FEATURES END */"),
        ("/* GKM V185 SAFE BIG SITE FEATURES START */", "/* GKM V185 SAFE BIG SITE FEATURES END */"),
        ("/* GKM V186 BUTTONS MENU FIX START */", "/* GKM V186 BUTTONS MENU FIX END */"),
    ]:
        text = remove_block(text, s, e)
    text = text.rstrip() + "\n\n" + V186_BLOCK.strip() + "\n"
    APP.write_text(text, encoding="utf-8")

    for rel in ["index.html", "film/index.html", "downloads/index.html"]:
        p = ROOT / rel
        if p.exists():
            h = p.read_text(encoding="utf-8", errors="replace")
            h = re.sub(r'app\.js\?v=\d+', 'app.js?v=186', h)
            h = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=186', h)
            if "app.js?v=186" not in h and "app.js" in h:
                h = h.replace("app.js", "app.js?v=186", 1)
            p.write_text(h, encoding="utf-8")

    if shutil.which("node"):
        res = subprocess.run(["node", "--check", str(APP)], cwd=ROOT, text=True, capture_output=True)
        if res.returncode:
            print(res.stdout); print(res.stderr); return res.returncode
    print("[GKM V186] DONE")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
