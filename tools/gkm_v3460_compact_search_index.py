#!/usr/bin/env python3
"""
GKM V3460.3.4 — compact and sparsify fast search indexes.

The catalog itself is not reduced:
- all records and IDs remain;
- Russian and original titles remain;
- descriptions, posters, genres, ratings and votes remain;
- cards and static pages are untouched.

The script:
1. rebuilds the helper `search` string without duplicating full descriptions;
2. removes only empty optional fields from search indexes;
3. validates IDs, record counts and the GitHub size safety limit;
4. writes files atomically.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FULL_PATH = ROOT / "data" / "fast" / "search_index.json"
LITE_PATH = ROOT / "data" / "fast" / "search_lite.json"
REPORT_PATH = ROOT / "TEST_REPORT_V3460_3_4_SEARCH_COMPACT.json"

MAX_SEARCH_CHARS = 520
HARD_FILE_LIMIT = 94 * 1024 * 1024

SPACE_RE = re.compile(r"\s+")
CLEAN_RE = re.compile(r"[^\wа-яё一-龯ぁ-ゔァ-ヴー々〆〤]+", re.I)

# These fields are optional in app.js. An absent value behaves exactly like
# an empty string / false value, while omitting it saves several MiB.
SPARSE_EMPTY_FIELDS = {
    "episodes",
    "studio",
    "country",
    "status",
    "ageRating",
    "overviewGenerated",
    "originalTitle",
    "titleLocalizationSource",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(temporary_name)

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(
                value,
                handle,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            handle.flush()
            os.fsync(handle.fileno())

        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


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
        return [
            part.strip()
            for part in re.split(r"[|,;/]", value)
            if part.strip()
        ]

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

    # A short description fragment keeps thematic keyword search,
    # without copying the full overview into the helper string.
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


def is_sparse_empty(value: Any) -> bool:
    return (
        value is None
        or value == ""
        or value == []
        or value == {}
        or value is False
    )


def compact_rows(rows: list[dict]) -> dict:
    before_ids = []
    before_search_chars = 0
    after_search_chars = 0
    changed_search = 0
    empty_ids = 0
    removed_fields = Counter()

    for item in rows:
        if not isinstance(item, dict):
            continue

        item_id = text(item.get("id"))
        before_ids.append(item_id)

        if not item_id:
            empty_ids += 1

        old_search = text(item.get("search"))
        new_search = build_search(item)

        before_search_chars += len(old_search)
        after_search_chars += len(new_search)

        if old_search != new_search:
            item["search"] = new_search
            changed_search += 1

        for field in tuple(SPARSE_EMPTY_FIELDS):
            if field in item and is_sparse_empty(item[field]):
                del item[field]
                removed_fields[field] += 1

    after_ids = [
        text(item.get("id"))
        for item in rows
        if isinstance(item, dict)
    ]

    return {
        "records": len(rows),
        "changedSearchRecords": changed_search,
        "emptyIds": empty_ids,
        "idsPreserved": before_ids == after_ids,
        "searchCharsBefore": before_search_chars,
        "searchCharsAfter": after_search_chars,
        "removedOptionalFields": dict(removed_fields),
        "removedOptionalFieldCount": sum(removed_fields.values()),
    }


def process(path: Path) -> tuple[dict, list[dict]]:
    if not path.exists():
        raise SystemExit(f"Missing index: {path}")

    rows = read_json(path)
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"Index is empty or invalid: {path}")

    before_size = path.stat().st_size
    before_count = len(rows)

    stats = compact_rows(rows)
    write_json_atomic(path, rows)

    after_size = path.stat().st_size
    reloaded = read_json(path)

    if not isinstance(reloaded, list):
        raise SystemExit(f"Written index is invalid: {path}")

    stats.update(
        {
            "path": str(path.relative_to(ROOT)),
            "recordsBefore": before_count,
            "recordsAfter": len(reloaded),
            "bytesBefore": before_size,
            "bytesAfter": after_size,
            "savedBytes": before_size - after_size,
            "savedMiB": round(
                (before_size - after_size) / 1024 / 1024,
                2,
            ),
        }
    )

    return stats, reloaded


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--hard-limit-bytes",
        type=int,
        default=HARD_FILE_LIMIT,
    )
    args = parser.parse_args()

    full, full_rows = process(FULL_PATH)
    lite, lite_rows = process(LITE_PATH)

    tests = {
        "fullIndexValid":
            isinstance(full_rows, list) and bool(full_rows),
        "liteIndexValid":
            isinstance(lite_rows, list) and bool(lite_rows),
        "fullRecordCountPreserved":
            full["recordsBefore"] == full["recordsAfter"],
        "liteRecordCountPreserved":
            lite["recordsBefore"] == lite["recordsAfter"],
        "fullIdsPreserved":
            full["idsPreserved"],
        "liteIdsPreserved":
            lite["idsPreserved"],
        "fullIndexBelowSafetyLimit":
            FULL_PATH.stat().st_size < args.hard_limit_bytes,
        "liteIndexBelowSafetyLimit":
            LITE_PATH.stat().st_size < args.hard_limit_bytes,
        "liteNotLargerThanFull":
            len(lite_rows) <= len(full_rows),
        "fullIdsPresent":
            all(
                text(item.get("id"))
                for item in full_rows
                if isinstance(item, dict)
            ),
        "searchHelperPresent":
            all(
                text(item.get("search"))
                for item in full_rows[:1000]
                if isinstance(item, dict)
            ),
    }

    report = {
        "version": "V3460.3.4",
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
        failed = [
            name
            for name, passed in tests.items()
            if not passed
        ]
        raise SystemExit(
            "V3460.3.4 index compaction validation failed: "
            + ", ".join(failed)
        )


if __name__ == "__main__":
    main()
