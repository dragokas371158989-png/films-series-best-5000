#!/usr/bin/env python3
"""
GKM V3460.2 — synchronize data/fast/meta.json with the live catalog.

The script does not modify catalog records. It recalculates:
- count;
- rawCount and dedupeRemoved diagnostics;
- genres;
- years;
- page counters for the principal content buckets;
- generatedAt and sync metadata.

It mirrors the result to film/data/fast/meta.json when that tree exists.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SEARCH_PATH = ROOT / "data" / "fast" / "search_index.json"
PRIMARY_META_PATH = ROOT / "data" / "fast" / "meta.json"
FILM_META_PATH = ROOT / "film" / "data" / "fast" / "meta.json"
WALL_MANIFEST_PATH = ROOT / "data" / "fast" / "poster_wall_v333" / "manifest.json"
REPORT_PATH = ROOT / "TEST_REPORT_V3460_2_META_SYNC.json"

LAT = re.compile(r"[A-Za-z]")
YEAR_RE = re.compile(r"(18\d{2}|19\d{2}|20\d{2}|21\d{2})")


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, value: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def text(value: Any) -> str:
    return str(value or "").strip()


def integer(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def norm(value: Any) -> str:
    value = text(value).lower().replace("ё", "е")
    value = re.sub(r"[^\wа-яё]+", " ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def genres_of(item: dict) -> list[str]:
    value = item.get("genres")
    if isinstance(value, str):
        parts = re.split(r"[|,;/]", value)
    elif isinstance(value, list):
        parts = []
        for child in value:
            if isinstance(child, dict):
                child = child.get("name") or child.get("title") or ""
            parts.append(str(child or ""))
    else:
        parts = []

    output = []
    seen = set()
    for part in parts:
        part = text(part)
        key = norm(part)
        if part and key and key not in seen:
            seen.add(key)
            output.append(part)
    return output


def year_of(item: dict) -> str:
    raw = text(
        item.get("year")
        or item.get("release_date")
        or item.get("first_air_date")
        or item.get("date")
    )
    match = YEAR_RE.search(raw)
    return match.group(1) if match else ""


def bucket_of(item: dict) -> str:
    raw = norm(item.get("type") or item.get("category") or item.get("__kind"))

    if raw in {"фильм", "movie", "film"}:
        return "movies"
    if raw in {"сериал", "series", "tv", "tv series"}:
        return "series"
    if raw in {"аниме", "anime"}:
        return "anime"
    if "мульт" in raw or raw in {"cartoon", "animation", "animated series"}:
        return "cartoons"

    return "other"


def count_primary_chunks() -> int:
    total = 0
    for path in sorted((ROOT / "data").glob("chunk_*.json")):
        value = read_json(path, [])
        if isinstance(value, list):
            total += len(value)
    return total


def page_info(count: int, page_size: int) -> dict:
    return {
        "count": int(count),
        "pages": int(math.ceil(count / page_size)) if count else 0,
        "pageSize": int(page_size),
    }


def sorted_genres(rows: list[dict]) -> list[str]:
    by_key: dict[str, str] = {}
    for item in rows:
        for genre in genres_of(item):
            key = norm(genre)
            if key and key not in by_key:
                by_key[key] = genre

    return sorted(
        by_key.values(),
        key=lambda value: (bool(LAT.search(value)), norm(value)),
    )


def sorted_years(rows: list[dict]) -> list[str]:
    years = {year_of(item) for item in rows}
    years.discard("")
    return sorted(years, key=int, reverse=True)


def choose_raw_count(
    catalog_count: int,
    primary_count: int,
    existing_meta: dict,
    wall_manifest: dict,
) -> int:
    candidates = [catalog_count, primary_count]

    for value in (
        existing_meta.get("rawCount") if isinstance(existing_meta, dict) else 0,
        wall_manifest.get("sourceTotal") if isinstance(wall_manifest, dict) else 0,
    ):
        value = integer(value)
        if value >= catalog_count:
            candidates.append(value)

    return max(candidates)


def build_meta(rows: list[dict], existing: dict) -> tuple[dict, dict]:
    if not isinstance(existing, dict):
        existing = {}

    count = len(rows)
    page_size = max(1, integer(existing.get("pageSize")) or 60)
    home_limit = max(1, integer(existing.get("homeLimit")) or 18)

    buckets = Counter(bucket_of(item) for item in rows)
    primary_count = count_primary_chunks()
    wall_manifest = read_json(WALL_MANIFEST_PATH, {})
    raw_count = choose_raw_count(count, primary_count, existing, wall_manifest)
    dedupe_removed = max(raw_count - count, 0)

    pages = dict(existing.get("pages") or {})
    pages["all"] = page_info(count, page_size)
    pages["movies"] = page_info(buckets["movies"], page_size)
    pages["series"] = page_info(buckets["series"], page_size)
    pages["anime"] = page_info(buckets["anime"], page_size)
    pages["cartoons"] = page_info(buckets["cartoons"], page_size)

    notes = [
        str(value)
        for value in (existing.get("notes") or [])
        if str(value).strip()
        and "V3460.2" not in str(value)
        and "meta.json synchronized" not in str(value).lower()
    ]
    notes.append(
        "V3460.2: meta.json synchronized from data/fast/search_index.json"
    )

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )

    result = dict(existing)
    result.update(
        {
            "generatedAt": generated_at,
            "rawCount": raw_count,
            "count": count,
            "dedupeRemoved": dedupe_removed,
            "pageSize": page_size,
            "homeLimit": home_limit,
            "genres": sorted_genres(rows),
            "years": sorted_years(rows),
            "pages": pages,
            "metaSyncVersion": "V3460.2",
            "metaSyncSource": "data/fast/search_index.json",
            "catalogBreakdown": {
                "movies": buckets["movies"],
                "series": buckets["series"],
                "anime": buckets["anime"],
                "cartoons": buckets["cartoons"],
                "other": buckets["other"],
            },
            "notes": notes,
        }
    )

    diagnostics = {
        "catalogCount": count,
        "primaryChunkCount": primary_count,
        "rawCount": raw_count,
        "dedupeRemoved": dedupe_removed,
        "pageSize": page_size,
        "genres": len(result["genres"]),
        "years": len(result["years"]),
        "buckets": dict(result["catalogBreakdown"]),
        "wallSourceTotal": integer(
            wall_manifest.get("sourceTotal") if isinstance(wall_manifest, dict) else 0
        ),
    }

    return result, diagnostics


def validate_meta(meta: dict, rows: list[dict]) -> dict:
    expected_count = len(rows)
    all_page = (meta.get("pages") or {}).get("all") or {}

    latin_genres = [
        genre for genre in (meta.get("genres") or [])
        if LAT.search(str(genre or ""))
    ]

    tests = {
        "countMatchesCatalog": integer(meta.get("count")) == expected_count,
        "allPageCountMatches": integer(all_page.get("count")) == expected_count,
        "allPageSizeValid": integer(all_page.get("pageSize")) > 0,
        "allPageTotalValid": integer(all_page.get("pages"))
            == int(math.ceil(expected_count / max(1, integer(all_page.get("pageSize"))))),
        "genresPresent": bool(meta.get("genres")),
        "genresContainNoLatin": not latin_genres,
        "yearsPresent": bool(meta.get("years")),
        "syncVersionPresent": meta.get("metaSyncVersion") == "V3460.2",
    }

    return {
        "tests": tests,
        "latinGenreExamples": latin_genres[:30],
        "pass": all(tests.values()),
    }


def main():
    rows = read_json(SEARCH_PATH)
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"Missing or empty search index: {SEARCH_PATH}")

    existing = read_json(PRIMARY_META_PATH, {})
    meta, diagnostics = build_meta(rows, existing)
    validation = validate_meta(meta, rows)

    if not validation["pass"]:
        raise SystemExit(
            "V3460.2 metadata validation failed: "
            + json.dumps(validation, ensure_ascii=False)
        )

    write_json(PRIMARY_META_PATH, meta)

    mirrored = False
    if FILM_META_PATH.parent.exists():
        write_json(FILM_META_PATH, meta)
        mirrored = True

    report = {
        "version": "V3460.2",
        "status": "success",
        "metaPath": str(PRIMARY_META_PATH.relative_to(ROOT)),
        "filmMetaMirrored": mirrored,
        "diagnostics": diagnostics,
        "validation": validation,
    }
    write_json(REPORT_PATH, report)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
