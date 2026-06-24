#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GKM V144 — автоматическое обновление каталога ТОЛЬКО через Kinopoisk.dev.

Зачем:
- не используем TMDB как основной источник;
- фильмы, сериалы, мультфильмы, аниме и мультсериалы берём из Кинопоиска;
- сохраняем русские названия, русские описания, постеры, страны, жанры, возраст, статус, эпизоды;
- аккуратно сливаем новые записи с текущими data/chunk_*.json;
- не удаляем ручные файлы data/fast/anime_top_manual.json, anime_studios_top.json и т.д.

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

DATA_DIR = Path("data")
REPORT_JSON = DATA_DIR / "auto_update_kinopoisk_v144_report.json"
API_BASE = "https://api.kinopoisk.dev/v1.4"
API_KEY = (os.environ.get("KINOPOISK_API_KEY") or "").strip()
PAGES_PER_TYPE = int(os.environ.get("GKM_KP_PAGES_PER_TYPE", "4"))
LIMIT = int(os.environ.get("GKM_KP_LIMIT", "250"))
SLEEP = float(os.environ.get("GKM_KP_SLEEP", "0.35"))
CHUNK_SIZE = int(os.environ.get("GKM_AUTO_UPDATE_CHUNK_SIZE", "500"))

# Kinopoisk.dev movie types. Если API поменяет тип, скрипт не упадёт, просто пропустит его.
KP_TYPES = [
    ("movie", "Фильм"),
    ("tv-series", "Сериал"),
    ("cartoon", "Мультфильм"),
    ("animated-series", "Мультсериал"),
    ("anime", "Аниме"),
]

SELECT_FIELDS = [
    "id", "name", "alternativeName", "enName", "type", "year", "description", "shortDescription",
    "poster", "backdrop", "rating", "votes", "genres", "countries", "ageRating", "status",
    "seasonsInfo", "seriesLength", "movieLength", "productionCompanies", "networks", "premiere",
]


def log(msg: str) -> None:
    print(f"[GKM KP V144] {msg}", flush=True)


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
    for v in values:
        if isinstance(v, dict):
            name = clean(v.get("name") or v.get("title") or v.get("alternativeName"))
        else:
            name = clean(v)
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
    text = json.dumps(data, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (",", ":"))
    path.write_text(text, encoding="utf-8")


def chunk_files() -> List[Path]:
    files = sorted(DATA_DIR.glob("chunk_*.json"))
    if not files:
        files = sorted((DATA_DIR / "chunks").glob("chunk_*.json"))
    return files


def load_existing() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for p in chunk_files():
        data = load_json(p, [])
        if isinstance(data, list):
            items.extend([x for x in data if isinstance(x, dict)])
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
    for k in ("kp", "imdb", "filmCritics", "russianFilmCritics"):
        try:
            v = float(rating.get(k) or 0)
            if v > 0:
                return round(v, 1)
        except Exception:
            pass
    return 0.0


def pick_votes(doc: Dict[str, Any]) -> int:
    votes = doc.get("votes") if isinstance(doc.get("votes"), dict) else {}
    for k in ("kp", "imdb", "filmCritics", "russianFilmCritics"):
        try:
            v = int(votes.get(k) or 0)
            if v > 0:
                return v
        except Exception:
            pass
    return 0


def episode_count(doc: Dict[str, Any]) -> Any:
    total = 0
    for s in doc.get("seasonsInfo") or []:
        if isinstance(s, dict):
            try:
                total += int(s.get("episodesCount") or s.get("episodeCount") or s.get("episodes") or 0)
            except Exception:
                pass
    return total or doc.get("episodes") or doc.get("episodeCount") or doc.get("numberOfEpisodes") or ""


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
    backdrop = doc.get("backdrop") if isinstance(doc.get("backdrop"), dict) else {}
    premiere = doc.get("premiere") if isinstance(doc.get("premiere"), dict) else {}
    studio = as_list_names((doc.get("productionCompanies") or []) + (doc.get("networks") or []), 5)
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
        "backdrop": clean(backdrop.get("url") or backdrop.get("previewUrl")),
        "country": country,
        "studio": studio,
        "status": clean(doc.get("status")),
        "ageRating": (str(doc.get("ageRating")) + "+") if doc.get("ageRating") else "",
        "episodes": episode_count(doc),
        "premiere": clean(premiere.get("world") or premiere.get("russia")),
        "source": "kinopoisk_auto_v144",
        "updated_at": now_iso(),
    }
    return {k: v for k, v in item.items() if v not in (None, "", [], {})}


def request_json(url: str) -> Optional[Dict[str, Any]]:
    req = Request(url, headers={
        "accept": "application/json",
        "X-API-KEY": API_KEY,
        "User-Agent": "GKM-Kinopoisk-AutoCatalog/144",
    })
    try:
        with urlopen(req, timeout=35) as r:
            if r.status < 200 or r.status >= 300:
                log(f"HTTP {r.status}: {url}")
                return None
            return json.loads(r.read().decode("utf-8", "replace"))
    except HTTPError as e:
        log(f"HTTPError {e.code}: {url}")
    except URLError as e:
        log(f"URLError: {url} :: {e}")
    except Exception as e:
        log(f"request failed: {url} :: {e}")
    return None


def kinopoisk_url(kp_type: str, page: int, limit: int) -> str:
    params: List[tuple[str, Any]] = []
    for f in SELECT_FIELDS:
        params.append(("selectFields", f))
    params += [
        ("page", page),
        ("limit", limit),
        ("type", kp_type),
        ("sortField", "votes.kp"),
        ("sortType", "-1"),
        ("notNullFields", "name"),
        ("notNullFields", "poster.url"),
        ("notNullFields", "rating.kp"),
    ]
    return f"{API_BASE}/movie?" + urlencode(params)


def fetch_kinopoisk() -> List[Dict[str, Any]]:
    if not API_KEY:
        log("KINOPOISK_API_KEY is empty — skip update, keep current database")
        return []
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
                k = item_key(item)
                if k not in seen:
                    out.append(item)
                    seen.add(k)
            time.sleep(SLEEP)
    log(f"fetched from kinopoisk: {len(out)}")
    return out


def merge_item(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(old)
    # Кинопоиск — главный источник русских данных. Но не затираем ручные правки, если они явно есть.
    for k, v in new.items():
        if v in (None, "", [], {}):
            continue
        if k in ("rating", "votes"):
            try:
                if float(v or 0) >= float(out.get(k) or 0):
                    out[k] = v
            except Exception:
                out[k] = v
        elif k in ("ru", "overview", "poster", "backdrop", "country", "studio", "status", "ageRating", "episodes", "genres"):
            if not out.get(k) or out.get("source") in ("tmdb_auto_v143", "jikan_auto_v143", "tmdb", "jikan"):
                out[k] = v
        else:
            if not out.get(k):
                out[k] = v
    out["updated_at"] = now_iso()
    if not out.get("source") or str(out.get("source")).startswith(("tmdb", "jikan")):
        out["source"] = "kinopoisk_auto_v144"
    return out


def save_chunks(items: List[Dict[str, Any]]) -> None:
    # Удаляем только корневые chunk_*.json, не трогаем data/fast и ручные json.
    for p in DATA_DIR.glob("chunk_*.json"):
        p.unlink()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for i in range(0, len(items), CHUNK_SIZE):
        save_json(DATA_DIR / f"chunk_{i // CHUNK_SIZE + 1:04d}.json", items[i:i + CHUNK_SIZE])
    index = {
        "version": "v144-kinopoisk-only-auto-catalog",
        "total": len(items),
        "chunkSize": CHUNK_SIZE,
        "chunks": [f"data/chunk_{i:04d}.json" for i in range(1, (len(items) + CHUNK_SIZE - 1) // CHUNK_SIZE + 1)],
        "updatedAt": now_iso(),
        "source": "kinopoisk.dev",
    }
    save_json(DATA_DIR / "index.json", index, pretty=True)


def main() -> int:
    existing = load_existing()
    by_key: Dict[str, Dict[str, Any]] = {item_key(x): x for x in existing if isinstance(x, dict)}
    before = len(by_key)
    fetched = fetch_kinopoisk()
    added = 0
    updated = 0
    for item in fetched:
        k = item_key(item)
        if k in by_key:
            merged = merge_item(by_key[k], item)
            if merged != by_key[k]:
                updated += 1
            by_key[k] = merged
        else:
            by_key[k] = item
            added += 1
    items = list(by_key.values())
    # Стабильный порядок: популярные/рейтинговые выше, но всё сохраняем.
    items.sort(key=lambda x: (int(x.get("votes") or 0), float(x.get("rating") or 0), int(str(x.get("year") or 0)[:4] or 0)), reverse=True)
    save_chunks(items)
    report = {
        "version": "v144-kinopoisk-only-auto-catalog-2026-06-24",
        "before": before,
        "fetched": len(fetched),
        "added": added,
        "updated": updated,
        "after": len(items),
        "types": [x[0] for x in KP_TYPES],
        "pagesPerType": PAGES_PER_TYPE,
        "limit": LIMIT,
        "updatedAt": now_iso(),
    }
    save_json(REPORT_JSON, report, pretty=True)
    log("report: " + json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
