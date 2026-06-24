#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V145 — автоматическое обновление каталога ТОЛЬКО через Kinopoisk.dev.

Что исправлено:
- убраны опасные notNullFields, из-за которых Kinopoisk давал HTTP 400;
- убраны тяжёлые/спорные selectFields;
- если Kinopoisk отдаёт 400/401/403/500 — Action падает красным и показывает BODY ошибки;
- фильмы, сериалы, мультфильмы, аниме и мультсериалы берём из Кинопоиска;
- аккуратно сливаем новые записи с текущими data/chunk_*.json;
- не трогаем ручные файлы data/fast/anime_top_manual.json, anime_studios_top.json и т.д.

Нужен GitHub Secret:
- KINOPOISK_API_KEY

Опциональные env:
- GKM_KP_PAGES_PER_TYPE=4
- GKM_KP_LIMIT=250
- GKM_KP_SLEEP=0.35
- GKM_AUTO_UPDATE_CHUNK_SIZE=500
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


VERSION = "v145-kinopoisk-request-fix-2026-06-24"

DATA_DIR = Path("data")
REPORT_JSON = DATA_DIR / "auto_update_kinopoisk_v145_report.json"

API_BASE = "https://api.kinopoisk.dev/v1.4"
API_KEY = (os.environ.get("KINOPOISK_API_KEY") or "").strip()

PAGES_PER_TYPE = int(os.environ.get("GKM_KP_PAGES_PER_TYPE", "4"))
LIMIT = int(os.environ.get("GKM_KP_LIMIT", "250"))
SLEEP = float(os.environ.get("GKM_KP_SLEEP", "0.35"))
CHUNK_SIZE = int(os.environ.get("GKM_AUTO_UPDATE_CHUNK_SIZE", "500"))

KP_TYPES = [
    ("movie", "Фильм"),
    ("tv-series", "Сериал"),
    ("cartoon", "Мультфильм"),
    ("animated-series", "Мультсериал"),
    ("anime", "Аниме"),
]

# ВАЖНО:
# Тут только безопасные поля. Не добавляем notNullFields.
# Не добавляем networks / productionCompanies / seasonsInfo в первом запросе,
# потому что Kinopoisk может отдавать HTTP 400 на слишком тяжёлых/спорных запросах.
SELECT_FIELDS = [
    "id",
    "name",
    "alternativeName",
    "enName",
    "type",
    "year",
    "description",
    "shortDescription",
    "poster",
    "rating",
    "votes",
    "genres",
    "countries",
    "ageRating",
    "status",
]


def log(msg: str) -> None:
    print(f"[GKM KP V145] {msg}", flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def norm(value: Any) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"\s*\(\d{4}\)\s*", " ", text)
    text = re.sub(r"[^0-9a-zа-я一-龯ぁ-ゔァ-ヴー]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def as_list_names(values: Any, max_items: int = 8) -> List[str]:
    out: List[str] = []

    if not isinstance(values, list):
        return out

    for value in values:
        if isinstance(value, dict):
            name = clean(value.get("name") or value.get("title") or value.get("alternativeName"))
        else:
            name = clean(value)

        if name and name not in out:
            out.append(name)

        if len(out) >= max_items:
            break

    return out


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    if pretty:
        text = json.dumps(data, ensure_ascii=False, indent=2)
    else:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    path.write_text(text, encoding="utf-8")


def chunk_files() -> List[Path]:
    files = sorted(DATA_DIR.glob("chunk_*.json"))

    if not files:
        files = sorted((DATA_DIR / "chunks").glob("chunk_*.json"))

    return files


def load_existing() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for path in chunk_files():
        data = load_json(path, [])

        if isinstance(data, list):
            items.extend([item for item in data if isinstance(item, dict)])

    log(f"loaded existing: {len(items)}")
    return items


def item_key(item: Dict[str, Any]) -> str:
    kid = clean(item.get("kinopoiskId") or item.get("kpId"))

    if kid:
        return f"kp::{kid}"

    sid = clean(item.get("id"))

    if sid.startswith("kp_"):
        return sid

    title = item.get("ru") or item.get("name") or item.get("title") or item.get("en")
    typ = item.get("type") or item.get("category")
    year = item.get("year") or ""

    return f"{norm(typ)}::{norm(title)}::{year}"


def pick_rating(doc: Dict[str, Any]) -> float:
    rating = doc.get("rating") if isinstance(doc.get("rating"), dict) else {}

    for key in ("kp", "imdb", "filmCritics", "russianFilmCritics"):
        try:
            value = float(rating.get(key) or 0)

            if value > 0:
                return round(value, 1)
        except Exception:
            pass

    return 0.0


def pick_votes(doc: Dict[str, Any]) -> int:
    votes = doc.get("votes") if isinstance(doc.get("votes"), dict) else {}

    for key in ("kp", "imdb", "filmCritics", "russianFilmCritics"):
        try:
            value = int(votes.get(key) or 0)

            if value > 0:
                return value
        except Exception:
            pass

    return 0


def episode_count(doc: Dict[str, Any]) -> Any:
    total = 0

    for season in doc.get("seasonsInfo") or []:
        if isinstance(season, dict):
            try:
                total += int(
                    season.get("episodesCount")
                    or season.get("episodeCount")
                    or season.get("episodes")
                    or 0
                )
            except Exception:
                pass

    return (
        total
        or doc.get("episodes")
        or doc.get("episodeCount")
        or doc.get("numberOfEpisodes")
        or ""
    )


def map_doc(doc: Dict[str, Any], fallback_type: str) -> Optional[Dict[str, Any]]:
    kid = doc.get("id") or doc.get("kinopoiskId")

    if not kid:
        return None

    kp_type = clean(doc.get("type"))
    type_ru = dict(KP_TYPES).get(kp_type, fallback_type)

    name_ru = clean(doc.get("name"))
    name_alt = clean(doc.get("alternativeName") or doc.get("enName"))
    year = doc.get("year") or ""

    poster = doc.get("poster") if isinstance(doc.get("poster"), dict) else {}

    country = as_list_names(doc.get("countries"), 5)
    genres = as_list_names(doc.get("genres"), 12)

    item = {
        "id": f"kp_{kid}",
        "kinopoiskId": kid,
        "ru": name_ru or name_alt,
        "en": name_alt or name_ru,
        "year": year,
        "type": type_ru,
        "category": type_ru,
        "rating": pick_rating(doc),
        "votes": pick_votes(doc),
        "genres": genres,
        "overview": clean(doc.get("description") or doc.get("shortDescription")),
        "shortDescription": clean(doc.get("shortDescription")),
        "poster": clean(poster.get("url") or poster.get("previewUrl")),
        "country": country,
        "status": clean(doc.get("status")),
        "ageRating": (str(doc.get("ageRating")) + "+") if doc.get("ageRating") else "",
        "episodes": episode_count(doc),
        "source": "kinopoisk_auto_v145",
        "updated_at": now_iso(),
    }

    return {key: value for key, value in item.items() if value not in (None, "", [], {})}


def request_json(url: str) -> Optional[Dict[str, Any]]:
    req = Request(
        url,
        headers={
            "accept": "application/json",
            "X-API-KEY": API_KEY,
            "User-Agent": "GKM-Kinopoisk-AutoCatalog/145",
        },
    )

    try:
        with urlopen(req, timeout=35) as response:
            if response.status < 200 or response.status >= 300:
                body = response.read().decode("utf-8", errors="ignore")
                log(f"HTTP {response.status}: {url}")
                log(f"BODY: {body[:2000]}")
                raise SystemExit(1)

            return json.loads(response.read().decode("utf-8", "replace"))

    except HTTPError as error:
        body = ""

        try:
            body = error.read().decode("utf-8", errors="ignore")
        except Exception:
            pass

        log(f"HTTPError {error.code}: {url}")
        log(f"BODY: {body[:2000]}")
        raise SystemExit(1)

    except URLError as error:
        log(f"URLError: {url} :: {error}")
        raise SystemExit(1)

    except Exception as error:
        log(f"request failed: {url} :: {error}")
        raise SystemExit(1)


def kinopoisk_url(kp_type: str, page: int, limit: int) -> str:
    params: List[tuple[str, Any]] = []

    for field in SELECT_FIELDS:
        params.append(("selectFields", field))

    params += [
        ("page", page),
        ("limit", limit),
        ("type", kp_type),
        ("sortField", "votes.kp"),
        ("sortType", "-1"),
    ]

    return f"{API_BASE}/movie?" + urlencode(params)


def fetch_kinopoisk() -> List[Dict[str, Any]]:
    if not API_KEY:
        log("ERROR: KINOPOISK_API_KEY is empty")
        raise SystemExit(1)

    out: List[Dict[str, Any]] = []
    seen = set()

    for kp_type, fallback_type in KP_TYPES:
        for page in range(1, PAGES_PER_TYPE + 1):
            url = kinopoisk_url(kp_type, page, LIMIT)
            data = request_json(url)

            docs = data.get("docs") if isinstance(data, dict) else []

            if not isinstance(docs, list):
                docs = []

            log(f"{kp_type} page {page}: {len(docs)} docs")

            if not docs:
                break

            for doc in docs:
                item = map_doc(doc, fallback_type)

                if not item:
                    continue

                key = item_key(item)

                if key not in seen:
                    out.append(item)
                    seen.add(key)

            time.sleep(SLEEP)

    log(f"fetched from kinopoisk: {len(out)}")

    if not out:
        log("ERROR: fetched 0 docs from Kinopoisk")
        raise SystemExit(1)

    return out


def merge_item(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(old)

    for key, value in new.items():
        if value in (None, "", [], {}):
            continue

        if key in ("rating", "votes"):
            try:
                if float(value or 0) >= float(out.get(key) or 0):
                    out[key] = value
            except Exception:
                out[key] = value

        elif key in (
            "ru",
            "overview",
            "poster",
            "country",
            "status",
            "ageRating",
            "episodes",
            "genres",
        ):
            if not out.get(key) or out.get("source") in (
                "tmdb_auto_v143",
                "jikan_auto_v143",
                "tmdb",
                "jikan",
            ):
                out[key] = value

        else:
            if not out.get(key):
                out[key] = value

    out["updated_at"] = now_iso()

    if not out.get("source") or str(out.get("source")).startswith(("tmdb", "jikan")):
        out["source"] = "kinopoisk_auto_v145"

    return out


def save_chunks(items: List[Dict[str, Any]]) -> None:
    for path in DATA_DIR.glob("chunk_*.json"):
        path.unlink()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for index in range(0, len(items), CHUNK_SIZE):
        chunk_number = index // CHUNK_SIZE + 1
        chunk_path = DATA_DIR / f"chunk_{chunk_number:04d}.json"
        save_json(chunk_path, items[index:index + CHUNK_SIZE])

    total_chunks = (len(items) + CHUNK_SIZE - 1) // CHUNK_SIZE

    index_data = {
        "version": VERSION,
        "total": len(items),
        "chunkSize": CHUNK_SIZE,
        "chunks": [f"data/chunk_{i:04d}.json" for i in range(1, total_chunks + 1)],
        "updatedAt": now_iso(),
        "source": "kinopoisk.dev",
    }

    save_json(DATA_DIR / "index.json", index_data, pretty=True)


def main() -> int:
    existing = load_existing()
    by_key: Dict[str, Dict[str, Any]] = {
        item_key(item): item for item in existing if isinstance(item, dict)
    }

    before = len(by_key)
    fetched = fetch_kinopoisk()

    added = 0
    updated = 0

    for item in fetched:
        key = item_key(item)

        if key in by_key:
            merged = merge_item(by_key[key], item)

            if merged != by_key[key]:
                updated += 1

            by_key[key] = merged
        else:
            by_key[key] = item
            added += 1

    items = list(by_key.values())

    items.sort(
        key=lambda item: (
            int(item.get("votes") or 0),
            float(item.get("rating") or 0),
            int(str(item.get("year") or 0)[:4] or 0),
        ),
        reverse=True,
    )

    save_chunks(items)

    report = {
        "version": VERSION,
        "before": before,
        "fetched": len(fetched),
        "added": added,
        "updated": updated,
        "after": len(items),
        "types": [item[0] for item in KP_TYPES],
        "pagesPerType": PAGES_PER_TYPE,
        "limit": LIMIT,
        "updatedAt": now_iso(),
    }

    save_json(REPORT_JSON, report, pretty=True)
    log("report: " + json.dumps(report, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
