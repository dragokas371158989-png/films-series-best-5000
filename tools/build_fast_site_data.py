import json
import os
import re
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")
FAST_DIR = DATA_DIR / "fast"
PAGE_SIZE = int(os.environ.get("GKM_FAST_PAGE_SIZE", "60"))
HOME_LIMIT = int(os.environ.get("GKM_FAST_HOME_LIMIT", "18"))

BAD_DIR_PARTS = {"fast", ".git", "node_modules"}
BAD_FILE_NAMES = {"meta.json", "home.json", "search_index.json"}

def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"SKIP unreadable {path}: {e}")
        return None

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def looks_like_media_item(obj):
    if not isinstance(obj, dict):
        return False

    title_keys = ("ru", "title", "name", "nameRu", "nameEn", "en", "originalTitle", "titleOriginal", "nameOriginal")
    has_title = any(str(obj.get(k) or "").strip() for k in title_keys)

    media_keys = (
        "poster", "posterUrl", "poster_path", "image", "imageUrl",
        "rating", "vote_average", "votes", "vote_count",
        "genres", "genre", "year", "release_date",
        "description", "overview", "synopsis",
        "type", "kind", "source", "provider",
        "tmdbId", "kinopoiskId", "filmId", "mal_id",
    )
    has_media_field = any(k in obj for k in media_keys)

    return has_title and has_media_field

def extract_media_items(data, depth=0):
    if depth > 8:
        return []

    found = []

    if isinstance(data, list):
        if data and sum(1 for x in data[:30] if looks_like_media_item(x)) >= 1:
            for x in data:
                if looks_like_media_item(x):
                    found.append(x)
            return found

        for x in data:
            found.extend(extract_media_items(x, depth + 1))
        return found

    if isinstance(data, dict):
        if looks_like_media_item(data):
            return [data]

        # Сначала стандартные ключи
        for key in ("movies", "items", "data", "results", "records", "list", "titles"):
            value = data.get(key)
            if isinstance(value, list):
                found.extend(extract_media_items(value, depth + 1))

        # Потом общий обход
        if not found:
            for value in data.values():
                if isinstance(value, (list, dict)):
                    found.extend(extract_media_items(value, depth + 1))

    return found

def iter_json_files():
    files = []

    # Самое важное — чанки
    for pattern in ("chunks/*.json", "chunk_*.json", "**/chunk_*.json", "movies_updates.json", "*.json", "**/*.json"):
        root = DATA_DIR if pattern != "movies_updates.json" else Path(".")
        for p in root.glob(pattern):
            if not p.is_file():
                continue
            if any(part in BAD_DIR_PARTS for part in p.parts):
                continue
            if p.name in BAD_FILE_NAMES:
                continue
            files.append(p)

    # Дедуп путей, сохраняя порядок
    seen = set()
    result = []
    for p in files:
        key = str(p)
        if key not in seen:
            seen.add(key)
            result.append(p)
    return result

def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()

def norm(value):
    return re.sub(r"[^\wа-яА-ЯёЁ]+", " ", str(value or "").lower().replace("ё", "е")).strip()

RU_TITLE_MAP = {
    "interstellar": "Интерстеллар",
    "inception": "Начало",
    "the dark knight": "Тёмный рыцарь",
    "fight club": "Бойцовский клуб",
    "the shawshank redemption": "Побег из Шоушенка",
    "forrest gump": "Форрест Гамп",
    "the godfather": "Крёстный отец",
    "pulp fiction": "Криминальное чтиво",
    "the matrix": "Матрица",
    "naruto": "Наруто",
    "one piece": "Ван-Пис",
    "attack on titan": "Атака титанов",
    "death note": "Тетрадь смерти",
}

def title_of(item):
    title = clean_text(
        item.get("ru")
        or item.get("title")
        or item.get("name")
        or item.get("nameRu")
        or item.get("nameEn")
        or item.get("en")
        or item.get("originalTitle")
        or item.get("titleOriginal")
        or item.get("nameOriginal")
        or ""
    )
    if not title:
        return ""
    return RU_TITLE_MAP.get(norm(title), title)

def en_of(item):
    return clean_text(item.get("en") or item.get("nameEn") or item.get("originalTitle") or item.get("titleOriginal") or item.get("nameOriginal") or "")

def year_of(item):
    text = clean_text(item.get("year") or item.get("release_date") or item.get("first_air_date") or item.get("premiereRu") or item.get("premiereWorld") or "")
    m = re.search(r"(19\d{2}|20\d{2})", text)
    return m.group(1) if m else ""

def rating_of(item):
    for key in ("rating", "vote_average", "ratingKinopoisk", "ratingImdb", "score"):
        try:
            value = item.get(key)
            if value not in (None, ""):
                return round(float(value), 2)
        except Exception:
            pass
    return 0.0

def votes_of(item):
    for key in ("votes", "vote_count", "ratingVoteCount", "kinopoiskVotes", "imdbVotes"):
        try:
            value = item.get(key)
            if value not in (None, ""):
                return int(float(value))
        except Exception:
            pass
    return 0

def genres_of(item):
    genres = item.get("genres") or item.get("genre") or item.get("genresRu") or []
    if isinstance(genres, list):
        out = []
        for g in genres:
            if isinstance(g, dict):
                out.append(g.get("genre") or g.get("name") or g.get("title") or "")
            else:
                out.append(g)
        genres = out
    elif isinstance(genres, str):
        genres = re.split(r"[,;/|·]+", genres)
    else:
        genres = []

    clean = []
    seen = set()
    for g in genres:
        g = clean_text(g)
        if not g:
            continue
        k = norm(g)
        if k not in seen:
            seen.add(k)
            clean.append(g)
    return clean[:12]

def type_of(item):
    t = clean_text(item.get("type") or item.get("kind") or item.get("category") or "")
    low = norm(t)
    genres_text = " ".join(norm(g) for g in genres_of(item))
    source = norm(item.get("source") or item.get("provider") or item.get("category") or "")
    text = " ".join([low, genres_text, source, norm(title_of(item)), norm(en_of(item))])

    if "аниме" in text or "anime" in text or "jikan" in source or "myanimelist" in source:
        return "Аниме"
    if "мульт" in text or "animation" == low or "cartoon" == low:
        return "Мультфильм"
    if "сериал" in text or low in {"tv", "series", "tv series"}:
        return "Сериал"
    return "Фильм"

def poster_of(item):
    return clean_text(item.get("poster") or item.get("posterUrl") or item.get("poster_url") or item.get("image") or item.get("imageUrl") or item.get("poster_path") or item.get("cover") or "")

def overview_of(item):
    for key in ("overview_ru", "ruOverview", "description_ru", "descriptionRu", "description", "overview", "synopsis", "shortDescription"):
        value = clean_text(item.get(key))
        if value:
            return value
    return ""

def stable_id(item, fallback):
    for key in ("id", "uid", "tmdbId", "tmdb_id", "kinopoiskId", "filmId", "mal_id", "malId", "shikimori_id"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return "gkm_" + str(fallback)

def pick_extra(item):
    extra = {}
    keys = [
        "player", "playerUrl", "video", "videoUrl", "url", "src", "iframe", "rutube",
        "watchUrl", "watch", "trailer", "trailerUrl", "players", "videoLinks", "links", "sources",
        "episodes", "episodeCount", "status", "studio", "studios", "country", "countries",
        "ageRating", "age", "source", "tmdbId", "tmdb_id", "kinopoiskId", "filmId",
        "mal_id", "malId", "shikimori_id", "shikimoriId",
    ]
    for key in keys:
        if key in item and item[key] not in (None, "", [], {}):
            extra[key] = item[key]
    return extra

def card_item(raw, i):
    item = {
        "id": stable_id(raw, i),
        "ru": title_of(raw),
        "en": en_of(raw),
        "year": year_of(raw),
        "type": type_of(raw),
        "rating": rating_of(raw),
        "votes": votes_of(raw),
        "poster": poster_of(raw),
        "genres": genres_of(raw),
        "overview": overview_of(raw),
    }
    item.update(pick_extra(raw))
    item["source"] = clean_text(item.get("source") or raw.get("provider") or "")
    item["episodes"] = item.get("episodes") or item.get("episodeCount") or ""
    item["studio"] = item.get("studio") or item.get("studios") or ""
    item["country"] = item.get("country") or item.get("countries") or ""
    item["ageRating"] = item.get("ageRating") or item.get("age") or ""
    return item

def score(item):
    r = float(item.get("rating") or 0)
    v = int(item.get("votes") or 0)
    y = int(item.get("year") or 0)
    return r * 10 + min(v, 50000) / 50000 * 4 + (0.4 if y >= 2010 else 0)

def quality(item):
    return int(item.get("votes") or 0) * 100 + float(item.get("rating") or 0) * 1000 + (10000 if item.get("poster") else 0) + len(item.get("overview") or "")

def collect_raw_items():
    raw_items = []
    files = iter_json_files()
    print(f"JSON files scanned: {len(files)}")

    for p in files:
        data = read_json(p)
        if data is None:
            continue
        items = extract_media_items(data)
        if items:
            print(f"FOUND {len(items)} items in {p}")
            raw_items.extend(items)

    return raw_items

def dedupe(raw_items):
    best = {}
    skipped = 0

    for i, raw in enumerate(raw_items):
        item = card_item(raw, i)
        title_key = norm(item.get("ru") or item.get("en"))
        if not title_key:
            skipped += 1
            continue

        key = item["type"] + "|" + title_key
        old = best.get(key)
        if old is None or quality(item) > quality(old):
            best[key] = item

    print(f"Skipped no-title: {skipped}")
    return list(best.values())

def write_pages(tab_name, items):
    pages_dir = FAST_DIR / "pages" / tab_name
    pages_dir.mkdir(parents=True, exist_ok=True)
    for old in pages_dir.glob("page_*.json"):
        old.unlink()

    pages = max(1, (len(items) + PAGE_SIZE - 1) // PAGE_SIZE)
    for page in range(1, pages + 1):
        part = items[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
        save_json(pages_dir / f"page_{page:04d}.json", {
            "tab": tab_name,
            "page": page,
            "pages": pages,
            "count": len(items),
            "pageSize": PAGE_SIZE,
            "items": part,
        })
    return {"count": len(items), "pages": pages, "pageSize": PAGE_SIZE}

def main():
    raw_items = collect_raw_items()
    print(f"Raw items: {len(raw_items)}")

    items = dedupe(raw_items)
    print(f"After dedupe: {len(items)}")

    if len(items) == 0:
        raise SystemExit("ERROR: 0 media items found. I refuse to overwrite data/fast with empty database.")

    FAST_DIR.mkdir(parents=True, exist_ok=True)

    genres = sorted({g for item in items for g in item.get("genres", [])}, key=lambda x: x.lower())
    years = sorted({item.get("year") for item in items if item.get("year")}, reverse=True)

    by_smart = lambda seq: sorted(seq, key=score, reverse=True)

    all_sorted = by_smart(items)
    movies = by_smart([x for x in items if x["type"] == "Фильм"])
    series = by_smart([x for x in items if x["type"] == "Сериал"])
    anime = by_smart([x for x in items if x["type"] == "Аниме"])
    cartoons = by_smart([x for x in items if x["type"] == "Мультфильм"])
    new_items = sorted([x for x in items if int(x.get("year") or 0) >= 2024], key=lambda x: (int(x.get("year") or 0), score(x)), reverse=True)
    popular = sorted([x for x in items if int(x.get("votes") or 0) >= 1000], key=lambda x: int(x.get("votes") or 0), reverse=True)
    top = by_smart([x for x in items if int(x.get("votes") or 0) >= 300 and float(x.get("rating") or 0) >= 7])

    pages = {
        "all": write_pages("all", all_sorted),
        "movies": write_pages("movies", movies),
        "series": write_pages("series", series),
        "anime": write_pages("anime", anime),
        "cartoons": write_pages("cartoons", cartoons),
        "new": write_pages("new", new_items),
        "popular": write_pages("popular", popular),
        "top": write_pages("top", top[:250]),
    }

    home = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "total": len(items),
        "sections": {
            "popular": popular[:HOME_LIMIT],
            "top": top[:HOME_LIMIT],
            "new": new_items[:HOME_LIMIT],
            "anime": anime[:HOME_LIMIT],
            "movies": movies[:HOME_LIMIT],
            "series": series[:HOME_LIMIT],
            "cartoons": cartoons[:HOME_LIMIT],
        }
    }

    search_index = []
    for x in all_sorted:
        y = dict(x)
        if len(str(y.get("overview") or "")) > 520:
            y["overview"] = y["overview"][:520]
        search_index.append(y)

    meta = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "rawCount": len(raw_items),
        "count": len(items),
        "pageSize": PAGE_SIZE,
        "homeLimit": HOME_LIMIT,
        "genres": genres,
        "years": years,
        "pages": pages,
    }

    save_json(FAST_DIR / "home.json", home)
    save_json(FAST_DIR / "search_index.json", search_index)
    save_json(FAST_DIR / "meta.json", meta)

    print("FAST DATA READY")
    print(f"Count: {len(items)}")
    print(f"Pages all: {pages['all']['pages']}")

if __name__ == "__main__":
    main()
