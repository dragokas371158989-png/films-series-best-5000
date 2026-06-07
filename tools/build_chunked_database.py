import json
import math
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
        generated_at = data.get("generatedAt") or data.get("generated_at") or datetime.now(timezone.utc).isoformat()

        return movies, version, generated_at

    return [], 1, datetime.now(timezone.utc).isoformat()


def compact_movie(m):
    genres = m.get("genres") or []
    if not isinstance(genres, list):
        genres = []

    return {
        "id": m.get("id"),
        "ru": m.get("ru") or m.get("title") or m.get("name") or "",
        "en": m.get("en") or m.get("original_title") or m.get("original_name") or "",
        "year": m.get("year") or 0,
        "type": m.get("type") or m.get("category") or "",
        "category": m.get("category") or m.get("type") or "",
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

            # Делаем сразу все варианты, чтобы app.js точно понял
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

        # Делаем сразу несколько названий количества, чтобы сайт точно прочитал
        "count": total,
        "total": total,
        "totalCount": total,

        "chunkSize": CHUNK_SIZE,
        "chunksCount": chunk_count,

        # Делаем сразу несколько названий списка чанков
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
    print("Total movies:", total)
    print("Chunks:", chunk_count)
    print("Index:", INDEX_FILE)


if __name__ == "__main__":
    main()
