#!/usr/bin/env python3
"""GKM V3452.2 — deterministic sync of official Russian cache into every live dataset.

No network calls. Reads data/ru_official_cache_v3452_1.json and updates:
- primary chunks;
- fast search indexes;
- fast pages;
- poster wall and seed;
- film fast-data mirrors;
- anime-tv data;
- static film HTML pages.

The script is idempotent and can safely run after every daily catalog rebuild.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "data" / "ru_official_cache_v3452_1.json"
REPORT_PATH = ROOT / "TEST_REPORT_V3452_2_SYNC.json"

CYR = re.compile(r"[А-Яа-яЁё]")
LAT = re.compile(r"[A-Za-z]")
JSONLD_RE = re.compile(
    r'(<script\s+type=["\']application/ld\+json["\'][^>]*>)(.*?)(</script>)',
    re.I | re.S,
)

SKIP_JSON_NAMES = {
    CACHE_PATH.name,
    "unresolved_official_ru_v3452_1.json",
    REPORT_PATH.name,
}


def norm(value: Any) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[^\wа-яё]+", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def has_cyr(value: Any) -> bool:
    return bool(CYR.search(str(value or "")))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def load_cache() -> dict[str, dict]:
    if not CACHE_PATH.exists():
        raise SystemExit(f"Missing official cache: {CACHE_PATH}")
    raw = read_json(CACHE_PATH)
    items = raw.get("items") if isinstance(raw, dict) else None
    if not isinstance(items, dict) or not items:
        raise SystemExit("Official cache is empty")
    result = {}
    for iid, payload in items.items():
        if not isinstance(payload, dict):
            continue
        ru = str(payload.get("ru") or "").strip()
        if not has_cyr(ru):
            continue
        result[str(iid)] = dict(payload)
    if not result:
        raise SystemExit("Official cache contains no Cyrillic titles")
    return result


def iter_primary_items() -> list[dict]:
    items = []
    for path in sorted((ROOT / "data").glob("chunk_*.json")):
        try:
            value = read_json(path)
        except Exception:
            continue
        if isinstance(value, list):
            items.extend(x for x in value if isinstance(x, dict))
    return items


def build_official_by_any_id(cache: dict[str, dict]) -> dict[str, dict]:
    """Map canonical and merged duplicate IDs to the same official payload."""
    mapping = dict(cache)
    for item in iter_primary_items():
        iid = str(item.get("id") or "").strip()
        aliases = [
            str(x or "").strip()
            for x in (item.get("mergedDuplicateIds") or [])
            if str(x or "").strip()
        ]
        payload = None
        for candidate in [iid, *aliases]:
            if candidate in cache:
                payload = cache[candidate]
                break
        if payload:
            for candidate in [iid, *aliases]:
                if candidate:
                    mapping[candidate] = payload
    return mapping


def item_payload(item: dict, official_by_id: dict[str, dict]) -> dict | None:
    iid = str(item.get("id") or "").strip()
    candidates = [iid]
    candidates.extend(
        str(x or "").strip()
        for x in (item.get("mergedDuplicateIds") or [])
        if str(x or "").strip()
    )
    for candidate in candidates:
        payload = official_by_id.get(candidate)
        if payload:
            return payload
    return None


def update_item(item: dict, official_by_id: dict[str, dict], stats: Counter) -> bool:
    payload = item_payload(item, official_by_id)
    if not payload:
        return False

    ru = str(payload.get("ru") or "").strip()
    if not has_cyr(ru):
        return False

    old_title = str(
        item.get("ru")
        or item.get("title")
        or item.get("name")
        or ""
    ).strip()

    changed = False
    if item.get("ru") != ru:
        item["ru"] = ru
        changed = True

    # Keep all display fields synchronized where they already exist.
    for key in ("title", "name", "title_ru", "nameRu"):
        if key in item and item.get(key) != ru:
            item[key] = ru
            changed = True

    original = str(
        payload.get("original")
        or item.get("en")
        or item.get("originalTitle")
        or item.get("original_title")
        or ""
    ).strip()
    if original:
        if not item.get("en"):
            item["en"] = original
            changed = True
        if not item.get("originalTitle"):
            item["originalTitle"] = original
            changed = True

    if has_cyr(payload.get("overview")):
        overview = str(payload["overview"]).strip()
        if item.get("overview") != overview:
            item["overview"] = overview
            changed = True
        if "description" in item and item.get("description") != overview:
            item["description"] = overview
            changed = True

    if payload.get("genres") and item.get("genres") != payload["genres"]:
        item["genres"] = payload["genres"]
        changed = True

    aliases = []
    for value in item.get("aliases") or []:
        value = str(value or "").strip()
        if value:
            aliases.append(value)
    aliases.extend([old_title, ru, original])
    unique, seen = [], set()
    for value in aliases:
        key = norm(value)
        if value and key and key not in seen:
            seen.add(key)
            unique.append(value)
    if unique != (item.get("aliases") or []):
        item["aliases"] = unique
        changed = True

    source = str(payload.get("source") or "Official cache V3452.1")
    if item.get("titleLocalizationSource") != source:
        item["titleLocalizationSource"] = source
        changed = True

    if changed:
        stats["items_updated"] += 1
    return changed


def update_tree(value: Any, official_by_id: dict[str, dict], stats: Counter) -> bool:
    changed = False
    if isinstance(value, dict):
        if value.get("id") is not None:
            changed |= update_item(value, official_by_id, stats)
        for child in value.values():
            changed |= update_tree(child, official_by_id, stats)
    elif isinstance(value, list):
        for child in value:
            changed |= update_tree(child, official_by_id, stats)
    return changed


def json_targets() -> list[Path]:
    targets = []

    patterns = [
        "data/chunk_*.json",
        "data/chunks/chunk_*.json",
        "data/fast/search_index.json",
        "data/fast/search_lite.json",
        "data/fast/home.json",
        "data/fast/pages/*.json",
        "film/data/fast/search_index.json",
        "film/data/fast/search_lite.json",
        "film/data/fast/home.json",
        "film/data/fast/pages/*.json",
        "anime-tv/anime_data.json",
    ]
    for pattern in patterns:
        targets.extend(ROOT.glob(pattern))

    # Any additional small derived JSON used by cards/search.
    for pattern in (
        "anime_updates.json",
        "movies_updates.json",
        "data/anime*.json",
    ):
        targets.extend(ROOT.glob(pattern))

    unique = []
    seen = set()
    for path in targets:
        if not path.is_file() or path.name in SKIP_JSON_NAMES:
            continue
        key = str(path.resolve())
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return sorted(unique)


def process_json_files(official_by_id: dict[str, dict], stats: Counter, dry_run: bool) -> None:
    for path in json_targets():
        try:
            value = read_json(path)
        except Exception:
            stats["json_read_errors"] += 1
            continue
        changed = update_tree(value, official_by_id, stats)
        stats["json_files_checked"] += 1
        if changed:
            stats["json_files_changed"] += 1
            if not dry_run:
                write_json(path, value)


def process_poster_wall(official_by_id: dict[str, dict], stats: Counter, dry_run: bool) -> None:
    for base in (
        ROOT / "data" / "fast" / "poster_wall_v333",
        ROOT / "film" / "data" / "fast" / "poster_wall_v333",
    ):
        if not base.exists():
            continue
        for path in sorted(base.glob("*.json")):
            if path.name == "manifest.json":
                continue
            try:
                rows = read_json(path)
            except Exception:
                stats["wall_read_errors"] += 1
                continue
            if not isinstance(rows, list):
                continue

            changed = False
            seen = set()
            output = []
            for row in rows:
                if not isinstance(row, list) or len(row) < 2:
                    output.append(row)
                    continue
                iid = str(row[0] or "").strip()
                payload = official_by_id.get(iid)
                if payload and has_cyr(payload.get("ru")):
                    ru = str(payload["ru"]).strip()
                    if row[1] != ru:
                        row[1] = ru
                        changed = True
                        stats["wall_rows_updated"] += 1
                    if len(row) > 2 and payload.get("original") and not row[2]:
                        row[2] = payload["original"]
                        changed = True

                # Exact duplicate ID in the same wall file.
                key = iid or json.dumps(row[:4], ensure_ascii=False)
                if key in seen:
                    stats["wall_duplicates_removed"] += 1
                    changed = True
                    continue
                seen.add(key)
                output.append(row)

            stats["wall_files_checked"] += 1
            if changed:
                stats["wall_files_changed"] += 1
                if not dry_run:
                    write_json(path, output)


def replace_meta_content(source: str, name: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    pattern = re.compile(
        rf'(<meta\s+(?:name|property)=["\']{re.escape(name)}["\']\s+content=)["\'][^"\']*["\']',
        re.I,
    )
    return pattern.sub(lambda m: m.group(1) + f'"{escaped}"', source, count=1)


def process_static_pages(official_by_id: dict[str, dict], stats: Counter, dry_run: bool) -> None:
    film_dir = ROOT / "film"
    if not film_dir.exists():
        return

    for path in sorted(film_dir.glob("*.html")):
        text = path.read_text(encoding="utf-8", errors="replace")
        id_match = re.search(r'data-id=["\']([^"\']+)', text)
        iid = id_match.group(1) if id_match else path.stem
        payload = official_by_id.get(str(iid))
        if not payload or not has_cyr(payload.get("ru")):
            continue

        ru = str(payload["ru"]).strip()
        changed = text
        changed = re.sub(
            r"(<h1[^>]*>).*?(</h1>)",
            lambda m: m.group(1) + html.escape(ru) + m.group(2),
            changed,
            count=1,
            flags=re.I | re.S,
        )
        changed = re.sub(
            r"<title>.*?</title>",
            f"<title>{html.escape(ru)}</title>",
            changed,
            count=1,
            flags=re.I | re.S,
        )
        changed = replace_meta_content(changed, "og:title", ru)

        match = JSONLD_RE.search(changed)
        if match:
            try:
                payload_json = json.loads(html.unescape(match.group(2).strip()))
                if isinstance(payload_json, dict):
                    payload_json["name"] = ru
                    if payload.get("original"):
                        payload_json["alternateName"] = payload["original"]
                    clean = json.dumps(payload_json, ensure_ascii=False, separators=(",", ":"))
                    changed = changed[:match.start(2)] + clean + changed[match.end(2):]
            except Exception:
                stats["html_jsonld_errors"] += 1

        stats["html_pages_checked"] += 1
        if changed != text:
            stats["html_pages_changed"] += 1
            if not dry_run:
                path.write_text(changed, encoding="utf-8")


def verify_control_ids(official_by_id: dict[str, dict]) -> dict:
    path = ROOT / "data" / "fast" / "search_index.json"
    rows = read_json(path)
    by_id = {}
    for item in rows if isinstance(rows, list) else []:
        if not isinstance(item, dict):
            continue
        iid = str(item.get("id") or "")
        by_id[iid] = item
        for alias in item.get("mergedDuplicateIds") or []:
            by_id[str(alias)] = item

    result = {}
    for iid in ("mal_1002", "mal_35082", "mal_10049"):
        expected = official_by_id.get(iid, {}).get("ru")
        actual = (by_id.get(iid) or {}).get("ru")
        result[iid] = {
            "expected": expected,
            "actual": actual,
            "pass": bool(expected and actual == expected),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stats = Counter()
    cache = load_cache()
    official_by_id = build_official_by_any_id(cache)

    stats["official_cache_items"] = len(cache)
    stats["official_mapped_ids"] = len(official_by_id)

    process_json_files(official_by_id, stats, args.dry_run)
    process_poster_wall(official_by_id, stats, args.dry_run)
    process_static_pages(official_by_id, stats, args.dry_run)

    controls = verify_control_ids(official_by_id)
    if not args.dry_run and not all(x["pass"] for x in controls.values()):
        raise SystemExit("Control titles were not synchronized: " + json.dumps(controls, ensure_ascii=False))

    report = {
        "version": "V3452.2",
        "mode": "dry-run" if args.dry_run else "apply",
        "stats": dict(stats),
        "controlTitles": controls,
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
