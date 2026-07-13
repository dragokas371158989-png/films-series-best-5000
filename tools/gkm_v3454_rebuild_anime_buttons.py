#!/usr/bin/env python3
"""
GKM V3454 — rebuild data files used by:
- "Топ аниме 100"
- "Топ студий"

The script reads the current fully Russian catalog and creates:
- data/fast/anime_top_manual.json
- data/fast/anime_studios_top.json
- data/fast/anime_studios_detail.json

It also mirrors them to film/data/fast when that directory exists.
No network access is required.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FAST = ROOT / "data" / "fast"
FILM_FAST = ROOT / "film" / "data" / "fast"
REPORT = ROOT / "TEST_REPORT_V3454_ANIME_BUTTONS.json"

TOP_LIMIT = 100
STUDIO_LIMIT = 250

SPACE_RE = re.compile(r"\s+")
SEPARATOR_RE = re.compile(r"\s*(?:/|,|;|\||&)\s*")
CYR = re.compile(r"[А-Яа-яЁё]")


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, value: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def text(value: Any) -> str:
    return str(value or "").strip()


def norm(value: Any) -> str:
    value = text(value).lower().replace("ё", "е")
    value = re.sub(r"[^\wа-яё]+", " ", value, flags=re.I)
    return SPACE_RE.sub(" ", value).strip()


def number(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def integer(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def title_of(item: dict) -> str:
    return text(
        item.get("ru")
        or item.get("title_ru")
        or item.get("nameRu")
        or item.get("title")
        or item.get("name")
        or item.get("en")
        or "Без названия"
    )


def type_of(item: dict) -> str:
    return text(item.get("type") or item.get("category") or item.get("__kind"))


def is_anime(item: dict) -> bool:
    value = norm(
        " ".join(
            text(item.get(key))
            for key in (
                "type", "category", "__kind", "source",
                "ru", "en", "title", "name"
            )
        )
    )
    return (
        type_of(item) == "Аниме"
        or "аниме" in value
        or "anime" in value
        or "myanimelist" in value
        or "jikan" in value
    )


def has_poster(item: dict) -> bool:
    return bool(
        text(
            item.get("poster")
            or item.get("poster_path")
            or item.get("image")
            or item.get("cover")
        )
    )


def public_item(item: dict) -> dict:
    """Keep fields required by the existing cards/details code."""
    allowed = (
        "id", "ru", "en", "title", "name", "originalTitle",
        "year", "type", "category", "rating", "votes", "poster",
        "genres", "overview", "description", "episodes", "studio",
        "studios", "country", "ageRating", "status", "source",
        "aliases", "mergedDuplicateIds",
    )
    result = {key: item.get(key) for key in allowed if key in item}
    result["ru"] = title_of(item)
    result["type"] = "Аниме"
    result["rating"] = number(item.get("rating"))
    result["votes"] = integer(item.get("votes"))
    return result


def load_search_index() -> list[dict]:
    path = FAST / "search_index.json"
    rows = read_json(path)
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"Missing or empty catalog: {path}")
    return [row for row in rows if isinstance(row, dict)]


def load_primary_by_id() -> dict[str, dict]:
    result: dict[str, dict] = {}
    for path in sorted((ROOT / "data").glob("chunk_*.json")):
        rows = read_json(path, [])
        if not isinstance(rows, list):
            continue
        for item in rows:
            if not isinstance(item, dict):
                continue
            iid = text(item.get("id"))
            if iid:
                result[iid] = item
            for alias in item.get("mergedDuplicateIds") or []:
                alias = text(alias)
                if alias:
                    result.setdefault(alias, item)
    return result


# Fallback inference is used only when source data has no studio field.
INFER_RULES = (
    (re.compile(r"атака титанов|магическая битва|человек.?бензопила|сага о винланде|дороро", re.I), "MAPPA"),
    (re.compile(r"тетрадь смерти|ванпанч|охотник.?х.?охотник|фрирен|паразит|триган", re.I), "Madhouse"),
    (re.compile(r"мастера меча онлайн|госпожа кагуя|восемьдесят шесть|семь смертных грехов", re.I), "A-1 Pictures"),
    (re.compile(r"наруто|боруто|блич|токийский гуль|чёрный клевер|черный клевер", re.I), "Pierrot"),
    (re.compile(r"стальной алхимик|моя геройская академия|моб психо", re.I), "Bones"),
    (re.compile(r"истребитель демонов|судьба", re.I), "ufotable"),
    (re.compile(r"ван.?пис|драконий жемчуг|сейлор мун", re.I), "Toei Animation"),
    (re.compile(r"код гиас|ковбой бибоп|гинтама", re.I), "Sunrise"),
    (re.compile(r"врата штейна|re.?zero|акаме", re.I), "White Fox"),
    (re.compile(r"форма голоса|вайолет|кланнад|дракон.?горничная", re.I), "Kyoto Animation"),
    (re.compile(r"евангелион", re.I), "Gainax / Khara"),
    (re.compile(r"унесённые призраками|унесенные призраками|мой сосед тоторо|принцесса мононоке", re.I), "Studio Ghibli"),
)


def raw_studio_values(item: dict, primary: dict | None) -> list[str]:
    values: list[str] = []

    def add(value: Any):
        if value in (None, "", [], {}):
            return
        if isinstance(value, str):
            values.append(value)
            return
        if isinstance(value, dict):
            candidate = value.get("name") or value.get("title") or value.get("studio")
            if candidate:
                values.append(text(candidate))
            return
        if isinstance(value, list):
            for child in value:
                add(child)

    for source in (item, primary or {}):
        for key in (
            "studio", "studios", "animationStudio",
            "animation_studio", "productionStudio",
            "production_studio"
        ):
            add(source.get(key))

    return values


def clean_studio_names(item: dict, primary: dict | None) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()

    for raw in raw_studio_values(item, primary):
        for part in SEPARATOR_RE.split(raw):
            part = SPACE_RE.sub(" ", text(part)).strip(" -–—")
            key = norm(part)
            if (
                not part
                or key in {
                    "студия", "не указана", "неизвестно", "unknown",
                    "n a", "none", "студия не указана в источнике"
                }
            ):
                continue
            if key not in seen:
                seen.add(key)
                output.append(part)

    if output:
        return output

    title = title_of(item)
    for pattern, studio in INFER_RULES:
        if pattern.search(title):
            return [studio]
    return []


def franchise_key(item: dict) -> str:
    """
    Conservative top dedupe:
    same Russian/original title and same year is one record.
    Seasons and films with distinct titles remain separate.
    """
    title = norm(
        item.get("en")
        or item.get("originalTitle")
        or item.get("ru")
        or item.get("title")
    )
    year = text(item.get("year"))
    return f"{title}|{year}"


def build_top(anime: list[dict]) -> dict:
    ranked = sorted(
        anime,
        key=lambda item: (
            has_poster(item),
            integer(item.get("votes")),
            number(item.get("rating")),
            integer(item.get("year")),
        ),
        reverse=True,
    )

    result = []
    seen_ids = set()
    seen_titles = set()

    for item in ranked:
        iid = text(item.get("id"))
        key = franchise_key(item)
        if iid and iid in seen_ids:
            continue
        if key and key in seen_titles:
            continue
        if iid:
            seen_ids.add(iid)
        if key:
            seen_titles.add(key)

        # Keep real audience signals; allow lower-vote records only when
        # the catalog contains fewer than 100 stronger entries.
        if integer(item.get("votes")) < 500 and len(result) >= TOP_LIMIT:
            continue

        result.append(public_item(item))
        if len(result) >= TOP_LIMIT:
            break

    return {
        "version": "v3454-anime-buttons",
        "generatedFrom": "data/fast/search_index.json",
        "sort": "votes_desc_rating_desc",
        "count": len(result),
        "items": result,
    }


def build_studios(
    anime: list[dict],
    primary_by_id: dict[str, dict],
) -> tuple[dict, dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)

    for item in anime:
        iid = text(item.get("id"))
        primary = primary_by_id.get(iid)
        studios = clean_studio_names(item, primary)
        for studio in studios:
            grouped[studio].append(public_item(item))

    detail: dict[str, list[dict]] = {}
    summaries: list[dict] = []

    for studio, rows in grouped.items():
        unique = {}
        for item in rows:
            key = text(item.get("id")) or franchise_key(item)
            previous = unique.get(key)
            if previous is None or integer(item.get("votes")) > integer(previous.get("votes")):
                unique[key] = item

        ordered = sorted(
            unique.values(),
            key=lambda item: (
                integer(item.get("votes")),
                number(item.get("rating")),
                integer(item.get("year")),
            ),
            reverse=True,
        )

        if not ordered:
            continue

        detail[studio] = ordered
        summaries.append(
            {
                "studio": studio,
                "count": len(ordered),
                "avgRating": round(
                    sum(number(item.get("rating")) for item in ordered) / len(ordered),
                    2,
                ),
                "votes": sum(integer(item.get("votes")) for item in ordered),
                "topTitles": [title_of(item) for item in ordered[:6]],
            }
        )

    summaries.sort(
        key=lambda row: (
            integer(row.get("votes")),
            integer(row.get("count")),
            number(row.get("avgRating")),
        ),
        reverse=True,
    )
    summaries = summaries[:STUDIO_LIMIT]

    # Keep detail only for studios visible in the top.
    visible = {row["studio"] for row in summaries}
    detail = {studio: rows for studio, rows in detail.items() if studio in visible}

    top_payload = {
        "version": "v3454-anime-buttons",
        "generatedFrom": "current Russian catalog",
        "count": len(summaries),
        "studios": summaries,
    }
    detail_payload = {
        "version": "v3454-anime-buttons",
        "generatedFrom": "current Russian catalog",
        "count": len(detail),
        "studios": detail,
    }
    return top_payload, detail_payload


def write_all(name: str, value: Any):
    write_json(FAST / name, value)
    if FILM_FAST.exists():
        write_json(FILM_FAST / name, value)


def main():
    rows = load_search_index()
    primary_by_id = load_primary_by_id()
    anime = [row for row in rows if is_anime(row)]

    if not anime:
        raise SystemExit("No anime records found in search_index.json")

    top_payload = build_top(anime)
    studios_top, studios_detail = build_studios(anime, primary_by_id)

    if len(top_payload["items"]) < 50:
        raise SystemExit(
            f"Anime top is unexpectedly small: {len(top_payload['items'])}"
        )
    if not studios_top["studios"]:
        raise SystemExit(
            "No studios were produced. Check studio/studios fields in catalog."
        )
    if not studios_detail["studios"]:
        raise SystemExit("Studio detail is empty")

    write_all("anime_top_manual.json", top_payload)
    write_all("anime_studios_top.json", studios_top)
    write_all("anime_studios_detail.json", studios_detail)

    report = {
        "version": "V3454",
        "catalogRecords": len(rows),
        "animeRecords": len(anime),
        "animeTopRecords": len(top_payload["items"]),
        "studioCount": len(studios_top["studios"]),
        "studioAnimeRecords": sum(
            len(rows) for rows in studios_detail["studios"].values()
        ),
        "files": [
            "data/fast/anime_top_manual.json",
            "data/fast/anime_studios_top.json",
            "data/fast/anime_studios_detail.json",
        ],
        "tests": {
            "animeTopAtLeast50": len(top_payload["items"]) >= 50,
            "studiosNotEmpty": bool(studios_top["studios"]),
            "studioDetailsNotEmpty": bool(studios_detail["studios"]),
            "russianTopTitles": all(
                CYR.search(title_of(item))
                for item in top_payload["items"]
                if title_of(item)
            ),
        },
    }
    write_json(REPORT, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
