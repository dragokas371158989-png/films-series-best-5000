import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("movies_updates.json")

TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TARGET_COUNT = int(os.environ.get("TARGET_COUNT", "100000"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty. Add it in GitHub: Settings -> Secrets and variables -> Actions.")

BASE = "https://api.themoviedb.org/3/"
IMG_W342 = "https://image.tmdb.org/t/p/w342"
IMG_W780 = "https://image.tmdb.org/t/p/w780"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "Golub Catalog Mira GitHub updater",
    "Accept": "application/json",
}

GENRE_MAP_MOVIE = {}
GENRE_MAP_TV = {}

# Жанры TMDB, которые считаем аниме/мультфильмами
ANIMATION_GENRE_ID = 16

# Для 100к нельзя держать слишком жёсткий фильтр
MIN_VOTES = 0


def get_json(path, params=None, retries=4):
    params = dict(params or {})
    params.setdefault("language", "ru-RU")

    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)

    last_err = None

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(1.5 + attempt * 1.5)

    raise last_err


def load_genres():
    global GENRE_MAP_MOVIE, GENRE_MAP_TV

    try:
        movie = get_json("genre/movie/list", {})
        GENRE_MAP_MOVIE = {
            int(x["id"]): x["name"]
            for x in movie.get("genres", [])
            if x.get("id") and x.get("name")
        }
    except Exception as e:
        print("Movie genres failed:", e)
        GENRE_MAP_MOVIE = {}

    try:
        tv = get_json("genre/tv/list", {})
        GENRE_MAP_TV = {
            int(x["id"]): x["name"]
            for x in tv.get("genres", [])
            if x.get("id") and x.get("name")
        }
    except Exception as e:
        print("TV genres failed:", e)
        GENRE_MAP_TV = {}


def poster(path):
    return IMG_W342 + path if path else ""


def backdrop(path):
    return IMG_W780 + path if path else ""


def clean_text(s):
    return str(s or "").strip()


def movie_item(x):
    genre_ids = x.get("genre_ids") or []
    genres = [GENRE_MAP_MOVIE.get(int(g), "") for g in genre_ids if str(g).isdigit()]
    genres = [g for g in genres if g]

    title_ru = clean_text(x.get("title") or x.get("name"))
    title_en = clean_text(x.get("original_title") or x.get("original_name") or title_ru)

    date = clean_text(x.get("release_date") or x.get("first_air_date"))
    year = 0
    if len(date) >= 4 and date[:4].isdigit():
        year = int(date[:4])

    return {
        "id": int(x.get("id") or 0),
        "ru": title_ru,
        "en": title_en,
        "year": year,
        "type": "Фильм",
        "category": "Фильм",
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres,
        "overview": clean_text(x.get("overview")),
        "poster": poster(x.get("poster_path")),
        "backdrop": backdrop(x.get("backdrop_path")),
        "adult": bool(x.get("adult") or False),
        "source": "tmdb",
    }


def tv_item(x):
    genre_ids = x.get("genre_ids") or []
    genres = [GENRE_MAP_TV.get(int(g), "") for g in genre_ids if str(g).isdigit()]
    genres = [g for g in genres if g]

    title_ru = clean_text(x.get("name") or x.get("title"))
    title_en = clean_text(x.get("original_name") or x.get("original_title") or title_ru)

    date = clean_text(x.get("first_air_date") or x.get("release_date"))
    year = 0
    if len(date) >= 4 and date[:4].isdigit():
        year = int(date[:4])

    is_anime = ANIMATION_GENRE_ID in genre_ids

    return {
        "id": int(x.get("id") or 0),
        "ru": title_ru,
        "en": title_en,
        "year": year,
        "type": "Аниме" if is_anime else "Сериал",
        "category": "Аниме" if is_anime else "Сериал",
        "rating": round(float(x.get("vote_average") or 0), 1),
        "votes": int(x.get("vote_count") or 0),
        "popularity": round(float(x.get("popularity") or 0), 2),
        "genres": genres if not is_anime else list(dict.fromkeys(genres + ["Аниме"])),
        "overview": clean_text(x.get("overview")),
        "poster": poster(x.get("poster_path")),
        "backdrop": backdrop(x.get("backdrop_path")),
        "adult": False,
        "source": "tmdb",
    }


def anime_mark(item):
    item["type"] = "Аниме"
    item["category"] = "Аниме"
    if "Аниме" not in item["genres"]:
        item["genres"].append("Аниме")
    return item


def quality_score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    popularity = float(item.get("popularity") or 0)
    year = int(item.get("year") or 0)

    votes_score = min(8, votes / 1500)
    pop_score = min(5, popularity / 60)
    fresh_score = 0.5 if year >= 2020 else 0

    penalty = 0
    if votes < 1:
        penalty += 2
    elif votes < 20:
        penalty += 1

    return rating * 2 + votes_score + pop_score + fresh_score - penalty


def make_key(item):
    return "|".join(
        str(item.get(f) or "").lower().strip()
        for f in ("ru", "en", "year", "type")
    )


def collect_discover(media_type, params, max_pages=500, limit=None, label=""):
    result = []

    for page in range(1, max_pages + 1):
        if limit and len(result) >= limit:
            break

        try:
            data = get_json(f"discover/{media_type}", {**params, "page": page})
        except Exception as e:
            print(label, "page", page, "failed:", e)
            break

        rows = data.get("results", [])
        if not rows:
            break

        total_pages = int(data.get("total_pages") or 1)
        if total_pages > 500:
            total_pages = 500

        for x in rows:
            item = movie_item(x) if media_type == "movie" else tv_item(x)

            if not item["ru"] and not item["en"]:
                continue

            if not item["poster"]:
                continue

            if item.get("adult"):
                continue

            if int(item.get("votes") or 0) < MIN_VOTES:
                continue

            result.append(item)

        if page >= total_pages:
            break

        time.sleep(0.06)

    print(label, "collected:", len(result))
    return result


def add_many(storage, known_ids, known_titles, items):
    added = 0

    for item in items:
        if not item.get("id"):
            continue

        key_id = f'{item.get("type")}:{item.get("id")}'
        key_title = make_key(item)

        if key_id in known_ids or key_title in known_titles:
            continue

        storage.append(item)
        known_ids.add(key_id)
        known_titles.add(key_title)
        added += 1

    return added


def load_existing():
    if not OUT.exists():
        return []

    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data.get("films", []) or data.get("movies", []) or []
        if isinstance(data, list):
            return data
    except Exception:
        pass

    return []


def main():
    load_genres()

    movies = []
    known_ids = set()
    known_titles = set()

    existing = load_existing()
    for item in existing:
        if not isinstance(item, dict):
            continue
        key_id = f'{item.get("type")}:{item.get("id")}'
        key_title = make_key(item)
        if key_id and key_id not in known_ids:
            movies.append(item)
            known_ids.add(key_id)
            known_titles.add(key_title)

    print("Existing:", len(movies))
    current_year = datetime.now(timezone.utc).year

    # 1. Самые сильные общие подборки
    sort_modes = [
        "popularity.desc",
        "vote_count.desc",
        "vote_average.desc",
        "primary_release_date.desc",
        "release_date.desc",
    ]

    tv_sort_modes = [
        "popularity.desc",
        "vote_count.desc",
        "vote_average.desc",
        "first_air_date.desc",
    ]

    # Фильмы широким проходом
    for sort_by in sort_modes:
        if len(movies) >= TARGET_COUNT:
            break

        items = collect_discover(
            "movie",
            {
                "sort_by": sort_by,
                "include_adult": "false",
                "include_video": "false",
                "vote_count.gte": 0,
            },
            max_pages=500,
            limit=12000,
            label=f"movie {sort_by}",
        )
        add_many(movies, known_ids, known_titles, items)

    # Сериалы широким проходом
    for sort_by in tv_sort_modes:
        if len(movies) >= TARGET_COUNT:
            break

        items = collect_discover(
            "tv",
            {
                "sort_by": sort_by,
                "include_adult": "false",
                "vote_count.gte": 0,
            },
            max_pages=500,
            limit=12000,
            label=f"tv {sort_by}",
        )
        add_many(movies, known_ids, known_titles, items)

    # 2. Проход по годам для фильмов
    year_blocks = list(range(current_year + 1, 1899, -1))

    for year in year_blocks:
        if len(movies) >= TARGET_COUNT:
            break

        items = collect_discover(
            "movie",
            {
                "sort_by": "popularity.desc",
                "include_adult": "false",
                "include_video": "false",
                "primary_release_year": year,
                "vote_count.gte": 0,
            },
            max_pages=500,
            limit=3500,
            label=f"movie year {year}",
        )
        add_many(movies, known_ids, known_titles, items)

    # 3. Проход по годам для сериалов
    for year in year_blocks:
        if len(movies) >= TARGET_COUNT:
            break

        items = collect_discover(
            "tv",
            {
                "sort_by": "popularity.desc",
                "include_adult": "false",
                "first_air_date_year": year,
                "vote_count.gte": 0,
            },
            max_pages=500,
            limit=3500,
            label=f"tv year {year}",
        )
        add_many(movies, known_ids, known_titles, items)

    # 4. Аниме отдельно: мультфильм + Япония
    anime_queries = [
        {
            "sort_by": "popularity.desc",
            "with_genres": str(ANIMATION_GENRE_ID),
            "with_origin_country": "JP",
            "vote_count.gte": 0,
        },
        {
            "sort_by": "vote_count.desc",
            "with_genres": str(ANIMATION_GENRE_ID),
            "with_origin_country": "JP",
            "vote_count.gte": 0,
        },
        {
            "sort_by": "first_air_date.desc",
            "with_genres": str(ANIMATION_GENRE_ID),
            "with_origin_country": "JP",
            "vote_count.gte": 0,
        },
    ]

    for params in anime_queries:
        if len(movies) >= TARGET_COUNT:
            break

        items = collect_discover(
            "tv",
            params,
            max_pages=500,
            limit=15000,
            label=f"anime {params.get('sort_by')}",
        )
        items = [anime_mark(x) for x in items]
        add_many(movies, known_ids, known_titles, items)

    # 5. Мультфильмы-фильмы отдельно
    cartoon_movie_items = collect_discover(
        "movie",
        {
            "sort_by": "popularity.desc",
            "include_adult": "false",
            "include_video": "false",
            "with_genres": str(ANIMATION_GENRE_ID),
            "vote_count.gte": 0,
        },
        max_pages=500,
        limit=15000,
        label="cartoon movies",
    )
    for x in cartoon_movie_items:
        if "мультфильм" not in " ".join(x.get("genres", [])).lower():
            if "мультфильм" not in x["genres"]:
                x["genres"].append("мультфильм")
    add_many(movies, known_ids, known_titles, cartoon_movie_items)

    movies.sort(key=quality_score, reverse=True)
    movies = movies[:TARGET_COUNT]

    result = {
        "version": int(time.time()),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "targetCount": TARGET_COUNT,
        "count": len(movies),
        "sort": "quality_score",
        "films": movies,
    }

    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print("DONE")
    print("Target:", TARGET_COUNT)
    print("Saved:", len(movies))


if __name__ == "__main__":
    main()
