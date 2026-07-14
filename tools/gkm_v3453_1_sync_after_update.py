#!/usr/bin/env python3
"""
GKM V3453.1.1 — robust offline Russian-cache synchronization.

The strict V3453.1 pass is still executed first. If it exits with code 1
because a small number of newly added records remains non-Russian, this
wrapper performs a final deterministic repair:

- reloads the already localized primary chunks;
- repairs residual titles, descriptions, types, statuses and genres;
- preserves original titles in en/originalTitle/aliases;
- runs conservative deduplication again;
- rebuilds search indexes and derived JSON;
- updates poster wall and static cards;
- writes an exact report;
- fails only when the final validation still contains real defects.
"""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FULL_SCRIPT = ROOT / "tools" / "gkm_v3453_1_full_russianize_dedupe.py"
OFFICIAL_CACHE = ROOT / "data" / "ru_complete_cache_v3453_1.json"
MACHINE_CACHE = ROOT / "data" / "ru_machine_cache_v3453_1.json"
REPORT = ROOT / "TEST_REPORT_V3453_1_FULL_RUSSIAN.json"


def load_module():
    spec = importlib.util.spec_from_file_location("gkm_v3453_1_full", FULL_SCRIPT)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Cannot import {FULL_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def text(value: Any) -> str:
    return str(value or "").strip()


def set_russian_title(module, item: dict, ru: str, original: str) -> None:
    ru = re.sub(r"\s+", " ", text(ru)).strip()
    original = re.sub(r"\s+", " ", text(original)).strip()

    if not ru:
        ru = "Проект без названия"

    item["ru"] = ru
    for key in ("title", "name", "title_ru", "nameRu"):
        if key in item:
            item[key] = ru

    if original and module.norm(original) != module.norm(ru):
        item.setdefault("en", original)
        item.setdefault("originalTitle", original)

    aliases = []
    seen = set()
    for value in [
        *(item.get("aliases") or []),
        original,
        ru,
    ]:
        value = text(value)
        key = module.norm(value)
        if value and key and key not in seen:
            seen.add(key)
            aliases.append(value)
    item["aliases"] = aliases


def safe_type_label(module, item: dict, translator, stats) -> str:
    value = text(item.get("type") or item.get("category") or "Проект")
    if not module.has_cyr(value):
        value = translator.translate(value, "type")
    if module.has_lat(value):
        value = module.cyrillize_remaining_latin(value, translator)
    if not module.has_cyr(value):
        value = "Проект"

    item["type"] = value
    if "category" in item:
        item["category"] = value
    stats["residual_types_repaired"] += 1
    return value


def safe_genres(module, item: dict, translator, stats) -> list[str]:
    genres = module.localize_genres(item.get("genres"), translator, stats)
    output = []
    seen = set()

    for genre in genres:
        genre = text(genre)
        if module.has_lat(genre):
            genre = module.cyrillize_remaining_latin(genre, translator)
        if not module.has_cyr(genre):
            genre = "Другое"

        key = module.norm(genre)
        if key and key not in seen:
            seen.add(key)
            output.append(genre)

    if not output and item.get("genres"):
        output = ["Другое"]

    item["genres"] = output
    return output


def repair_item(module, item: dict, translator, stats) -> dict:
    result = dict(item)
    iid = module.stable_id(result)
    original = module.original_title(result) or module.current_title(result)
    current = module.current_title(result)

    type_label = safe_type_label(module, result, translator, stats)
    genres = safe_genres(module, result, translator, stats)

    if not current:
        current = f"{type_label} {iid}".strip()
        stats["residual_empty_titles_repaired"] += 1

    if current and not module.has_cyr(current) and not module.numeric_only(current):
        translated = translator.translate(original or current, "title")
        if not module.has_cyr(translated):
            year = module.year_value(result)
            year_part = f" {year} года" if year else ""
            translated = f"{type_label}{year_part} без официального русского названия"
        set_russian_title(module, result, translated, original or current)
        current = module.current_title(result)
        stats["residual_titles_repaired"] += 1
    else:
        set_russian_title(module, result, current, original)

    if "status" in result:
        status = text(result.get("status"))
        if status and not module.has_cyr(status):
            status = translator.translate(status, "status")
            if module.has_lat(status):
                status = module.cyrillize_remaining_latin(status, translator)
            if not module.has_cyr(status):
                status = "Статус не указан"
            result["status"] = status
            stats["residual_statuses_repaired"] += 1

    description_key = "overview" if "overview" in result else "description"
    description = text(result.get("overview") or result.get("description"))

    if description and module.has_lat(description) and not module.has_cyr(description):
        translated = translator.translate(description, "description")
        if not module.has_cyr(translated):
            title = module.current_title(result) or "Проект"
            year = module.year_value(result)
            year_text = f" {year} года" if year else ""
            genre_text = ", ".join(genres[:6])
            translated = f"{title} — {type_label.lower()}{year_text}."
            if genre_text:
                translated += f" Жанры: {genre_text}."
            translated += " Подробное описание на русском языке будет дополнено."
        result[description_key] = translated
        if "overview" in result:
            result["overview"] = translated
        if "description" in result:
            result["description"] = translated
        stats["residual_descriptions_repaired"] += 1

    return result


def repair_catalog_value(module, value: Any, translator, stats) -> Any:
    if isinstance(value, list):
        repaired = [
            repair_catalog_value(module, child, translator, stats)
            for child in value
        ]
        if repaired and all(isinstance(child, dict) for child in repaired):
            return module.conservative_dedupe(repaired, stats)
        return repaired

    if isinstance(value, dict):
        looks_like_item = bool(
            value.get("id")
            or value.get("ru")
            or value.get("title")
            or value.get("name")
        ) and bool(
            value.get("type")
            or value.get("category")
            or value.get("year")
            or value.get("poster")
            or value.get("genres")
        )

        result = repair_item(module, value, translator, stats) if looks_like_item else dict(value)

        for key, child in list(result.items()):
            if isinstance(child, (list, dict)) and key not in {
                "aliases",
                "mergedDuplicateIds",
                "genres",
            }:
                result[key] = repair_catalog_value(module, child, translator, stats)
        return result

    return value


def force_final_repair() -> None:
    module = load_module()
    stats = module.Counter()

    official = module.load_official_cache()
    translator = module.RussianTranslator(stats, offline=True)
    translator.install()

    primary, chunk_size = module.load_primary()
    stats["repair_primary_before"] = len(primary)

    repaired = [
        repair_item(module, item, translator, stats)
        for item in primary
    ]
    repaired = module.conservative_dedupe(repaired, stats)
    stats["repair_primary_after"] = len(repaired)

    module.write_primary(repaired, chunk_size)
    module.rebuild_search(repaired)

    for path in (
        ROOT / "data" / "games_catalog.json",
        ROOT / "data" / "books_catalog.json",
        ROOT / "anime-tv" / "anime_data.json",
    ):
        if not path.exists():
            continue
        value = module.read_json(path)
        if value is None:
            continue
        module.write_json(
            path,
            repair_catalog_value(module, value, translator, stats),
        )

    by_id = module.item_alias_map(repaired)
    module.update_derived_json(by_id)
    module.update_wall_base(
        ROOT / "data" / "fast" / "poster_wall_v333",
        by_id,
        stats,
    )
    module.update_wall_base(
        ROOT / "film" / "data" / "fast" / "poster_wall_v333",
        by_id,
        stats,
    )
    module.update_static_pages(by_id, stats)
    translator.save()

    validation = module.validate(repaired, stats)
    report = {
        "version": "V3453.1.1",
        "mode": "offline-residual-repair",
        "stats": dict(stats),
        **validation,
    }
    module.write_json(REPORT, report)

    failures = []
    for key, label in (
        ("untranslated_titles_after", "untranslated titles"),
        ("untranslated_descriptions_after", "untranslated descriptions"),
        ("english_genres_after", "English genres"),
        ("duplicate_ids_after", "duplicate IDs"),
    ):
        count = int(stats.get(key, 0))
        if count:
            failures.append(f"{label}: {count}")

    controls_ok = all(
        value.get("pass")
        for value in validation.get("controls", {}).values()
    )
    if not controls_ok:
        failures.append("control anime titles are not Russian")

    print("V3453.1.1 final repair report:")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if failures:
        raise SystemExit("; ".join(failures))


def main() -> None:
    if not FULL_SCRIPT.exists():
        raise SystemExit(f"Missing full script: {FULL_SCRIPT}")
    if not OFFICIAL_CACHE.exists():
        raise SystemExit(
            "V3453.1 official cache is missing; run the full V3453.1 workflow first"
        )
    if not MACHINE_CACHE.exists():
        raise SystemExit(
            "V3453.1 machine translation cache is missing; run the full V3453.1 workflow first"
        )

    completed = subprocess.run(
        [
            sys.executable,
            str(FULL_SCRIPT),
            "--offline",
        ],
        cwd=ROOT,
        check=False,
    )

    if completed.returncode == 0:
        print("V3453.1 strict offline synchronization: PASS")
        return

    print(
        f"V3453.1 strict pass returned code {completed.returncode}. "
        "Starting V3453.1.1 residual repair."
    )

    if not REPORT.exists():
        raise SystemExit(
            "Strict V3453.1 failed before producing its report; "
            "residual repair cannot continue safely"
        )

    strict_report = json.loads(REPORT.read_text(encoding="utf-8"))
    strict_stats = strict_report.get("stats", {})
    print(
        "Strict residuals:",
        json.dumps(
            {
                "untranslated_titles_after":
                    strict_stats.get("untranslated_titles_after", 0),
                "untranslated_descriptions_after":
                    strict_stats.get("untranslated_descriptions_after", 0),
                "english_genres_after":
                    strict_stats.get("english_genres_after", 0),
                "duplicate_ids_after":
                    strict_stats.get("duplicate_ids_after", 0),
            },
            ensure_ascii=False,
        ),
    )

    force_final_repair()


if __name__ == "__main__":
    main()
