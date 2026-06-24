#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V146 — применяет сортировку "голоса от 9 000 000 и ниже".
Запускать из корня репозитория:
    python tools/gkm_v146_apply_votes_sort.py

Что делает:
- вставляет JS-патч в app.js / film/app.js / downloads/app.js / anime-tv/app.js, если файлы есть;
- добавляет window.GKM_V146_VOTES_9000000_SORT_VERSION;
- меняет кеш в index.html на app.js?v=146;
- сортирует топы/жанры по весу: голоса 85%, рейтинг 15%;
- 10.0 с 2–100 голосами больше не лезет наверх.
"""
from __future__ import annotations

import re
from pathlib import Path

VERSION = "v146-votes-9000000-sort-2026-06-24"

ROOT = Path(".")
APP_FILES = [
    ROOT / "app.js",
    ROOT / "film" / "app.js",
    ROOT / "downloads" / "app.js",
    ROOT / "anime-tv" / "app.js",
]
HTML_FILES = [
    ROOT / "index.html",
    ROOT / "film" / "index.html",
    ROOT / "downloads" / "index.html",
    ROOT / "anime-tv" / "index.html",
]

START = "/* GKM_V146_VOTES_9000000_SORT_START */"
END = "/* GKM_V146_VOTES_9000000_SORT_END */"

PATCH = r"""
/* GKM_V146_VOTES_9000000_SORT_START */
(function () {
  "use strict";

  window.GKM_V146_VOTES_9000000_SORT_VERSION = "v146-votes-9000000-sort-2026-06-24";

  if (window.__GKM_V146_VOTES_9000000_SORT_INSTALLED__) return;
  window.__GKM_V146_VOTES_9000000_SORT_INSTALLED__ = true;

  function num(x) {
    if (x == null) return 0;
    if (typeof x === "number") return Number.isFinite(x) ? x : 0;

    let s = String(x).toLowerCase().replace(/\s+/g, " ").trim();
    if (!s) return 0;

    let mult = 1;
    if (s.includes("млн") || s.includes("million") || s.includes("m")) mult = 1000000;
    else if (s.includes("тыс") || s.includes("k")) mult = 1000;

    s = s.replace(",", ".").replace(/[^0-9.]/g, "");
    const v = parseFloat(s);
    return Number.isFinite(v) ? Math.round(v * mult) : 0;
  }

  function firstNumber(obj, keys) {
    for (const k of keys) {
      if (!obj) continue;
      if (obj[k] != null && obj[k] !== "") return num(obj[k]);
    }
    return 0;
  }

  function votesOfV146(item) {
    if (!item || typeof item !== "object") return 0;

    if (typeof window.votesOf === "function") {
      try {
        const v = num(window.votesOf(item));
        if (v) return v;
      } catch (e) {}
    }

    const direct = firstNumber(item, [
      "votes", "voteCount", "votesCount", "ratingVoteCount", "kpVotes",
      "kinopoiskVotes", "imdbVotes", "ratingVotes", "rating_count"
    ]);
    if (direct) return direct;

    if (item.rating && typeof item.rating === "object") {
      const r = item.rating;
      const nested = firstNumber(r, ["votes", "kpVotes", "imdbVotes", "voteCount", "votesCount"]);
      if (nested) return nested;
    }

    if (item.votes && typeof item.votes === "object") {
      const v = item.votes;
      return firstNumber(v, ["kp", "imdb", "filmCritics", "russianFilmCritics"]);
    }

    return 0;
  }

  function ratingOfV146(item) {
    if (!item || typeof item !== "object") return 0;

    if (typeof window.ratingOf === "function") {
      try {
        const r = num(window.ratingOf(item));
        if (r) return r;
      } catch (e) {}
    }

    const direct = firstNumber(item, [
      "rating", "rate", "score", "kpRating", "kinopoiskRating",
      "imdbRating", "ratingKp", "rating_imdb"
    ]);
    if (direct) return direct;

    if (item.rating && typeof item.rating === "object") {
      const r = item.rating;
      return firstNumber(r, ["kp", "imdb", "filmCritics", "russianFilmCritics"]);
    }

    return 0;
  }

  function hasPosterV146(item) {
    return Boolean(
      item &&
      (item.poster || item.posterUrl || item.image || item.img || item.cover ||
        (item.poster && item.poster.url))
    );
  }

  function isMediaItemV146(item) {
    if (!item || typeof item !== "object") return false;

    const hasTitle = Boolean(
      item.ru || item.name || item.title || item.en || item.originalTitle || item.alternativeName
    );
    const hasMeta = Boolean(
      item.year || item.type || item.category || item.genres || item.genre ||
      item.poster || item.rating || item.votes || item.kinopoiskId || item.kpId
    );

    return hasTitle && hasMeta;
  }

  function activeTextV146() {
    const parts = [];

    try {
      document.querySelectorAll("button.active,.active,select").forEach((el) => {
        if (el.tagName === "SELECT") {
          const opt = el.options && el.options[el.selectedIndex];
          if (opt) parts.push(opt.textContent || opt.value || "");
        } else {
          parts.push(el.textContent || "");
        }
      });
    } catch (e) {}

    return parts.join(" ").toLowerCase();
  }

  function shouldSkipModeV146() {
    const t = activeTextV146();

    if (t.includes("новинки")) return true;
    if (t.includes("случай")) return true;
    if (t.includes("история")) return true;
    if (t.includes("избран")) return true;

    return false;
  }

  function votesScore9000000V146(item) {
    const v = votesOfV146(item);
    const r = ratingOfV146(item);
    const year = num(item && item.year);

    if (!v) return -999999;

    const votesPart = Math.min(v, 9000000) / 9000000;
    const ratingPart = Math.max(0, Math.min(r, 10)) / 10;

    let score = votesPart * 0.85 + ratingPart * 0.15;

    if (v < 10) score -= 10;
    else if (v < 100) score -= 5;
    else if (v < 1000) score -= 2;
    else if (v < 10000) score -= 0.7;

    if (r >= 9.5 && v < 1000) score -= 3;

    if (!hasPosterV146(item) && v < 5000) score -= 1.5;

    const currentYear = new Date().getFullYear();
    if (year >= currentYear && v < 1000) score -= 0.8;

    return score;
  }

  function mediaArrayV146(arr) {
    if (!Array.isArray(arr) || arr.length < 3) return false;

    const sample = arr.slice(0, Math.min(arr.length, 20));
    let media = 0;

    for (const item of sample) {
      if (isMediaItemV146(item)) media++;
    }

    return media >= Math.max(3, Math.ceil(sample.length * 0.45));
  }

  const nativeSort = Array.prototype.sort;

  Array.prototype.sort = function patchedGkmSort(compareFn) {
    const result = nativeSort.call(this, compareFn);

    try {
      if (!shouldSkipModeV146() && mediaArrayV146(this)) {
        nativeSort.call(this, function (a, b) {
          const sb = votesScore9000000V146(b);
          const sa = votesScore9000000V146(a);
          if (sb !== sa) return sb - sa;

          const vb = votesOfV146(b);
          const va = votesOfV146(a);
          if (vb !== va) return vb - va;

          const rb = ratingOfV146(b);
          const ra = ratingOfV146(a);
          if (rb !== ra) return rb - ra;

          return num(b && b.year) - num(a && a.year);
        });
      }
    } catch (e) {}

    return result;
  };

  window.GKM_V146_votesOf = votesOfV146;
  window.GKM_V146_ratingOf = ratingOfV146;
  window.GKM_V146_score9000000 = votesScore9000000V146;

  console.log("GKM: " + window.GKM_V146_VOTES_9000000_SORT_VERSION);
})();
/* GKM_V146_VOTES_9000000_SORT_END */
""".strip() + "\n"


def patch_app_js(path: Path) -> bool:
    if not path.exists():
        return False

    text = path.read_text(encoding="utf-8", errors="ignore")
    old = text

    pattern = re.compile(
        re.escape(START) + r".*?" + re.escape(END) + r"\s*",
        flags=re.S,
    )
    text = pattern.sub("", text).rstrip() + "\n\n" + PATCH

    if text != old:
        path.write_text(text, encoding="utf-8")
        return True

    return False


def patch_html(path: Path) -> bool:
    if not path.exists():
        return False

    text = path.read_text(encoding="utf-8", errors="ignore")
    old = text

    text = re.sub(r'app\.js\?v=\d+', 'app.js?v=146', text)
    text = re.sub(r'app\.js\?version=\d+', 'app.js?version=146', text)
    text = re.sub(r'(src=["\']app\.js)(["\'])', r'\1?v=146\2', text)

    if text != old:
        path.write_text(text, encoding="utf-8")
        return True

    return False


def main() -> int:
    changed = []

    for path in APP_FILES:
        if patch_app_js(path):
            changed.append(str(path))

    for path in HTML_FILES:
        if patch_html(path):
            changed.append(str(path))

    print("GKM V146 apply result")

    if changed:
        for path in changed:
            print("changed:", path)
    else:
        print("nothing changed")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
