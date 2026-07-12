#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V112 global dedupe.
Runs inside GitHub Actions after fast data is built/enriched.
Removes exact/near duplicate titles with same normalized title + year,
regenerates fast pages, search_lite and search_shards.
"""
import json, re, math, shutil
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FAST = DATA / "fast"
PAGE_SIZE = 60
HOME_LIMIT = 18
VERSION = "v112-global-dedupe-fast-db-2026-06-19"

TITLE_DROP_WORDS = {"the", "a", "an"}
TYPE_ORDER = {"Аниме": 70, "Сериал": 60, "Мультфильм": 50, "Фильм": 40}
TAB_DIRS = {
    "all": lambda x: True,
    "movies": lambda x: norm_type(x) == "Фильм",
    "series": lambda x: norm_type(x) == "Сериал",
    "anime": lambda x: norm_type(x) == "Аниме",
    "cartoons": lambda x: norm_type(x) == "Мультфильм",
    "new": lambda x: int_year(x) >= 2022,
    "popular": lambda x: int_votes(x) >= 10000,
    "top": lambda x: True,
}

def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def clean_text(v):
    return str(v or "").strip()

def normalize_title(s):
    s = clean_text(s).lower().replace("ё", "е")
    s = re.sub(r"[\u2010-\u2015—–_]+", " ", s)
    s = re.sub(r"[\"'`«»“”‘’!?.,;:()\[\]{}<>/\\|]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    parts = [p for p in s.split() if p not in TITLE_DROP_WORDS]
    return " ".join(parts)

def int_year(x):
    try: return int(float(str(x.get("year") or 0)))
    except Exception: return 0

def int_votes(x):
    try: return int(float(str(x.get("votes") or 0)))
    except Exception: return 0

def float_rating(x):
    try: return float(str(x.get("rating") or 0))
    except Exception: return 0.0

def norm_type(x):
    t = clean_text(x.get("type") or x.get("kind") or x.get("category"))
    gs = " ".join(map(str, x.get("genres") or [])).lower()
    src = clean_text(x.get("source")).lower()
    if "аниме" in t.lower() or "anime" in t.lower() or "mal" in src or "jikan" in src or "аниме" in gs:
        return "Аниме"
    if "сериал" in t.lower() or t.lower() in {"tv", "series"}:
        return "Сериал"
    if "мульт" in t.lower() or "cartoon" in t.lower() or "мультфильм" in gs:
        return "Мультфильм"
    return "Фильм"

def item_key(x):
    year = int_year(x)
    titles = [x.get("ru"), x.get("en"), x.get("title"), x.get("name"), x.get("originalTitle")]
    keys = [normalize_title(t) for t in titles if normalize_title(t)]
    key_title = keys[0] if keys else normalize_title(x.get("id"))
    return (key_title, year)

def score(x):
    return (
        1000000 if clean_text(x.get("poster")) else 0,
        TYPE_ORDER.get(norm_type(x), 0),
        int_votes(x),
        float_rating(x),
        len(clean_text(x.get("overview"))),
    )

def merge_items(best, other):
    out = dict(best)
    # keep better type for anime/cartoon duplicates
    if TYPE_ORDER.get(norm_type(other), 0) > TYPE_ORDER.get(norm_type(out), 0):
        out["type"] = norm_type(other)
    else:
        out["type"] = norm_type(out)
    # fill blanks
    for k, v in other.items():
        if k not in out or out.get(k) in (None, "", [], 0, "—"):
            out[k] = v
    # prefer longer overview, more votes/rating when same title
    if len(clean_text(other.get("overview"))) > len(clean_text(out.get("overview"))):
        out["overview"] = other.get("overview")
    if int_votes(other) > int_votes(out):
        out["votes"] = other.get("votes")
    if float_rating(other) > float_rating(out):
        out["rating"] = other.get("rating")
    # merge genres
    genres=[]
    for g in list(out.get("genres") or []) + list(other.get("genres") or []):
        if g and g not in genres: genres.append(g)
    out["genres"] = genres[:12]
    out["search"] = search_text(out)
    return out

def search_text(x):
    parts = [x.get("ru"), x.get("en"), x.get("title"), x.get("year"), x.get("type")]
    parts += list(x.get("genres") or [])
    return " ".join(clean_text(p) for p in parts if clean_text(p))

def dedupe_list(items):
    kept = {}
    order = []
    removed = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        it = dict(it)
        it["type"] = norm_type(it)
        it["search"] = search_text(it)
        key = item_key(it)
        if key not in kept:
            kept[key] = it
            order.append(key)
        else:
            removed += 1
            a, b = kept[key], it
            if score(b) > score(a):
                kept[key] = merge_items(b, a)
            else:
                kept[key] = merge_items(a, b)
    return [kept[k] for k in order], removed

def sort_main(items):
    return sorted(items, key=lambda x: (float_rating(x), int_votes(x), int_year(x)), reverse=True)

def write_pages(items, meta):
    pages_dir = FAST / "pages"
    if pages_dir.exists():
        shutil.rmtree(pages_dir)
    pages_dir.mkdir(parents=True, exist_ok=True)
    pages_meta = {}
    for tab, pred in TAB_DIRS.items():
        arr = [x for x in items if pred(x)]
        if tab == "top":
            arr = sort_main(items)[:250]
        elif tab in {"popular", "new"}:
            arr = sorted(arr, key=lambda x: (int_votes(x), float_rating(x)), reverse=True) if tab == "popular" else sorted(arr, key=lambda x: (int_year(x), int_votes(x)), reverse=True)
        page_count = max(1, math.ceil(len(arr) / PAGE_SIZE))
        tab_dir = pages_dir / tab
        tab_dir.mkdir(parents=True, exist_ok=True)
        for i in range(page_count):
            save_json(tab_dir / f"page_{i+1:04d}.json", arr[i*PAGE_SIZE:(i+1)*PAGE_SIZE])
        pages_meta[tab] = {"count": len(arr), "pages": page_count, "pageSize": PAGE_SIZE}
    meta["pages"] = pages_meta
    return meta

def write_home(items):
    sorted_pop = sorted(items, key=lambda x: (int_votes(x), float_rating(x)), reverse=True)
    sorted_new = sorted(items, key=lambda x: (int_year(x), int_votes(x)), reverse=True)
    home = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "total": len(items),
        "sections": {
            "popular": sorted_pop[:HOME_LIMIT],
            "new": sorted_new[:HOME_LIMIT],
            "top": sort_main(items)[:HOME_LIMIT],
            "anime": [x for x in sorted_pop if norm_type(x)=="Аниме"][:HOME_LIMIT],
            "movies": [x for x in sorted_pop if norm_type(x)=="Фильм"][:HOME_LIMIT],
            "series": [x for x in sorted_pop if norm_type(x)=="Сериал"][:HOME_LIMIT],
            "cartoons": [x for x in sorted_pop if norm_type(x)=="Мультфильм"][:HOME_LIMIT],
        }
    }
    save_json(FAST / "home.json", home)

def write_search_helpers(items):
    lite=[]
    shards={}
    for x in items:
        lx={k:x.get(k) for k in ["id","ru","en","year","type","rating","votes","poster","genres","overview","episodes","studio","country","ageRating","source"]}
        lx["search"] = search_text(x)
        lite.append(lx)
        norm = normalize_title((x.get("ru") or x.get("en") or "")[:1]) or "other"
        ch = norm[0] if norm else "other"
        if not ch.isalnum(): ch = "other"
        shards.setdefault(ch, []).append(lx)
    save_json(FAST / "search_lite.json", lite)
    shards_dir = FAST / "search_shards"
    if shards_dir.exists(): shutil.rmtree(shards_dir)
    shards_dir.mkdir(parents=True, exist_ok=True)
    for ch, arr in shards.items():
        save_json(shards_dir / f"{ch}.json", arr)
    save_json(shards_dir / "manifest.json", {"version": VERSION, "count": len(items), "shards": {k: len(v) for k,v in sorted(shards.items())}})

def dedupe_raw_chunks(pattern):
    removed_total = 0
    for path in sorted(DATA.glob(pattern)):
        arr = load_json(path, None)
        if isinstance(arr, list):
            out, removed = dedupe_list(arr)
            if removed:
                save_json(path, out)
                removed_total += removed
    return removed_total

def main():
    si = FAST / "search_index.json"
    if not si.exists():
        raise SystemExit("data/fast/search_index.json not found")
    items = load_json(si, [])
    before = len(items)
    deduped, removed_fast = dedupe_list(items)
    save_json(si, deduped)
    meta = load_json(FAST / "meta.json", {})
    meta["count"] = len(deduped)
    meta["dedupe"] = {"version": VERSION, "before": before, "after": len(deduped), "removedFast": removed_fast}
    meta["appVersion"] = VERSION
    meta["searchIndexVersion"] = VERSION
    meta["generatedAt"] = datetime.now(timezone.utc).isoformat()
    meta = write_pages(deduped, meta)
    write_home(deduped)
    write_search_helpers(deduped)
    save_json(FAST / "meta.json", meta)
    raw_removed = dedupe_raw_chunks("chunk_*.json") + dedupe_raw_chunks("chunks/*.json")
    report = ROOT / "TEST_REPORT_V112_DEDUPE.txt"
    report.write_text(
        f"GKM V112 global dedupe\nversion: {VERSION}\nfast before: {before}\nfast after: {len(deduped)}\nfast removed: {removed_fast}\nraw removed: {raw_removed}\nposters: {sum(1 for x in deduped if x.get('poster'))}/{len(deduped)}\n",
        encoding="utf-8"
    )
    print(f"V112 dedupe complete: fast {before} -> {len(deduped)} removed={removed_fast}; raw_removed={raw_removed}")

if __name__ == "__main__":
    main()
