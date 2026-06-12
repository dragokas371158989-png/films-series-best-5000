import json
import os
import re
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")
FAST_DIR = DATA_DIR / "fast"
INDEX_PATH = DATA_DIR / "index.json"
UPDATES_PATH = Path("movies_updates.json")

PAGE_SIZE = int(os.environ.get("GKM_FAST_PAGE_SIZE", "60"))
HOME_LIMIT = int(os.environ.get("GKM_FAST_HOME_LIMIT", "18"))

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
    "avatar": "Аватар",
    "deadpool": "Дэдпул",
    "joker": "Джокер",
    "naruto": "Наруто",
    "naruto shippuden": "Наруто: Ураганные хроники",
    "one piece": "Ван-Пис",
    "attack on titan": "Атака титанов",
    "demon slayer": "Истребитель демонов",
    "kimetsu no yaiba": "Истребитель демонов",
    "jujutsu kaisen": "Магическая битва",
    "death note": "Тетрадь смерти",
    "one punch man": "Ванпанчмен",
    "one-punch man": "Ванпанчмен",
}

def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Cannot read {path}: {e}")
        return default

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def extract_items(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("movies", "items", "data", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return value
    return []

def chunk_path(entry):
    if isinstance(entry, str):
        value = entry
    elif isinstance(entry, dict):
        value = entry.get("file") or entry.get("path") or entry.get("url") or entry.get("name") or ""
    else:
        return None

    value = str(value).strip().lstrip("/")
    if not value:
        return None
    if value.startswith("data/"):
        return Path(value)
    if value.startswith("chunks/"):
        return DATA_DIR / value
    return DATA_DIR / "chunks" / value if value.startswith("chunk_") else DATA_DIR / value

def iter_source_items():
    index = load_json(INDEX_PATH, {})
    chunks = []

    if isinstance(index, dict) and isinstance(index.get("chunks"), list):
        for entry in index["chunks"]:
            p = chunk_path(entry)
            if p and p.exists():
                chunks.append(p)

    if chunks:
        print(f"Reading chunks: {len(chunks)}")
        for p in chunks:
            data = load_json(p, [])
            for item in extract_items(data):
                if isinstance(item, dict):
                    yield item
        return

    print("No chunks found, reading fallback movies_updates.json")
    data = load_json(UPDATES_PATH, {})
    for item in extract_items(data):
        if isinstance(item, dict):
            yield item

def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()

def norm(value):
    return re.sub(r"[^\wа-яА-ЯёЁ]+", " ", str(value or "").lower().replace("ё", "е")).strip()

def title_of(item):
    title = clean_text(item.get("ru") or item.get("title") or item.get("name") or item.get("en") or "Без названия")
    n = norm(title)
    return RU_TITLE_MAP.get(n, title)

def en_of(item):
    return clean_text(item.get("en") or item.get("originalTitle") or item.get("titleOriginal") or item.get("nameOriginal") or "")

def year_of(item):
    text = clean_text(item.get("year") or item.get("release_date") or item.get("first_air_date") or "")
    m = re.search(r"(19\d{2}|20\d{2})", text)
    return m.group(1) if m else ""

def rating_of(item):
    try:
        return round(float(item.get("rating") or item.get("vote_average") or 0), 2)
    except Exception:
        return 0.0

def votes_of(item):
    try:
        return int(float(item.get("votes") or item.get("vote_count") or 0))
    except Exception:
        return 0

def genres_of(item):
    genres = item.get("genres") or item.get("genre") or []
    if isinstance(genres, str):
        genres = re.split(r"[,;/|·]+", genres)
    if not isinstance(genres, list):
        genres = []
    clean = []
    seen = set()
    for g in genres:
        g = clean_text(g)
        if not g:
            continue
        key = norm(g)
        if key not in seen:
            seen.add(key)
            clean.append(g)
    return clean[:12]

def type_of(item):
    t = clean_text(item.get("type") or item.get("kind") or "")
    low = norm(t)
    genres = " ".join(norm(g) for g in genres_of(item))
    source = norm(item.get("source") or item.get("provider") or item.get("category") or "")

    text = " ".join([
        low,
        source,
        norm(item.get("ru")),
        norm(item.get("en")),
        norm(item.get("title")),
        genres,
    ])

    if "аниме" in text or "anime" in text or "shikimori" in source or "myanimelist" in source:
        return "Аниме"
    if "мульт" in low or "мульт" in genres:
        return "Мультфильм"
    if "сериал" in low or low in {"tv", "series"}:
        return "Сериал"
    return "Фильм"

def poster_of(item):
    return clean_text(item.get("poster") or item.get("posterUrl") or item.get("image") or item.get("poster_path") or "")

def overview_of(item):
    for key in ("overview_ru", "ruOverview", "description_ru", "descriptionRu", "description", "overview", "synopsis"):
        value = clean_text(item.get(key))
        if value:
            return value
    return ""

def stable_id(item, fallback):
    for key in ("id", "uid", "tmdbId", "tmdb_id", "mal_id", "malId", "shikimori_id"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return "gkm_" + str(fallback)

def pick_extra(item):
    extra = {}
    keys = [
        "player", "playerUrl", "video", "videoUrl", "url", "src", "iframe", "rutube",
        "players", "videoLinks", "links", "episodes", "episodeCount", "status",
        "studio", "studios", "country", "countries", "ageRating", "age", "source",
        "tmdbId", "tmdb_id", "mal_id", "malId", "shikimori_id", "shikimoriId",
    ]
    for key in keys:
        if key in item and item[key] not in (None, "", [], {}):
            extra[key] = item[key]
    return extra

def smart_score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    year = int(item.get("year") or 0)

    if votes < 30:
        return rating

    vote_bonus = min(votes, 50000) / 50000 * 4
    year_bonus = 0.4 if year >= 2010 else 0
    return rating * 10 + vote_bonus + year_bonus

def quality(item):
    return int(item.get("votes") or 0) * 100 + float(item.get("rating") or 0) * 1000 + (1 if item.get("poster") else 0) * 10000 + len(item.get("overview") or "")

def card_item(item, fallback):
    out = {
        "id": stable_id(item, fallback),
        "ru": title_of(item),
        "en": en_of(item),
        "year": year_of(item),
        "type": type_of(item),
        "rating": rating_of(item),
        "votes": votes_of(item),
        "poster": poster_of(item),
        "genres": genres_of(item),
        "overview": overview_of(item),
    }
    out.update(pick_extra(item))
    out["source"] = clean_text(out.get("source") or item.get("provider") or "")
    out["episodes"] = out.get("episodes") or out.get("episodeCount") or ""
    out["studio"] = out.get("studio") or out.get("studios") or ""
    out["country"] = out.get("country") or out.get("countries") or ""
    out["ageRating"] = out.get("ageRating") or out.get("age") or ""
    return out

def dedupe(items):
    best = {}
    for i, raw in enumerate(items):
        item = card_item(raw, i)
        title_key = norm(item["ru"] or item["en"])
        if not title_key:
            continue

        key = item["type"] + "|" + title_key
        old = best.get(key)

        if old is None or quality(item) > quality(old):
            best[key] = item

    return list(best.values())

def write_pages(tab_name, items):
    pages_dir = FAST_DIR / "pages" / tab_name
    pages_dir.mkdir(parents=True, exist_ok=True)

    for old in pages_dir.glob("page_*.json"):
        old.unlink()

    pages = max(1, (len(items) + PAGE_SIZE - 1) // PAGE_SIZE)

    for page in range(1, pages + 1):
        start = (page - 1) * PAGE_SIZE
        part = items[start:start + PAGE_SIZE]
        save_json(
            pages_dir / f"page_{page:04d}.json",
            {
                "tab": tab_name,
                "page": page,
                "pages": pages,
                "count": len(items),
                "pageSize": PAGE_SIZE,
                "items": part,
            }
        )

    return {"count": len(items), "pages": pages, "pageSize": PAGE_SIZE}

def main():
    FAST_DIR.mkdir(parents=True, exist_ok=True)

    raw_items = list(iter_source_items())
    print(f"Raw items: {len(raw_items)}")

    items = dedupe(raw_items)
    print(f"After dedupe: {len(items)}")

    genres = sorted({g for item in items for g in item.get("genres", [])}, key=lambda x: x.lower())
    years = sorted({item.get("year") for item in items if item.get("year")}, reverse=True)

    def by_smart(seq):
        return sorted(seq, key=smart_score, reverse=True)

    all_sorted = by_smart(items)
    movies = by_smart([x for x in items if x["type"] == "Фильм"])
    series = by_smart([x for x in items if x["type"] == "Сериал"])
    anime = by_smart([x for x in items if x["type"] == "Аниме"])
    cartoons = by_smart([x for x in items if x["type"] == "Мультфильм"])
    new_items = sorted([x for x in items if int(x.get("year") or 0) >= 2024], key=lambda x: (int(x.get("year") or 0), smart_score(x)), reverse=True)
    popular = sorted([x for x in items if x["votes"] >= 1000], key=lambda x: x["votes"], reverse=True)
    top = by_smart([x for x in items if x["votes"] >= 300 and x["rating"] >= 7])

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
    print(f"Written: {FAST_DIR}")
    print(f"Count: {len(items)}")
    print(f"Pages all: {pages['all']['pages']}")

if __name__ == "__main__":
    main()
