#!/usr/bin/env python3
# -*- coding: utf-8 -*-

GKM V162 — Франшизы + порядок просмотра.
Патчер добавляет runtime-модуль в app.js и переключает index.html на app.js?v=162.

Запуск из корня проекта:
python tools/gkm_v162_apply_franchise_pages.py
"""
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(".")
APP = ROOT / "app.js"
INDEXES = [ROOT / "index.html", ROOT / "film" / "index.html", ROOT / "downloads" / "index.html"]

VERSION = "v162-franchise-pages-watch-order-2026-06-24"
MARKER_START = "/* GKM V162 FRANCHISE PAGES START */"
MARKER_END = "/* GKM V162 FRANCHISE PAGES END */"

V162_JS = r"""
/* GKM V162 FRANCHISE PAGES START */
(function () {
  "use strict";

  window.GKM_V162_FRANCHISE_PAGES_VERSION = "v162-franchise-pages-watch-order-2026-06-24";

  const FRANCHISE_RULES = [
    { key: "naruto", title: "Наруто", aliases: ["naruto", "наруто", "боруто", "boruto"], orderHints: ["наруто", "naruto", "ураганные хроники", "shippuden", "road to ninja", "last", "boruto"] },
    { key: "bleach", title: "Блич", aliases: ["bleach", "блич"], orderHints: ["блич", "bleach", "memories of nobody", "diamond dust", "fade to black", "hell verse", "thousand-year", "тысячелет"] },
    { key: "attack_on_titan", title: "Атака титанов", aliases: ["attack on titan", "shingeki", "атака титанов", "進撃"], orderHints: ["атака титанов", "attack on titan", "season 2", "season 3", "final", "финал"] },
    { key: "tokyo_ghoul", title: "Токийский гуль", aliases: ["tokyo ghoul", "токийский гуль"], orderHints: ["tokyo ghoul", "токийский гуль", "√a", "re"] },
    { key: "one_piece", title: "Ван-Пис", aliases: ["one piece", "ван-пис", "ван пис"], orderHints: ["one piece", "ван-пис", "ван пис", "red", "stampede", "gold", "strong world"] },
    { key: "dragon_ball", title: "Драконий жемчуг", aliases: ["dragon ball", "драконий жемчуг", "doragon"], orderHints: ["dragon ball", "драконий жемчуг", "z", "super", "gt", "broly"] },
    { key: "fate", title: "Fate", aliases: ["fate/", "fate:", "судьба:", "судьба"], orderHints: ["fate/zero", "stay night", "unlimited blade", "heaven", "grand order"] },
    { key: "alien", title: "Чужой", aliases: ["alien", "чужой", "прометей", "prometheus", "covenant", "ромул"], orderHints: ["чужой", "alien", "чужие", "aliens", "чужой 3", "воскрешение", "прометей", "завет", "ромул"] },
    { key: "predator", title: "Хищник", aliases: ["predator", "хищник", "prey", "добыча"], orderHints: ["хищник", "predator", "predator 2", "predators", "prey", "добыча"] },
    { key: "marvel_avengers", title: "Марвел / Мстители", aliases: ["avengers", "мстители", "marvel", "железный человек", "iron man", "thor", "тор", "captain america", "капитан америка"], orderHints: ["железный человек", "iron man", "thor", "тор", "captain america", "капитан америка", "avengers", "мстители", "infinity war", "endgame", "финал"] },
    { key: "fast_furious", title: "Форсаж", aliases: ["fast & furious", "fast and furious", "форсаж"], orderHints: ["форсаж", "fast", "furious", "hobbs", "shaw"] },
    { key: "harry_potter", title: "Гарри Поттер", aliases: ["harry potter", "гарри поттер", "fantastic beasts", "фантастические твари"], orderHints: ["философский камень", "тайная комната", "азкабан", "кубок огня", "орден феникса", "принц полукровка", "дары смерти", "фантастические твари"] },
    { key: "lord_of_the_rings", title: "Властелин колец", aliases: ["lord of the rings", "властелин колец", "hobbit", "хоббит"], orderHints: ["хоббит", "нежданное путешествие", "пустошь смауга", "битва пяти", "братство кольца", "две крепости", "возвращение короля"] },
    { key: "terminator", title: "Терминатор", aliases: ["terminator", "терминатор"], orderHints: ["терминатор", "terminator", "judgment day", "генезис", "dark fate"] },
    { key: "matrix", title: "Матрица", aliases: ["matrix", "матрица"], orderHints: ["матрица", "matrix", "reloaded", "revolutions", "resurrections"] }
  ];

  function gkmText(v) {
    return String(v || "").toLowerCase().replace(/ё/g, "е");
  }

  function gkmTitle(item) {
    return String(item?.ru || item?.name || item?.title || item?.en || item?.alternativeName || "").trim();
  }

  function gkmYear(item) {
    const y = parseInt(String(item?.year || item?.releaseYear || "0").slice(0, 4), 10);
    return Number.isFinite(y) ? y : 0;
  }

  function gkmRating(item) {
    const r = Number(item?.rating || item?.kpRating || item?.ratingKinopoisk || 0);
    return Number.isFinite(r) ? r : 0;
  }

  function gkmVotes(item) {
    const v = Number(item?.votes || item?.kpVotes || item?.votesKp || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function gkmPoster(item) {
    return item?.poster || item?.posterUrl || item?.image || item?.img || "";
  }

  function gkmType(item) {
    return String(item?.type || item?.category || "").trim() || "—";
  }

  function gkmGenres(item) {
    const raw = item?.genres || item?.genre || [];
    if (Array.isArray(raw)) return raw.map(x => typeof x === "string" ? x : (x?.name || "")).filter(Boolean);
    return String(raw || "").split(/[,.·/|]+/).map(x => x.trim()).filter(Boolean);
  }

  function gkmAllItems() {
    const candidates = [
      window.allItems,
      window.ALL_ITEMS,
      window.catalogItems,
      window.CATALOG_ITEMS,
      window.items,
      window.movies,
      window.catalog,
      window.DB,
      window.database
    ];

    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return c;
      if (c && Array.isArray(c.items) && c.items.length) return c.items;
      if (c && Array.isArray(c.docs) && c.docs.length) return c.docs;
    }

    const storeKeys = Object.keys(window).filter(k => /item|movie|catalog|database|all/i.test(k));
    for (const k of storeKeys) {
      try {
        const v = window[k];
        if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
        if (v && Array.isArray(v.items) && v.items.length) return v.items;
      } catch (e) {}
    }

    return [];
  }

  function gkmMatchFranchise(item, rule) {
    const text = gkmText([gkmTitle(item), item?.en, item?.alternativeName, item?.originalTitle, item?.overview, item?.description].filter(Boolean).join(" "));
    return rule.aliases.some(a => text.includes(gkmText(a)));
  }

  function gkmOrderScore(item, rule) {
    const title = gkmText(gkmTitle(item));
    let score = 9999;
    rule.orderHints.forEach((hint, idx) => {
      if (title.includes(gkmText(hint))) score = Math.min(score, idx);
    });
    return score;
  }

  function gkmFranchiseItems(rule) {
    const items = gkmAllItems().filter(item => gkmMatchFranchise(item, rule));
    const seen = new Set();
    const unique = [];

    for (const it of items) {
      const key = String(it?.id || it?.kinopoiskId || "") || (gkmText(gkmTitle(it)) + "::" + gkmYear(it));
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(it);
    }

    return unique;
  }

  function gkmSortRelease(items) {
    return [...items].sort((a, b) => {
      const ya = gkmYear(a), yb = gkmYear(b);
      if (ya !== yb) return ya - yb;
      return gkmTitle(a).localeCompare(gkmTitle(b), "ru");
    });
  }

  function gkmSortRating(items) {
    return [...items].sort((a, b) => {
      const vb = gkmVotes(b), va = gkmVotes(a);
      if (vb !== va) return vb - va;
      return gkmRating(b) - gkmRating(a);
    });
  }

  function gkmSortWatch(rule, items) {
    return [...items].sort((a, b) => {
      const oa = gkmOrderScore(a, rule), ob = gkmOrderScore(b, rule);
      if (oa !== ob) return oa - ob;
      const ya = gkmYear(a), yb = gkmYear(b);
      if (ya !== yb) return ya - yb;
      return gkmVotes(b) - gkmVotes(a);
    });
  }

  function gkmCard(item, idx) {
    const poster = gkmPoster(item);
    const title = gkmTitle(item);
    const year = gkmYear(item) || "—";
    const rating = gkmRating(item) || "—";
    const votes = gkmVotes(item);
    const genres = gkmGenres(item).slice(0, 2).join(" · ");
    const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safePoster = poster ? `<img src="${String(poster).replace(/"/g, "&quot;")}" alt="${safeTitle}" loading="lazy">` : `<div class="gkm-v162-no-poster">Нет постера</div>`;

    return `
      <div class="gkm-v162-fr-card" data-gkm-v162-id="${String(item?.id || item?.kinopoiskId || idx).replace(/"/g, "&quot;")}">
        <div class="gkm-v162-rank">#${idx + 1}</div>
        <div class="gkm-v162-poster">${safePoster}</div>
        <div class="gkm-v162-info">
          <div class="gkm-v162-title">${safeTitle}</div>
          <div class="gkm-v162-meta">${year} · ${gkmType(item)}</div>
          <div class="gkm-v162-genres">${genres || "Жанры не указаны"}</div>
          <div class="gkm-v162-score">★ ${rating} · ${votes ? votes.toLocaleString("ru-RU") + " голосов" : "голосов нет"}</div>
        </div>
      </div>
    `;
  }

  function gkmMainContainer() {
    return document.querySelector("#content") ||
      document.querySelector("main") ||
      document.querySelector(".content") ||
      document.querySelector(".grid")?.parentElement ||
      document.body;
  }

  function gkmRenderFranchise(ruleKey, mode = "watch") {
    const rule = FRANCHISE_RULES.find(r => r.key === ruleKey) || FRANCHISE_RULES[0];
    const raw = gkmFranchiseItems(rule);
    let items = raw;

    if (mode === "release") items = gkmSortRelease(raw);
    else if (mode === "rating") items = gkmSortRating(raw);
    else items = gkmSortWatch(rule, raw);

    const main = gkmMainContainer();

    main.innerHTML = `
      <section class="gkm-v162-franchise-page">
        <div class="gkm-v162-head">
          <div>
            <h2>🧬 Франшиза: ${rule.title}</h2>
            <p>${items.length} тайтлов · порядок просмотра / по году / по популярности</p>
          </div>
          <div class="gkm-v162-head-actions">
            <button class="gkm-v162-mode ${mode === "watch" ? "active" : ""}" data-mode="watch">Порядок просмотра</button>
            <button class="gkm-v162-mode ${mode === "release" ? "active" : ""}" data-mode="release">По году</button>
            <button class="gkm-v162-mode ${mode === "rating" ? "active" : ""}" data-mode="rating">По популярности</button>
          </div>
        </div>

        ${items.length ? `
          <div class="gkm-v162-fr-grid">
            ${items.map((item, idx) => gkmCard(item, idx)).join("")}
          </div>
        ` : `
          <div class="gkm-v162-empty">
            Не нашёл тайтлы этой франшизы в загруженной базе. Попробуй обновить базу или поискать по названию.
          </div>
        `}
      </section>
    `;

    main.querySelectorAll(".gkm-v162-mode").forEach(btn => {
      btn.addEventListener("click", () => gkmRenderFranchise(rule.key, btn.dataset.mode || "watch"));
    });

    main.querySelectorAll(".gkm-v162-fr-card").forEach((card, idx) => {
      card.addEventListener("click", () => {
        const item = items[idx];
        if (typeof window.openDetails === "function") return window.openDetails(item);
        if (typeof window.showDetails === "function") return window.showDetails(item);
        if (typeof window.openModal === "function") return window.openModal(item);
      });
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function gkmOpenFranchisesHub() {
    const main = gkmMainContainer();

    const cards = FRANCHISE_RULES.map(rule => {
      const count = gkmFranchiseItems(rule).length;
      return `
        <button class="gkm-v162-franchise-tile" data-rule="${rule.key}">
          <b>${rule.title}</b>
          <span>${count} тайтлов</span>
        </button>
      `;
    }).join("");

    main.innerHTML = `
      <section class="gkm-v162-franchise-page">
        <div class="gkm-v162-head">
          <div>
            <h2>🧬 Франшизы</h2>
            <p>Открой серию фильмов/аниме и смотри порядок просмотра.</p>
          </div>
        </div>
        <div class="gkm-v162-hub-grid">${cards}</div>
      </section>
    `;

    main.querySelectorAll(".gkm-v162-franchise-tile").forEach(btn => {
      btn.addEventListener("click", () => gkmRenderFranchise(btn.dataset.rule, "watch"));
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function gkmAddButton() {
    if (document.querySelector("[data-gkm-v162-franchise-btn]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "🧬 Франшизы";
    btn.dataset.gkmV162FranchiseBtn = "1";
    btn.className = "btn gkm-v162-franchise-btn";
    btn.addEventListener("click", gkmOpenFranchisesHub);

    const target =
      document.querySelector(".tabs") ||
      document.querySelector(".nav") ||
      document.querySelector(".buttons") ||
      document.querySelector(".filter-buttons") ||
      document.querySelector(".controls") ||
      document.querySelector("header") ||
      document.body;

    target.appendChild(btn);
  }

  function gkmPatchDetailsFranchiseButton() {
    document.addEventListener("click", function () {
      setTimeout(() => {
        const modal = document.querySelector(".modal.show") || document.querySelector(".modal") || document.querySelector("[role='dialog']");
        if (!modal || modal.querySelector("[data-gkm-v162-modal-franchise]")) return;

        const titleNode = modal.querySelector("h1,h2,.title,.modal-title");
        const title = titleNode ? titleNode.textContent || "" : "";
        const item = gkmAllItems().find(x => gkmText(gkmTitle(x)) === gkmText(title));
        const rule = FRANCHISE_RULES.find(r => item ? gkmMatchFranchise(item, r) : r.aliases.some(a => gkmText(title).includes(gkmText(a))));

        if (!rule) return;

        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "🧬 Вся франшиза";
        b.className = "gkm-v162-modal-franchise-btn";
        b.dataset.gkmV162ModalFranchise = "1";
        b.addEventListener("click", () => gkmRenderFranchise(rule.key, "watch"));

        const anchor = modal.querySelector(".meta") || titleNode?.parentElement || modal;
        anchor.appendChild(b);
      }, 80);
    }, true);
  }

  function gkmAddStyles() {
    if (document.querySelector("#gkm-v162-franchise-style")) return;

    const style = document.createElement("style");
    style.id = "gkm-v162-franchise-style";
    style.textContent = `
      .gkm-v162-franchise-btn,.gkm-v162-mode,.gkm-v162-franchise-tile,.gkm-v162-modal-franchise-btn{border:1px solid #00d8ff;background:linear-gradient(135deg,#5a25d6,#04c9f4);color:#fff;border-radius:14px;padding:12px 18px;font-weight:800;cursor:pointer;box-shadow:0 0 18px rgba(0,216,255,.25);margin:6px}
      .gkm-v162-mode{background:linear-gradient(135deg,#2b155f,#5a25d6);padding:10px 14px}
      .gkm-v162-mode.active{background:linear-gradient(135deg,#ff9d00,#b13cff)}
      .gkm-v162-franchise-page{padding:18px 8px 60px;color:#fff}
      .gkm-v162-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px;margin:8px 0 18px;border:1px solid rgba(0,216,255,.35);border-radius:18px;background:rgba(10,8,35,.72)}
      .gkm-v162-head h2{margin:0 0 8px;font-size:30px;text-shadow:0 0 16px rgba(185,125,255,.65)}
      .gkm-v162-head p{margin:0;color:#cfc9ff}
      .gkm-v162-head-actions{display:flex;flex-wrap:wrap;justify-content:flex-end}
      .gkm-v162-fr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
      .gkm-v162-fr-card{position:relative;border:1px solid rgba(0,216,255,.35);border-radius:18px;overflow:hidden;background:rgba(6,8,24,.88);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
      .gkm-v162-fr-card:hover{transform:translateY(-3px);box-shadow:0 0 24px rgba(0,216,255,.28)}
      .gkm-v162-rank{position:absolute;top:10px;left:10px;z-index:2;background:linear-gradient(135deg,#ffae00,#ffcc47);color:#111;font-weight:900;border-radius:999px;padding:7px 10px}
      .gkm-v162-poster{height:320px;background:rgba(80,40,150,.48);display:flex;align-items:center;justify-content:center;font-weight:900}
      .gkm-v162-poster img{width:100%;height:100%;object-fit:cover;display:block}
      .gkm-v162-no-poster{color:#fff;opacity:.75}
      .gkm-v162-info{padding:12px}
      .gkm-v162-title{font-size:18px;font-weight:900;line-height:1.1;margin-bottom:8px}
      .gkm-v162-meta,.gkm-v162-genres{color:#cfc9ff;font-size:14px;margin-bottom:6px}
      .gkm-v162-score{display:inline-block;border:1px solid #00d8ff;border-radius:999px;padding:6px 10px;color:#fff;background:rgba(0,216,255,.11);font-weight:800}
      .gkm-v162-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
      .gkm-v162-franchise-tile{text-align:left;min-height:92px;display:flex;flex-direction:column;justify-content:center}
      .gkm-v162-franchise-tile b{display:block;font-size:22px;margin-bottom:8px}
      .gkm-v162-franchise-tile span{color:#e8e1ff}
      .gkm-v162-empty{padding:24px;border:1px solid rgba(255,60,120,.45);border-radius:18px;background:rgba(40,8,24,.72);color:#fff}
      .gkm-v162-modal-franchise-btn{padding:8px 12px;font-size:14px;margin-left:8px}
      @media(max-width:720px){.gkm-v162-head{flex-direction:column}.gkm-v162-head-actions{justify-content:flex-start}.gkm-v162-fr-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.gkm-v162-poster{height:230px}}
    `;
    document.head.appendChild(style);
  }

  function gkmInitV162() {
    gkmAddStyles();
    gkmAddButton();
    gkmPatchDetailsFranchiseButton();
    console.log("GKM: v162-franchise-pages-watch-order-2026-06-24");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gkmInitV162);
  else gkmInitV162();

  window.GKM_V162_OPEN_FRANCHISES = gkmOpenFranchisesHub;
  window.GKM_V162_OPEN_FRANCHISE = gkmRenderFranchise;
})();
/* GKM V162 FRANCHISE PAGES END */
"""


def patch_app() -> None:
    if not APP.exists():
        raise SystemExit("app.js не найден в корне проекта")

    text = APP.read_text(encoding="utf-8", errors="replace")

    if MARKER_START in text and MARKER_END in text:
        text = re.sub(
            re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END),
            V162_JS.strip(),
            text,
            flags=re.S,
        )
    else:
        text = text.rstrip() + "\n\n" + V162_JS.strip() + "\n"

    APP.write_text(text, encoding="utf-8")
    print("[GKM V162] patched app.js")


def patch_index(path: Path) -> None:
    if not path.exists():
        return

    text = path.read_text(encoding="utf-8", errors="replace")
    text2 = re.sub(r'app\.js\?v=\d+', 'app.js?v=162', text)
    text2 = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=162', text2)

    if text2 != text:
        path.write_text(text2, encoding="utf-8")
        print(f"[GKM V162] patched {path}")


def main() -> int:
    patch_app()

    for path in INDEXES:
        patch_index(path)

    print("[GKM V162] done")
    print("Проверка в консоли сайта:")
    print("window.GKM_V162_FRANCHISE_PAGES_VERSION")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
