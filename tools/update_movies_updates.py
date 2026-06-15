import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime

OUT = Path("movies_updates.json")
TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TARGET_COUNT = int(os.environ.get("TARGET_COUNT", "5000"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty. Add it in GitHub: Settings -> Secrets and variables -> Actions.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "MovieCatalogTV GitHub updater 5000 best",
    "Accept": "application/json",
}

IMG_W342 = "https://image.tmdb.org/t/p/w342"
IMG_W500 = "https://image.tmdb.org/t/p/w500"

RU_TITLE_MAP = {
    "attack on titan": "Атака титанов",
    "shingeki no kyojin": "Атака титанов",
    "attack on titan season 2": "Атака титанов 2 сезон",
    "shingeki no kyojin season 2": "Атака титанов 2 сезон",
    "attack on titan season 3": "Атака титанов 3 сезон",
    "shingeki no kyojin season 3": "Атака титанов 3 сезон",
    "attack on titan final season": "Атака титанов: Финальный сезон",
    "shingeki no kyojin the final season": "Атака титанов: Финальный сезон",

    "demon slayer": "Истребитель демонов",
    "demon slayer: kimetsu no yaiba": "Истребитель демонов",
    "demon slayer kimetsu no yaiba": "Истребитель демонов",
    "kimetsu no yaiba": "Истребитель демонов",
    "kimetsu no yaiba: yuukaku-hen": "Истребитель демонов: Квартал красных фонарей",
    "kimetsu no yaiba yuukaku-hen": "Истребитель демонов: Квартал красных фонарей",
    "kimetsu no yaiba: katanakaji no sato-hen": "Истребитель демонов: Деревня кузнецов",
    "kimetsu no yaiba katanakaji no sato-hen": "Истребитель демонов: Деревня кузнецов",

    "one punch man": "Ванпанчмен",
    "one-punch man": "Ванпанчмен",
    "one punch man 2nd season": "Ванпанчмен 2 сезон",
    "one-punch man 2nd season": "Ванпанчмен 2 сезон",

    "death note": "Тетрадь смерти",
    "fullmetal alchemist": "Стальной алхимик",
    "fullmetal alchemist: brotherhood": "Стальной алхимик: Братство",
    "fullmetal alchemist brotherhood": "Стальной алхимик: Братство",

    "naruto": "Наруто",
    "naruto: shippuden": "Наруто: Ураганные хроники",
    "naruto shippuden": "Наруто: Ураганные хроники",
    "naruto shippuuden": "Наруто: Ураганные хроники",

    "one piece": "Ван-Пис",
    "bleach": "Блич",
    "jujutsu kaisen": "Магическая битва",
    "chainsaw man": "Человек-бензопила",
    "tokyo ghoul": "Токийский гуль",
    "black clover": "Чёрный клевер",
    "hunter x hunter": "Охотник х Охотник",

    "boku no hero academia": "Моя геройская академия",
    "my hero academia": "Моя геройская академия",
    "boku no hero academia 2nd season": "Моя геройская академия 2 сезон",
    "boku no hero academia 3rd season": "Моя геройская академия 3 сезон",
    "boku no hero academia 4th season": "Моя геройская академия 4 сезон",
    "boku no hero academia 5th season": "Моя геройская академия 5 сезон",
    "boku no hero academia 6th season": "Моя геройская академия 6 сезон",

    "dragon ball": "Драконий жемчуг",
    "dragon ball z": "Драконий жемчуг Z",
    "dragon ball z kai": "Драконий жемчуг Z Кай",
    "dragon ball z kai: the final chapters": "Драконий жемчуг Z Кай: Финальные главы",
    "dragon ball super": "Драконий жемчуг Супер",

    "solo leveling": "Поднятие уровня в одиночку",
    "blue lock": "Синяя тюрьма: Блю Лок",
    "spy x family": "Семья шпиона",
    "vinland saga": "Сага о Винланде",
    "berserk": "Берсерк",
    "cowboy bebop": "Ковбой Бибоп",
    "neon genesis evangelion": "Евангелион",
    "code geass": "Код Гиас",
    "steins;gate": "Врата Штейна",
    "mob psycho 100": "Моб Психо 100",
    "haikyu!!": "Волейбол!!",
    "haikyuu!!": "Волейбол!!",
    "the seven deadly sins": "Семь смертных грехов",
    "nanatsu no taizai": "Семь смертных грехов",
    "dr. stone": "Доктор Стоун",
    "fire force": "Пламенная бригада пожарных",
    "the promised neverland": "Обещанный Неверленд",
    "made in abyss": "Созданный в Бездне",
    "mushoku tensei": "Реинкарнация безработного",
    "overlord": "Повелитель",
    "that time i got reincarnated as a slime": "О моём перерождении в слизь",
    "tensei shitara slime datta ken": "О моём перерождении в слизь",
}


def norm_title(value):
    return " ".join(
        str(value or "")
        .lower()
        .replace("‐", "-")
        .replace("‑", "-")
        .replace("–", "-")
        .replace("—", "-")
        .split()
    )


def apply_known_ru_title(ru_title, original_title):
    ru = str(ru_title or "").strip()
    en = str(original_title or "").strip()

    for item in (ru, en):
        n = norm_title(item)

        if n in RU_TITLE_MAP:
            return RU_TITLE_MAP[n]

        for key, value in RU_TITLE_MAP.items():
            if n.startswith(key) or key in n:
                return value

    return ru or en


def get_json(path, params=None, retries=4):
    base_url = "https://api.themoviedb.org/3"
    params = params or {}
    params.setdefault("language", "ru-RU")
    url = base_url + path + "?" + urllib.parse.urlencode(params)

    last_err = None

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(2 + attempt * 2)

    raise last_err


def genre_maps():
    maps = {"movie": {}, "tv": {}}

    for kind in ("movie", "tv"):
        data = get_json(f"/genre/{kind}/list")
        maps[kind] = {g["id"]: g["name"] for g in data.get("genres", [])}
        time.sleep(0.3)

    return maps


def load_existing():
    if not OUT.exists():
        return {"version": 1, "movies": []}

    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))

        if isinstance(data, list):
            return {"version": 1, "movies": data}

        if "movies" not in data:
            data["movies"] = data.get("items") or []

        return data
    except Exception:
        return {"version": 1, "movies": []}


def clean_year(date):
    return str(date[:4]) if date and len(date) >= 4 else ""


def poster_url(path):
    return IMG_W342 + path if path else ""


def convert_movie(item, gmap, source=""):
    tmdb_id = int(item.get("id", 0))
    title = item.get("title") or item.get("name") or ""
    original = item.get("original_title") or item.get("original_name") or title
    year = clean_year(item.get("release_date") or "")
    genres = [gmap.get(x, "") for x in item.get("genre_ids", [])]
    genres = [x for x in genres if x]

    return {
        "id": 7000000 + tmdb_id,
        "tmdbId": tmdb_id,
        "ru": apply_known_ru_title(title, original),
        "en": original,
        "year": year,
        "type": "Фильм",
        "episodes": "",
        "status": "Вышел",
        "studio": "",
        "rating": round(float(item.get("vote_average") or 0), 2),
        "votes": int(item.get("vote_count") or 0),
        "poster": poster_url(item.get("poster_path")),
        "backdrop": IMG_W500 + item["backdrop_path"] if item.get("backdrop_path") else "",
        "overview": item.get("overview") or "",
        "genres": genres,
        "source": source,
    }


def convert_tv(item, gmap, source=""):
    tmdb_id = int(item.get("id", 0))
    title = item.get("name") or item.get("title") or ""
    original = item.get("original_name") or item.get("original_title") or title
    year = clean_year(item.get("first_air_date") or "")
    genres = [gmap.get(x, "") for x in item.get("genre_ids", [])]
    genres = [x for x in genres if x]

    return {
        "id": 8000000 + tmdb_id,
        "tmdbId": tmdb_id,
        "ru": apply_known_ru_title(title, original),
        "en": original,
        "year": year,
        "type": "Сериал",
        "episodes": "",
        "status": "Онгоинг",
        "studio": "",
        "rating": round(float(item.get("vote_average") or 0), 2),
        "votes": int(item.get("vote_count") or 0),
        "poster": poster_url(item.get("poster_path")),
        "backdrop": IMG_W500 + item["backdrop_path"] if item.get("backdrop_path") else "",
        "overview": item.get("overview") or "",
        "genres": genres,
        "source": source,
    }


def quality_score(x):
    rating = float(x.get("rating") or 0)
    votes = int(x.get("votes") or 0)
    year_text = str(x.get("year") or "")
    year = int(year_text) if year_text.isdigit() else 0

    if votes < 50:
        return -1

    vote_bonus = min(votes, 50000) / 50000.0
    year_bonus = 0.15 if year >= 2010 else 0.0

    return rating * 10 + vote_bonus * 5 + year_bonus


def add_items(items, movies, known, conv, gmap, source):
    added = 0

    for item in items:
        x = conv(item, gmap, source)

        if not x["ru"] and not x["en"]:
            continue

        if not x["poster"]:
            continue

        if float(x.get("rating") or 0) < 5.5:
            continue

        if int(x.get("votes") or 0) < 30:
            continue

        k1 = str(x["id"])
        k2 = "|".join(str(x.get(f) or "") for f in ("ru", "en", "year", "type")).lower()

        if k1 not in known and k2 not in known:
            movies.append(x)
            known.add(k1)
            known.add(k2)
            added += 1

    return added


def fetch_pages(kind, path, params, conv, gmap, movies, known, source, max_pages=250):
    added_total = 0
    page = 1

    while page <= max_pages:
        p = dict(params or {})
        p["page"] = page

        try:
            data = get_json(path, p)
        except Exception as e:
            print(f"Skip {kind} {path} page {page}: {e}")
            break

        results = data.get("results") or []

        if not results:
            break

        added = add_items(results, movies, known, conv, gmap, source)
        added_total += added

        total_pages = int(data.get("total_pages") or 1)

        if page >= min(total_pages, max_pages):
            break

        if page % 10 == 0:
            print(f"{source}: page {page}, current pool {len(movies)}, added {added_total}")

        page += 1
        time.sleep(0.25)

    return added_total


def main():
    existing = load_existing()
    existing_movies = existing.get("movies") or []

    movies = []
    known = set()

    for x in existing_movies:
        if not x.get("poster"):
            continue

        x["ru"] = apply_known_ru_title(x.get("ru"), x.get("en"))

        k1 = str(x.get("id", ""))
        k2 = "|".join(str(x.get(f) or "") for f in ("ru", "en", "year", "type")).lower()

        if k1 and k1 not in known:
            movies.append(x)
            known.add(k1)
            known.add(k2)

    before = len(movies)
    gm = genre_maps()

    fetch_pages("movie", "/movie/top_rated", {"region": "RU"}, convert_movie, gm["movie"], movies, known, "movie_top_rated", max_pages=250)
    fetch_pages("tv", "/tv/top_rated", {}, convert_tv, gm["tv"], movies, known, "tv_top_rated", max_pages=250)

    fetch_pages("movie", "/movie/popular", {"region": "RU"}, convert_movie, gm["movie"], movies, known, "movie_popular", max_pages=150)
    fetch_pages("tv", "/tv/popular", {}, convert_tv, gm["tv"], movies, known, "tv_popular", max_pages=150)

    fetch_pages("movie", "/trending/movie/week", {}, convert_movie, gm["movie"], movies, known, "trending_movie_week", max_pages=80)
    fetch_pages("tv", "/trending/tv/week", {}, convert_tv, gm["tv"], movies, known, "trending_tv_week", max_pages=80)

    current_year = datetime.utcnow().year

    for year in range(current_year, 1970, -1):
        if len(movies) >= TARGET_COUNT * 2:
            break

        fetch_pages(
            "movie",
            "/discover/movie",
            {
                "sort_by": "vote_average.desc",
                "primary_release_year": year,
                "vote_count.gte": 100,
                "include_adult": "false",
            },
            convert_movie,
            gm["movie"],
            movies,
            known,
            f"discover_best_movie_{year}",
            max_pages=10,
        )

        fetch_pages(
            "tv",
            "/discover/tv",
            {
                "sort_by": "vote_average.desc",
                "first_air_date_year": year,
                "vote_count.gte": 100,
                "include_adult": "false",
            },
            convert_tv,
            gm["tv"],
            movies,
            known,
            f"discover_best_tv_{year}",
            max_pages=10,
        )

    movies.sort(key=quality_score, reverse=True)
    movies = movies[:TARGET_COUNT]

    result = {
        "version": int(existing.get("version", 1)) + 1,
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "targetCount": TARGET_COUNT,
        "count": len(movies),
        "sort": "best_by_rating_votes_poster_ru_titles",
        "movies": movies,
    }

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Before valid existing: {before}")
    print(f"Final count: {len(movies)}")
    print(f"Written: {OUT}")


if __name__ == "__main__":
    main()
