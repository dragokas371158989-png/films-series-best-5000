import json
import time
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

# Сколько аниме хотим держать в общей базе.
# Можно поставить 5000, 10000, 15000.
TARGET_ANIME_COUNT = 12000

DB_FILE = Path("movies_updates.json")

HEADERS = {
    "User-Agent": "GolubCatalogAnimeBooster/1.0",
    "Accept": "application/json",
}

# Хентай / эротика не добавляем
EXCLUDED_GENRE_NAMES = {
    "hentai",
    "erotica",
    "adult cast hentai",
}

EXCLUDED_GENRE_IDS = {12, 49}

# Русские названия жанров для сайта
GENRE_RU = {
    "Action": "Экшен",
    "Adventure": "Приключения",
    "Avant Garde": "Авангард",
    "Award Winning": "Призовые",
    "Boys Love": "Boys Love",
    "Comedy": "Комедия",
    "Drama": "Драма",
    "Fantasy": "Фэнтези",
    "Girls Love": "Girls Love",
    "Gourmet": "Еда",
    "Horror": "Ужасы",
    "Mystery": "Детектив",
    "Romance": "Романтика",
    "Sci-Fi": "Фантастика",
    "Slice of Life": "Повседневность",
    "Sports": "Спорт",
    "Supernatural": "Сверхъестественное",
    "Suspense": "Саспенс",
    "Ecchi": "Этти",

    "Adult Cast": "Взрослые персонажи",
    "Anthropomorphic": "Антропоморфные",
    "CGDCT": "Милые девочки",
    "Childcare": "Забота о детях",
    "Combat Sports": "Боевые виды спорта",
    "Crossdressing": "Кроссдрессинг",
    "Delinquents": "Хулиганы",
    "Detective": "Детектив",
    "Educational": "Образовательное",
    "Gag Humor": "Гэг-юмор",
    "Gore": "Жесть",
    "Harem": "Гарем",
    "High Stakes Game": "Игры на ставки",
    "Historical": "Историческое",
    "Idols (Female)": "Айдолы",
    "Idols (Male)": "Айдолы",
    "Isekai": "Исекай",
    "Iyashikei": "Исцеляющее",
    "Love Polygon": "Любовный многоугольник",
    "Magical Sex Shift": "Магическая смена пола",
    "Mahou Shoujo": "Девочки-волшебницы",
    "Martial Arts": "Боевые искусства",
    "Mecha": "Меха",
    "Medical": "Медицина",
    "Military": "Военное",
    "Music": "Музыка",
    "Mythology": "Мифология",
    "Organized Crime": "Организованная преступность",
    "Otaku Culture": "Отаку-культура",
    "Parody": "Пародия",
    "Performing Arts": "Сценическое искусство",
    "Pets": "Питомцы",
    "Psychological": "Психология",
    "Racing": "Гонки",
    "Reincarnation": "Перерождение",
    "Reverse Harem": "Обратный гарем",
    "Romantic Subtext": "Романтический подтекст",
    "Samurai": "Самураи",
    "School": "Школа",
    "Showbiz": "Шоу-бизнес",
    "Space": "Космос",
    "Strategy Game": "Игры",
    "Super Power": "Суперспособности",
    "Survival": "Выживание",
    "Team Sports": "Командный спорт",
    "Time Travel": "Путешествия во времени",
    "Vampire": "Вампиры",
    "Video Game": "Игры",
    "Villainess": "Злодейка",
    "Visual Arts": "Искусство",
    "Workplace": "Работа",

    "Josei": "Дзёсэй",
    "Kids": "Для детей",
    "Seinen": "Сэйнэн",
    "Shoujo": "Сёдзё",
    "Shounen": "Сёнэн",
}

IMPORTANT_GENRE_IDS = [
    1, 2, 4, 8, 10, 14, 22, 24, 30, 36, 37, 41, 46, 47,
    62, 72, 23, 35, 18, 17, 38, 19, 40, 31, 32, 21, 78, 79,
    42, 27, 25, 43, 15
]


def get_json(url, retries=5):
    last_error = None

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            wait = 2 + attempt * 3
            print(f"Retry {attempt + 1}/{retries}: {url} -> {error}. Wait {wait}s")
            time.sleep(wait)

    raise last_error


def jikan(path, params=None):
    params = params or {}
    query = urllib.parse.urlencode(params)
    url = "https://api.jikan.moe/v4" + path
    if query:
        url += "?" + query
    return get_json(url)


def load_database():
    if not DB_FILE.exists():
        return {"version": 1, "movies": []}

    data = json.loads(DB_FILE.read_text(encoding="utf-8"))

    if isinstance(data, list):
        return {"version": 1, "movies": data}

    if "movies" not in data:
        data["movies"] = data.get("items") or data.get("data") or []

    return data


def save_database(data):
    data["version"] = int(data.get("version") or 1) + 1
    data["generatedAt"] = datetime.now(timezone.utc).isoformat()
    data["count"] = len(data.get("movies", []))
    DB_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def genre_names(item):
    out = []
    out_ids = []

    for block in ("genres", "explicit_genres", "themes", "demographics"):
        for genre in item.get(block) or []:
            name = genre.get("name")
            gid = genre.get("mal_id")
            if name:
                out.append(name)
            if gid:
                out_ids.append(int(gid))

    return out, out_ids


def is_bad_anime(item):
    names, ids = genre_names(item)

    if any(gid in EXCLUDED_GENRE_IDS for gid in ids):
        return True

    lowered = {str(name).strip().lower() for name in names}
    if lowered & EXCLUDED_GENRE_NAMES:
        return True

    rating = str(item.get("rating") or "").lower()
    if "rx" in rating or "hentai" in rating:
        return True

    return False


def get_year(item):
    year = item.get("year")
    if year:
        return str(year)

    aired = item.get("aired") or {}
    prop = aired.get("prop") or {}
    started = prop.get("from") or {}
    y = started.get("year")
    return str(y or "")


def get_poster(item):
    images = item.get("images") or {}
    jpg = images.get("jpg") or {}
    webp = images.get("webp") or {}

    return (
        webp.get("large_image_url")
        or jpg.get("large_image_url")
        or webp.get("image_url")
        or jpg.get("image_url")
        or ""
    )


def get_studio(item):
    studios = item.get("studios") or []
    if not studios:
        return ""
    return studios[0].get("name") or ""


def build_genres(item):
    names, _ = genre_names(item)

    result = ["Аниме"]

    for name in names:
        if not name:
            continue

        ru = GENRE_RU.get(name)
        if ru and ru not in result:
            result.append(ru)

        # Английские названия тоже оставляем,
        # чтобы фильтр Исекай/Shounen/Fantasy работал лучше
        if name not in result:
            result.append(name)

    return result


def convert_anime(item):
    if is_bad_anime(item):
        return None

    mal_id = item.get("mal_id")
    if not mal_id:
        return None

    poster = get_poster(item)
    if not poster:
        return None

    title = item.get("title") or ""
    title_en = item.get("title_english") or item.get("title_japanese") or title

    if not title and not title_en:
        return None

    score = item.get("score") or 0
    scored_by = item.get("scored_by") or 0

    # совсем пустые/мусорные записи отсекаем
    if not score and not scored_by:
        return None

    overview = item.get("synopsis") or ""
    episodes = item.get("episodes") or ""
    status = item.get("status") or ""
    anime_type = item.get("type") or ""

    return {
        "id": f"mal_{mal_id}",
        "malId": mal_id,
        "ru": title_en or title,
        "en": title,
        "year": get_year(item),
        "type": "Аниме",
        "animeType": anime_type,
        "episodes": episodes,
        "status": status,
        "studio": get_studio(item),
        "rating": round(float(score or 0), 1),
        "votes": int(scored_by or 0),
        "poster": poster,
        "overview": overview,
        "genres": build_genres(item),
        "source": "Jikan / MyAnimeList"
    }


def collect_from_endpoint(path, params, max_pages, known, collected):
    page = 1

    while page <= max_pages and len(collected) < TARGET_ANIME_COUNT * 2:
        request_params = dict(params)
        request_params["page"] = page
        request_params["limit"] = 25

        print(f"Fetch {path} page {page}")

        data = jikan(path, request_params)
        items = data.get("data") or []

        if not items:
            break

        added = 0

        for item in items:
            converted = convert_anime(item)
            if not converted:
                continue

            anime_id = str(converted["id"])
            mal_id = f"mal_{converted.get('malId')}"

            if anime_id in known or mal_id in known:
                continue

            known.add(anime_id)
            known.add(mal_id)
            collected.append(converted)
            added += 1

        print(f"Added from page: {added}. Total collected: {len(collected)}")

        pagination = data.get("pagination") or {}
        if not pagination.get("has_next_page"):
            break

        page += 1
        time.sleep(0.75)


def anime_score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)

    year_raw = str(item.get("year") or "")
    year = int(year_raw) if year_raw.isdigit() else 0

    vote_bonus = min(votes, 800000) / 800000 * 8
    year_bonus = 0.5 if year >= 2010 else 0

    return rating * 10 + vote_bonus + year_bonus


def main():
    db = load_database()
    movies = db.get("movies") or []

    known = set()
    kept_movies = []
    old_anime = []

    for item in movies:
        item_id = str(item.get("id", ""))
        mal_id = item.get("malId")

        if item_id:
            known.add(item_id)

        if mal_id:
            known.add(f"mal_{mal_id}")

        # старые аниме из нашей добавки пока отдельно
        if item.get("type") == "Аниме" and (str(item.get("id", "")).startswith("mal_") or item.get("source") == "Jikan / MyAnimeList"):
            old_anime.append(item)
        else:
            kept_movies.append(item)

    print(f"Base before: {len(movies)}")
    print(f"Kept non-booster records: {len(kept_movies)}")
    print(f"Old booster anime: {len(old_anime)}")

    collected = []

    # 1. Самые популярные и любимые
    collect_from_endpoint("/top/anime", {"filter": "bypopularity"}, 120, known, collected)
    collect_from_endpoint("/top/anime", {"filter": "favorite"}, 80, known, collected)
    collect_from_endpoint("/top/anime", {"filter": "airing"}, 40, known, collected)
    collect_from_endpoint("/top/anime", {"filter": "upcoming"}, 40, known, collected)

    # 2. По типам
    collect_from_endpoint("/top/anime", {"type": "tv"}, 80, known, collected)
    collect_from_endpoint("/top/anime", {"type": "movie"}, 40, known, collected)
    collect_from_endpoint("/top/anime", {"type": "ova"}, 30, known, collected)
    collect_from_endpoint("/top/anime", {"type": "ona"}, 30, known, collected)

    # 3. Текущий и будущий сезон
    collect_from_endpoint("/seasons/now", {}, 12, known, collected)
    collect_from_endpoint("/seasons/upcoming", {}, 12, known, collected)

    # 4. Важные жанры и темы, включая исекай/сёнэн/сэйнэн/школу/гарем/меха
    for gid in IMPORTANT_GENRE_IDS:
        collect_from_endpoint("/anime", {"genres": gid, "order_by": "score", "sort": "desc"}, 8, known, collected)
        time.sleep(0.9)

    merged_anime = old_anime + collected

    # Убираем дубли и мусор
    clean = []
    seen = set()

    for item in merged_anime:
        if is_bad_anime({
            "genres": [{"name": g} for g in item.get("genres", [])],
            "rating": item.get("rating", "")
        }):
            continue

        key = str(item.get("id") or item.get("malId") or "")
        if not key or key in seen:
            continue

        seen.add(key)
        clean.append(item)

    clean.sort(key=anime_score, reverse=True)
    clean = clean[:TARGET_ANIME_COUNT]

    db["movies"] = kept_movies + clean
    db["animeCount"] = len(clean)

    save_database(db)

    print(f"Anime added/kept: {len(clean)}")
    print(f"Base after: {len(db['movies'])}")


if __name__ == "__main__":
    main()
