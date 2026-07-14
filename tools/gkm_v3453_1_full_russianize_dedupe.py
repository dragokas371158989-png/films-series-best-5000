#!/usr/bin/env python3
"""
GKM V3453 — full-site Russian localization and conservative deduplication.

Priority:
1. Official Russian cache already produced by V3452.1.
2. Fresh Shikimori Russian titles for every mal_* record.
3. Existing human Russian title.
4. Offline English -> Russian neural translation with Argos Translate.
5. Cyrillic transliteration only as the final emergency fallback.

Updates:
- primary chunks and mirror chunks;
- search indexes and lite indexes;
- fast pages;
- 3D poster wall + seed + manifest;
- anime-tv;
- games, books, manga, ranobe and comics;
- static film pages;
- genres, statuses and existing non-Russian descriptions.

Deduplication is conservative:
- exact duplicate IDs;
- same normalized original title + year + type, only when poster also matches.
Different seasons, years and remakes are preserved.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V3453_1_FULL_RUSSIAN.json"
OFFICIAL_CACHE_OUT = ROOT / "data" / "ru_complete_cache_v3453_1.json"
MACHINE_CACHE_PATH = ROOT / "data" / "ru_machine_cache_v3453_1.json"

CYR = re.compile(r"[А-Яа-яЁё]")
LAT = re.compile(r"[A-Za-z]")
CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
YEAR_RE = re.compile(r"(19\d{2}|20\d{2})")

GENRE_MAP = {
    "action": "Боевик", "adventure": "Приключения", "animation": "Анимация",
    "anime": "Аниме", "comedy": "Комедия", "crime": "Криминал",
    "documentary": "Документальный", "drama": "Драма", "family": "Семейный",
    "fantasy": "Фэнтези", "history": "Исторический", "historical": "Исторический",
    "horror": "Ужасы", "music": "Музыка", "mystery": "Детектив",
    "romance": "Романтика", "science fiction": "Фантастика", "sci-fi": "Фантастика",
    "science-fiction": "Фантастика", "thriller": "Триллер", "war": "Военный",
    "western": "Вестерн", "sport": "Спорт", "sports": "Спорт",
    "supernatural": "Сверхъестественное", "psychological": "Психология",
    "suspense": "Саспенс", "slice of life": "Повседневность",
    "school": "Школа", "martial arts": "Боевые искусства",
    "super power": "Суперспособности", "parody": "Пародия",
    "samurai": "Самураи", "vampire": "Вампиры", "space": "Космос",
    "mecha": "Меха", "military": "Военное", "mythology": "Мифология",
    "performing arts": "Сценическое искусство", "adult cast": "Взрослые персонажи",
    "boys love": "Мужская любовь", "girls love": "Женская любовь",
    "workplace": "Работа", "time travel": "Путешествия во времени",
    "survival": "Выживание", "isekai": "Исекай", "reincarnation": "Реинкарнация",
    "gourmet": "Кулинария", "medical": "Медицина", "detective": "Детектив",
    "kids": "Детский", "game": "Игры", "games": "Игры",
    "biography": "Биография", "memoir": "Мемуары", "poetry": "Поэзия",
    "novel": "Роман", "manga": "Манга", "manhwa": "Манхва",
    "manhua": "Маньхуа", "comic": "Комикс", "comics": "Комиксы",
    "light novel": "Ранобэ", "ranobe": "Ранобэ",
}


# V3453.1: normalized taxonomy aliases from MyAnimeList/Shikimori,
# games and books. Keys are normalized below, so hyphens/spaces are equivalent.
GENRE_MAP.update({
    # MAL/Jikan genres
    "avant garde": "Авангард",
    "award winning": "Лауреаты премий",
    "boys love": "Мужская любовь",
    "girls love": "Женская любовь",
    "sci fi": "Фантастика",
    "slice-of-life": "Повседневность",
    "ecchi": "Этти",
    "erotica": "Эротика",
    "hentai": "Хентай",

    # MAL/Jikan themes
    "anthropomorphic": "Антропоморфизм",
    "cgdct": "Милые девушки занимаются милыми делами",
    "childcare": "Воспитание детей",
    "combat sports": "Боевые виды спорта",
    "crossdressing": "Переодевание",
    "delinquents": "Хулиганы",
    "educational": "Образовательное",
    "gag humor": "Гэг-юмор",
    "gore": "Жестокость",
    "harem": "Гарем",
    "high stakes game": "Игра с высокими ставками",
    "idols female": "Женские идолы",
    "idols male": "Мужские идолы",
    "iyashikei": "Исцеляющее",
    "love polygon": "Любовный многоугольник",
    "magical sex shift": "Магическая смена пола",
    "mahou shoujo": "Девочки-волшебницы",
    "mahou shounen": "Юноши-волшебники",
    "organized crime": "Организованная преступность",
    "otaku culture": "Культура отаку",
    "pets": "Домашние животные",
    "racing": "Гонки",
    "reverse harem": "Обратный гарем",
    "romantic subtext": "Романтический подтекст",
    "showbiz": "Шоу-бизнес",
    "strategy game": "Стратегические игры",
    "team sports": "Командные виды спорта",
    "video game": "Видеоигры",
    "visual arts": "Изобразительное искусство",

    # Demographics
    "josei": "Дзёсэй",
    "seinen": "Сэйнэн",
    "shoujo": "Сёдзё",
    "shounen": "Сёнэн",

    # Games
    "role playing": "Ролевая игра",
    "role-playing": "Ролевая игра",
    "rpg": "РПГ",
    "jrpg": "Японская ролевая игра",
    "mmorpg": "ММОРПГ",
    "mmo": "ММО",
    "real time strategy": "Стратегия в реальном времени",
    "turn based strategy": "Пошаговая стратегия",
    "simulation": "Симулятор",
    "simulator": "Симулятор",
    "shooter": "Шутер",
    "first person shooter": "Шутер от первого лица",
    "third person shooter": "Шутер от третьего лица",
    "platformer": "Платформер",
    "fighting": "Файтинг",
    "puzzle": "Головоломка",
    "sandbox": "Песочница",
    "open world": "Открытый мир",
    "visual novel": "Визуальная новелла",
    "roguelike": "Рогалик",
    "roguelite": "Рогалайт",
    "metroidvania": "Метроидвания",
    "stealth": "Стелс",
    "tactical": "Тактика",
    "card game": "Карточная игра",
    "board game": "Настольная игра",
    "indie": "Инди",
    "casual": "Казуальная игра",
    "arcade": "Аркада",

    # Books
    "fiction": "Художественная литература",
    "nonfiction": "Документальная литература",
    "non-fiction": "Документальная литература",
    "young adult": "Подростковая литература",
    "childrens": "Детская литература",
    "children s": "Детская литература",
    "classics": "Классика",
    "contemporary": "Современная литература",
    "historical fiction": "Историческая проза",
    "literary fiction": "Литературная проза",
    "self help": "Саморазвитие",
    "business": "Бизнес",
    "economics": "Экономика",
    "politics": "Политика",
    "religion": "Религия",
    "philosophy": "Философия",
    "psychology": "Психология",
    "art": "Искусство",
    "travel": "Путешествия",
    "cooking": "Кулинария",
    "true crime": "Документальный криминал",
    "graphic novel": "Графический роман",
    "graphic novels": "Графические романы",
})

def taxonomy_key(value: Any) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-яё]+", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()

GENRE_MAP_NORMALIZED = {taxonomy_key(key): value for key, value in GENRE_MAP.items()}

TYPE_MAP = {
    "movie": "Фильм", "film": "Фильм", "фильм": "Фильм",
    "tv": "Сериал", "tv series": "Сериал", "series": "Сериал", "сериал": "Сериал",
    "cartoon": "Мультфильм", "animation": "Мультфильм", "мультфильм": "Мультфильм",
    "animated series": "Мультсериал", "cartoon series": "Мультсериал",
    "anime": "Аниме", "аниме": "Аниме",
    "game": "Игра", "игра": "Игра",
    "book": "Книга", "книга": "Книга",
    "manga": "Манга", "манга": "Манга",
    "ranobe": "Ранобэ", "light novel": "Ранобэ", "ранобэ": "Ранобэ",
    "comic": "Комикс", "comics": "Комикс", "комикс": "Комикс",
}

STATUS_MAP = {
    "released": "Вышел", "finished airing": "Вышел", "finished": "Завершён",
    "airing": "Выходит", "currently airing": "Выходит", "ongoing": "Выходит",
    "upcoming": "Скоро выйдет", "not yet aired": "Скоро выйдет",
    "planned": "Запланирован", "cancelled": "Отменён", "canceled": "Отменён",
}

TRANSLIT = str.maketrans({
    "a":"а","b":"б","c":"к","d":"д","e":"е","f":"ф","g":"г","h":"х","i":"и",
    "j":"дж","k":"к","l":"л","m":"м","n":"н","o":"о","p":"п","q":"к","r":"р",
    "s":"с","t":"т","u":"у","v":"в","w":"в","x":"кс","y":"й","z":"з",
    "A":"А","B":"Б","C":"К","D":"Д","E":"Е","F":"Ф","G":"Г","H":"Х","I":"И",
    "J":"Дж","K":"К","L":"Л","M":"М","N":"Н","O":"О","P":"П","Q":"К","R":"Р",
    "S":"С","T":"Т","U":"У","V":"В","W":"В","X":"Кс","Y":"Й","Z":"З",
})


def norm(value: Any) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[^\wа-яё]+", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def has_cyr(value: Any) -> bool:
    return bool(CYR.search(str(value or "")))


def has_lat(value: Any) -> bool:
    return bool(LAT.search(str(value or "")))


def numeric_only(value: Any) -> bool:
    text = re.sub(r"[\W_]+", "", str(value or ""), flags=re.UNICODE)
    return bool(text) and text.isdigit()


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


def current_title(item: dict) -> str:
    for key in ("ru", "title_ru", "nameRu", "title", "name", "en", "originalTitle", "original_title"):
        value = str(item.get(key) or "").strip()
        if value:
            return value
    return ""


def original_title(item: dict) -> str:
    for key in ("en", "originalTitle", "original_title", "original_name", "title", "name", "ru"):
        value = str(item.get(key) or "").strip()
        if value:
            return value
    return ""


def item_type(item: dict) -> str:
    raw = norm(item.get("type") or item.get("category") or item.get("__kind"))
    return TYPE_MAP.get(raw, str(item.get("type") or item.get("category") or "Проект"))


def year_value(item: dict) -> str:
    raw = str(item.get("year") or item.get("release_date") or item.get("first_air_date") or "")
    match = YEAR_RE.search(raw)
    return match.group(1) if match else ""


def poster_value(item: dict) -> str:
    return str(item.get("poster") or item.get("poster_path") or item.get("image") or "").strip()


def stable_id(item: dict) -> str:
    return str(item.get("id") or "").strip()


def merge_items(base: dict, other: dict, stats: Counter) -> dict:
    result = dict(base)
    aliases = list(result.get("aliases") or [])
    merged_ids = list(result.get("mergedDuplicateIds") or [])
    oid = stable_id(other)
    if oid and oid != stable_id(result):
        merged_ids.append(oid)

    for key, value in other.items():
        if value in (None, "", [], {}):
            continue
        if key in ("genres", "aliases", "mergedDuplicateIds"):
            continue
        if result.get(key) in (None, "", [], {}):
            result[key] = value
        elif key in ("votes", "rating"):
            try:
                if float(value) > float(result.get(key) or 0):
                    result[key] = value
            except Exception:
                pass

    genres = []
    for value in [*(result.get("genres") or []), *(other.get("genres") or [])]:
        value = str(value or "").strip()
        if value and norm(value) not in {norm(x) for x in genres}:
            genres.append(value)
    result["genres"] = genres

    for value in (
        current_title(base), current_title(other),
        original_title(base), original_title(other),
        *(other.get("aliases") or []),
    ):
        value = str(value or "").strip()
        if value and norm(value) not in {norm(x) for x in aliases}:
            aliases.append(value)
    result["aliases"] = aliases

    unique_ids = []
    for value in [*merged_ids, *(other.get("mergedDuplicateIds") or [])]:
        value = str(value or "").strip()
        if value and value != stable_id(result) and value not in unique_ids:
            unique_ids.append(value)
    if unique_ids:
        result["mergedDuplicateIds"] = unique_ids

    stats["duplicates_merged"] += 1
    return result


def conservative_dedupe(items: list[dict], stats: Counter) -> list[dict]:
    output = []
    by_id = {}
    by_key = {}

    for item in items:
        iid = stable_id(item)
        if iid and iid in by_id:
            index = by_id[iid]
            output[index] = merge_items(output[index], item, stats)
            stats["duplicate_ids_removed"] += 1
            continue

        original = norm(original_title(item))
        key = (original, year_value(item), item_type(item))
        poster = norm(poster_value(item))

        index = None
        if original and key in by_key:
            candidate_index = by_key[key]
            candidate = output[candidate_index]
            same_poster = poster and poster == norm(poster_value(candidate))
            same_id_alias = iid and iid in (candidate.get("mergedDuplicateIds") or [])
            if same_poster or same_id_alias:
                index = candidate_index

        if index is not None:
            output[index] = merge_items(output[index], item, stats)
            if iid:
                by_id[iid] = index
            stats["semantic_duplicates_removed"] += 1
            continue

        index = len(output)
        output.append(dict(item))
        if iid:
            by_id[iid] = index
        if original:
            by_key.setdefault(key, index)

    return output


def load_official_cache() -> dict[str, dict]:
    candidates = [
        ROOT / "data" / "ru_complete_cache_v3453_1.json",
        ROOT / "data" / "ru_complete_cache_v3453.json",
        ROOT / "data" / "ru_official_cache_v3452_1.json",
        ROOT / "data" / "ru_official_cache_v3452.json",
        ROOT / "data" / "ru_official_cache_v3451.json",
    ]
    result = {}
    for path in candidates:
        raw = read_json(path, {})
        items = raw.get("items") if isinstance(raw, dict) else None
        if not isinstance(items, dict):
            continue
        for iid, payload in items.items():
            if not isinstance(payload, dict):
                continue
            ru = str(payload.get("ru") or "").strip()
            if has_cyr(ru):
                result[str(iid)] = dict(payload)
    return result


def http_json(url: str, retries=5):
    headers = {
        "User-Agent": "GKM-V3453/1.0 (+https://github.com/dragokas371158989-png/films-series-best-5000)",
        "Accept": "application/json",
    }
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code in (429, 500, 502, 503, 504):
                time.sleep(min(15, 1.5 * (attempt + 1)))
                continue
            return None
        except Exception:
            if attempt + 1 >= retries:
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def collect_all_items() -> list[dict]:
    items = []
    for path in sorted((ROOT / "data").glob("chunk_*.json")):
        value = read_json(path, [])
        if isinstance(value, list):
            items.extend(x for x in value if isinstance(x, dict))

    for path in (
        ROOT / "data" / "games_catalog.json",
        ROOT / "data" / "books_catalog.json",
        ROOT / "anime-tv" / "anime_data.json",
    ):
        value = read_json(path, [])
        if isinstance(value, list):
            items.extend(x for x in value if isinstance(x, dict))
        elif isinstance(value, dict):
            for child in value.values():
                if isinstance(child, list):
                    items.extend(x for x in child if isinstance(x, dict))
    return items


def refresh_shikimori_cache(all_items: list[dict], official: dict[str, dict], stats: Counter, offline: bool):
    mal_ids = set()
    for item in all_items:
        iid = stable_id(item)
        match = re.fullmatch(r"mal_(\d+)", iid)
        if match:
            mal_ids.add(match.group(1))
        elif str(item.get("source") or "").lower() == "jikan":
            raw = str(item.get("id") or "")
            if raw.isdigit():
                mal_ids.add(raw)

    stats["mal_ids_total"] = len(mal_ids)
    if offline:
        return

    ids = sorted(
        (
            mal_id for mal_id in mal_ids
            if not has_cyr(official.get(f"mal_{mal_id}", {}).get("ru"))
        ),
        key=int,
    )
    stats["mal_ids_missing_official_ru"] = len(ids)
    for offset in range(0, len(ids), 50):
        batch = ids[offset:offset + 50]
        query = urllib.parse.urlencode({"ids": ",".join(batch), "limit": 50})
        rows = http_json(f"https://shikimori.one/api/animes?{query}")
        returned = set()

        if isinstance(rows, list):
            for row in rows:
                mal_id = str(row.get("id") or "")
                if not mal_id:
                    continue
                returned.add(mal_id)
                ru = str(row.get("russian") or "").strip()
                if has_cyr(ru):
                    official[f"mal_{mal_id}"] = {
                        "ru": ru,
                        "original": str(row.get("name") or "").strip(),
                        "source": "Shikimori V3453",
                    }
                    stats["shikimori_titles"] += 1

        missing = [mal_id for mal_id in batch if mal_id not in returned or not has_cyr(official.get(f"mal_{mal_id}", {}).get("ru"))]
        for mal_id in missing:
            row = http_json(f"https://shikimori.one/api/animes/{mal_id}")
            if not isinstance(row, dict):
                stats["shikimori_missing"] += 1
                continue
            ru = str(row.get("russian") or "").strip()
            if has_cyr(ru):
                official[f"mal_{mal_id}"] = {
                    "ru": ru,
                    "original": str(row.get("name") or "").strip(),
                    "source": "Shikimori V3453",
                }
                stats["shikimori_individual_titles"] += 1
            time.sleep(0.35)

        write_json(OFFICIAL_CACHE_OUT, {"version": "V3453.1", "items": official})
        time.sleep(0.75)


class RussianTranslator:
    def __init__(self, stats: Counter, offline=False):
        self.stats = stats
        self.offline = offline
        raw = read_json(MACHINE_CACHE_PATH, {})
        self.cache = raw.get("items", {}) if isinstance(raw, dict) else {}
        if not isinstance(self.cache, dict):
            self.cache = {}
        self.ready = False
        self.translate_module = None

    def install(self):
        if self.offline:
            return
        try:
            import argostranslate.package
            import argostranslate.translate
            self.translate_module = argostranslate.translate

            installed = argostranslate.translate.get_installed_languages()
            has_pair = False
            for source in installed:
                if source.code != "en":
                    continue
                has_pair = any(target.code == "ru" for target in source.translations_to)
            if not has_pair:
                argostranslate.package.update_package_index()
                packages = argostranslate.package.get_available_packages()
                package = next(
                    p for p in packages
                    if p.from_code == "en" and p.to_code == "ru"
                )
                argostranslate.package.install_from_path(package.download())
            self.ready = True
            self.stats["argos_ready"] = 1
        except Exception as exc:
            self.stats["argos_install_errors"] += 1
            self.stats["argos_error_text"] = str(exc)[:500]

    def save(self):
        write_json(MACHINE_CACHE_PATH, {"version": "V3453", "items": self.cache})

    @staticmethod
    def transliterate(text: str) -> str:
        return text.translate(TRANSLIT)

    def translate(self, text: str, kind="title") -> str:
        text = str(text or "").strip()
        if not text or has_cyr(text) or numeric_only(text):
            return text

        cache_key = f"{kind}:{text}"
        cached = str(self.cache.get(cache_key) or "").strip()
        if cached:
            return cached

        translated = ""
        if self.ready and has_lat(text) and not CJK.search(text):
            try:
                if kind == "description" and len(text) > 900:
                    parts = re.split(r"(?<=[.!?])\s+", text)
                    groups, current = [], ""
                    for part in parts:
                        if len(current) + len(part) + 1 > 750 and current:
                            groups.append(current)
                            current = part
                        else:
                            current = f"{current} {part}".strip()
                    if current:
                        groups.append(current)
                    translated = " ".join(
                        self.translate_module.translate(group, "en", "ru")
                        for group in groups
                    )
                else:
                    translated = self.translate_module.translate(text, "en", "ru")
            except Exception:
                self.stats["machine_translation_errors"] += 1

        if not has_cyr(translated):
            translated = self.transliterate(text)
            self.stats["transliteration_fallbacks"] += 1
        else:
            self.stats["machine_translations"] += 1

        translated = re.sub(r"\s+", " ", translated).strip()
        self.cache[cache_key] = translated
        if len(self.cache) % 250 == 0:
            self.save()
        return translated


def cyrillize_remaining_latin(value: str, translator: RussianTranslator) -> str:
    """Guarantee that a taxonomy label contains no Latin characters."""
    text = str(value or "").strip()
    if not has_lat(text):
        return text

    def replace(match):
        return translator.transliterate(match.group(0))

    return LAT.sub(lambda m: replace(m), text)


def localize_genres(
    value: Any,
    translator: RussianTranslator | None = None,
    stats: Counter | None = None,
) -> list[str]:
    if isinstance(value, str):
        parts = re.split(r"[|,;/]", value)
    elif isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict):
                parts.append(str(item.get("name") or item.get("title") or ""))
            else:
                parts.append(str(item or ""))
    else:
        parts = []

    output, seen = [], set()
    for part in parts:
        part = part.strip()
        if not part:
            continue

        key = taxonomy_key(part)
        localized = GENRE_MAP_NORMALIZED.get(key, part)

        # Any remaining English taxonomy label is translated once and cached.
        if has_lat(localized) and translator is not None:
            translated = translator.translate(localized, "genre")
            if translated:
                localized = translated
                if stats is not None:
                    stats["unknown_genres_machine_translated"] += 1

        # Even if Argos keeps an acronym/word in Latin, force a Cyrillic form.
        if has_lat(localized) and translator is not None:
            localized = cyrillize_remaining_latin(localized, translator)
            if stats is not None:
                stats["genre_latin_fragments_cyrillized"] += 1

        localized = re.sub(r"\s+", " ", str(localized or "")).strip()
        label_key = norm(localized)
        if label_key and label_key not in seen:
            seen.add(label_key)
            output.append(localized)
    return output


def apply_localization(item: dict, official: dict[str, dict], translator: RussianTranslator, stats: Counter) -> dict:
    result = dict(item)
    iid = stable_id(result)

    official_payload = official.get(iid, {})
    official_ru = str(official_payload.get("ru") or "").strip()
    existing = current_title(result)
    original = str(
        official_payload.get("original")
        or original_title(result)
        or existing
    ).strip()

    source_marker = norm(result.get("titleLocalizationSource"))
    machine_old = any(token in source_marker for token in ("translit", "machine", "fallback"))

    if has_cyr(official_ru):
        ru = official_ru
        localization_source = str(official_payload.get("source") or "Official V3453")
        stats["official_titles_applied"] += 1
    elif has_cyr(existing) and not machine_old:
        ru = existing
        localization_source = str(result.get("titleLocalizationSource") or "Existing Russian")
        stats["existing_russian_titles_kept"] += 1
    else:
        ru = translator.translate(original or existing, "title")
        localization_source = "Argos V3453" if has_cyr(ru) else "Fallback V3453"
        stats["fallback_titles_applied"] += 1

    if not ru:
        ru = f"Проект {iid}" if iid else "Проект без названия"

    old_display = existing
    result["ru"] = ru
    for key in ("title", "name", "title_ru", "nameRu"):
        if key in result:
            result[key] = ru

    if original and norm(original) != norm(ru):
        result.setdefault("en", original)
        result.setdefault("originalTitle", original)

    aliases, seen = [], set()
    for value in [
        *(result.get("aliases") or []),
        old_display, original, ru,
    ]:
        value = str(value or "").strip()
        key = norm(value)
        if value and key and key not in seen:
            seen.add(key)
            aliases.append(value)
    result["aliases"] = aliases
    result["titleLocalizationSource"] = localization_source

    raw_type_value = str(result.get("type") or result.get("category") or "Проект").strip()
    raw_type = norm(raw_type_value)
    localized_type = TYPE_MAP.get(raw_type, raw_type_value)
    if has_lat(localized_type):
        localized_type = translator.translate(localized_type, "type")
        localized_type = cyrillize_remaining_latin(localized_type, translator)
        stats["unknown_types_translated"] += 1
    result["type"] = localized_type
    if "category" in result:
        result["category"] = localized_type

    result["genres"] = localize_genres(result.get("genres"), translator, stats)

    if "status" in result:
        raw_status = str(result.get("status") or "").strip()
        localized_status = STATUS_MAP.get(norm(raw_status), raw_status)
        if has_lat(localized_status):
            localized_status = translator.translate(localized_status, "status")
            localized_status = cyrillize_remaining_latin(localized_status, translator)
            stats["unknown_statuses_translated"] += 1
        result["status"] = localized_status

    overview_key = "overview" if "overview" in result or "description" not in result else "description"
    overview = str(result.get("overview") or result.get("description") or "").strip()
    if overview and not has_cyr(overview):
        translated_overview = translator.translate(overview, "description")
        result[overview_key] = translated_overview
        if "overview" in result:
            result["overview"] = translated_overview
        if "description" in result:
            result["description"] = translated_overview
        stats["descriptions_translated"] += 1

    return result


def load_primary() -> tuple[list[dict], int]:
    paths = sorted((ROOT / "data").glob("chunk_*.json"))
    items = []
    chunk_size = 1000
    if paths:
        first = read_json(paths[0], [])
        if isinstance(first, list) and first:
            chunk_size = len(first)
    for path in paths:
        rows = read_json(path, [])
        if isinstance(rows, list):
            items.extend(x for x in rows if isinstance(x, dict))
    return items, max(100, chunk_size)


def write_primary(items: list[dict], chunk_size: int):
    for base in (ROOT / "data", ROOT / "data" / "chunks", ROOT / "film" / "data" / "chunks"):
        base.mkdir(parents=True, exist_ok=True)
        for old in base.glob("chunk_*.json"):
            old.unlink()
        for index in range(0, len(items), chunk_size):
            number = index // chunk_size + 1
            write_json(base / f"chunk_{number:04d}.json", items[index:index + chunk_size])


def item_alias_map(items: list[dict]) -> dict[str, dict]:
    mapping = {}
    for item in items:
        iid = stable_id(item)
        if iid:
            mapping[iid] = item
        for alias in item.get("mergedDuplicateIds") or []:
            alias = str(alias or "").strip()
            if alias:
                mapping[alias] = item
    return mapping


def compact_search_item(item: dict) -> dict:
    ru = current_title(item)
    original = original_title(item)
    genres = localize_genres(item.get("genres"))
    result = {
        "id": stable_id(item),
        "ru": ru,
        "en": original if norm(original) != norm(ru) else "",
        "year": str(year_value(item)),
        "type": item_type(item),
        "rating": item.get("rating") or 0,
        "votes": item.get("votes") or 0,
        "poster": item.get("poster") or "",
        "genres": genres,
        "overview": str(item.get("overview") or item.get("description") or "")[:2000],
        "episodes": item.get("episodes") or "",
        "studio": item.get("studio") or "",
        "country": item.get("country") or "",
        "ageRating": item.get("ageRating") or "",
        "source": item.get("source") or "",
        "aliases": item.get("aliases") or [],
        "mergedDuplicateIds": item.get("mergedDuplicateIds") or [],
    }
    result["search"] = " ".join(
        str(value or "")
        for value in (
            ru, original, result["year"], result["type"],
            " ".join(genres), " ".join(result["aliases"]),
        )
    ).strip()
    return result


def rebuild_search(items: list[dict]):
    rows = [compact_search_item(item) for item in items]
    lite = [
        {
            "id": row["id"], "ru": row["ru"], "en": row["en"],
            "year": row["year"], "type": row["type"],
            "rating": row["rating"], "votes": row["votes"],
            "poster": row["poster"], "genres": row["genres"],
            "search": row["search"],
        }
        for row in rows
    ]
    for base in (ROOT / "data" / "fast", ROOT / "film" / "data" / "fast"):
        write_json(base / "search_index.json", rows)
        write_json(base / "search_lite.json", lite)


def update_catalog_file(path: Path, official: dict[str, dict], translator: RussianTranslator, stats: Counter):
    value = read_json(path)
    if value is None:
        return

    if isinstance(value, list):
        rows = [apply_localization(x, official, translator, stats) if isinstance(x, dict) else x for x in value]
        dict_rows = [x for x in rows if isinstance(x, dict)]
        other_rows = [x for x in rows if not isinstance(x, dict)]
        rows = conservative_dedupe(dict_rows, stats) + other_rows
        write_json(path, rows)
    elif isinstance(value, dict):
        changed = {}
        for key, child in value.items():
            if isinstance(child, list):
                localized = [apply_localization(x, official, translator, stats) if isinstance(x, dict) else x for x in child]
                dict_rows = [x for x in localized if isinstance(x, dict)]
                other_rows = [x for x in localized if not isinstance(x, dict)]
                changed[key] = conservative_dedupe(dict_rows, stats) + other_rows
            else:
                changed[key] = child
        write_json(path, changed)


def update_json_tree(value: Any, by_id: dict[str, dict]) -> bool:
    changed = False
    if isinstance(value, dict):
        iid = str(value.get("id") or "").strip()
        source = by_id.get(iid)
        if source:
            for key in ("ru", "title", "name", "type", "category", "genres", "overview", "description", "status", "aliases", "mergedDuplicateIds"):
                if key in source and source.get(key) not in (None, "") and value.get(key) != source.get(key):
                    if key in value or key in ("ru", "genres", "overview"):
                        value[key] = source[key]
                        changed = True
        for child in value.values():
            changed |= update_json_tree(child, by_id)
    elif isinstance(value, list):
        for child in value:
            changed |= update_json_tree(child, by_id)
    return changed


def update_derived_json(by_id: dict[str, dict]):
    patterns = (
        "data/fast/pages/*.json",
        "film/data/fast/pages/*.json",
        "data/fast/home.json",
        "film/data/fast/home.json",
        "anime_updates.json",
        "movies_updates.json",
    )
    for pattern in patterns:
        for path in ROOT.glob(pattern):
            value = read_json(path)
            if value is not None and update_json_tree(value, by_id):
                write_json(path, value)


def update_wall_base(base: Path, by_id: dict[str, dict], stats: Counter):
    if not base.exists():
        return

    kind_counts = {}
    total = 0
    for prefix in ("movies", "series", "anime", "cartoons"):
        seen = set()
        count = 0
        for path in sorted(base.glob(f"{prefix}_*.json")):
            rows = read_json(path, [])
            if not isinstance(rows, list):
                continue
            output = []
            for row in rows:
                if not isinstance(row, list) or len(row) < 2:
                    continue
                iid = str(row[0] or "").strip()
                item = by_id.get(iid)
                if item:
                    canonical = stable_id(item)
                    row[0] = canonical
                    row[1] = current_title(item)
                    if len(row) > 2:
                        row[2] = original_title(item)
                    if len(row) > 8:
                        row[8] = "|".join(localize_genres(item.get("genres")))
                key = (prefix, str(row[0] or "").strip())
                if key in seen:
                    stats["wall_duplicates_removed"] += 1
                    continue
                seen.add(key)
                output.append(row)
            write_json(path, output)
            count += len(output)
        kind_counts[prefix] = count
        total += count

    seed_path = base / "seed_all.json"
    if seed_path.exists():
        rows = read_json(seed_path, [])
        output, seen = [], set()
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, list) or len(row) < 2:
                continue
            iid = str(row[0] or "").strip()
            item = by_id.get(iid)
            if item:
                row[0] = stable_id(item)
                row[1] = current_title(item)
                if len(row) > 2:
                    row[2] = original_title(item)
                if len(row) > 8:
                    row[8] = "|".join(localize_genres(item.get("genres")))
            key = str(row[0] or "").strip()
            if key in seen:
                continue
            seen.add(key)
            output.append(row)
        write_json(seed_path, output)

    manifest_path = base / "manifest.json"
    manifest = read_json(manifest_path, {})
    if isinstance(manifest, dict):
        manifest["version"] = "v3453.1-full-russian"
        manifest["total"] = total
        for kind, count in kind_counts.items():
            manifest.setdefault("kinds", {}).setdefault(kind, {})["count"] = count
        write_json(manifest_path, manifest)


def update_static_pages(by_id: dict[str, dict], stats: Counter):
    film = ROOT / "film"
    if not film.exists():
        return

    for path in film.glob("*.html"):
        text = path.read_text(encoding="utf-8", errors="replace")
        match = re.search(r'data-id=["\']([^"\']+)', text)
        iid = match.group(1) if match else path.stem
        item = by_id.get(str(iid))
        if not item:
            continue
        ru = current_title(item)
        overview = str(item.get("overview") or item.get("description") or "").strip()
        genres = localize_genres(item.get("genres"))

        changed = text.replace('<html lang="en">', '<html lang="ru">')
        changed = re.sub(
            r"<title>.*?</title>",
            f"<title>{html.escape(ru)}</title>",
            changed, count=1, flags=re.I | re.S,
        )
        changed = re.sub(
            r"(<h1[^>]*>).*?(</h1>)",
            lambda m: m.group(1) + html.escape(ru) + m.group(2),
            changed, count=1, flags=re.I | re.S,
        )
        changed = re.sub(
            r'(<p class=["\']genres["\']>).*?(</p>)',
            lambda m: m.group(1) + html.escape(" · ".join(genres)) + m.group(2),
            changed, count=1, flags=re.I | re.S,
        )
        changed = re.sub(
            r'(<p class=["\']overview["\']>).*?(</p>)',
            lambda m: m.group(1) + html.escape(overview) + m.group(2),
            changed, count=1, flags=re.I | re.S,
        )
        changed = re.sub(
            r'(<img\b[^>]*\balt=)["\'][^"\']*["\']',
            lambda m: m.group(1) + f'"{html.escape(ru, quote=True)}"',
            changed, count=1, flags=re.I,
        )

        ld = re.search(r'(<script type=["\']application/ld\+json["\']>)(.*?)(</script>)', changed, re.I | re.S)
        if ld:
            try:
                value = json.loads(html.unescape(ld.group(2)))
                if isinstance(value, dict):
                    value["name"] = ru
                    value["description"] = overview
                    value["genre"] = genres
                    original = original_title(item)
                    if norm(original) != norm(ru):
                        value["alternateName"] = original
                    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                    changed = changed[:ld.start(2)] + payload + changed[ld.end(2):]
            except Exception:
                stats["jsonld_errors"] += 1

        if changed != text:
            path.write_text(changed, encoding="utf-8")
            stats["static_pages_updated"] += 1


def validate(items: list[dict], stats: Counter):
    untranslated_titles = []
    untranslated_descriptions = []
    english_genres = []
    ids = Counter()

    for item in items:
        iid = stable_id(item)
        if iid:
            ids[iid] += 1

        title = current_title(item)
        if title and not has_cyr(title) and not numeric_only(title):
            untranslated_titles.append((iid, title))

        description = str(item.get("overview") or item.get("description") or "").strip()
        if description and has_lat(description) and not has_cyr(description):
            untranslated_descriptions.append((iid, description[:100]))

        for genre in localize_genres(item.get("genres")):
            if has_lat(genre):
                english_genres.append((iid, genre))

    duplicate_ids = [iid for iid, count in ids.items() if count > 1]

    stats["untranslated_titles_after"] = len(untranslated_titles)
    stats["untranslated_descriptions_after"] = len(untranslated_descriptions)
    stats["english_genres_after"] = len(english_genres)
    stats["duplicate_ids_after"] = len(duplicate_ids)

    controls = {}
    by_id = item_alias_map(items)
    for iid in ("mal_6372", "mal_4814", "mal_1002", "mal_35082", "mal_10049"):
        item = by_id.get(iid)
        controls[iid] = {
            "title": current_title(item or {}),
            "pass": bool(item and has_cyr(current_title(item))),
        }

    return {
        "untranslatedTitleExamples": untranslated_titles[:100],
        "untranslatedDescriptionExamples": untranslated_descriptions[:30],
        "englishGenreExamples": english_genres[:30],
        "duplicateIdExamples": duplicate_ids[:100],
        "controls": controls,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    stats = Counter()
    official = load_official_cache()
    all_items = collect_all_items()
    refresh_shikimori_cache(all_items, official, stats, args.offline)
    write_json(OFFICIAL_CACHE_OUT, {"version": "V3453", "items": official})

    translator = RussianTranslator(stats, offline=args.offline)
    translator.install()

    primary, chunk_size = load_primary()
    stats["primary_before"] = len(primary)
    localized = [
        apply_localization(item, official, translator, stats)
        for item in primary
    ]
    localized = conservative_dedupe(localized, stats)
    stats["primary_after"] = len(localized)

    write_primary(localized, chunk_size)
    rebuild_search(localized)

    for path in (
        ROOT / "data" / "games_catalog.json",
        ROOT / "data" / "books_catalog.json",
        ROOT / "anime-tv" / "anime_data.json",
    ):
        if path.exists():
            update_catalog_file(path, official, translator, stats)

    by_id = item_alias_map(localized)
    update_derived_json(by_id)
    update_wall_base(ROOT / "data" / "fast" / "poster_wall_v333", by_id, stats)
    update_wall_base(ROOT / "film" / "data" / "fast" / "poster_wall_v333", by_id, stats)
    update_static_pages(by_id, stats)
    translator.save()

    validation = validate(localized, stats)
    report = {
        "version": "V3453",
        "stats": dict(stats),
        **validation,
    }
    write_json(REPORT, report)

    failures = []
    if stats["untranslated_titles_after"] > 0:
        failures.append(f"untranslated titles: {stats['untranslated_titles_after']}")
    if stats["untranslated_descriptions_after"] > 0:
        failures.append(f"untranslated descriptions: {stats['untranslated_descriptions_after']}")
    if stats["english_genres_after"] > 0:
        failures.append(f"English genres: {stats['english_genres_after']}")
    if stats["duplicate_ids_after"] > 0:
        failures.append(f"duplicate IDs: {stats['duplicate_ids_after']}")
    if not all(value["pass"] for value in validation["controls"].values()):
        failures.append("control anime titles are not Russian")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit("; ".join(failures))


if __name__ == "__main__":
    main()
