#!/usr/bin/env python3
"""
GKM V3460.1 — stable-core health audit.

Read-only inspection of the repository. It writes only:
- data/health_v3460.json
- TEST_REPORT_V3460_HEALTH.json

Checks:
- critical files and JSON;
- JavaScript syntax;
- full search index counts;
- Russian titles and genres;
- duplicate and empty IDs;
- anime top/studio databases;
- 3D poster wall;
- static pages and key workflows.

The audit does not modify catalog records.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HEALTH_PATH = ROOT / "data" / "health_v3460.json"
REPORT_PATH = ROOT / "TEST_REPORT_V3460_HEALTH.json"

CYR = re.compile(r"[А-Яа-яЁё]")
LAT = re.compile(r"[A-Za-z]")

CRITICAL_FILES = [
    "index.html",
    "style.css",
    "app.js",
    "features_v344.js",
    "ai_search_worker_v344.js",
    "data/fast/search_index.json",
    "data/fast/search_lite.json",
    "data/fast/meta.json",
    "data/fast/poster_wall_v333/manifest.json",
    "data/fast/anime_top_manual.json",
    "data/fast/anime_studios_top.json",
    "data/fast/anime_studios_detail.json",
]

JS_FILES = [
    "app.js",
    "features_v344.js",
    "ai_search_worker_v344.js",
]

WORKFLOW_FILES = [
    ".github/workflows/gkm_v344_safe_auto_update.yml",
    ".github/workflows/gkm_v3453_1_full_russian_site.yml",
    ".github/workflows/gkm_v3453_1_sync_after_update.yml",
    ".github/workflows/gkm_v3454_rebuild_anime_buttons.yml",
]


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def text(value: Any) -> str:
    return str(value or "").strip()


def title_of(item: dict) -> str:
    return text(
        item.get("ru")
        or item.get("title_ru")
        or item.get("nameRu")
        or item.get("title")
        or item.get("name")
        or item.get("en")
    )


def genres_of(item: dict) -> list[str]:
    value = item.get("genres")
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[|,;/]", value) if part.strip()]
    if isinstance(value, list):
        output = []
        for part in value:
            if isinstance(part, dict):
                part = part.get("name") or part.get("title") or ""
            part = text(part)
            if part:
                output.append(part)
        return output
    return []


def count_payload(value: Any, preferred_keys: tuple[str, ...]) -> int:
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        for key in preferred_keys:
            child = value.get(key)
            if isinstance(child, list):
                return len(child)
            if isinstance(child, dict):
                return len(child)
        if isinstance(value.get("count"), (int, float)):
            return int(value["count"])
    return 0


def run_node_check(relative_path: str) -> dict:
    path = ROOT / relative_path
    if not path.exists():
        return {"ok": False, "message": "Файл отсутствует"}
    try:
        completed = subprocess.run(
            ["node", "--check", str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        return {"ok": False, "message": "Node.js не найден"}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    return {
        "ok": completed.returncode == 0,
        "message": (completed.stderr or completed.stdout or "OK").strip()[:1000],
    }


def inspect_search_index(path: Path) -> dict:
    rows = read_json(path)
    if not isinstance(rows, list):
        return {
            "ok": False,
            "count": 0,
            "error": "search_index.json не является массивом",
        }

    ids = Counter()
    empty_ids = 0
    untranslated_titles = []
    latin_genres = []
    empty_titles = 0
    types = Counter()

    for item in rows:
        if not isinstance(item, dict):
            continue
        iid = text(item.get("id"))
        if iid:
            ids[iid] += 1
        else:
            empty_ids += 1

        title = title_of(item)
        if not title:
            empty_titles += 1
        elif not CYR.search(title):
            untranslated_titles.append({"id": iid, "title": title})

        for genre in genres_of(item):
            if LAT.search(genre):
                latin_genres.append({"id": iid, "title": title, "genre": genre})

        item_type = text(item.get("type") or item.get("category") or "Не указан")
        types[item_type] += 1

    duplicate_ids = [iid for iid, count in ids.items() if count > 1]

    return {
        "ok": True,
        "count": len(rows),
        "emptyIds": empty_ids,
        "emptyTitles": empty_titles,
        "duplicateIds": len(duplicate_ids),
        "duplicateIdExamples": duplicate_ids[:30],
        "untranslatedTitles": len(untranslated_titles),
        "untranslatedTitleExamples": untranslated_titles[:20],
        "latinGenres": len(latin_genres),
        "latinGenreExamples": latin_genres[:20],
        "types": dict(types.most_common()),
    }


def inspect_poster_wall(base: Path) -> dict:
    manifest_path = base / "manifest.json"
    manifest = read_json(manifest_path, {})
    shards = []
    for prefix in ("movies", "series", "anime", "cartoons"):
        shards.extend(sorted(base.glob(f"{prefix}_*.json")))

    total_rows = 0
    parse_errors = []
    duplicates = 0
    seen_by_prefix: dict[str, set[str]] = {
        "movies": set(),
        "series": set(),
        "anime": set(),
        "cartoons": set(),
    }

    for path in shards:
        rows = read_json(path)
        if not isinstance(rows, list):
            parse_errors.append(path.name)
            continue
        prefix = path.name.split("_", 1)[0]
        seen = seen_by_prefix.setdefault(prefix, set())
        for row in rows:
            if not isinstance(row, list) or not row:
                continue
            total_rows += 1
            iid = text(row[0])
            if iid:
                if iid in seen:
                    duplicates += 1
                else:
                    seen.add(iid)

    return {
        "ok": bool(shards) and not parse_errors and total_rows > 0,
        "manifestTotal": int(manifest.get("total") or 0) if isinstance(manifest, dict) else 0,
        "manifestVersion": text(manifest.get("version")) if isinstance(manifest, dict) else "",
        "sourceTotal": int(manifest.get("sourceTotal") or 0) if isinstance(manifest, dict) else 0,
        "shards": len(shards),
        "rows": total_rows,
        "duplicateIdsInsideKinds": duplicates,
        "parseErrors": parse_errors,
    }


def validate_fast_json() -> dict:
    files = sorted((ROOT / "data" / "fast").glob("*.json"))
    files += sorted((ROOT / "data" / "fast" / "poster_wall_v333").glob("*.json"))

    errors = []
    for path in files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append({
                "file": str(path.relative_to(ROOT)),
                "error": str(exc)[:300],
            })

    return {
        "checked": len(files),
        "errors": len(errors),
        "examples": errors[:20],
    }


def file_status() -> dict:
    result = {}
    for relative in CRITICAL_FILES:
        path = ROOT / relative
        result[relative] = {
            "exists": path.exists(),
            "size": path.stat().st_size if path.exists() else 0,
        }
    return result


def status_check(checks: list[dict]) -> str:
    critical_failed = any(
        check.get("level") == "critical" and not check.get("ok")
        for check in checks
    )
    warning_failed = any(
        check.get("level") == "warning" and not check.get("ok")
        for check in checks
    )
    if critical_failed:
        return "critical"
    if warning_failed:
        return "warning"
    return "healthy"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    files = file_status()
    search = inspect_search_index(ROOT / "data" / "fast" / "search_index.json")
    search_lite = read_json(ROOT / "data" / "fast" / "search_lite.json", [])
    meta = read_json(ROOT / "data" / "fast" / "meta.json", {})
    top = read_json(ROOT / "data" / "fast" / "anime_top_manual.json")
    studios_top = read_json(ROOT / "data" / "fast" / "anime_studios_top.json")
    studios_detail = read_json(ROOT / "data" / "fast" / "anime_studios_detail.json")
    wall = inspect_poster_wall(ROOT / "data" / "fast" / "poster_wall_v333")
    fast_json = validate_fast_json()
    js = {relative: run_node_check(relative) for relative in JS_FILES}

    top_count = count_payload(top, ("items", "anime", "top"))
    studios_count = count_payload(studios_top, ("studios", "items"))
    studio_details_count = count_payload(studios_detail, ("studios", "items"))
    static_pages = len(list((ROOT / "film").glob("*.html"))) if (ROOT / "film").exists() else 0

    checks = []

    for relative, info in files.items():
        checks.append({
            "id": f"file:{relative}",
            "name": f"Файл {relative}",
            "ok": info["exists"] and info["size"] > 0,
            "level": "critical",
            "details": f"{info['size']} байт" if info["exists"] else "Файл отсутствует",
        })

    for relative, info in js.items():
        checks.append({
            "id": f"js:{relative}",
            "name": f"JavaScript {relative}",
            "ok": info["ok"],
            "level": "critical",
            "details": info["message"],
        })

    checks.extend([
        {
            "id": "search:count",
            "name": "Основной каталог",
            "ok": search.get("ok") and int(search.get("count") or 0) >= 1000,
            "level": "critical",
            "details": f"{search.get('count', 0)} записей",
        },
        {
            "id": "search:duplicates",
            "name": "Дубли ID в каталоге",
            "ok": int(search.get("duplicateIds") or 0) == 0,
            "level": "critical",
            "details": str(search.get("duplicateIds", 0)),
        },
        {
            "id": "search:russianTitles",
            "name": "Русские названия",
            "ok": int(search.get("untranslatedTitles") or 0) == 0,
            "level": "critical",
            "details": f"без русского: {search.get('untranslatedTitles', 0)}",
        },
        {
            "id": "search:russianGenres",
            "name": "Русские жанры",
            "ok": int(search.get("latinGenres") or 0) == 0,
            "level": "critical",
            "details": f"с латиницей: {search.get('latinGenres', 0)}",
        },
        {
            "id": "search:emptyIds",
            "name": "Записи без ID",
            "ok": int(search.get("emptyIds") or 0) == 0,
            "level": "critical",
            "details": str(search.get("emptyIds", 0)),
        },
        {
            "id": "search:lite",
            "name": "Облегчённый индекс",
            "ok": isinstance(search_lite, list) and len(search_lite) >= 1000,
            "level": "critical",
            "details": f"{len(search_lite) if isinstance(search_lite, list) else 0} записей",
        },
        {
            "id": "meta:count",
            "name": "Счётчик meta.json",
            "ok": isinstance(meta, dict)
                  and int(meta.get("count") or 0) == int(search.get("count") or 0),
            "level": "warning",
            "details": f"meta={meta.get('count') if isinstance(meta, dict) else 0}, каталог={search.get('count', 0)}",
        },
        {
            "id": "anime:top",
            "name": "Топ аниме",
            "ok": top_count >= 50,
            "level": "critical",
            "details": f"{top_count} записей",
        },
        {
            "id": "anime:studios",
            "name": "Топ студий",
            "ok": studios_count > 0 and studio_details_count > 0,
            "level": "critical",
            "details": f"студий: {studios_count}, деталей: {studio_details_count}",
        },
        {
            "id": "wall:rows",
            "name": "3D-стена",
            "ok": wall["ok"] and wall["rows"] > 0,
            "level": "critical",
            "details": f"{wall['rows']} карточек, {wall['shards']} частей",
        },
        {
            "id": "wall:duplicates",
            "name": "Дубли внутри 3D-стены",
            "ok": wall["duplicateIdsInsideKinds"] == 0,
            "level": "warning",
            "details": str(wall["duplicateIdsInsideKinds"]),
        },
        {
            "id": "json:fast",
            "name": "JSON в data/fast",
            "ok": fast_json["errors"] == 0,
            "level": "critical",
            "details": f"проверено: {fast_json['checked']}, ошибок: {fast_json['errors']}",
        },
        {
            "id": "pages:static",
            "name": "Статические карточки",
            "ok": static_pages > 0,
            "level": "warning",
            "details": f"{static_pages} страниц",
        },
        {
            "id": "workflow:core",
            "name": "Основные workflows",
            "ok": all((ROOT / path).exists() for path in WORKFLOW_FILES),
            "level": "warning",
            "details": ", ".join(
                path for path in WORKFLOW_FILES if not (ROOT / path).exists()
            ) or "Все присутствуют",
        },
    ])

    status = status_check(checks)
    now = datetime.now(timezone.utc).isoformat()

    snapshot = {
        "version": "V3460.1",
        "status": status,
        "generatedAt": now,
        "commit": os.environ.get("GITHUB_SHA", ""),
        "runUrl": (
            f"{os.environ.get('GITHUB_SERVER_URL', '')}/"
            f"{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/"
            f"{os.environ.get('GITHUB_RUN_ID', '')}"
            if os.environ.get("GITHUB_RUN_ID")
            else ""
        ),
        "summary": {
            "catalogRecords": int(search.get("count") or 0),
            "searchLiteRecords": len(search_lite) if isinstance(search_lite, list) else 0,
            "animeTopRecords": top_count,
            "studioRecords": studios_count,
            "posterWallRecords": wall["rows"],
            "staticPages": static_pages,
            "untranslatedTitles": int(search.get("untranslatedTitles") or 0),
            "latinGenres": int(search.get("latinGenres") or 0),
            "duplicateIds": int(search.get("duplicateIds") or 0),
            "criticalFailures": sum(
                1 for check in checks
                if check["level"] == "critical" and not check["ok"]
            ),
            "warnings": sum(
                1 for check in checks
                if check["level"] == "warning" and not check["ok"]
            ),
        },
        "checks": checks,
        "details": {
            "files": files,
            "javascript": js,
            "search": search,
            "posterWall": wall,
            "fastJson": fast_json,
            "types": search.get("types", {}),
        },
    }

    HEALTH_PATH.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(snapshot, ensure_ascii=False, indent=2)
    HEALTH_PATH.write_text(rendered, encoding="utf-8")
    REPORT_PATH.write_text(rendered, encoding="utf-8")

    print(rendered)

    if args.strict and status == "critical":
        raise SystemExit("V3460.1 strict health gate failed")


if __name__ == "__main__":
    main()
