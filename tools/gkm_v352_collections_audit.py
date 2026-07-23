#!/usr/bin/env python3
"""Audit V352 home collections, season titles and genre cleanup."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V352_COLLECTIONS.json"

FAMILY_RULES = {
    "attack-on-titan": ("атака титанов", "attack on titan", "shingeki no kyojin"),
    "my-hero-academia": ("моя геройская академия", "my hero academia", "boku no hero academia"),
    "re-zero": ("re zero", "rezero", "жизнь с нуля", "re starting life"),
    "naruto": ("наруто", "naruto", "shippuden", "shippuuden", "boruto"),
    "bleach": ("блич", "bleach", "thousand year blood", "sennen kessen", "tybw"),
    "one-piece": ("ван пис", "ванпис", "one piece"),
    "fullmetal-alchemist": ("стальной алхимик", "fullmetal alchemist"),
    "tokyo-ghoul": ("токийский гуль", "tokyo ghoul"),
    "dragon-ball": ("драконий жемчуг", "dragon ball"),
    "hunter-x-hunter": ("hunter x hunter", "охотник х охотник", "охотник x охотник"),
    "demon-slayer": ("истребитель демонов", "demon slayer", "kimetsu no yaiba"),
    "jujutsu-kaisen": ("магическая битва", "jujutsu kaisen"),
    "code-geass": ("код гиас", "code geass"),
    "frieren": ("фрирен", "frieren"),
    "vinland-saga": ("сага о винланде", "vinland saga"),
    "solo-leveling": ("поднятие уровня в одиночку", "solo leveling"),
}

MEDIA_GENRES = {
    "аниме", "anime", "фильм", "film", "movie", "сериал", "series", "tv",
    "мультфильм", "мультсериал", "cartoon", "animation", "animated series",
    "игра", "game", "книга", "book", "манга", "manga", "ранобэ",
    "light novel", "комикс", "comic",
}
NORMALIZED_MEDIA_GENRES = {
    re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", value.lower().replace("ё", "е"), flags=re.UNICODE)).strip()
    for value in MEDIA_GENRES
}


def text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def norm(value: Any) -> str:
    value = text(value).lower().replace("ё", "е").replace("’", "'").replace("`", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", value, flags=re.UNICODE)).strip()


def rows_from(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("items", "data", "results"):
            child = value.get(key)
            if isinstance(child, list):
                return [item for item in child if isinstance(item, dict)]
    return []


def raw_title(item: dict) -> str:
    values = [
        item.get("ru"), item.get("title_ru"), item.get("en"), item.get("title"),
        item.get("name"), item.get("originalTitle"), item.get("original_title"),
        item.get("original_name"),
    ]
    aliases = item.get("aliases")
    if isinstance(aliases, list):
        values.extend(aliases)
    return " ".join(text(value) for value in values if text(value))


def family_key(item: dict) -> str:
    raw = norm(raw_title(item))
    media_type = norm(item.get("type") or item.get("category") or "other")
    for key, aliases in FAMILY_RULES.items():
        if any(norm(alias) in raw for alias in aliases):
            return f"{media_type}:{key}"
    return ""


def genre_values(item: dict) -> list[str]:
    value = item.get("genres")
    if isinstance(value, list):
        return [text(part.get("name") if isinstance(part, dict) else part) for part in value]
    return [text(part) for part in re.split(r"[,|/]+", text(value))]


def page_paths() -> Iterable[Path]:
    pages = ROOT / "data" / "fast" / "pages"
    if pages.exists():
        yield from sorted(pages.rglob("*.json"))


def ui_checks() -> dict[str, bool]:
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    return {
        "app_cache_v352": 'GKM_DATA_CACHE_VERSION = "352"' in app and "app.js?v=352" in index,
        "home_uses_collection_collapse": (
            "gkmV352RenderHome" in app
            and "const result = collapse(source);" in app
            and "data-gkm-v352-section" in app
        ),
        "collection_badges_preserved": "__gkmCollectionCount" in app,
        "season_titles_enabled": (
            "gkmV352DisplayTitle" in app
            and "Сезон 3 · часть 2" in app
            and "Финальный сезон · часть 2" in app
        ),
        "media_genres_removed": "gkmV352GetGenres" in app and "MEDIA_GENRES" in app,
        "runtime_test_api": "GKM_V352_TEST_API" in app,
    }


def main() -> None:
    family_groups: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    genre_artifacts = Counter()
    artifact_examples: list[dict] = []
    records = 0

    home_path = ROOT / "data" / "fast" / "home.json"
    if home_path.exists():
        try:
            home = json.loads(home_path.read_text(encoding="utf-8"))
        except Exception:
            home = {}
        sections = home.get("sections", {}) if isinstance(home, dict) else {}
        if isinstance(sections, dict):
            for section, items in sections.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    key = family_key(item)
                    if key:
                        family_groups[str(section)][key].append(item)

    for path in page_paths():
        for item in rows_from(path):
            records += 1
            for genre in genre_values(item):
                key = norm(genre)
                if key in NORMALIZED_MEDIA_GENRES:
                    genre_artifacts[key] += 1
                    if len(artifact_examples) < 30:
                        artifact_examples.append(
                            {
                                "id": item.get("id"),
                                "title": item.get("ru") or item.get("title"),
                                "type": item.get("type"),
                                "genre": genre,
                            }
                        )

    duplicated_families = {}
    predicted_removed = 0
    for section, groups in sorted(family_groups.items()):
        duplicates = {}
        for key, items in sorted(groups.items()):
            if len(items) < 2:
                continue
            predicted_removed += len(items) - 1
            duplicates[key] = [
                {
                    "id": item.get("id"),
                    "title": item.get("ru") or item.get("title"),
                    "year": item.get("year"),
                }
                for item in items
            ]
        if duplicates:
            duplicated_families[section] = duplicates

    checks = ui_checks()
    report = {
        "version": "V352",
        "pageRecordsScanned": records,
        "uiChecks": checks,
        "homeDuplicateFamiliesBeforeRuntimeCollapse": duplicated_families,
        "homeCardsPredictedToCollapse": predicted_removed,
        "mediaTypeGenresRemovedAtRuntime": dict(genre_artifacts),
        "mediaTypeGenreExamples": artifact_examples,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("V352 UI checks failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
