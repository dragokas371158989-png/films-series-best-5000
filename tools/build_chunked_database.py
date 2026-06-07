import json
import math
import re
from pathlib import Path
from datetime import datetime, timezone

SOURCE_FILE = Path("movies_updates.json")
DATA_DIR = Path("data")
CHUNKS_DIR = DATA_DIR / "chunks"
INDEX_FILE = DATA_DIR / "index.json"

CHUNK_SIZE = 500


def read_json(path: Path):
    if not path.exists():
        raise SystemExit(f"{path} not found")

    return json.loads(path.read_text(encoding="utf-8"))


def extract_movies(data):
    if isinstance(data, list):
        return data, 1, datetime.now(timezone.utc).isoformat()

    if isinstance(data, dict):
        movies = (
            data.get("films")
            or data.get("movies")
            or data.get("items")
            or data.get("data")
            or []
        )

        version = data.get("version", 1)
        generated_at = (
            data.get("generatedAt")
            or data.get("generated_at")
            or datetime.now(timezone.utc).isoformat()
        )

        return movies, version, generated_at

    return [], 1, datetime.now(timezone.utc).isoformat()


def norm_text(value):
    value = str(value or "").lower().strip()
    value = value.replace("ё", "е")
    value = re.sub(r"[^\wа-яa-z0-9]+", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def norm_poster(value):
    value = str(value or "").strip()
    if not value:
        return ""

    return value.split("/")[-1].lower().strip()


def get_year(m):
    try:
        return int(m.get("year") or 0)
    except Exception:
        return 0


def get_rating(m):
    try:
        return float(m.get("rating") or 0)
    except Exception:
        return 0


def get_votes(m):
    try:
        return int(m.get("votes") or 0)
    except Exception:
        return 0


def get_popularity(m):
    try:
        return float(m.get("popularity") or 0)
    except Exception:
        return 0


def is_anime(m):
    item_type = str(m.get("type") or "").lower()
    category = str(m.get("category") or "").lower()
    genres = m.get("genres") or []
    genres_text = " ".join(str(g).lower() for g in genres)

    return (
        "аниме" in item_type
        or "аниме" in category
        or "аниме" in genres_text
    )


def item_score(m):
    rating = get_rating(m)
    votes = get_votes(m)
    popularity = get_popularity(m)
    year = get_year(m)

    score = rating * 10
    score += min(votes / 1000, 25)
    score += min(popularity / 40, 15)

    if is_anime(m):
        score += 5

    if year >= 2020:
        score += 2

    if m.get("overview"):
        score += 1

    if m.get("backdrop"):
        score += 1

    return score


def all_keys(m):
    keys = []

    item_id = str(m.get("id") or "").strip()
    ru = norm_text(m.get("ru") or m.get("title") or m.get("name"))
    en = norm_text(m.get("en") or m.get("original_title") or m.get("original_name"))
    year = get_year(m)
    poster = norm_poster(m.get("poster"))

    # Самое жёсткое: одинаковый TMDB id считаем дублем даже если тип разный
    if item_id:
        keys.append(f"id:{item_id}")

    # Название + год
    if ru and year:
        keys.append(f"ru:{ru}:{year}")
        keys.append(f"ru:{ru}:{year - 1}")
        keys.append(f"ru:{ru}:{year + 1}")

    if en and year:
        keys.append(f"en:{en}:{year}")
        keys.append(f"en:{en}:{year - 1}")
        keys.append(f"en:{en}:{year + 1}")

    # Постер — самый надёжный признак дубля
    if poster:
        keys.append(f"poster:{poster}")

    # Название без года тоже добавляем, но только если оно достаточно длинное
    if ru and len(ru) >= 6:
        keys.append(f"ru_only:{ru}")

    if en and len(en) >= 6:
        keys.append(f"en_only:{en}")

    return keys


def merge_items(old, new):
    """
    Объединяем дубль: оставляем более качественную запись,
    но сохраняем аниме-тип, если одна из версий была аниме.
    """

    best = new if item_score(new) > item_score(old) else old

    old_is_anime = is_anime(old)
    new_is_anime = is_anime(new)

    if old_is_anime or new_is_anime:
        best["type"] = "Аниме"
        best["category"] = "Аниме"

        genres = best.get("genres") or []
        if not isinstance(genres, list):
            genres = []

        if "Аниме" not in genres:
            genres.append("Аниме")

        best["genres"] = genres

    # Если у лучшей версии нет описания/постера/бекдропа, берём из другой
    for field in ["overview", "poster", "backdrop", "ru", "en"]:
        if not best.get(field):
            best[field] = old.get(field) or new.get(field) or ""

    return best


def dedupe_movies(movies):
    key_to_item = {}
    result = []

    for m in movies:
        if not isinstance(m, dict):
            continue

        keys = all_keys(m)
        if not keys:
            continue

        found = None

        for key in keys:
            if key in key_to_item:
                found = key_to_item[key]
                break

        if found is None:
            result.append(m)
            for key in keys:
                key_to_item[key] = m
        else:
            merged = merge_items(found, m)

            if merged is not found:
                try:
                    index = result.index(found)
                    result[index] = merged
                except ValueError:
                    result.append(merged)

            # Все ключи старой и новой версии цепляем к merged
            for key in all_keys(found) + keys + all_keys(merged):
                key_to_item[key] = merged

            # Если found заменился, обновляем result
            if merged is found:
                pass

    # Второй проход: убираем одинаковые объекты/одинаковые постеры
    final = []
    seen = set()

    for m in result:
        keys = all_keys(m)
        signature = "|".join(keys[:5])

        if signature in seen:
            continue

        seen.add(signature)
        final.append(m)

    return final


def compact_movie(m):
    genres = m.get("genres") or []
    if not isinstance(genres, list):
        genres = []

    ru = m.get("ru") or m.get("title") or m.get("name") or ""
    en = m.get("en") or m.get("original_title") or m.get("original_name") or ""

    item_type = m.get("type") or m.get("category") or ""
    category = m.get("category") or item_type

    if is_anime(m):
        item_type = "Аниме"
        category = "Аниме"
        if "Аниме" not in genres:
            genres.append("Аниме")

    return {
        "id": m.get("id"),
        "ru": ru,
        "en": en,
        "year": get_year(m),
        "type": item_type,
        "category": category,
        "rating": get_rating(m),
        "votes": get_votes(m),
        "popularity": get_popularity(m),
        "genres": genres,
        "overview": m.get("overview") or "",
        "poster": m.get("poster") or "",
        "backdrop": m.get("backdrop") or "",
        "source": m.get("source") or "tmdb",
    }


def main():
    data = read_json(SOURCE_FILE)
    movies, version, generated_at = extract_movies(data)

    if not isinstance(movies, list):
        movies = []

    movies = [m for m in movies if isinstance(m, dict)]
    movies = [m for m in movies if m.get("poster")]

    before = len(movies)

    movies = dedupe_movies(movies)

    movies.sort(key=item_score, reverse=True)

    after = len(movies)

    DATA_DIR.mkdir(exist_ok=True)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

    for old_file in CHUNKS_DIR.glob("chunk_*.json"):
        old_file.unlink()

    total = len(movies)
    chunk_count = math.ceil(total / CHUNK_SIZE) if total else 0

    chunks = []

    for i in range(chunk_count):
        start = i * CHUNK_SIZE
        end = start + CHUNK_SIZE

        chunk_movies = movies[start:end]
        compact_items = [compact_movie(m) for m in chunk_movies]

        chunk_name = f"chunk_{i + 1:04d}.json"
        chunk_file = CHUNKS_DIR / chunk_name
        chunk_url = f"data/chunks/{chunk_name}"

        chunk_data = {
            "chunk": i + 1,
            "count": len(compact_items),
            "items": compact_items,
            "films": compact_items,
            "movies": compact_items,
        }

        chunk_file.write_text(
            json.dumps(chunk_data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8"
        )

        chunks.append({
            "file": chunk_url,
            "url": chunk_url,
            "path": chunk_url,
            "name": chunk_name,
            "count": len(compact_items),
        })

    index_data = {
        "version": version,
        "generatedAt": generated_at,
        "count": total,
        "total": total,
        "totalCount": total,
        "beforeDedupe": before,
        "afterDedupe": after,
        "removedDuplicates": before - after,
        "chunkSize": CHUNK_SIZE,
        "chunksCount": chunk_count,
        "chunks": chunks,
        "files": chunks,
        "parts": chunks,
    }

    INDEX_FILE.write_text(
        json.dumps(index_data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

    print("DONE")
    print("Source:", SOURCE_FILE)
    print("Before dedupe:", before)
    print("After dedupe:", after)
    print("Removed duplicates:", before - after)
    print("Chunks:", chunk_count)
    print("Index:", INDEX_FILE)


if __name__ == "__main__":
    main()
