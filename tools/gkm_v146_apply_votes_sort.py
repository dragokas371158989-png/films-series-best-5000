#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import re
from pathlib import Path

APP = Path("app.js")
BACKUP = Path("app.js.v146_backup")

PATCH = r"""
/* ================= GKM V146 votes 9000000 smart sort ================= */
window.GKM_V146_VOTES_9000000_SORT_VERSION = "v146-votes-9000000-sort-2026-06-24";

function GKM_V146_number(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).toLowerCase().replace(/\s+/g, "").replace(",", ".");
  let mul = 1;
  if (s.includes("млн") || s.includes("million") || s.endsWith("m")) mul = 1000000;
  else if (s.includes("тыс") || s.includes("k")) mul = 1000;
  s = s.replace(/[^0-9.\-]/g, "");
  const n = Number(s || 0);
  return Number.isFinite(n) ? n * mul : 0;
}

function GKM_V146_votesOfSafe(item) {
  if (!item) return 0;
  if (typeof votesOf === "function") { try { return GKM_V146_number(votesOf(item)); } catch (e) {} }
  const v = item.votes ?? item.voteCount ?? item.votes_kp ?? item.kpVotes ?? item.ratingVotes ?? item.rating_vote_count;
  if (typeof v === "object" && v) return GKM_V146_number(v.kp ?? v.imdb ?? v.value ?? 0);
  return GKM_V146_number(v);
}

function GKM_V146_ratingOfSafe(item) {
  if (!item) return 0;
  if (typeof ratingOf === "function") { try { return GKM_V146_number(ratingOf(item)); } catch (e) {} }
  const r = item.rating ?? item.rate ?? item.rating_kp ?? item.kpRating ?? item.score;
  if (typeof r === "object" && r) return GKM_V146_number(r.kp ?? r.imdb ?? r.value ?? 0);
  return GKM_V146_number(r);
}

function votesScore9000000(item) {
  const v = GKM_V146_votesOfSafe(item);
  const r = GKM_V146_ratingOfSafe(item);
  if (!v) return -999;
  const votesPart = Math.min(v, 9000000) / 9000000;
  const ratingPart = Math.max(0, Math.min(r, 10)) / 10;
  let score = votesPart * 0.85 + ratingPart * 0.15;
  if (v < 10) score -= 10;
  else if (v < 100) score -= 5;
  else if (v < 1000) score -= 2;
  else if (v < 10000) score -= 0.7;
  const poster = item && (item.poster || item.posterUrl || item.image || item.img || item.cover);
  if (!poster && v < 50000) score -= 1.2;
  return score;
}

function isBadTopItem(item) {
  const v = GKM_V146_votesOfSafe(item);
  const r = GKM_V146_ratingOfSafe(item);
  const poster = item && (item.poster || item.posterUrl || item.image || item.img || item.cover);
  if (r >= 9.5 && v < 1000) return true;
  if (v < 100) return true;
  if (!poster && v < 50000) return true;
  return false;
}

function GKM_V146_applyVotes9000000Sort(items, opts) {
  if (!Array.isArray(items)) return items;
  const keepTrash = opts && opts.keepTrash;
  const arr = keepTrash ? items.slice() : items.filter(item => !isBadTopItem(item));
  arr.sort((a, b) => {
    const sb = votesScore9000000(b);
    const sa = votesScore9000000(a);
    if (sb !== sa) return sb - sa;
    const vb = GKM_V146_votesOfSafe(b);
    const va = GKM_V146_votesOfSafe(a);
    if (vb !== va) return vb - va;
    return GKM_V146_ratingOfSafe(b) - GKM_V146_ratingOfSafe(a);
  });
  return arr;
}

window.GKM_V146_applyVotes9000000Sort = GKM_V146_applyVotes9000000Sort;
/* ================= /GKM V146 votes 9000000 smart sort ================= */
"""

def main() -> int:
    if not APP.exists():
        print("ERROR: app.js not found. Run this script from repo root.")
        return 1
    text = APP.read_text(encoding="utf-8", errors="replace")
    if "GKM_V146_VOTES_9000000_SORT_VERSION" in text:
        print("OK: V146 already exists in app.js")
        return 0
    BACKUP.write_text(text, encoding="utf-8")
    text = text.rstrip() + "\n" + PATCH + "\n"
    replacements = 0
    patterns = [
        r"\.sort\s*\(\s*\(\s*a\s*,\s*b\s*\)\s*=>\s*\([^)]*ratingOf\(b\)[\s\S]{0,240}?ratingOf\(a\)[^)]*\)\s*\)",
        r"\.sort\s*\(\s*\(\s*a\s*,\s*b\s*\)\s*=>\s*\([^)]*votesOf\(b\)[\s\S]{0,240}?votesOf\(a\)[^)]*\)\s*\)",
    ]
    replacement = ".sort((a,b)=>{const sb=votesScore9000000(b),sa=votesScore9000000(a);if(sb!==sa)return sb-sa;const vb=GKM_V146_votesOfSafe(b),va=GKM_V146_votesOfSafe(a);if(vb!==va)return vb-va;return GKM_V146_ratingOfSafe(b)-GKM_V146_ratingOfSafe(a);})"
    for pattern in patterns:
        text, n = re.subn(pattern, replacement, text, count=2)
        replacements += n
    text = re.sub(r"app\.js\?v=\d+", "app.js?v=146", text)
    APP.write_text(text, encoding="utf-8")
    print("OK: V146 patch added to app.js")
    print(f"Backup: {BACKUP}")
    print(f"Automatic sort replacements: {replacements}")
    print("Check: window.GKM_V146_VOTES_9000000_SORT_VERSION")
    print("If genre top still shows trash, manually use: items = GKM_V146_applyVotes9000000Sort(items)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
