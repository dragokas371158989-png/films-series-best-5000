import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TARGET_COUNT = int(os.environ.get("TARGET_COUNT", "100000"))
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1000"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty")

ROOT = Path(".")
DATA_DIR = ROOT / "data"
CHUNKS_DIR = DATA_DIR / "chunks"
INDEX_FILE = DATA_DIR / "index.json"

BASE = "https://api.themoviedb.org/3/"
IMG = "https://image.tmdb.org/t/p/w342"
IMG_BG = "https://image.tmdb.org/t/p/w780"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json", "User-Agent": "Chunked catalog builder"}

GENRE_MOVIE = {}
GENRE_TV = {}

def get_json(path, params=None, retries=4):
    params = dict(params or {})
    params.setdefault("language", "ru-RU")
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=50) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            err = e
            time.sleep(1.0 + i * 1.5)
    raise err

def load_genres():
    global GENRE_MOVIE, GENRE_TV
    try:
        GENRE_MOVIE = {g["id"]: g["name"] for g in get_json("genre/movie/list").get("genres", [])}
        GENRE_TV = {g["id"]: g["name"] for g in get_json("genre/tv/list").get("genres", [])}
    except Exception as e:
        print("genres failed", e)

def img(path):
    return IMG + path if path else ""

def bg(path):
    return IMG_BG + path if path else ""

def item_movie(x, anime=False):
    year = (x.get("release_date") or "")[:4]
    genres = [GENRE_MOVIE.get(g, str(g)) for g in x.get("genre_ids", [])]
    if anime and "Аниме" not in genres:
        genres.append("Аниме")
    return {
        "id": str(x.get("id")),
        "tmdb_id": x.get("id"),
        "media_type": "movie",
        "type": "Аниме" if anime else "Фильм",
        "category": "Аниме" if anime else "",
        "ru": x.get("title") or "",
        "en": x.get("original_title") or x.get("title") or "",
        "year": int(year) if year.isdigit() else None,
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres,
        "overview": x.get("overview") or "",
        "poster": img(x.get("poster_path")),
        "backdrop": bg(x.get("backdrop_path")),
        "adult": bool(x.get("adult")),
        "source": "tmdb",
    }

def item_tv(x, anime=False):
    year = (x.get("first_air_date") or "")[:4]
    genres = [GENRE_TV.get(g, str(g)) for g in x.get("genre_ids", [])]
    if anime and "Аниме" not in genres:
        genres.append("Аниме")
    return {
        "id": "tv_" + str(x.get("id")),
        "tmdb_id": x.get("id"),
        "media_type": "tv",
        "type": "Аниме" if anime else "Сериал",
        "category": "Аниме" if anime else "",
        "ru": x.get("name") or "",
        "en": x.get("original_name") or x.get("name") or "",
        "year": int(year) if year.isdigit() else None,
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres,
        "overview": x.get("overview") or "",
        "poster": img(x.get("poster_path")),
        "backdrop": bg(x.get("backdrop_path")),
        "adult": False,
        "source": "tmdb",
    }

def collect_discover(kind, params, years=None, max_pages=500, limit=None, anime=False, label=""):
    out = []
    years = years or [None]
    for year in years:
        for page in range(1, max_pages + 1):
            if limit and len(out) >= limit:
                return out
            p = dict(params)
            p["page"] = page
            if year:
                if kind == "movie":
                    p["primary_release_year"] = year
                else:
                    p["first_air_date_year"] = year
            try:
                data = get_json("discover/movie" if kind == "movie" else "discover/tv", p)
            except Exception as e:
                print(label, year, page, "failed", e)
                break
            rows = data.get("results", [])
            if not rows:
                break
            for x in rows:
                it = item_movie(x, anime=anime) if kind == "movie" else item_tv(x, anime=anime)
                if not it["id"] or not it["poster"] or it.get("adult"):
                    continue
                out.append(it)
            if page % 50 == 0:
                print(label, "year", year, "page", page, "items", len(out))
            total_pages = min(int(data.get("total_pages") or 1), max_pages)
            if page >= total_pages:
                break
            time.sleep(0.06)
    return out

def score(x):
    rating = float(x.get("rating") or 0)
    votes = int(x.get("votes") or 0)
    pop = float(x.get("popularity") or 0)
    year = x.get("year") or 0
    penalty = 3 if votes < 5 else 1 if votes < 20 else 0
    return rating * 2 + min(6, votes / 2000) + min(4, pop / 80) + (0.4 if year and year >= 2020 else 0) - penalty

def dedupe(items):
    by_id = {}
    for it in items:
        key = str(it.get("id"))
        if key not in by_id:
            by_id[key] = it
        else:
            if score(it) > score(by_id[key]):
                by_id[key] = it
    return list(by_id.values())

def compact(it, chunk_name):
    return {
        "id": it.get("id"),
        "chunk": chunk_name,
        "ru": it.get("ru"),
        "en": it.get("en"),
        "type": it.get("type"),
        "category": it.get("category"),
        "year": it.get("year"),
        "rating": it.get("rating"),
        "votes": it.get("votes"),
        "genres": it.get("genres") or [],
        "poster": it.get("poster"),
    }

def main():
    load_genres()
    years = list(range(2027, 1940, -1))
    items = []

    print("Collect movies popular")
    items += collect_discover("movie", {"sort_by":"popularity.desc","vote_count.gte":"0","include_adult":"false"}, years=years, limit=35000, label="movie_pop")
    print("Collect movies votes")
    items += collect_discover("movie", {"sort_by":"vote_count.desc","vote_count.gte":"0","include_adult":"false"}, years=years, limit=35000, label="movie_votes")
    print("Collect tv popular")
    items += collect_discover("tv", {"sort_by":"popularity.desc","vote_count.gte":"0"}, years=years, limit=30000, label="tv_pop")
    print("Collect tv votes")
    items += collect_discover("tv", {"sort_by":"vote_count.desc","vote_count.gte":"0"}, years=years, limit=30000, label="tv_votes")
    print("Collect anime tv")
    items += collect_discover("tv", {"sort_by":"popularity.desc","with_genres":"16","with_original_language":"ja","vote_count.gte":"0"}, years=years, limit=25000, anime=True, label="anime_tv")
    print("Collect anime movies")
    items += collect_discover("movie", {"sort_by":"popularity.desc","with_genres":"16","with_original_language":"ja","vote_count.gte":"0","include_adult":"false"}, years=years, limit=20000, anime=True, label="anime_movie")

    items = dedupe(items)
    items = [x for x in items if x.get("poster")]
    items.sort(key=score, reverse=True)
    if len(items) > TARGET_COUNT:
        items = items[:TARGET_COUNT]

    DATA_DIR.mkdir(exist_ok=True)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

    for old in CHUNKS_DIR.glob("chunk_*.json"):
        old.unlink()

    index_items = []
    chunk_count = 0
    for i in range(0, len(items), CHUNK_SIZE):
        chunk_count += 1
        chunk_name = f"chunk_{chunk_count:04d}"
        chunk_items = items[i:i+CHUNK_SIZE]
        (CHUNKS_DIR / f"{chunk_name}.json").write_text(json.dumps({
            "chunk": chunk_name,
            "count": len(chunk_items),
            "items": chunk_items
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        for it in chunk_items:
            index_items.append(compact(it, chunk_name))

    INDEX_FILE.write_text(json.dumps({
        "version": 5,
        "target": TARGET_COUNT,
        "count": len(index_items),
        "chunks": chunk_count,
        "chunkSize": CHUNK_SIZE,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": index_items
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print("Saved items:", len(index_items), "chunks:", chunk_count)

if __name__ == "__main__":
    main()
