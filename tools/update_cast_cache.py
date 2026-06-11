import json
import os
import time
import urllib.request
from pathlib import Path
from datetime import datetime

TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
DATA_DIR = Path("data")
INDEX_PATH = DATA_DIR / "index.json"
UPDATES_PATH = Path("movies_updates.json")
OUT_PATH = DATA_DIR / "cast_cache.json"
LIMIT = int(os.environ.get("GKM_CAST_LIMIT", "2500"))

if not TOKEN:
    raise SystemExit("TMDB_READ_TOKEN is empty.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "GKM cast cache updater v2",
    "Accept": "application/json",
}

# ВАЖНО: эти фильмы всегда добавляем, даже если они не попали в лимит.
# 155 = The Dark Knight
# 157336 = Interstellar
# 13 = Forrest Gump
# 238 = The Godfather
# 680 = Pulp Fiction
# 27205 = Inception
# 603 = The Matrix
MUST_INCLUDE = [
    {"key": "movie:155", "kind": "movie", "tmdbId": 155, "itemId": "155", "title": "Тёмный рыцарь", "score": 999999999},
    {"key": "movie:157336", "kind": "movie", "tmdbId": 157336, "itemId": "157336", "title": "Интерстеллар", "score": 999999998},
    {"key": "movie:13", "kind": "movie", "tmdbId": 13, "itemId": "13", "title": "Форрест Гамп", "score": 999999997},
    {"key": "movie:238", "kind": "movie", "tmdbId": 238, "itemId": "238", "title": "Крёстный отец", "score": 999999996},
    {"key": "movie:680", "kind": "movie", "tmdbId": 680, "itemId": "680", "title": "Криминальное чтиво", "score": 999999995},
    {"key": "movie:27205", "kind": "movie", "tmdbId": 27205, "itemId": "27205", "title": "Начало", "score": 999999994},
    {"key": "movie:603", "kind": "movie", "tmdbId": 603, "itemId": "603", "title": "Матрица", "score": 999999993},
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

    # 1. Прямые записи из data/index.json
    index = load_json(INDEX_PATH, [])
    items.extend(extract_items(index))

    # 2. Чанки из data/index.json
    chunks = []

    if isinstance(index, dict) and isinstance(index.get("chunks"), list):
        for entry in index["chunks"]:
            p = chunk_path(entry)
            if p and p.exists():
                chunks.append(p)

    # 3. Все возможные chunk-файлы, даже если index.json их не указал
    for p in sorted(DATA_DIR.glob("chunk*.json")):
        if p not in chunks:
            chunks.append(p)

    for p in chunks:
        data = load_json(p, [])
        items.extend(extract_items(data))

    # 4. movies_updates.json тоже читаем
    updates = load_json(UPDATES_PATH, {})
    items.extend(extract_items(updates))

    # Убираем точные дубли
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
    t = str(item.get("type", "")).lower()
    return "tv" if "сериал" in t else "movie"


def tmdb_id(item):
    kind = media_kind(item)
    direct = item.get("tmdbId") or item.get("tmdb_id") or item.get("tmdbID")

    if direct:
        try:
            return int(direct)
        except Exception:
            pass

    source = str(item.get("source") or item.get("provider") or item.get("category") or "").lower()
    raw_id = item.get("id")

    try:
        numeric = int(raw_id)
    except Exception:
        return None

    # Самый важный вариант твоей базы:
    # id: 155, source: tmdb
    if "tmdb" in source and 0 < numeric < 2_000_000:
        return numeric

    if kind == "movie" and 7_000_000 < numeric < 8_000_000:
        return numeric - 7_000_000

    if kind == "tv" and 8_000_000 < numeric < 9_000_000:
        return numeric - 8_000_000

    return None


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


def fetch_credits(kind, tid):
    url = f"https://api.themoviedb.org/3/{kind}/{tid}/credits?language=ru-RU"
    req = urllib.request.Request(url, headers=HEADERS)

    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


def build_targets():
    items = load_all_items()
    targets = []

    for item in items:
        if not isinstance(item, dict):
            continue

        if is_anime(item):
            continue

        kind = media_kind(item)

        if kind not in ("movie", "tv"):
            continue

        tid = tmdb_id(item)

        if not tid:
            continue

        targets.append({
            "key": f"{kind}:{tid}",
            "kind": kind,
            "tmdbId": tid,
            "itemId": str(item.get("id") or ""),
            "title": item.get("ru") or item.get("en") or "",
            "score": score(item),
        })

    # must include ставим поверх всего
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

    updated = 0
    skipped = 0
    failed = 0

    for i, t in enumerate(targets, start=1):
        key = t["key"]

        if key in result_items and result_items[key].get("cast"):
            skipped += 1
            continue

        try:
            data = fetch_credits(t["kind"], t["tmdbId"])
            raw_cast = data.get("cast") or []

            cast = []

            for p in raw_cast[:16]:
                name = p.get("name") or p.get("original_name") or ""
                role = p.get("character") or ""

                if not name:
                    continue

                cast.append({
                    "name": name,
                    "role": role,
                    "profile": p.get("profile_path") or "",
                })

            result_items[key] = {
                "kind": t["kind"],
                "tmdbId": t["tmdbId"],
                "itemId": t["itemId"],
                "title": t["title"],
                "cast": cast,
            }

            updated += 1

            if i % 25 == 0:
                print(f"Processed {i}/{len(targets)} updated={updated} skipped={skipped} failed={failed}")

            time.sleep(0.15)
        except Exception as e:
            failed += 1
            print(f"Failed {key} {t['title']}: {e}")
            time.sleep(0.8)

    out = {
        "version": int(old.get("version", 0) or 0) + 1 if isinstance(old, dict) else 1,
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "count": len(result_items),
        "limit": LIMIT,
        "items": result_items,
    }

    save_json(OUT_PATH, out)

    print("GKM cast cache v2 complete")
    print(f"Targets: {len(targets)}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    print(f"Written: {OUT_PATH}")

    for key in ("movie:155", "movie:157336"):
        print(f"Check {key}: {'YES' if key in result_items else 'NO'}")


if __name__ == "__main__":
    main()
