#!/usr/bin/env python3
"""GKM V366: verify Russian media titles and repair high-confidence collapses.

The catalog contains the same media from several providers.  A provider feed may
label a specific sequel or special with the short franchise name (for example
"Наруто").  This control reuses already verified Russian names from the local
Shikimori/Kinopoisk/TMDB caches and from better catalog copies.  It never calls
an external API, never machine-translates a title and only applies a repair when
the identity match is strong enough.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
FAST_DIR = DATA_DIR / "fast"
SEARCH_PATH = FAST_DIR / "search_index.json"
LITE_PATH = FAST_DIR / "search_lite.json"
HEALTH_PATH = FAST_DIR / "title_health_v366.json"
REPORT_PATH = ROOT / "TEST_REPORT_V366_RUSSIAN_TITLES.json"
TITLE_MAP_PATH = DATA_DIR / "ru_titles_map.json"

OFFICIAL_CACHE_PATHS = (
    DATA_DIR / "ru_complete_cache_v3453_1.json",
    DATA_DIR / "ru_complete_cache_v3453.json",
    DATA_DIR / "ru_official_cache_v3452_1.json",
    DATA_DIR / "ru_official_cache_v3452.json",
    DATA_DIR / "ru_official_cache_v3451.json",
)

SKIP_FAST_PARTS = {
    "search_shards",
    "poster_atlas_v358",
    "poster_atlas_v364",
}

CYR_RE = re.compile(r"[А-Яа-яЁё]")
LATIN_RE = re.compile(r"[A-Za-z]")
YEAR_RE = re.compile(r"(18\d{2}|19\d{2}|20\d{2})")
SYNTHETIC_TITLE_RE = re.compile(
    r"^(?:(?:фильм|сериал|аниме|мультфильм|проект)\s+\d{4}\s+года\s+№\S+"
    r"|(?:фильм|сериал|аниме|мультфильм|проект)\s+№\S+"
    r"|проект\s+(?:без названия|\S+)|без названия|untitled|null|undefined)$",
    re.I,
)
SAFE_ID_RE = re.compile(r"^(?:mal|kp)_\d+$", re.I)

NOISE_TOKENS = {
    "a", "an", "and", "anime", "film", "gekijouban", "movie", "movies",
    "no", "of", "ova", "special", "the", "to", "tv",
}
MOVIE_MARKER_RE = re.compile(
    r"(?:\bmovie\b|\bfilm\b|\bgekijouban\b|劇場版|the\s+movie)",
    re.I,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def norm(value: Any) -> str:
    text = clean(value).lower().replace("ё", "е")
    text = re.sub(r"[^\wа-я]+", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def load_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, value: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        ),
        encoding="utf-8",
    )


def has_cyr(value: Any) -> bool:
    return bool(CYR_RE.search(clean(value)))


def has_latin(value: Any) -> bool:
    return bool(LATIN_RE.search(clean(value)))


def title_of(item: dict) -> str:
    return clean(
        item.get("ru")
        or item.get("title_ru")
        or item.get("nameRu")
        or item.get("title")
        or item.get("name")
        or item.get("en")
        or item.get("original_title")
        or item.get("original_name")
    )


def year_of(item: dict) -> str:
    raw = clean(item.get("year") or item.get("release_date") or item.get("first_air_date"))
    match = YEAR_RE.search(raw)
    return match.group(1) if match else ""


def media_family(item: dict) -> str:
    raw = norm(item.get("type") or item.get("category"))
    if raw in {"фильм", "movie", "film"}:
        return "movie"
    if raw in {"игра", "game", "книга", "манга", "book", "manga"}:
        return "other"
    return "tv"


def stable_key(item: dict) -> str:
    source = norm(item.get("source") or item.get("provider") or "catalog") or "catalog"
    item_id = clean(
        item.get("id")
        or item.get("tmdbId")
        or item.get("tmdb_id")
        or item.get("kinopoiskId")
        or item.get("mal_id")
    )
    return f"{source}|{media_family(item)}|{item_id}" if item_id else ""


def poster_identity(item: dict) -> str:
    value = clean(
        item.get("poster")
        or item.get("poster_url")
        or item.get("image")
        or item.get("cover")
        or item.get("poster_path")
    ).lower()
    if not value:
        return ""
    value = re.sub(r"[?#].*$", "", value)
    value = re.sub(r"/(?:w92|w154|w185|w342|w500|original)/", "/", value)
    return value


def item_aliases(item: dict, include_current: bool = False) -> list[str]:
    values: list[Any] = [
        item.get("en"),
        item.get("original_title"),
        item.get("original_name"),
        item.get("originalTitle"),
        item.get("nameOriginal"),
    ]
    aliases = item.get("aliases")
    if isinstance(aliases, list):
        values.extend(aliases)
    if include_current:
        values.extend(
            (
                item.get("ru"),
                item.get("title_ru"),
                item.get("nameRu"),
                item.get("title"),
                item.get("name"),
            )
        )
    out: list[str] = []
    seen: set[str] = set()
    current = norm(title_of(item))
    for raw in values:
        value = clean(raw)
        key = norm(value)
        if not key or key in seen:
            continue
        if not include_current and key == current and has_cyr(value):
            continue
        seen.add(key)
        out.append(value)
    return out


def source_priority(source: Any) -> int:
    value = norm(source)
    if any(token in value for token in ("shikimori", "myanimelist", "jikan")):
        return 950
    if "kinopoisk" in value or value.startswith("kp"):
        return 920
    if "tmdb" in value:
        return 820
    if any(token in value for token in ("top rated", "top_rated", "discover")):
        return 520
    return 650


def title_quality(title: str, source: Any = "") -> int:
    value = clean(title)
    if not has_cyr(value) or SYNTHETIC_TITLE_RE.fullmatch(value):
        return -10_000
    words = norm(value).split()
    punctuation = 80 if re.search(r"[:—–-]", value) else 0
    return source_priority(source) + min(len(value), 140) * 3 + min(len(words), 18) * 18 + punctuation


@dataclass(frozen=True)
class Candidate:
    ru: str
    source: str
    year: str
    family: str
    aliases: tuple[str, ...]
    stable: str = ""
    official: bool = False

    @property
    def base_score(self) -> int:
        return title_quality(self.ru, self.source) + (500 if self.official else 0)


def load_title_map() -> dict[str, str]:
    raw = load_json(TITLE_MAP_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {
        norm(key): clean(value)
        for key, value in raw.items()
        if norm(key) and has_cyr(value)
    }


def load_official_candidates() -> list[Candidate]:
    merged: dict[str, dict] = {}
    for path in OFFICIAL_CACHE_PATHS:
        raw = load_json(path, {})
        items = raw.get("items") if isinstance(raw, dict) else None
        if not isinstance(items, dict):
            continue
        for item_id, payload in items.items():
            if not isinstance(payload, dict):
                continue
            ru = clean(payload.get("ru"))
            original = clean(payload.get("original"))
            # Old numeric TMDB caches predate media-family keys.  A movie and a
            # series can share the same numeric ID there, so those rows are not
            # safe title evidence.  MAL/Kinopoisk IDs are namespaced.
            if (
                not SAFE_ID_RE.fullmatch(clean(item_id))
                or not has_cyr(ru)
                or not original
            ):
                continue
            key = f"{item_id}|{norm(original)}"
            current = merged.get(key)
            if current is None or title_quality(ru, payload.get("source")) > title_quality(
                current.get("ru"), current.get("source")
            ):
                merged[key] = {
                    "id": clean(item_id),
                    "ru": ru,
                    "original": original,
                    "source": clean(payload.get("source") or path.stem),
                }
    return [
        Candidate(
            ru=row["ru"],
            source=row["source"],
            year="",
            family="tv",
            aliases=(row["original"],),
            stable=row["id"] if SAFE_ID_RE.fullmatch(row["id"]) else "",
            official=True,
        )
        for row in merged.values()
    ]


def meaningful_tokens(value: str) -> set[str]:
    return {
        token
        for token in norm(value).split()
        if len(token) > 1 and token not in NOISE_TOKENS
    }


def similarity(left: str, right: str) -> float:
    a = meaningful_tokens(left)
    b = meaningful_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


class TitleResolver:
    def __init__(self, rows: list[dict]):
        self.title_map = load_title_map()
        self.base_ru_titles = {norm(value) for value in self.title_map.values()}
        self.exact: dict[str, list[Candidate]] = defaultdict(list)
        self.poster: dict[str, list[Candidate]] = defaultdict(list)
        self.safe_official: dict[str, list[Candidate]] = defaultdict(list)
        self.franchise_year: dict[tuple[str, str], list[Candidate]] = defaultdict(list)
        self.franchise_aliases = sorted(
            (
                key for key in self.title_map
                if 1 <= len(key.split()) <= 5 and len(key) >= 4
            ),
            key=len,
            reverse=True,
        )

        for original, ru in self.title_map.items():
            candidate = Candidate(
                ru=ru,
                source="ru_titles_map V366",
                year="",
                family="tv",
                aliases=(original,),
                official=True,
            )
            self.exact[original].append(candidate)

        for candidate in load_official_candidates():
            self._index_candidate(candidate)
            if candidate.stable:
                self.safe_official[candidate.stable].append(candidate)

        for item in rows:
            if not isinstance(item, dict):
                continue
            ru = title_of(item)
            if title_quality(ru, item.get("source")) < 0:
                continue
            aliases = tuple(item_aliases(item))
            if not aliases:
                continue
            candidate = Candidate(
                ru=ru,
                source=clean(item.get("source") or "catalog"),
                year=year_of(item),
                family=media_family(item),
                aliases=aliases,
                stable=stable_key(item),
            )
            self._index_candidate(candidate)
            poster = poster_identity(item)
            if poster:
                self.poster[poster].append(candidate)

    def _roots(self, value: str) -> set[str]:
        key = norm(value)
        if not key:
            return set()
        padded = f" {key} "
        return {
            alias
            for alias in self.franchise_aliases
            if f" {alias} " in padded
        }

    def _index_candidate(self, candidate: Candidate) -> None:
        roots: set[str] = set()
        for alias in candidate.aliases:
            key = norm(alias)
            if not key:
                continue
            self.exact[key].append(candidate)
            roots.update(self._roots(alias))
        if candidate.year:
            for root in roots:
                self.franchise_year[(root, candidate.year)].append(candidate)

    def collapsed_franchise_title(self, item: dict) -> bool:
        current = norm(title_of(item))
        if not current or current not in self.base_ru_titles:
            return False
        # Shikimori/MyAnimeList and Kinopoisk rows are the trusted evidence used
        # to repair weaker provider copies.  Do not reinterpret their concise
        # official base-series names as collapsed franchise labels.
        if source_priority(item.get("source")) >= 900:
            return False
        for original in item_aliases(item):
            original_key = norm(original)
            if not original_key:
                continue
            mapped = self.title_map.get(original_key)
            if mapped and norm(mapped) == current:
                return False
            for root in self._roots(original):
                if norm(self.title_map.get(root)) != current:
                    continue
                # The base title itself is valid; extra words describe another
                # season, film or special and must not be collapsed.
                if original_key != root and (
                    len(meaningful_tokens(original)) > len(meaningful_tokens(root))
                    or len(original_key) >= len(root) + 7
                ):
                    return True
        return False

    def needs_repair(self, item: dict) -> bool:
        title = title_of(item)
        return (
            not title
            or not has_cyr(title)
            or bool(SYNTHETIC_TITLE_RE.fullmatch(title))
            or self.collapsed_franchise_title(item)
        )

    @staticmethod
    def _dedupe(candidates: Iterable[tuple[Candidate, int, str]]) -> list[tuple[Candidate, int, str]]:
        best: dict[str, tuple[Candidate, int, str]] = {}
        for candidate, score, reason in candidates:
            key = norm(candidate.ru)
            previous = best.get(key)
            if previous is None or score > previous[1]:
                best[key] = (candidate, score, reason)
        return sorted(best.values(), key=lambda row: row[1], reverse=True)

    def resolve(self, item: dict) -> tuple[str, str, int] | None:
        current = title_of(item)
        current_key = norm(current)
        if not self.needs_repair(item):
            return None

        aliases = item_aliases(item)
        year = year_of(item)
        family = media_family(item)
        candidates: list[tuple[Candidate, int, str]] = []

        raw_id = clean(item.get("id"))
        if SAFE_ID_RE.fullmatch(raw_id):
            for candidate in self.safe_official.get(raw_id, []):
                candidates.append((candidate, candidate.base_score + 12_000, "official-id"))

        for original in aliases:
            original_key = norm(original)
            for candidate in self.exact.get(original_key, []):
                if year and candidate.year and candidate.year != year:
                    continue
                if candidate.family != family and candidate.family != "other" and family != "other":
                    continue
                distinctive = len(meaningful_tokens(original)) >= 2 or len(original_key) >= 9
                if not distinctive and not candidate.official:
                    continue
                score = candidate.base_score + 8_000
                if year and candidate.year == year:
                    score += 700
                if candidate.family == family:
                    score += 300
                candidates.append((candidate, score, "exact-original"))

            # Some provider originals prepend a Japanese anniversary or promo
            # label to an otherwise exact English/Romaji title.  A contained
            # trusted alias with the same year is still a high-confidence link.
            original_padded = f" {original_key} "
            for root in self._roots(original):
                for candidate in self.franchise_year.get((root, year), []):
                    if source_priority(candidate.source) < 900:
                        continue
                    for candidate_alias in candidate.aliases:
                        candidate_key = norm(candidate_alias)
                        if (
                            len(candidate_key) >= 8
                            and len(meaningful_tokens(candidate_alias)) >= 2
                            and f" {candidate_key} " in original_padded
                        ):
                            score = candidate.base_score + 7_200
                            if candidate.family == family:
                                score += 300
                            candidates.append((candidate, score, "contained-original"))
                            break

        poster = poster_identity(item)
        if poster:
            for candidate in self.poster.get(poster, []):
                if year and candidate.year and candidate.year != year:
                    continue
                if candidate.family != family and candidate.family != "other" and family != "other":
                    continue
                score = candidate.base_score + 9_000
                if year and candidate.year == year:
                    score += 700
                if candidate.family == family:
                    score += 300
                candidates.append((candidate, score, "same-poster"))

        # Fuzzy matching is limited to the same franchise and year.  It is
        # only used for already suspicious titles and needs a clear winner.
        for original in aliases:
            for root in self._roots(original):
                for candidate in self.franchise_year.get((root, year), []):
                    best_similarity = max(
                        (similarity(original, alias) for alias in candidate.aliases),
                        default=0.0,
                    )
                    if best_similarity < 0.55:
                        continue
                    score = candidate.base_score + int(best_similarity * 4_000)
                    if candidate.family == family:
                        score += 250
                    candidates.append((candidate, score, "franchise-year"))

        # Theatrical anime copies from TMDB often keep only a Japanese title
        # plus the short franchise label.  When exactly one trusted film from
        # that franchise exists in the same year, use its verified Russian
        # name.  This covers the numbered Naruto/One Piece films without
        # guessing from the poster text.
        if self.collapsed_franchise_title(item) and any(
            MOVIE_MARKER_RE.search(original) for original in aliases
        ):
            movie_candidates: list[Candidate] = []
            for original in aliases:
                for root in self._roots(original):
                    for candidate in self.franchise_year.get((root, year), []):
                        if source_priority(candidate.source) < 900:
                            continue
                        if candidate.family != family and candidate.family != "other" and family != "other":
                            continue
                        if not any(MOVIE_MARKER_RE.search(alias) for alias in candidate.aliases):
                            continue
                        movie_candidates.append(candidate)
            movie_ranked = self._dedupe(
                (candidate, candidate.base_score + 5_000, "franchise-movie-year")
                for candidate in movie_candidates
            )
            if movie_ranked:
                winner_score = movie_ranked[0][1]
                if len(movie_ranked) == 1 or winner_score - movie_ranked[1][1] >= 160:
                    candidates.append(movie_ranked[0])

        ranked = [
            row for row in self._dedupe(candidates)
            if norm(row[0].ru) != current_key and has_cyr(row[0].ru)
        ]
        if not ranked:
            return None

        winner, score, reason = ranked[0]
        if reason == "franchise-year":
            if score < 3_500:
                return None
            if len(ranked) > 1 and score - ranked[1][1] < 420:
                return None

        if (
            reason in {"franchise-year", "franchise-movie-year"}
            and current_key in self.base_ru_titles
            and len(norm(winner.ru)) <= len(current_key)
        ):
            return None
        return winner.ru, reason, score


def rebuild_search(item: dict) -> str:
    aliases = item.get("aliases") if isinstance(item.get("aliases"), list) else []
    genres = item.get("genres") if isinstance(item.get("genres"), list) else []
    return clean(
        " ".join(
            str(value or "")
            for value in (
                item.get("ru"),
                item.get("en"),
                " ".join(map(str, aliases[:14])),
                item.get("year"),
                item.get("type"),
                " ".join(map(str, genres[:8])),
                item.get("source"),
            )
        )
    )[:480]


def apply_title(item: dict, title: str, reason: str) -> bool:
    old = title_of(item)
    title = clean(title)
    if not title or norm(title) == norm(old):
        return False

    before = json.dumps(item, ensure_ascii=False, sort_keys=True)
    item["ru"] = title
    item["title_ru"] = title
    for key in ("title", "name", "nameRu"):
        if key in item:
            item[key] = title

    aliases = item.get("aliases") if isinstance(item.get("aliases"), list) else []
    values = [title, old, *aliases]
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = clean(value)
        key = norm(value)
        if value and key and key not in seen:
            seen.add(key)
            unique.append(value)
    item["aliases"] = unique

    for key in ("overview", "overview_ru", "description", "description_ru"):
        value = clean(item.get(key))
        if value and old:
            item[key] = value.replace(f"«{old}»", f"«{title}»", 1)

    item["titleLocalizationSource"] = f"V366 {reason}"
    item["search"] = rebuild_search(item)
    item.pop("__hay", None)
    item.pop("__gkmV362CatalogChecked", None)
    item.pop("__gkmV362CatalogIssues", None)
    return before != json.dumps(item, ensure_ascii=False, sort_keys=True)


def repair_value(
    value: Any,
    resolver: TitleResolver,
    forced: dict[str, tuple[str, str]],
    stats: Counter,
    context: str,
) -> None:
    if isinstance(value, list):
        for child in value:
            repair_value(child, resolver, forced, stats, context)
        return
    if not isinstance(value, dict):
        return

    if any(key in value for key in ("ru", "en", "title", "name")) and (
        value.get("id") is not None or value.get("source") or value.get("type")
    ):
        stats["recordsScanned"] += 1
        key = stable_key(value)
        decision = forced.get(key) if key else None
        if decision is None:
            resolved = resolver.resolve(value)
            if resolved:
                decision = (resolved[0], resolved[1])
        if decision and apply_title(value, decision[0], decision[1]):
            stats["recordsRepaired"] += 1
            stats[f"reason:{decision[1]}"] += 1
            stats[f"context:{context}"] += 1

    for child in value.values():
        if isinstance(child, (dict, list)):
            repair_value(child, resolver, forced, stats, context)


def candidate_fast_paths() -> list[Path]:
    paths: list[Path] = []
    for path in FAST_DIR.rglob("*.json"):
        if path in {SEARCH_PATH, HEALTH_PATH}:
            continue
        if any(part in SKIP_FAST_PARTS for part in path.parts):
            continue
        paths.append(path)
    return sorted(paths)


def build_health(
    rows: list[dict],
    resolver: TitleResolver,
    stats: Counter,
    source_sha: str,
) -> dict[str, Any]:
    previous = load_json(HEALTH_PATH, {})
    previous_catalog_total = int(
        previous.get("catalogTitlesRepaired")
        or previous.get("catalogTitlesRepairedTotal")
        or 0
    ) if isinstance(previous, dict) else 0
    previous_record_total = int(
        previous.get("recordsRepaired")
        or previous.get("recordsRepairedTotal")
        or 0
    ) if isinstance(previous, dict) else 0
    russian = 0
    synthetic = 0
    collapsed = 0
    unresolved = 0
    latin_only = 0
    source_counts: Counter[str] = Counter()
    samples: list[dict[str, str]] = []

    for item in rows:
        if not isinstance(item, dict):
            continue
        title = title_of(item)
        if has_cyr(title):
            russian += 1
        elif has_latin(title):
            latin_only += 1
        if SYNTHETIC_TITLE_RE.fullmatch(title):
            synthetic += 1
        if resolver.collapsed_franchise_title(item):
            collapsed += 1
        if resolver.needs_repair(item):
            unresolved += 1
            if len(samples) < 100:
                samples.append(
                    {
                        "id": clean(item.get("id")),
                        "title": title,
                        "original": clean(item.get("en") or item.get("original_title")),
                        "year": year_of(item),
                        "type": clean(item.get("type")),
                        "source": clean(item.get("source")),
                    }
                )
        source_counts[clean(item.get("titleLocalizationSource") or "existing")] += 1

    health = {
        "version": "366",
        "generatedAt": now_iso(),
        "status": "success" if collapsed == 0 and synthetic == 0 else "warning",
        "catalogItems": len(rows),
        "russianTitles": russian,
        "latinOnlyTitles": latin_only,
        "syntheticTitles": synthetic,
        "collapsedFranchiseTitles": collapsed,
        "unresolvedRussianTitles": unresolved,
        "catalogTitlesRepairedThisRun": stats["catalogTitlesRepaired"],
        "catalogTitlesRepaired": previous_catalog_total + stats["catalogTitlesRepaired"],
        "recordsRepairedThisRun": stats["recordsRepaired"],
        "recordsRepaired": previous_record_total + stats["recordsRepaired"],
        "verifiedLocalSources": {
            "ruTitleMap": str(TITLE_MAP_PATH.relative_to(ROOT)),
            "officialCaches": [
                str(path.relative_to(ROOT))
                for path in OFFICIAL_CACHE_PATHS
                if path.exists()
            ],
        },
        "repairReasons": {
            key.removeprefix("reason:"): value
            for key, value in sorted(stats.items())
            if key.startswith("reason:")
        },
        "localizationSources": dict(source_counts.most_common(20)),
        "sourceSha256": source_sha,
        "issueSamples": samples,
    }
    save_json(HEALTH_PATH, health, pretty=True)
    return health


def update_static_pages(decisions_by_id: dict[str, tuple[str, str]]) -> int:
    film_dir = ROOT / "film"
    if not film_dir.exists() or not decisions_by_id:
        return 0
    updated = 0
    for path in film_dir.glob("*.html"):
        source = path.read_text(encoding="utf-8", errors="replace")
        match = re.search(r'data-id=["\']([^"\']+)', source)
        if not match:
            continue
        item_id = clean(match.group(1))
        decision = decisions_by_id.get(item_id)
        if not decision:
            continue
        old_title, title = decision
        changed = source
        changed = re.sub(
            r"(<h1[^>]*>).*?(</h1>)",
            lambda value: value.group(1) + html.escape(title) + value.group(2),
            changed,
            count=1,
            flags=re.I | re.S,
        )
        changed = re.sub(
            r"<title>.*?</title>",
            f"<title>{html.escape(title)}</title>",
            changed,
            count=1,
            flags=re.I | re.S,
        )
        changed = changed.replace(f"«{old_title}»", f"«{title}»")
        if changed != source:
            path.write_text(changed, encoding="utf-8")
            updated += 1
    return updated


def verify() -> dict[str, Any]:
    rows = load_json(SEARCH_PATH, [])
    health = load_json(HEALTH_PATH, {})
    failures: list[str] = []
    if not isinstance(rows, list) or len(rows) < 100_000:
        failures.append("search_index has fewer than 100000 records")
        rows = []
    if health.get("version") != "366":
        failures.append("V366 title health report is missing")
    if int(health.get("catalogItems") or 0) != len(rows):
        failures.append("title health count does not match search index")

    controls = {
        ("Jikan / MyAnimeList", "mal_16870"): "Наруто: Последний фильм",
        ("movie_top_rated", "7317442"): "Наруто: Последний фильм",
        ("movie_top_rated", "7118406"): "Наруто: Ураганные хроники 6 — Путь ниндзя",
        ("movie_top_rated", "7020982"): "Наруто: Ураганные хроники 1 — Адепты Тёмного царства",
        ("movie_top_rated", "7017581"): "Наруто: Ураганные хроники 2 — Связи",
        ("movie_top_rated", "7036728"): "Наруто: Ураганные хроники 3 — Наследники воли огня",
        ("movie_top_rated", "7016907"): "Наруто 1: Книга искусств ниндзя Снежной принцессы",
        ("movie_top_rated", "7347201"): "Боруто",
        ("tv_top_rated", "8070881"): "Боруто: Новое поколение Наруто",
        ("tmdb", "1031396"): "Путь Наруто",
    }
    found: dict[str, dict[str, Any]] = {}
    for item in rows:
        if not isinstance(item, dict):
            continue
        key = (clean(item.get("source")), clean(item.get("id")))
        expected = controls.get(key)
        if expected is None:
            continue
        actual = title_of(item)
        found[f"{key[0]}:{key[1]}"] = {
            "expected": expected,
            "actual": actual,
            "pass": norm(actual) == norm(expected),
        }
    for source_id, result in found.items():
        if not result["pass"]:
            failures.append(f"Russian title control failed: {source_id}")
    if len(found) != len(controls):
        failures.append("not all Naruto/Boruto title controls were found")

    return {
        "ok": not failures,
        "failures": failures,
        "catalogItems": len(rows),
        "controls": found,
        "unresolvedRussianTitles": int(health.get("unresolvedRussianTitles") or 0),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify existing V366 output only")
    args = parser.parse_args()
    if args.check:
        result = verify()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1

    rows = load_json(SEARCH_PATH, [])
    if not isinstance(rows, list):
        raise RuntimeError("data/fast/search_index.json is not a list")

    stats: Counter[str] = Counter()
    resolver = TitleResolver(rows)
    forced: dict[str, tuple[str, str]] = {}
    decisions_by_id: dict[str, tuple[str, str]] = {}
    ambiguous_static_ids: set[str] = set()

    for item in rows:
        if not isinstance(item, dict):
            continue
        stats["recordsScanned"] += 1
        result = resolver.resolve(item)
        if not result:
            continue
        old_title = title_of(item)
        title, reason, _score = result
        if not apply_title(item, title, reason):
            continue
        stats["recordsRepaired"] += 1
        stats["catalogTitlesRepaired"] += 1
        stats[f"reason:{reason}"] += 1
        key = stable_key(item)
        if key:
            forced[key] = (title, reason)
        item_id = clean(item.get("id"))
        if item_id and item_id not in ambiguous_static_ids:
            existing = decisions_by_id.get(item_id)
            if existing is None:
                decisions_by_id[item_id] = (old_title, title)
            elif norm(existing[1]) != norm(title):
                # Ambiguous numeric IDs are intentionally excluded from static
                # page updates; dynamic data still uses source-aware keys.
                decisions_by_id.pop(item_id, None)
                ambiguous_static_ids.add(item_id)

    save_json(SEARCH_PATH, rows)

    for path in candidate_fast_paths():
        value = load_json(path)
        if value is None:
            continue
        before = json.dumps(value, ensure_ascii=False, sort_keys=True)
        repair_value(value, resolver, forced, stats, str(path.relative_to(FAST_DIR).parent))
        after = json.dumps(value, ensure_ascii=False, sort_keys=True)
        if after != before:
            save_json(path, value)
            stats["filesChanged"] += 1

    static_updated = update_static_pages(decisions_by_id)
    source_sha = hashlib.sha256(SEARCH_PATH.read_bytes()).hexdigest()
    health = build_health(rows, resolver, stats, source_sha)
    verification = verify()
    report = {
        "version": "V366",
        "generatedAt": now_iso(),
        "status": "success" if verification["ok"] else "failed",
        "stats": dict(stats),
        "staticPagesUpdated": static_updated,
        "health": {
            key: health[key]
            for key in (
                "catalogItems",
                "russianTitles",
                "latinOnlyTitles",
                "syntheticTitles",
                "collapsedFranchiseTitles",
                "unresolvedRussianTitles",
                "catalogTitlesRepaired",
                "recordsRepaired",
            )
        },
        "verification": verification,
    }
    save_json(REPORT_PATH, report, pretty=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if verification["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
