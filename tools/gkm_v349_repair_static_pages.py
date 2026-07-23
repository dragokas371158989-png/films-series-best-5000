#!/usr/bin/env python3
"""Repair mixed static film pages without guessing colliding catalog IDs."""
from __future__ import annotations

import html
import json
import re
import urllib.parse
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FILM_DIR = ROOT / "film"
INDEX_PATH = ROOT / "data" / "index.json"
REPORT_PATH = ROOT / "TEST_REPORT_V349_STATIC_PAGES.json"
CYR = re.compile(r"[А-Яа-яЁё]")


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def norm(value: Any) -> str:
    value = str(value or "").lower().replace("ё", "е")
    value = re.sub(r"[^\wа-я]+", " ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def extract_items(value: Any) -> list[dict]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("items", "movies", "data", "results", "records"):
            if isinstance(value.get(key), list):
                return [item for item in value[key] if isinstance(item, dict)]
    return []


def load_primary() -> list[dict]:
    index = read_json(INDEX_PATH, {})
    chunks = index.get("chunks", []) if isinstance(index, dict) else []
    rows: list[dict] = []
    for entry in chunks:
        raw = entry if isinstance(entry, str) else entry.get("file") or entry.get("path")
        path = ROOT / str(raw or "")
        if path.exists():
            rows.extend(extract_items(read_json(path, [])))
    return rows


def is_series(item: dict) -> bool:
    value = norm(item.get("type") or item.get("category") or item.get("__kind"))
    return value in {"series", "tv", "tv series", "сериал"} or "сериал" in value


def names_of(item: dict) -> list[str]:
    values = []
    for key in (
        "ru", "title_ru", "nameRu", "title", "name", "en", "nameEn",
        "originalTitle", "original_title", "original_name",
    ):
        value = text(item.get(key))
        if value:
            values.append(value)
    for key in ("aliases", "names", "alt_titles", "alternative_titles"):
        children = item.get(key)
        if not isinstance(children, list):
            continue
        for child in children:
            if isinstance(child, dict):
                child = child.get("title") or child.get("name") or child.get("value")
            child = text(child)
            if child:
                values.append(child)
    return values


def title_of(item: dict) -> str:
    for value in names_of(item):
        if CYR.search(value):
            return value
    names = names_of(item)
    return names[0] if names else "Проект без названия"


def original_of(item: dict, title: str) -> str:
    for key in ("en", "nameEn", "originalTitle", "original_title", "original_name"):
        value = text(item.get(key))
        if value and norm(value) != norm(title):
            return value
    return ""


def genres_of(item: dict) -> list[str]:
    value = item.get("genres")
    if isinstance(value, str):
        children = re.split(r"[,;|/]", value)
    elif isinstance(value, list):
        children = value
    else:
        children = []
    output, seen = [], set()
    for child in children:
        if isinstance(child, dict):
            child = child.get("name") or child.get("title")
        child = text(child)
        key = norm(child)
        if child and key and key not in seen:
            seen.add(key)
            output.append(child)
    return output


def numeric(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def query_title(source: str) -> str:
    match = re.search(r"\bkp_query=([^\"&]+)", source, re.I)
    return text(urllib.parse.unquote_plus(match.group(1))) if match else ""


def read_jsonld(source: str) -> tuple[dict, tuple[int, int] | None]:
    match = re.search(
        r'(<script\s+type=["\']application/ld\+json["\']>)(.*?)(</script>)',
        source,
        re.I | re.S,
    )
    if not match:
        return {}, None
    try:
        value = json.loads(html.unescape(match.group(2)))
        return (value if isinstance(value, dict) else {}), (match.start(2), match.end(2))
    except Exception:
        return {}, None


def replace_tag(source: str, pattern: str, value: str) -> str:
    return re.sub(
        pattern,
        lambda match: match.group(1) + html.escape(value) + match.group(2),
        source,
        count=1,
        flags=re.I | re.S,
    )


def replace_meta(source: str, selector: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    if selector == "description":
        pattern = r'(<meta\s+name=["\']description["\']\s+content=)["\'][^"\']*["\']'
    else:
        pattern = (
            r'(<meta\s+property=["\']'
            + re.escape(selector)
            + r'["\']\s+content=)["\'][^"\']*["\']'
        )
    return re.sub(pattern, lambda match: match.group(1) + f'"{escaped}"', source, count=1, flags=re.I)


def page_payload(
    item: dict | None,
    fallback_title: str,
    tv_page: bool,
    tmdb_id: str,
    old_ld: dict,
) -> dict:
    if item:
        title = title_of(item)
        original = original_of(item, title)
        overview = text(item.get("overview") or item.get("description"))
        genres = genres_of(item)
        year = text(item.get("year") or item.get("release_date") or item.get("first_air_date"))
        year_match = re.search(r"(19\d{2}|20\d{2})", year)
        year = year_match.group(1) if year_match else ""
        rating = numeric(
            item.get("rating")
            or item.get("vote_average")
            or item.get("ratingKinopoisk")
        )
        votes = int(numeric(item.get("votes") or item.get("vote_count") or item.get("ratingVoteCount")))
        stable_id = text(item.get("id"))
        poster = text(item.get("poster") or item.get("posterUrl") or item.get("poster_path"))
        type_label = "Сериал" if tv_page else text(item.get("type") or "Фильм")
    else:
        title = fallback_title or f"{'Сериал' if tv_page else 'Фильм'} {tmdb_id}"
        original = ""
        genres = []
        year = text(old_ld.get("datePublished"))
        rating_data = old_ld.get("aggregateRating") if isinstance(old_ld.get("aggregateRating"), dict) else {}
        rating = numeric(rating_data.get("ratingValue"))
        votes = int(numeric(rating_data.get("ratingCount")))
        stable_id = f"static_tmdb_{'tv' if tv_page else 'movie'}_{tmdb_id}"
        poster = text(old_ld.get("image"))
        type_label = "Сериал" if tv_page else "Фильм"
        year_text = f" {year} года" if year else ""
        overview = (
            f"«{title}» — {type_label.lower()}{year_text}. "
            "Подробное описание будет восстановлено после синхронизации источника."
        )

    if not overview:
        year_text = f" {year} года" if year else ""
        overview = f"«{title}» — {type_label.lower()}{year_text}."

    return {
        "id": stable_id,
        "title": title,
        "original": original,
        "overview": overview,
        "genres": genres,
        "year": year,
        "rating": rating,
        "votes": votes,
        "poster": poster,
        "type": "Сериал" if tv_page else type_label,
        "schemaType": "TVSeries" if tv_page else "Movie",
    }


def update_page(path: Path, payload: dict) -> bool:
    source = path.read_text(encoding="utf-8", errors="replace")
    changed = source.replace('<html lang="en">', '<html lang="ru">')

    if re.search(r"\bdata-id=", changed):
        changed = re.sub(
            r'(\bdata-id=)["\'][^"\']*["\']',
            lambda match: match.group(1) + f'"{html.escape(payload["id"], quote=True)}"',
            changed,
            count=1,
        )
    else:
        changed = re.sub(
            r'(<main\b[^>]*class=["\'][^"\']*\bwrap\b[^"\']*["\'])',
            lambda match: match.group(1) + f' data-id="{html.escape(payload["id"], quote=True)}"',
            changed,
            count=1,
            flags=re.I,
        )

    title = payload["title"]
    genres_text = " · ".join(payload["genres"]) or "Жанр уточняется"
    year_text = f" · {payload['year']}" if payload["year"] else ""
    votes_text = f" · голосов: {payload['votes']}" if payload["votes"] else ""
    rating_text = f"{payload['rating']:.1f}".rstrip("0").rstrip(".") if payload["rating"] else "—"
    description = (
        f"{title} — {payload['type'].lower()}"
        + (f" {payload['year']} года" if payload["year"] else "")
        + (f", рейтинг {rating_text}" if payload["rating"] else "")
        + (f". Жанры: {', '.join(payload['genres'])}." if payload["genres"] else ".")
    )

    changed = replace_tag(changed, r"(<title>).*?(</title>)", title)
    changed = replace_tag(changed, r"(<h1[^>]*>).*?(</h1>)", title)
    changed = replace_tag(changed, r'(<p class=["\']meta["\']>).*?(</p>)', payload["type"] + year_text + votes_text)
    changed = replace_tag(changed, r'(<p class=["\']genres["\']>).*?(</p>)', genres_text)
    changed = replace_tag(changed, r'(<p class=["\']overview["\']>).*?(</p>)', payload["overview"])
    changed = replace_tag(changed, r'(<div class=["\']rating["\']>).*?(</div>)', rating_text)
    changed = replace_meta(changed, "description", description)
    changed = replace_meta(changed, "og:title", title)
    changed = replace_meta(changed, "og:description", description)
    changed = re.sub(
        r'(<img\b[^>]*\balt=)["\'][^"\']*["\']',
        lambda match: match.group(1) + f'"{html.escape(title, quote=True)}"',
        changed,
        count=1,
        flags=re.I,
    )

    ld, span = read_jsonld(changed)
    if span:
        ld.update(
            {
                "@context": "https://schema.org",
                "@type": payload["schemaType"],
                "name": title,
                "description": payload["overview"],
                "genre": payload["genres"],
                "datePublished": payload["year"],
            }
        )
        if payload["original"]:
            ld["alternateName"] = payload["original"]
        else:
            ld.pop("alternateName", None)
        if payload["poster"]:
            ld["image"] = payload["poster"]
        if payload["rating"]:
            ld["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": payload["rating"],
                "bestRating": 10,
                "ratingCount": payload["votes"],
            }
        start, end = span
        changed = changed[:start] + json.dumps(ld, ensure_ascii=False, separators=(",", ":")) + changed[end:]

    if changed == source:
        return False
    path.write_text(changed, encoding="utf-8")
    return True


def main() -> None:
    items = load_primary()
    by_tmdb: dict[tuple[bool, str], list[dict]] = defaultdict(list)
    by_name: dict[tuple[bool, str], list[dict]] = defaultdict(list)

    for item in items:
        tv = is_series(item)
        tmdb = text(item.get("tmdbId") or item.get("tmdb_id"))
        if tmdb:
            by_tmdb[(tv, tmdb)].append(item)
        for name in names_of(item):
            key = norm(name)
            if key:
                by_name[(tv, key)].append(item)

    stats = {
        "pages": 0,
        "matchedByTmdb": 0,
        "matchedByTitle": 0,
        "safeFallback": 0,
        "updated": 0,
        "unresolved": 0,
    }
    examples = []

    for path in sorted(FILM_DIR.glob("*.html")):
        match = re.fullmatch(r"(tv_)?(\d+)", path.stem)
        if not match:
            continue
        stats["pages"] += 1
        tv_page = bool(match.group(1))
        tmdb_id = match.group(2)
        source = path.read_text(encoding="utf-8", errors="replace")
        old_ld, _ = read_jsonld(source)
        query = query_title(source)

        candidate = None
        tmdb_candidates = by_tmdb.get((tv_page, tmdb_id), [])
        if len(tmdb_candidates) == 1:
            candidate = tmdb_candidates[0]
            stats["matchedByTmdb"] += 1
        else:
            title_candidates = {
                text(item.get("id")): item
                for item in by_name.get((tv_page, norm(query)), [])
                if text(item.get("id"))
            }
            if len(title_candidates) == 1:
                candidate = next(iter(title_candidates.values()))
                stats["matchedByTitle"] += 1

        if candidate is None:
            if not query:
                stats["unresolved"] += 1
                examples.append(path.name)
                continue
            stats["safeFallback"] += 1

        payload = page_payload(candidate, query, tv_page, tmdb_id, old_ld)
        if update_page(path, payload):
            stats["updated"] += 1

    report = {
        "version": "V349",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "success" if stats["unresolved"] == 0 else "warning",
        "stats": stats,
        "unresolvedExamples": examples[:100],
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if stats["unresolved"]:
        raise SystemExit(f"Unresolved static pages: {stats['unresolved']}")


if __name__ == "__main__":
    main()
