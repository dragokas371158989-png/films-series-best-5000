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

    # Берём только конец пути, чтобы одинаковые постеры считались дублем
    return value.split("/")[-1].lower()


def item_score(m):
    rating = float(m.get("rating") or 0)
    votes = int(m.get("votes") or 0)
    popularity = float(m.get("popularity") or 0)
    year = int(m.get("year") or 0)

    score = rating * 10
    score += min(votes / 1000, 20)
    score += min(popularity / 50, 10)

    # Чуть выше приоритет нормальным категориям
    category = str(m.get("category") or m.get("type") or "").lower()
    if "аниме" in category:
        score += 3
    if "фильм" in category:
        score += 2
    if "сериал" in category:
        score += 1

    if year >= 2020:
        score += 1

    return score


def dedupe_movies(movies):
    """
    Убирает дубли:
    1. одинаковый id + тип
    2. одинаковое русское/английское название + год
    3. одинаковый постер + год
    """

    best = {}

    for m in movies:
        if not isinstance(m, dict):
            continue

        ru = norm_text(m.get("ru") or m.get("title") or m.get("name"))
        en = norm_text(m.get("en") or m.get("original_title") or m.get("original_name"))
        year = str(m.get("year") or "").strip()
        poster = norm_poster(m.get("poster"))

        keys = []

        if ru and year:
            keys.append(f"title_ru:{ru}:{year}")

        if en and year:
            keys.append(f"title_en:{en}:{year}")

        if poster and year:
            keys.append(f"poster:{poster}:{year}")

        # Если нет нормального ключа, используем id
        if not keys:
            item_id = str(m.get("id") or "").strip()
            item_type = str(m.get("type") or m.get("category") or "").strip()
            if item_id:
                keys.append(f"id:{item_type}:{item_id}")

        if not keys:
            continue

        main_key = keys[0]

        # Если какой-то из ключей уже есть — считаем дублем
        existing_key = None
        for key in keys:
            if key in best:
                existing_key = key
                break

        if existing_key is None:
            best[main_key] = m

            # Привязываем все ключи к этой же записи
            for key in keys:
                best[key] = m
        else:
            old = best[existing_key]

            # Оставляем более качественную версию
            if item_score(m) > item_score(old):
                for key in keys:
                    best[key] = m

                # Обновляем старые ключи, которые ссылались на old
                for key, value in list(best.items()):
                    if value is old:
                        best[key] = m

    # Убираем повторные ссылки на один и тот же объект
    result = []
    seen_objects = set()

    for m in best.values():
        object_id = id(m)
        if object_id in seen_objects:
            continue

        seen_objects.add(object_id)
        result.append(m)

    return result


def compact_movie(m):
    genres = m.get("genres") or []
    if not isinstance(genres, list):
        genres = []

    ru = m.get("ru") or m.get("title") or m.get("name") or ""
    en = m.get("en") or m.get("original_title") or m.get("original_name") or ""

    item_type = m.get("type") or m.get("category") or ""
    category = m.get("category") or item_type

    # Если в жанрах есть Аниме, тип тоже делаем Аниме
    genres_text = " ".join(str(g).lower() for g in genres)
    if "аниме" in genres_text:
        item_type = "Аниме"
        category = "Аниме"

    return {
        "id": m.get("id"),
        "ru": ru,
        "en": en,
        "year": m.get("year") or 0,
        "type": item_type,
        "category": category,
        "rating": m.get("rating") or 0,
        "votes": m.get("votes") or 0,
        "popularity": m.get("popularity") or 0,
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
