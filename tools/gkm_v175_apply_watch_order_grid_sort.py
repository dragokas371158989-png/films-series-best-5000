#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V175 AUTO — применяет быстрые чистые франшизы V174 + сортировку сетки V175.

Что делает:
- удаляет старые франшизные блоки V162–V175 из app.js;
- добавляет V174 FAST CLEAN FRANCHISES;
- добавляет V175 WATCH ORDER GRID SORT;
- переключает index.html / film/index.html / downloads/index.html на app.js?v=175;
- проверяет app.js через node --check, если node доступен.

Запуск:
python tools/gkm_v175_apply_watch_order_grid_sort.py
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"

V174_BLOCK = r"""/* GKM V174 FAST CLEAN FRANCHISES START */
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
/* GKM V174 FAST CLEAN FRANCHISES END */"""

V175_BLOCK = r"""/* GKM V175 WATCH ORDER GRID SORT START */
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
/* GKM V175 WATCH ORDER GRID SORT END */"""

BLOCKS = [
    ("/* GKM V162 FRANCHISE PAGES START */", "/* GKM V162 FRANCHISE PAGES END */"),
    ("/* GKM V163 FRANCHISE DATA LOADER START */", "/* GKM V163 FRANCHISE DATA LOADER END */"),
    ("/* GKM V164 SAFE FRANCHISE SEARCH START */", "/* GKM V164 SAFE FRANCHISE SEARCH END */"),
    ("/* GKM V165 FRANCHISE OVERLAY FIX START */", "/* GKM V165 FRANCHISE OVERLAY FIX END */"),
    ("/* GKM V166 FRANCHISE SINGLE QUERY FIX START */", "/* GKM V166 FRANCHISE SINGLE QUERY FIX END */"),
    ("/* GKM V167 FRANCHISE CLEAN QUERIES START */", "/* GKM V167 FRANCHISE CLEAN QUERIES END */"),
    ("/* GKM V168 FRANCHISE WATCH ORDER START */", "/* GKM V168 FRANCHISE WATCH ORDER END */"),
    ("/* GKM V169 FRANCHISE GRID ORDER START */", "/* GKM V169 FRANCHISE GRID ORDER END */"),
    ("/* GKM V170 PRECISE FRANCHISE RESULT ORDER START */", "/* GKM V170 PRECISE FRANCHISE RESULT ORDER END */"),
    ("/* GKM V171 FRANCHISE BADGE EXACT FIX START */", "/* GKM V171 FRANCHISE BADGE EXACT FIX END */"),
    ("/* GKM V172 FULL FRANCHISE CATALOG START */", "/* GKM V172 FULL FRANCHISE CATALOG END */"),
    ("/* GKM V173 ALL FRANCHISE ORDER START */", "/* GKM V173 ALL FRANCHISE ORDER END */"),
    ("/* GKM V174 FAST CLEAN FRANCHISES START */", "/* GKM V174 FAST CLEAN FRANCHISES END */"),
    ("/* GKM V175 WATCH ORDER GRID SORT START */", "/* GKM V175 WATCH ORDER GRID SORT END */"),
]


def log(msg: str) -> None:
    print(f"[GKM V175 AUTO] {msg}", flush=True)


def remove_block(text: str, start: str, end: str) -> str:
    pattern = re.escape(start) + r".*?" + re.escape(end)
    return re.sub(pattern, "", text, flags=re.S)


def patch_app() -> None:
    if not APP.exists():
        raise SystemExit(f"app.js not found: {APP}")

    text = APP.read_text(encoding="utf-8", errors="replace")

    before = len(text)
    for start, end in BLOCKS:
        text = remove_block(text, start, end)

    text = text.rstrip() + "\n\n" + V174_BLOCK.strip() + "\n\n" + V175_BLOCK.strip() + "\n"
    APP.write_text(text, encoding="utf-8")

    log(f"app.js patched: {before} -> {len(text)} chars")


def patch_html() -> None:
    for rel in ["index.html", "film/index.html", "downloads/index.html"]:
        path = ROOT / rel
        if not path.exists():
            log(f"skip missing {rel}")
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        old = text

        text = re.sub(r'app\.js\?v=\d+', 'app.js?v=175', text)
        text = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=175', text)

        if "app.js?v=175" not in text and "app.js" in text:
            text = text.replace("app.js", "app.js?v=175", 1)

        path.write_text(text, encoding="utf-8")
        log(("updated " if text != old else "already ok ") + rel)


def node_check() -> None:
    if shutil.which("node") is None:
        log("node not found, skip node --check")
        return

    res = subprocess.run(["node", "--check", str(APP)], cwd=ROOT, text=True, capture_output=True)
    if res.returncode != 0:
        print(res.stdout)
        print(res.stderr)
        raise SystemExit(res.returncode)

    log("node --check OK")


def main() -> int:
    patch_app()
    patch_html()
    node_check()
    log("DONE: V175 AUTO applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
