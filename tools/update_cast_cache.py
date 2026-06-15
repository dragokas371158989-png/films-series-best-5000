import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime

KP_TOKEN = os.environ.get("KINOPOISK_API_KEY", "").strip()

DATA_DIR = Path("data")
INDEX_PATH = DATA_DIR / "index.json"
UPDATES_PATH = Path("movies_updates.json")
OUT_PATH = DATA_DIR / "cast_cache.json"

LIMIT = int(os.environ.get("GKM_CAST_LIMIT", "1800"))
SLEEP_SEC = float(os.environ.get("GKM_KP_SLEEP", "0.25"))

if not KP_TOKEN:
    raise SystemExit("KINOPOISK_API_KEY is empty. Add it in GitHub Secrets.")

KP_BASE = "https://kinopoiskapiunofficial.tech"
KP_HEADERS = {
    "X-API-KEY": KP_TOKEN,
    "Accept": "application/json",
    "User-Agent": "GKM Kinopoisk cast cache updater",
}

MUST_INCLUDE = [
    {"key": "movie:155", "kind": "movie", "tmdbId": 155, "itemId": "155", "title": "Тёмный рыцарь", "en": "The Dark Knight", "year": "2008", "score": 999999999},
    {"key": "movie:157336", "kind": "movie", "tmdbId": 157336, "itemId": "157336", "title": "Интерстеллар", "en": "Interstellar", "year": "2014", "score": 999999998},
    {"key": "movie:13", "kind": "movie", "tmdbId": 13, "itemId": "13", "title": "Форрест Гамп", "en": "Forrest Gump", "year": "1994", "score": 999999997},
    {"key": "movie:238", "kind": "movie", "tmdbId": 238, "itemId": "238", "title": "Крёстный отец", "en": "The Godfather", "year": "1972", "score": 999999996},
    {"key": "movie:27205", "kind": "movie", "tmdbId": 27205, "itemId": "27205", "title": "Начало", "en": "Inception", "year": "2010", "score": 999999995},
    {"key": "movie:603", "kind": "movie", "tmdbId": 603, "itemId": "603", "title": "Матрица", "en": "The Matrix", "year": "1999", "score": 999999994},
]


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
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


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
        value = entry.lstrip("/")
    elif isinstance(entry, dict):
        value = str(entry.get("file") or entry.get("path") or entry.get("url") or "").lstrip("/")
    else:
        return None
    if not value:
        return None
    if value.startswith("data/"):
        return Path(value)
    return DATA_DIR / value


def load_all_items():
    items = []
    index = load_json(INDEX_PATH, [])
    items.extend(extract_items(index))

    chunks = []
    if isinstance(index, dict) and isinstance(index.get("chunks"), list):
        for entry in index["chunks"]:
            p = chunk_path(entry)
            if p and p.exists():
                chunks.append(p)

    for p in sorted(DATA_DIR.glob("chunk*.json")):
        if p not in chunks:
            chunks.append(p)

    for p in chunks:
        data = load_json(p, [])
        items.extend(extract_items(data))

    updates = load_json(UPDATES_PATH, {})
    items.extend(extract_items(updates))

    seen = set()
    clean = []
    for item in items:
        if not isinstance(item, dict):
            continue
        key = str(item.get("id") or "") + "|" + str(item.get("tmdbId") or item.get("tmdb_id") or "") + "|" + str(item.get("ru") or item.get("en") or "")
        if key in seen:
            continue
        seen.add(key)
        clean.append(item)
    return clean


def is_anime(item):
    text = " ".join(str(item.get(k, "")) for k in ("type", "source", "category", "provider", "ru", "en")).lower()
    genres = item.get("genres") or []
    if isinstance(genres, list):
        text += " " + " ".join(str(x).lower() for x in genres)
    return "аниме" in text or "anime" in text or "shikimori" in text or "myanimelist" in text


def media_kind(item):
    return "tv" if "сериал" in str(item.get("type", "")).lower() else "movie"


def tmdb_id(item):
    kind = media_kind(item)
    direct = item.get("tmdbId") or item.get("tmdb_id") or item.get("tmdbID")
    if direct:
        try:
            return int(direct)
        except Exception:
            pass

    source = str(item.get("source") or item.get("provider") or item.get("category") or "").lower()
    try:
        numeric = int(item.get("id"))
    except Exception:
        return None

    if "tmdb" in source and 0 < numeric < 2_000_000:
        return numeric
    if kind == "movie" and 7_000_000 < numeric < 8_000_000:
        return numeric - 7_000_000
    if kind == "tv" and 8_000_000 < numeric < 9_000_000:
        return numeric - 8_000_000
    return None


def item_year(item):
    value = str(item.get("year") or "").strip()
    return value[:4] if len(value) >= 4 else value


def score(item):
    try:
        rating = float(item.get("rating") or 0)
    except Exception:
        rating = 0
    try:
        votes = int(item.get("votes") or 0)
    except Exception:
        votes = 0
    return rating * 100000 + min(votes, 100000)


def make_target(item):
    if not isinstance(item, dict) or is_anime(item):
        return None
    kind = media_kind(item)
    tid = tmdb_id(item)
    if not tid:
        return None
    return {
        "key": f"{kind}:{tid}",
        "kind": kind,
        "tmdbId": tid,
        "itemId": str(item.get("id") or ""),
        "title": item.get("ru") or item.get("title") or item.get("name") or item.get("en") or "",
        "en": item.get("en") or item.get("originalTitle") or item.get("titleOriginal") or "",
        "year": item_year(item),
        "score": score(item),
    }


def kp_get(path, params=None, retries=3):
    url = KP_BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)

    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=KP_HEADERS)
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            print(f"Kinopoisk request failed attempt={attempt + 1}: {path} {params} -> {e}")
            time.sleep(1.0 + attempt * 1.5)
    raise last_err


def normalize_title(s):
    return " ".join(str(s or "").lower().replace("ё", "е").split())


def choose_kp_film(search_data, target):
    films = []
    if isinstance(search_data, dict):
        if isinstance(search_data.get("films"), list):
            films = search_data["films"]
        elif isinstance(search_data.get("items"), list):
            films = search_data["items"]
    if not films:
        return None

    target_year = str(target.get("year") or "").strip()
    target_title = normalize_title(target.get("title") or "")
    target_en = normalize_title(target.get("en") or "")

    for f in films:
        fy = str(f.get("year") or "").strip()
        names = [f.get("nameRu"), f.get("nameEn"), f.get("nameOriginal")]
        names_norm = [normalize_title(x) for x in names if x]
        if target_year and fy and fy != target_year:
            continue
        if target_title and target_title in names_norm:
            return f
        if target_en and target_en in names_norm:
            return f

    if target_year:
        for f in films:
            if str(f.get("year") or "").strip() == target_year:
                return f
    return films[0]


def find_kp_id(target):
    queries = []
    for q in (target.get("title"), target.get("en")):
        q = str(q or "").strip()
        if q and q not in queries:
            queries.append(q)

    for q in queries:
        data = kp_get("/api/v2.1/films/search-by-keyword", {"keyword": q})
        film = choose_kp_film(data, target)
        if film:
            film_id = film.get("filmId") or film.get("kinopoiskId")
            if film_id:
                return int(film_id)
        time.sleep(SLEEP_SEC)
    return None


def load_kp_staff(kp_id):
    data = kp_get("/api/v1/staff", {"filmId": kp_id})
    return data if isinstance(data, list) else []


def convert_staff_to_cast(staff):
    cast = []
    for p in staff:
        profession = str(p.get("professionKey") or p.get("professionText") or "").upper()
        if profession and "ACTOR" not in profession and "АКТ" not in profession:
            continue

        name = p.get("nameRu") or p.get("nameEn") or ""
        role = p.get("description") or ""

        if not name:
            continue

        cast.append({
            "name": name,
            "role": role or "роль не указана",
            "profile": p.get("posterUrl") or "",
        })

        if len(cast) >= 16:
            break
    return cast


def build_targets():
    targets = []
    for item in load_all_items():
        t = make_target(item)
        if t:
            targets.append(t)

    targets.extend(MUST_INCLUDE)

    uniq = {}
    for t in sorted(targets, key=lambda x: x["score"], reverse=True):
        if t["key"] not in uniq:
            uniq[t["key"]] = t

    return list(uniq.values())[:LIMIT]


def main():
    old = load_json(OUT_PATH, {})
    old_items = old.get("items") if isinstance(old, dict) else {}
    if not isinstance(old_items, dict):
        old_items = {}

    targets = build_targets()
    result_items = dict(old_items)

    updated = skipped = failed = not_found = 0

    for i, target in enumerate(targets, start=1):
        key = target["key"]

        if key in result_items and result_items[key].get("cast") and result_items[key].get("source") == "kinopoiskapiunofficial":
            skipped += 1
            continue

        try:
            kp_id = find_kp_id(target)
            if not kp_id:
                not_found += 1
                print(f"KP not found: {key} {target.get('title')} {target.get('year')}")
                continue

            time.sleep(SLEEP_SEC)

            staff = load_kp_staff(kp_id)
            cast = convert_staff_to_cast(staff)

            result_items[key] = {
                "kind": target["kind"],
                "tmdbId": target["tmdbId"],
                "itemId": target["itemId"],
                "title": target["title"],
                "year": target.get("year") or "",
                "kinopoiskId": kp_id,
                "source": "kinopoiskapiunofficial",
                "cast": cast,
            }

            updated += 1

            if i % 20 == 0:
                print(f"Processed {i}/{len(targets)} updated={updated} skipped={skipped} failed={failed} not_found={not_found}")

            time.sleep(SLEEP_SEC)
        except Exception as e:
            failed += 1
            print(f"Failed {key} {target.get('title')}: {e}")
            time.sleep(1.5)

    out = {
        "version": int(old.get("version", 0) or 0) + 1 if isinstance(old, dict) else 1,
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "count": len(result_items),
        "limit": LIMIT,
        "source": "kinopoiskapiunofficial",
        "items": result_items,
    }

    save_json(OUT_PATH, out)

    print("GKM Kinopoisk cast cache complete")
    print(f"Targets: {len(targets)}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Not found: {not_found}")
    print(f"Failed: {failed}")
    print(f"Written: {OUT_PATH}")

    for key in ("movie:155", "movie:157336"):
        print(f"Check {key}: {'YES' if key in result_items else 'NO'}")


if __name__ == "__main__":
    main()
