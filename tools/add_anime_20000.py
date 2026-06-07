import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("movies_updates.json")

TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TARGET_ANIME_ADD = int(os.environ.get("TARGET_ANIME_ADD", "20000"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty. Add it in GitHub: Settings -> Secrets and variables -> Actions.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "Anime 20000 updater",
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

def anime_movie_item(x):
    title_ru = x.get("title") or x.get("name") or ""
    title_en = x.get("original_title") or x.get("original_name") or title_ru
    year = (x.get("release_date") or x.get("first_air_date") or "")[:4]
    genres = [GENRE_MAP_MOVIE.get(gid, str(gid)) for gid in x.get("genre_ids", [])]
    if "Аниме" not in genres:
        genres.append("Аниме")
    return {
        "id": str(x.get("id")),
        "tmdb_id": x.get("id"),
        "media_type": "movie",
        "type": "Аниме",
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
        "category": "Аниме",
        "source": "tmdb",
    }

def anime_tv_item(x):
    title_ru = x.get("name") or x.get("title") or ""
    title_en = x.get("original_name") or x.get("original_title") or title_ru
    year = (x.get("first_air_date") or x.get("release_date") or "")[:4]
    genres = [GENRE_MAP_TV.get(gid, str(gid)) for gid in x.get("genre_ids", [])]
    if "Аниме" not in genres:
        genres.append("Аниме")
    return {
        "id": "tv_" + str(x.get("id")),
        "tmdb_id": x.get("id"),
        "media_type": "tv",
        "type": "Аниме",
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
        "category": "Аниме",
        "source": "tmdb",
    }

def is_anime_existing(item):
    hay = " ".join([
        str(item.get("type") or ""),
        str(item.get("category") or ""),
        str(item.get("ru") or ""),
        str(item.get("en") or ""),
        str(item.get("overview") or ""),
        " ".join(str(x) for x in item.get("genres", []) if x)
    ]).lower()
    return any(x in hay for x in ["аниме", "anime", "manga", "ova"])

def collect(kind, params, years=None, max_pages=500, limit=None, label="anime"):
    result = []
    seen = set()
    if years is None:
        years = [None]
    for year in years:
        for page in range(1, max_pages + 1):
            if limit and len(result) >= limit:
                return result
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
                print(label, year, "page", page, "failed:", e)
                break
            rows = data.get("results", [])
            if not rows:
                break
            for x in rows:
                item = anime_movie_item(x) if kind == "movie" else anime_tv_item(x)
                if not item["id"] or item["id"] in seen:
                    continue
                if not item["poster"]:
                    continue
                if item.get("adult"):
                    continue
                seen.add(item["id"])
                result.append(item)
            if page % 20 == 0:
                print(label, "year", year, "page", page, "items", len(result))
            total_pages = min(int(data.get("total_pages") or 1), max_pages)
            if page >= total_pages:
                break
            time.sleep(0.10)
    return result

def score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    pop = float(item.get("popularity") or 0)
    year = item.get("year") or 0
    votes_score = min(6, votes / 1500)
    pop_score = min(4, pop / 60)
    fresh_score = 0.5 if year and year >= 2020 else 0
    penalty = 0
    if votes < 5:
        penalty += 3
    elif votes < 20:
        penalty += 1
    return rating * 2 + votes_score + pop_score + fresh_score - penalty

def load_existing():
    if OUT.exists():
        data = json.loads(OUT.read_text(encoding="utf-8"))
        items = data.get("movies") or data.get("items") or []
        return data, items
    return {"version": 4, "movies": []}, []

def main():
    load_genres()
    data, existing = load_existing()
    before_count = len(existing)
    existing_anime = sum(1 for x in existing if is_anime_existing(x))
    print("Existing:", before_count, "anime:", existing_anime)

    # Помечаем уже найденное аниме как отдельный тип
    for x in existing:
        if is_anime_existing(x):
            x["type"] = "Аниме"
            x["category"] = "Аниме"
            genres = x.get("genres") or []
            if isinstance(genres, list) and "Аниме" not in genres:
                genres.append("Аниме")
                x["genres"] = genres

    years = list(range(2027, 1950, -1))

    anime = []
    print("Collect anime TV popularity by years...")
    anime += collect("tv", {
        "sort_by": "popularity.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": "0",
    }, years=years, max_pages=500, limit=TARGET_ANIME_ADD, label="anime_tv_pop")

    print("Collect anime movies popularity by years...")
    anime += collect("movie", {
        "sort_by": "popularity.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": "0",
        "include_adult": "false",
    }, years=years, max_pages=500, limit=TARGET_ANIME_ADD, label="anime_movie_pop")

    print("Collect anime TV rating...")
    anime += collect("tv", {
        "sort_by": "vote_average.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": "1",
    }, years=years, max_pages=500, limit=TARGET_ANIME_ADD, label="anime_tv_rating")

    print("Collect anime movies rating...")
    anime += collect("movie", {
        "sort_by": "vote_average.desc",
        "with_genres": "16",
        "with_original_language": "ja",
        "vote_count.gte": "1",
        "include_adult": "false",
    }, years=years, max_pages=500, limit=TARGET_ANIME_ADD, label="anime_movie_rating")

    # дедуп
    merged_by_id = {}
    for item in existing:
        merged_by_id[str(item.get("id"))] = item
    new_added = 0
    anime_sorted = sorted(anime, key=score, reverse=True)
    for item in anime_sorted:
        key = str(item.get("id"))
        if not key:
            continue
        if key not in merged_by_id:
            merged_by_id[key] = item
            new_added += 1
        else:
            # если уже был фильм/сериал, но это аниме, усиливаем метку
            merged_by_id[key]["type"] = "Аниме"
            merged_by_id[key]["category"] = "Аниме"
            genres = merged_by_id[key].get("genres") or []
            if isinstance(genres, list) and "Аниме" not in genres:
                genres.append("Аниме")
                merged_by_id[key]["genres"] = genres
        if new_added >= TARGET_ANIME_ADD:
            break

    items = list(merged_by_id.values())
    items.sort(key=score, reverse=True)

    data["version"] = 4
    data["generatedAt"] = datetime.now(timezone.utc).isoformat()
    data["count"] = len(items)
    data["animeAddedTarget"] = TARGET_ANIME_ADD
    data["animeExistingBefore"] = existing_anime
    data["animeNewAdded"] = new_added
    data["movies"] = items

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Before:", before_count)
    print("After:", len(items))
    print("New anime added:", new_added)
    print("Anime total now:", sum(1 for x in items if is_anime_existing(x)))

if __name__ == "__main__":
    main()
