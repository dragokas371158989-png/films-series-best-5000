#!/usr/bin/env python3
"""GKM V364: bake confirmed repairs, build fast title shards and full health data."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "app.js"
DATA_DIR = ROOT / "data"
FAST_DIR = DATA_DIR / "fast"
SEARCH_PATH = FAST_DIR / "search_index.json"
LITE_PATH = FAST_DIR / "search_lite.json"
REPAIRS_PATH = DATA_DIR / "catalog_repairs_v364.json"
MANUAL_PATH = DATA_DIR / "manual_catalog_v364.json"
SHARDS_DIR = FAST_DIR / "search_shards"
HEALTH_PATH = FAST_DIR / "catalog_health_v364.json"
REPORT_PATH = ROOT / "TEST_REPORT_V364_INTEGRITY_SPEED.json"

GENERIC_TITLE_RE = re.compile(
    r"^(?:фильм|сериал|аниме|мультфильм|проект)\s+\d{4}\s+года\s+№",
    re.I,
)
PLACEHOLDER_RE = re.compile(
    r"(?:dummyimage|placeholder|no[-_ ]?poster|placehold\.co|/null(?:[/?#]|$))",
    re.I,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def norm(value: Any) -> str:
    value = str(value or "").lower().replace("ё", "е")
    value = re.sub(r"[^\wа-я]+", " ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, value: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        value,
        ensure_ascii=False,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    )
    path.write_text(text, encoding="utf-8")


def extract_repairs() -> dict[str, list[Any]]:
    source = APP_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"const\s+GKM_V361_CONFIRMED_MEDIA_REPAIRS\s*=\s*Object\.freeze\(\{(.*?)\}\);",
        source,
        re.S,
    )
    if not match:
        raise RuntimeError("GKM_V361_CONFIRMED_MEDIA_REPAIRS not found in app.js")
    value = json.loads("{" + match.group(1) + "}")
    if len(value) < 51:
        raise RuntimeError(f"Expected at least 51 confirmed repairs, got {len(value)}")
    return value


def media_family(item: dict) -> str:
    raw = norm(item.get("type") or item.get("category"))
    if raw in {"фильм", "movie", "film"}:
        return "movie"
    return "tv"


def stable_source_key(item: dict) -> str:
    source = norm(item.get("source") or item.get("provider") or "catalog") or "catalog"
    item_id = clean(
        item.get("id")
        or item.get("tmdbId")
        or item.get("tmdb_id")
        or item.get("kinopoiskId")
        or item.get("mal_id")
    )
    return f"{source}:{media_family(item)}:{item_id}" if item_id else ""


def rebuild_search_text(item: dict) -> str:
    aliases = item.get("aliases") if isinstance(item.get("aliases"), list) else []
    genres = item.get("genres") if isinstance(item.get("genres"), list) else []
    return clean(
        " ".join(
            str(value or "")
            for value in (
                item.get("ru"),
                item.get("en"),
                " ".join(map(str, aliases[:12])),
                item.get("year"),
                item.get("type"),
                " ".join(map(str, genres[:8])),
                item.get("source"),
            )
        )
    )[:320]


def repair_item(item: dict, repairs: dict[str, list[Any]]) -> bool:
    if norm(item.get("source")) != "tmdb":
        return False
    rule = repairs.get(clean(item.get("id")))
    if not rule:
        return False

    title, item_type, genres = rule
    title = clean(title)
    item_type = clean(item_type)
    genres = [clean(value) for value in genres if clean(value)]
    year_match = re.search(
        r"(19\d{2}|20\d{2})",
        clean(item.get("year") or item.get("release_date") or item.get("first_air_date")),
    )
    year = year_match.group(1) if year_match else ""
    rating = float(item.get("rating") or item.get("vote_average") or 0)
    original = clean(item.get("en") or item.get("original_title") or item.get("original_name"))

    before = json.dumps(item, ensure_ascii=False, sort_keys=True)
    item["ru"] = title
    item["title_ru"] = title
    for key in ("title", "name"):
        if key in item:
            item[key] = title
    item["type"] = item_type
    if "category" in item:
        item["category"] = item_type
    item["genres"] = genres
    item["aliases"] = list(dict.fromkeys(value for value in (title, original) if value))
    genre_tail = [value for value in genres if norm(value) != norm(item_type)][:4]
    item["overview"] = (
        f"«{title}» — {item_type.lower()}"
        + (f" {year} года" if year else "")
        + (f" в жанрах {', '.join(genre_tail)}" if genre_tail else "")
        + "."
        + (f" Рейтинг: {rating:.1f}." if rating > 0 else "")
    )
    for key in ("overview_ru", "description", "description_ru"):
        if key in item:
            item[key] = item["overview"]
    for key in ("country", "countries", "status"):
        if key in item:
            item[key] = ""
    item["sourceMediaKey"] = stable_source_key(item)
    item["search"] = rebuild_search_text(item)
    item.pop("__hay", None)
    item.pop("__gkmV361IntegrityFixed", None)
    return before != json.dumps(item, ensure_ascii=False, sort_keys=True)


def walk_and_repair(value: Any, repairs: dict[str, list[Any]]) -> int:
    changed = 0
    if isinstance(value, list):
        for child in value:
            changed += walk_and_repair(child, repairs)
        return changed
    if not isinstance(value, dict):
        return 0
    changed += int(repair_item(value, repairs))
    for child in value.values():
        if isinstance(child, (dict, list)):
            changed += walk_and_repair(child, repairs)
    return changed


def recovered_matrix_item() -> dict:
    return {
        "id": "tmdb_movie_604",
        "tmdbId": 604,
        "sourceMediaKey": "tmdb:movie:604",
        "ru": "Матрица: Перезагрузка",
        "en": "The Matrix Reloaded",
        "aliases": ["Матрица: Перезагрузка", "The Matrix Reloaded", "Matrix Reloaded"],
        "year": "2003",
        "type": "Фильм",
        "rating": 0,
        "votes": 0,
        "poster": "https://image.tmdb.org/t/p/w342/d0xVNNxIYxId2qHkqpgE39soOvD.jpg",
        "genres": ["Приключения", "Боевик", "Триллер", "Фантастика"],
        "overview": (
            "Борцы за свободу Нео, Тринити и Морфеус продолжают восстание людей "
            "против армии машин и защищают Зион — последний город человечества."
        ),
        "episodes": "",
        "studio": "",
        "country": "",
        "status": "",
        "ageRating": "",
        "source": "tmdb_movie",
        "recScore": 0,
        "overviewGenerated": False,
        "mergedDuplicateIds": [],
        "search": (
            "Матрица Перезагрузка The Matrix Reloaded Matrix Reloaded 2003 "
            "Фильм Приключения Боевик Триллер Фантастика tmdb movie"
        ),
    }


def add_manual_recovery(rows: list[dict]) -> bool:
    recovered = recovered_matrix_item()
    key = recovered["sourceMediaKey"]
    for item in rows:
        if clean(item.get("sourceMediaKey")) == key or clean(item.get("id")) == recovered["id"]:
            return False
    rows.append(recovered)
    return True


def repair_fast_json(repairs: dict[str, list[Any]]) -> dict[str, int]:
    stats = {"filesChanged": 0, "itemsRepaired": 0, "manualRecovered": 0}
    candidates = [
        path
        for path in FAST_DIR.rglob("*.json")
        if SHARDS_DIR not in path.parents
        and path != HEALTH_PATH
        and "poster_atlas_" not in path.as_posix()
    ]
    for path in sorted(candidates):
        value = load_json(path)
        if value is None:
            continue
        changed = walk_and_repair(value, repairs)
        if path in (SEARCH_PATH, LITE_PATH) and isinstance(value, list):
            changed += int(add_manual_recovery(value))
            stats["manualRecovered"] += int(any(
                clean(item.get("id")) == "tmdb_movie_604" for item in value if isinstance(item, dict)
            ))
        if changed:
            save_json(path, value)
            stats["filesChanged"] += 1
            stats["itemsRepaired"] += changed
    return stats


def compact_shard_item(item: dict) -> dict:
    keys = (
        "id", "ru", "en", "aliases", "year", "type", "rating", "votes",
        "poster", "genres", "overview", "episodes", "studio", "country",
        "status", "ageRating", "source", "search", "recScore",
        "overviewGenerated", "mergedDuplicateIds", "sourceMediaKey", "tmdbId",
    )
    return {
        key: item[key]
        for key in keys
        if key in item and item[key] not in (None, "", [], {})
    }


def prefix_key(value: Any) -> str:
    value = norm(value).replace(" ", "")
    if len(value) < 1:
        return ""
    key = value[:1]
    return key if re.fullmatch(r"[0-9a-zа-я]", key, re.I) else ""


def build_search_shards(rows: list[dict]) -> dict[str, Any]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    compact_cache: dict[str, dict] = {}
    for item in rows:
        if not isinstance(item, dict):
            continue
        names = [item.get("ru"), item.get("en")]
        aliases = item.get("aliases")
        if isinstance(aliases, list):
            names.extend(aliases[:6])
        keys = {prefix_key(value) for value in names}
        keys.discard("")
        if not keys:
            continue
        identity = (
            clean(item.get("sourceMediaKey"))
            or f"{norm(item.get('type'))}|{norm(item.get('source'))}|{clean(item.get('id'))}"
        )
        compact = compact_cache.setdefault(identity, compact_shard_item(item))
        for key in keys:
            buckets[key].append(compact)

    tmp = FAST_DIR / ".search_shards_v364_tmp"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    files: dict[str, dict[str, int]] = {}
    total_rows = 0
    for key in sorted(buckets):
        path = tmp / f"{key}.json"
        save_json(path, buckets[key])
        size = path.stat().st_size
        files[key] = {"items": len(buckets[key]), "bytes": size}
        total_rows += len(buckets[key])

    source_sha = hashlib.sha256(SEARCH_PATH.read_bytes()).hexdigest()
    manifest = {
        "version": "364",
        "generatedAt": now_iso(),
        "source": "data/fast/search_index.json",
        "sourceSha256": source_sha,
        "prefixLength": 1,
        "catalogItems": len(rows),
        "shardRows": total_rows,
        "shards": len(files),
        "files": files,
    }
    save_json(tmp / "manifest.json", manifest)
    if SHARDS_DIR.exists():
        shutil.rmtree(SHARDS_DIR)
    tmp.rename(SHARDS_DIR)
    return manifest


def build_health(rows: list[dict], repairs: dict[str, list[Any]]) -> dict[str, Any]:
    types = Counter()
    sources = Counter()
    missing_posters = 0
    generic_titles = 0
    short_descriptions = 0
    unsafe_posters = 0
    duplicates = 0
    seen = set()
    samples = []
    by_source_id: dict[tuple[str, str], set[str]] = defaultdict(set)

    for item in rows:
        if not isinstance(item, dict):
            continue
        title = clean(item.get("ru") or item.get("en"))
        item_type = clean(item.get("type") or "Без типа")
        source = clean(item.get("source") or "Без источника")
        poster = clean(item.get("poster"))
        overview = clean(item.get("overview"))
        item_id = clean(item.get("id"))
        types[item_type] += 1
        sources[source] += 1

        if not poster or PLACEHOLDER_RE.search(poster):
            missing_posters += 1
            if len(samples) < 80:
                samples.append({"code": "missing_poster", "id": item_id, "title": title, "type": item_type})
        if GENERIC_TITLE_RE.search(title):
            generic_titles += 1
            if len(samples) < 80:
                samples.append({"code": "generic_title", "id": item_id, "title": title, "type": item_type})
        if len(overview) < 80:
            short_descriptions += 1
        if re.match(r"^(?:javascript|file):", poster, re.I):
            unsafe_posters += 1

        stable = (
            clean(item.get("sourceMediaKey"))
            or f"{norm(item_type)}|{norm(source)}|{item_id}"
        )
        if stable in seen:
            duplicates += 1
        seen.add(stable)
        if source and item_id:
            by_source_id[(norm(source), item_id)].add(media_family(item))

    collisions = [
        {"source": source, "id": item_id, "families": sorted(families)}
        for (source, item_id), families in by_source_id.items()
        if len(families) > 1
    ]
    report = {
        "version": "364",
        "generatedAt": now_iso(),
        "status": "warning" if collisions or unsafe_posters else "success",
        "catalogItems": len(rows),
        "confirmedRepairRules": len(repairs),
        "confirmedRepairsPresent": sum(
            1
            for item in rows
            if isinstance(item, dict)
            and norm(item.get("source")) == "tmdb"
            and clean(item.get("id")) in repairs
        ),
        "manualRecoveries": sum(
            1 for item in rows if isinstance(item, dict) and clean(item.get("id")) == "tmdb_movie_604"
        ),
        "missingPosters": missing_posters,
        "genericTitles": generic_titles,
        "shortDescriptions": short_descriptions,
        "unsafePosters": unsafe_posters,
        "duplicateSourceMediaKeys": duplicates,
        "crossMediaIdCollisions": len(collisions),
        "types": dict(types.most_common()),
        "topSources": dict(sources.most_common(20)),
        "collisionSamples": collisions[:50],
        "issueSamples": samples[:80],
    }
    save_json(HEALTH_PATH, report, pretty=True)
    return report


def update_static_pages(rows: list[dict], repairs: dict[str, list[Any]]) -> dict[str, int]:
    from gkm_v349_repair_static_pages import page_payload, read_jsonld, update_page

    by_id = {
        clean(item.get("id")): item
        for item in rows
        if isinstance(item, dict) and clean(item.get("id"))
    }
    stats = {"updated": 0, "missing": 0, "matrixRecovered": 0}
    matrix_source = ROOT / "film" / "604.html"
    matrix_target = ROOT / "film" / "tmdb_movie_604.html"
    if matrix_source.exists() and not matrix_target.exists():
        matrix_target.write_text(
            matrix_source.read_text(encoding="utf-8", errors="replace"),
            encoding="utf-8",
        )
    if matrix_target.exists():
        source = matrix_target.read_text(encoding="utf-8", errors="replace")
        old_ld, _ = read_jsonld(source)
        payload = page_payload(recovered_matrix_item(), "Матрица: Перезагрузка", False, "604", old_ld)
        if update_page(matrix_target, payload):
            stats["updated"] += 1
        text = matrix_target.read_text(encoding="utf-8")
        text = text.replace("/film/604.html", "/film/tmdb_movie_604.html")
        text = text.replace('data-id="604"', 'data-id="tmdb_movie_604"')
        matrix_target.write_text(text, encoding="utf-8")
        stats["matrixRecovered"] = 1

    for item_id in repairs:
        path = ROOT / "film" / f"{item_id}.html"
        item = by_id.get(item_id)
        if not path.exists() or not item:
            stats["missing"] += 1
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        old_ld, _ = read_jsonld(source)
        payload = page_payload(
            item,
            clean(item.get("ru")),
            norm(item.get("type")) == "сериал",
            re.sub(r"\D", "", item_id),
            old_ld,
        )
        if update_page(path, payload):
            stats["updated"] += 1
    return stats


def write_catalog_sources(repairs: dict[str, list[Any]]) -> None:
    save_json(
        REPAIRS_PATH,
        {
            "version": "364",
            "generatedAt": now_iso(),
            "description": "Confirmed TMDB cross-media repairs baked into catalog builds.",
            "repairs": repairs,
        },
        pretty=True,
    )
    save_json(
        MANUAL_PATH,
        {
            "version": "364",
            "items": [recovered_matrix_item()],
        },
        pretty=True,
    )


def verify(repairs: dict[str, list[Any]]) -> dict[str, Any]:
    rows = load_json(SEARCH_PATH, [])
    shards_manifest = load_json(SHARDS_DIR / "manifest.json", {})
    health = load_json(HEALTH_PATH, {})
    failures = []
    if not isinstance(rows, list) or len(rows) < 100_000:
        failures.append("search_index has fewer than 100000 records")
    if len(repairs) < 51:
        failures.append("confirmed repairs missing")
    if int(shards_manifest.get("shards") or 0) < 40:
        failures.append("search shards were not generated")
    for query in ("п", "н", "m", "t"):
        if not (SHARDS_DIR / f"{query}.json").exists():
            failures.append(f"required shard missing: {query}.json")
    if int(health.get("catalogItems") or 0) != len(rows):
        failures.append("health report count does not match search index")
    if int(health.get("crossMediaIdCollisions") or 0) != 0:
        failures.append("cross-media ID collisions remain")
    if not any(clean(item.get("id")) == "tmdb_movie_604" for item in rows if isinstance(item, dict)):
        failures.append("The Matrix Reloaded recovery is missing")
    teen = next(
        (
            item for item in rows
            if isinstance(item, dict)
            and norm(item.get("source")) == "tmdb"
            and clean(item.get("id")) == "604"
        ),
        None,
    )
    if not teen or clean(teen.get("ru")) != "Юные Титаны":
        failures.append("TMDB TV 604 was not repaired to Юные Титаны")
    return {
        "ok": not failures,
        "failures": failures,
        "catalogItems": len(rows) if isinstance(rows, list) else 0,
        "repairs": len(repairs),
        "shards": int(shards_manifest.get("shards") or 0),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify existing V364 output only")
    parser.add_argument("--skip-wall", action="store_true", help="do not rebuild poster wall JSON")
    args = parser.parse_args()

    repairs = extract_repairs()
    if args.check:
        result = verify(repairs)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1

    write_catalog_sources(repairs)
    fast_stats = repair_fast_json(repairs)
    rows = load_json(SEARCH_PATH, [])
    if not isinstance(rows, list):
        raise RuntimeError("search_index.json is not a list")
    shards = build_search_shards(rows)
    health = build_health(rows, repairs)
    static_stats = update_static_pages(rows, repairs)

    if not args.skip_wall:
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "gkm_v344_build_poster_wall.py")],
            cwd=ROOT,
            check=True,
        )

    verification = verify(repairs)
    report = {
        "version": "V364",
        "generatedAt": now_iso(),
        "status": "success" if verification["ok"] else "failed",
        "fastData": fast_stats,
        "searchShards": {
            "shards": shards["shards"],
            "shardRows": shards["shardRows"],
            "catalogItems": shards["catalogItems"],
        },
        "health": {
            "catalogItems": health["catalogItems"],
            "missingPosters": health["missingPosters"],
            "genericTitles": health["genericTitles"],
            "crossMediaIdCollisions": health["crossMediaIdCollisions"],
        },
        "staticPages": static_stats,
        "verification": verification,
    }
    save_json(REPORT_PATH, report, pretty=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if verification["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
