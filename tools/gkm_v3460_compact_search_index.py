#!/usr/bin/env python3
"""
GKM V3460.3.1 — compact fast search indexes before GitHub commit.

Why:
GitHub rejects ordinary Git files larger than 100 MiB. The full catalog index
is already close to that limit and grows after every catalog update.

What is preserved:
- every record and ID;
- Russian/original titles;
- aliases;
- year, type, rating, votes and poster;
- genres, overview, studio, country, status and source.

Only the precomputed `search` helper string is rebuilt without repeating the
full description. The browser already searches title/ru/en/genres separately,
so cards and descriptions remain unchanged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FULL_PATH = ROOT / "data" / "fast" / "search_index.json"
LITE_PATH = ROOT / "data" / "fast" / "search_lite.json"
REPORT_PATH = ROOT / "TEST_REPORT_V3460_3_1_SEARCH_COMPACT.json"

MAX_SEARCH_CHARS = 520
HARD_FILE_LIMIT = 94 * 1024 * 1024
SPACE_RE = re.compile(r"\s+")
CLEAN_RE = re.compile(r"[^\wа-яё一-龯ぁ-ゔァ-ヴー々〆〤]+", re.I)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_compact(path: Path, value: Any):
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def text(value: Any) -> str:
    return str(value or "").strip()


def normalize(value: Any) -> str:
    value = text(value).lower().replace("ё", "е")
    value = CLEAN_RE.sub(" ", value)
    return SPACE_RE.sub(" ", value).strip()


def list_text(value: Any) -> list[str]:
    if isinstance(value, list):
        result = []
        for item in value:
            if isinstance(item, dict):
                item = item.get("name") or item.get("title") or ""
            item = text(item)
            if item:
                result.append(item)
        return result
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[|,;/]", value) if part.strip()]
    return []


def build_search(item: dict) -> str:
    aliases = list_text(item.get("aliases"))[:20]
    genres = list_text(item.get("genres"))
    values = [
        item.get("ru"),
        item.get("en"),
        item.get("originalTitle"),
        item.get("title"),
        item.get("name"),
        *aliases,
        item.get("year"),
        item.get("type"),
        *genres,
        item.get("studio"),
        item.get("country"),
        item.get("status"),
        item.get("source"),
    ]

    # Preserve a small description fragment for thematic keyword searches,
    # but never copy the whole overview into the helper string.
    overview = text(item.get("overview") or item.get("description"))
    if overview:
        values.append(overview[:180])

    words = []
    seen = set()
    for value in values:
        normalized = normalize(value)
        if not normalized:
            continue
        for word in normalized.split():
            if word in seen:
                continue
            seen.add(word)
            words.append(word)

    return " ".join(words)[:MAX_SEARCH_CHARS].strip()


def compact_rows(rows: list[dict]) -> dict:
    before_search_chars = 0
    after_search_chars = 0
    changed = 0
    empty_ids = 0

    for item in rows:
        if not isinstance(item, dict):
            continue
        if not text(item.get("id")):
            empty_ids += 1

        old = text(item.get("search"))
        new = build_search(item)
        before_search_chars += len(old)
        after_search_chars += len(new)

        if old != new:
            item["search"] = new
            changed += 1

    return {
        "records": len(rows),
        "changedRecords": changed,
        "emptyIds": empty_ids,
        "searchCharsBefore": before_search_chars,
        "searchCharsAfter": after_search_chars,
    }


def process(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Missing index: {path}")

    rows = read_json(path)
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"Index is empty or invalid: {path}")

    before_size = path.stat().st_size
    stats = compact_rows(rows)
    write_compact(path, rows)
    after_size = path.stat().st_size

    stats.update(
        {
            "path": str(path.relative_to(ROOT)),
            "bytesBefore": before_size,
            "bytesAfter": after_size,
            "savedBytes": max(before_size - after_size, 0),
        }
    )
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--hard-limit-bytes",
        type=int,
        default=HARD_FILE_LIMIT,
    )
    args = parser.parse_args()

    full = process(FULL_PATH)
    lite = process(LITE_PATH)

    full_rows = read_json(FULL_PATH)
    lite_rows = read_json(LITE_PATH)

    tests = {
        "fullIndexValid": isinstance(full_rows, list) and bool(full_rows),
        "liteIndexValid": isinstance(lite_rows, list) and bool(lite_rows),
        "fullIndexBelowSafetyLimit":
            FULL_PATH.stat().st_size < args.hard_limit_bytes,
        "liteNotLargerThanFull": len(lite_rows) <= len(full_rows),
        "fullIdsPresent":
            all(text(item.get("id")) for item in full_rows if isinstance(item, dict)),
        "searchHelperPresent":
            all(
                text(item.get("search"))
                for item in full_rows[:1000]
                if isinstance(item, dict)
            ),
    }

    report = {
        "version": "V3460.3.1",
        "status": "success" if all(tests.values()) else "failed",
        "safetyLimitBytes": args.hard_limit_bytes,
        "full": full,
        "lite": lite,
        "tests": tests,
    }

    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if not all(tests.values()):
        raise SystemExit("V3460.3.1 index compaction validation failed")


if __name__ == "__main__":
    main()
