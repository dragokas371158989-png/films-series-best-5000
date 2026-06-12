import json
import os
import re
import shutil
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")
FAST_DIR = DATA_DIR / "fast"
FAST_TMP_DIR = DATA_DIR / "fast_tmp_build"
INDEX_PATH = DATA_DIR / "index.json"

PAGE_SIZE = int(os.environ.get("GKM_FAST_PAGE_SIZE", "60"))
HOME_LIMIT = int(os.environ.get("GKM_FAST_HOME_LIMIT", "18"))

def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"SKIP unreadable {path}: {e}")
        return None

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()

def norm(value):
    return re.sub(r"[^\wа-яА-ЯёЁ]+", " ", str(value or "").lower().replace("ё", "е")).strip()

def extract_items(data):
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]

    if isinstance(data, dict):
        for key in ("movies", "items", "data", "results", "records", "list"):
            value = data.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]

    return []

def chunk_candidates(entry):
    raw = ""

    if isinstance(entry, str):
        raw = entry
    elif isinstance(entry, dict):
        raw = entry.get("file") or entry.get("path") or entry.get("url") or entry.get("src") or entry.get("name") or ""

    raw = str(raw or "").strip().replace("\\", "/").lstrip("/")
    if not raw:
        return []

    name = Path(raw).name
    candidates = []

    def add(p):
        if p not in candidates:
            candidates.append(p)

    if raw.startswith("data/"):
        add(Path(raw))
    else:
        add(DATA_DIR / raw)

    if raw.startswith("chunks/"):
        add(DATA_DIR / raw)

    if re.match(r"chunk_\d+\.json$", name, re.I):
        add(DATA_DIR / name)              # реальная структура пользователя: data/chunk_001.json
        add(DATA_DIR / "chunks" / name)   # запасной вариант

    return candidates

def find_chunk_files():
    index = load_json(INDEX_PATH)
    result = []

    if isinstance(index, dict) and isinstance(index.get("chunks"), list):
        for entry in index["chunks"]:
            chosen = None
            for p in chunk_candidates(entry):
                if p.exists():
                    chosen = p
                    break

            if chosen:
                result.append(chosen)
            else:
                print("MISSING chunk:", entry, "tried:", [str(x) for x in chunk_candidates(entry)])

    # fallback scan
    if not result:
        print("No chunks from index. Scanning data/chunk_*.json and data/chunks/chunk_*.json")
        for pattern in ("chunk_*.json", "chunks/chunk_*.json"):
            for p in DATA_DIR.glob(pattern):
                if p.is_file():
                    result.append(p)

    # dedupe, sorted by chunk number if possible
    seen = set()
    unique = []
    for p in result:
        s = str(p)
        if s not in seen:
            seen.add(s)
            unique.append(p)

    def sort_key(p):
        m = re.search(r"chunk_(\d+)\.json$", p.name, re.I)
        return int(m.group(1)) if m else 999999

    return sorted(unique, key=sort_key)

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
    return title

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
    source = norm(item.get("source") or item.get("provider") or "")
    genres_text = " ".join(norm(g) for g in genres_of(item))
    text = " ".join([low, source, genres_text, norm(title_of(item)), norm(en_of(item))])

    if "аниме" in text or "anime" in text or "jikan" in source or "myanimelist" in source:
        return "Аниме"
    if "мульт" in text or low in {"animation", "cartoon"}:
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
        "backdrop": clean_text(raw.get("backdrop") or ""),
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
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    year = int(item.get("year") or 0)

    # рейтинги 10.0 с 2 голосами не должны лезть наверх
    if votes < 30:
        return rating - 20

    return rating * 10 + min(votes, 50000) / 50000 * 4 + (0.4 if year >= 2010 else 0)

def quality(item):
    return (
        int(item.get("votes") or 0) * 100
        + float(item.get("rating") or 0) * 1000
        + (10000 if item.get("poster") else 0)
        + len(item.get("overview") or "")
    )

def collect_items():
    chunks = find_chunk_files()
    print(f"Resolved chunks: {len(chunks)}")

    raw_items = []

    for p in chunks:
        data = load_json(p)
        items = extract_items(data)
        print(f"{p}: {len(items)}")
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

        # Не склеиваем разные сезоны/части, если в названии есть сезон/season/part
        key = item["type"] + "|" + title_key

        old = best.get(key)
        if old is None or quality(item) > quality(old):
            best[key] = item

    print(f"Skipped without title: {skipped}")
    return list(best.values())

def write_pages(base_dir, tab_name, items):
    pages_dir = base_dir / "pages" / tab_name
    pages_dir.mkdir(parents=True, exist_ok=True)

    pages = max(1, (len(items) + PAGE_SIZE - 1) // PAGE_SIZE)

    for page in range(1, pages + 1):
        part = items[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
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
    raw_items = collect_items()
    print(f"Raw items: {len(raw_items)}")

    items = dedupe(raw_items)
    print(f"After dedupe: {len(items)}")

    if len(items) <= 0:
        raise SystemExit("ERROR: 0 items. Refusing to overwrite existing data/fast.")

    if FAST_TMP_DIR.exists():
        shutil.rmtree(FAST_TMP_DIR)
    FAST_TMP_DIR.mkdir(parents=True, exist_ok=True)

    genres = sorted({g for item in items for g in item.get("genres", [])}, key=lambda x: x.lower())
    years = sorted({item.get("year") for item in items if item.get("year")}, reverse=True)

    by_smart = lambda seq: sorted(seq, key=score, reverse=True)

    all_sorted = by_smart(items)
    movies = by_smart([x for x in items if x["type"] == "Фильм"])
    series = by_smart([x for x in items if x["type"] == "Сериал"])
    anime = by_smart([x for x in items if x["type"] == "Аниме"])
    cartoons = by_smart([x for x in items if x["type"] == "Мультфильм"])
    new_items = sorted(
        [x for x in items if int(x.get("year") or 0) >= 2024],
        key=lambda x: (int(x.get("year") or 0), score(x)),
        reverse=True,
    )
    popular = sorted(
        [x for x in items if int(x.get("votes") or 0) >= 1000],
        key=lambda x: int(x.get("votes") or 0),
        reverse=True,
    )
    top = by_smart([x for x in items if int(x.get("votes") or 0) >= 300 and float(x.get("rating") or 0) >= 7])

    pages = {
        "all": write_pages(FAST_TMP_DIR, "all", all_sorted),
        "movies": write_pages(FAST_TMP_DIR, "movies", movies),
        "series": write_pages(FAST_TMP_DIR, "series", series),
        "anime": write_pages(FAST_TMP_DIR, "anime", anime),
        "cartoons": write_pages(FAST_TMP_DIR, "cartoons", cartoons),
        "new": write_pages(FAST_TMP_DIR, "new", new_items),
        "popular": write_pages(FAST_TMP_DIR, "popular", popular),
        "top": write_pages(FAST_TMP_DIR, "top", top[:250]),
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
        },
    }

    # лёгкий поисковый индекс, чтобы не плодить файл 55+ MB
    search_index = []
    for x in all_sorted:
        search_index.append({
            "id": x.get("id"),
            "ru": x.get("ru"),
            "en": x.get("en"),
            "year": x.get("year"),
            "type": x.get("type"),
            "rating": x.get("rating"),
            "votes": x.get("votes"),
            "poster": x.get("poster"),
            "genres": x.get("genres", [])[:6],
            "overview": (x.get("overview") or "")[:180],
            "source": x.get("source"),
        })

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

    save_json(FAST_TMP_DIR / "home.json", home)
    save_json(FAST_TMP_DIR / "search_index.json", search_index)
    save_json(FAST_TMP_DIR / "meta.json", meta)

    if FAST_DIR.exists():
        shutil.rmtree(FAST_DIR)
    FAST_TMP_DIR.rename(FAST_DIR)

    print("FAST DATA READY")
    print(f"rawCount={len(raw_items)}")
    print(f"count={len(items)}")
    print(f"pages_all={pages['all']['pages']}")

if __name__ == "__main__":
    main()
