#!/usr/bin/env python3
"""Audit real description coverage in the generated fast catalog."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V350_CARDS_DESCRIPTIONS.json"


def rows_from(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("items", "data", "results"):
            if isinstance(value.get(key), list):
                return [item for item in value[key] if isinstance(item, dict)]
    return []


def main() -> None:
    canonical: dict[str, dict] = {}
    for path in sorted((ROOT / "data" / "fast" / "pages").rglob("*.json")):
        for item in rows_from(path):
            item_id = str(item.get("id") or "").strip()
            if item_id:
                canonical.setdefault(item_id, item)

    totals: dict[str, Counter] = defaultdict(Counter)
    examples: dict[str, list[dict]] = defaultdict(list)
    for item in canonical.values():
        media_type = str(item.get("type") or item.get("category") or "Неизвестно")
        overview = str(item.get("overview") or item.get("description") or "").strip()
        count = totals[media_type]
        count["total"] += 1
        if not overview:
            count["empty"] += 1
        if len(overview) < 80:
            count["under80"] += 1
        if len(overview) < 160:
            count["under160"] += 1
        else:
            count["good160"] += 1
        if (
            item.get("overviewGenerated")
            or item.get("overviewGeneratedRu")
            or "Описание будет дополнено" in overview
            or "из каталога «ГОЛУБЬ Каталог Мира»" in overview
        ):
            count["generated"] += 1
        if len(overview) < 80 and len(examples[media_type]) < 20:
            examples[media_type].append(
                {
                    "id": item.get("id"),
                    "title": item.get("ru") or item.get("title"),
                    "length": len(overview),
                    "overview": overview,
                }
            )

    report = {
        "version": "V350",
        "records": len(canonical),
        "byType": {key: dict(value) for key, value in sorted(totals.items())},
        "shortExamples": dict(examples),
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
