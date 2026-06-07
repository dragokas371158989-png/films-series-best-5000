import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("movies_updates.json")

TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TARGET_COUNT = int(os.environ.get("TARGET_COUNT", "25000"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty. Add it in GitHub: Settings -> Secrets and variables -> Actions.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "MovieCatalogTV GitHub updater 25000",
    "Accept": "application/json",
}

BASE = "https://api.themoviedb.org/3/"
IMG_W342 = "https://image.tmdb.org/t/p/w342"
IMG_W780 = "https://image.tmdb.org/t/p/w780"

GENRE_MAP_MOVIE = {}
GENRE_MAP_TV = {}

def get_json(path, params=None, retries=4):
    params = dict(params or {})
    params.setdefault("language", "ru-RU")
    url = BASE + path + "?" + urllib.parse.urlencode(params)

    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=50) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(1.2 + attempt * 1.8)
    raise last_err

def load_genres():
    global GENRE_MAP_MOVIE, GENRE_MAP_TV
    try:
        gm = get_json("genre/movie/list").get("genres", [])
        gt = get_json("genre/tv/list").get("genres", [])
        GENRE_MAP_MOVIE = {g["id"]: g["name"] for g in gm}
        GENRE_MAP_TV = {g["id"]: g["name"] for g in gt}
    except Exception as e:
        print("Genre load failed:", e)

def poster(path):
    return IMG_W342 + path if path else ""

def backdrop(path):
    return IMG_W780 + path if path else ""

def movie_item(x):
    title_ru = x.get("title") or x.get("name") or ""
    title_en = x.get("original_title") or x.get("original_name") or title_ru
    year = (x.get("release_date") or x.get("first_air_date") or "")[:4]
    genres = [GENRE_MAP_MOVIE.get(gid, str(gid)) for gid in x.get("genre_ids", [])]

    return {
        "id": str(x.get("id")),
        "tmdb_id": x.get("id"),
        "type": "Фильм",
        "ru": title_ru,
        "en": title_en,
        "year": int(year) if year.isdigit() else None,
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres,
        "overview": x.get("overview") or "",
        "poster": poster(x.get("poster_path")),
        "backdrop": backdrop(x.get("backdrop_path")),
        "adult": bool(x.get("adult")),
        "source": "tmdb",
    }

def tv_item(x):
    title_ru = x.get("name") or x.get("title") or ""
    title_en = x.get("original_name") or x.get("original_title") or title_ru
    year = (x.get("first_air_date") or x.get("release_date") or "")[:4]
    genres = [GENRE_MAP_TV.get(gid, str(gid)) for gid in x.get("genre_ids", [])]

    return {
        "id": "tv_" + str(x.get("id")),
        "tmdb_id": x.get("id"),
        "type": "Сериал",
        "ru": title_ru,
        "en": title_en,
        "year": int(year) if year.isdigit() else None,
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres,
        "overview": x.get("overview") or "",
        "poster": poster(x.get("poster_path")),
        "backdrop": backdrop(x.get("backdrop_path")),
        "adult": False,
        "source": "tmdb",
    }

def anime_mark(item):
    item["category"] = "Аниме"
    if "Аниме" not in item["genres"]:
        item["genres"].append("Аниме")
    return item

def collect_movie_discover(params, max_pages=500, limit=None, label="movies"):
    result = []
    seen = set()
    for page in range(1, max_pages + 1):
        if limit and len(result) >= limit:
            break
        try:
            data = get_json("discover/movie", {**params, "page": page})
        except Exception as e:
            print(label, "page", page, "failed:", e)
            break

        rows = data.get("results", [])
        if not rows:
            break

        for x in rows:
            item = movie_item(x)
            if not item["id"] or item["id"] in seen:
                continue
            if not item["poster"]:
                continue
            if item["adult"]:
                continue
            seen.add(item["id"])
            result.append(item)

        if page % 20 == 0:
            print(label, "page", page, "items", len(result))

        total_pages = min(int(data.get("total_pages") or 1), max_pages)
        if page >= total_pages:
            break
        time.sleep(0.12)
    return result

def collect_tv_discover(params, max_pages=500, limit=None, label="tv"):
    result = []
    seen = set()
    for page in range(1, max_pages + 1):
        if limit and len(result) >= limit:
            break
        try:
            data = get_json("discover/tv", {**params, "page": page})
        except Exception as e:
            print(label, "page", page, "failed:", e)
            break

        rows = data.get("results", [])
        if not rows:
            break

        for x in rows:
            item = tv_item(x)
            if not item["id"] or item["id"] in seen:
                continue
            if not item["poster"]:
                continue
            seen.add(item["id"])
            result.append(item)

        if page % 20 == 0:
            print(label, "page", page, "items", len(result))

        total_pages = min(int(data.get("total_pages") or 1), max_pages)
        if page >= total_pages:
            break
        time.sleep(0.12)
    return result

def dedupe(items):
    seen = set()
    out = []
    for item in items:
        key = item["id"]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out

def score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    pop = float(item.get("popularity") or 0)
    year = item.get("year") or 0

    # Убираем мусор: высокий рейтинг без голосов не должен быть в топе
    votes_score = min(6, votes / 3000)
    pop_score = min(4, pop / 80)
    fresh_score = 0.3 if year and year >= 2020 else 0
    penalty = 0
    if votes < 30:
        penalty += 5
    elif votes < 100:
        penalty += 2
    return rating * 2 + votes_score + pop_score + fresh_score - penalty

def main():
    load_genres()

    print("Collecting movies...")
    movies_top = collect_movie_discover({
        "sort_by": "vote_count.desc",
        "vote_count.gte": 100,
        "include_adult": "false",
    }, limit=9000, label="movies_top")

    movies_popular = collect_movie_discover({
        "sort_by": "popularity.desc",
        "vote_count.gte": 30,
        "include_adult": "false",
    }, limit=5000, label="movies_popular")

    print("Collecting TV series...")
    tv_top = collect_tv_discover({
        "sort_by": "vote_count.desc",
        "vote_count.gte": 80,
    }, limit=7000, label="tv_top")

    tv_popular = collect_tv_discover({
        "sort_by": "popularity.desc",
        "vote_count.gte": 25,
    }, limit=4000, label="tv_popular")

    print("Collecting anime movies...")
    anime_movies = collect_movie_discover({
        "sort_by": "popularity.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": 10,
        "include_adult": "false",
    }, limit=2500, label="anime_movies")
    anime_movies = [anime_mark(x) for x in anime_movies]

    print("Collecting anime series...")
    anime_tv = collect_tv_discover({
        "sort_by": "popularity.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": 10,
    }, limit=3500, label="anime_tv")
    anime_tv = [anime_mark(x) for x in anime_tv]

    print("Merging...")
    items = dedupe(movies_top + movies_popular + tv_top + tv_popular + anime_movies + anime_tv)
    items = [x for x in items if x.get("poster") and (x.get("rating") or 0) >= 0]
    items.sort(key=score, reverse=True)

    if len(items) > TARGET_COUNT:
        items = items[:TARGET_COUNT]

    data = {
        "version": 3,
        "target": TARGET_COUNT,
        "count": len(items),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "TMDB",
        "movies": items,
    }

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Saved", OUT, "items:", len(items))

if __name__ == "__main__":
    main()
