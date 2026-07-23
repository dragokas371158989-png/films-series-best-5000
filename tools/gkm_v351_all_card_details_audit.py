#!/usr/bin/env python3
"""Audit descriptions and UI integrity for every catalog media type."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V351_ALL_CARD_DETAILS.json"

DESCRIPTION_FIELDS = (
    "overview_ru",
    "description_ru",
    "synopsis_ru",
    "plot_ru",
    "overview",
    "description",
    "synopsis",
    "plot",
    "annotation",
    "summary",
)
BOILERPLATE = (
    re.compile(r"описание пока не добавлено", re.I),
    re.compile(r"описание будет (?:добавлено|дополнено)", re.I),
    re.compile(r"карточка (?:представлена|помогает|нужна)", re.I),
    re.compile(r"проект из каталога", re.I),
    re.compile(r"переходить к просмотру или поиску", re.I),
    re.compile(r"подходит ли проект под нужный вайб", re.I),
)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def rows_from(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        rows: list[dict] = []
        for key in ("items", "data", "results", "books", "manga", "comics", "ranobe"):
            child = value.get(key)
            if isinstance(child, list):
                rows.extend(item for item in child if isinstance(item, dict))
        return rows
    return []


def source_paths() -> Iterable[Path]:
    seen: set[Path] = set()
    patterns = (
        "data/fast/pages/**/*.json",
        "data/chunk_*.json",
        "data/books_catalog.json",
        "data/games_catalog.json",
        "data/books/**/*.json",
        "anime-tv/anime_data.json",
    )
    for pattern in patterns:
        for path in sorted(ROOT.glob(pattern)):
            if path.is_file() and path not in seen:
                seen.add(path)
                yield path


def title_of(item: dict) -> str:
    for key in ("ru", "title_ru", "title", "name", "en", "originalTitle"):
        value = clean(item.get(key))
        if value:
            return value
    return "Без названия"


def type_of(item: dict) -> str:
    raw = clean(item.get("type") or item.get("category") or item.get("kind"))
    low = raw.lower()
    if "аниме" in low or "anime" in low:
        return "Аниме"
    if "мульт" in low or "cartoon" in low or "animation" in low:
        return "Мультфильм"
    if "сериал" in low or "series" in low or low == "tv":
        return "Сериал"
    if "игр" in low or "game" in low:
        return "Игра"
    if any(token in low for token in ("книга", "манга", "раноб", "комик", "book", "manga", "comic")):
        return "Книга/Манга"
    if "фильм" in low or "movie" in low or "film" in low:
        return "Фильм"
    return raw or "Неизвестно"


def item_key(item: dict) -> str:
    identifier = clean(
        item.get("id")
        or item.get("kinopoiskId")
        or item.get("tmdbId")
        or item.get("mal_id")
        or item.get("slug")
    )
    if identifier:
        return identifier
    return "|".join((type_of(item), title_of(item).lower(), clean(item.get("year"))))


def description_of(item: dict) -> str:
    for field in DESCRIPTION_FIELDS:
        value = clean(item.get(field))
        if value:
            return value
    return ""


def is_boilerplate(value: str) -> bool:
    return any(pattern.search(value) for pattern in BOILERPLATE)


def ui_checks() -> dict[str, bool]:
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    style = (ROOT / "style.css").read_text(encoding="utf-8")
    return {
        "javascript_cache_v351": 'GKM_DATA_CACHE_VERSION = "351"' in app,
        "javascript_asset_v351": 'app.js?v=351' in index,
        "stylesheet_cache_v351": 'style.css?v=351' in index,
        "duplicate_description_disabled": (
            "one authoritative synopsis is shown" in app
            and "do not fabricate or duplicate a second description block" in app
        ),
        "v351_runtime_guard": "GKM_V351_ALL_CARD_DETAILS_VERSION" in app,
        "all_six_colour_themes": all(
            f'data-media-theme="{theme}"' in style
            for theme in ("movie", "series", "anime", "cartoon", "game", "book")
        ),
        "family_poster_recovery": "img.gkm-family-poster" in app and "gkm-family-empty" in app,
        "family_colour_guard": "GKM V351 — colour and poster integrity" in style,
    }


def main() -> None:
    canonical: dict[str, dict] = {}
    files = list(source_paths())
    for path in files:
        for item in rows_from(path):
            key = item_key(item)
            current = canonical.get(key)
            if current is None or len(description_of(item)) > len(description_of(current)):
                canonical[key] = item

    totals: dict[str, Counter] = defaultdict(Counter)
    examples: dict[str, dict[str, list[dict]]] = defaultdict(
        lambda: {"empty": [], "short": [], "boilerplate": []}
    )
    for item in canonical.values():
        media_type = type_of(item)
        description = description_of(item)
        stats = totals[media_type]
        stats["total"] += 1
        if not description:
            stats["empty"] += 1
            bucket = "empty"
        elif is_boilerplate(description):
            stats["boilerplate"] += 1
            bucket = "boilerplate"
        elif len(description) < 80:
            stats["short_under80"] += 1
            bucket = "short"
        else:
            stats["good"] += 1
            if len(description) >= 160:
                stats["good_160_plus"] += 1
            continue

        if len(examples[media_type][bucket]) < 12:
            examples[media_type][bucket].append(
                {
                    "id": item.get("id"),
                    "title": title_of(item),
                    "length": len(description),
                    "description": description,
                }
            )

    checks = ui_checks()
    report = {
        "version": "V351",
        "filesScanned": len(files),
        "records": len(canonical),
        "uiChecks": checks,
        "byType": {key: dict(value) for key, value in sorted(totals.items())},
        "problemExamples": {key: value for key, value in sorted(examples.items())},
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("UI integrity checks failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
