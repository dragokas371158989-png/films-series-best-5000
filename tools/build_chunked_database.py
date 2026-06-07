import json
import math
from pathlib import Path
from datetime import datetime, timezone

SOURCE_FILE = Path("movies_updates.json")
DATA_DIR = Path("data")
CHUNKS_DIR = DATA_DIR / "chunks"
INDEX_FILE = DATA_DIR / "index.json"

CHUNK_SIZE = 500


def read_movies():
    if not SOURCE_FILE.exists():
        raise SystemExit("movies_updates.json not found")

    data = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))

    if isinstance(data, list):
        movies = data
        version = 1
        generated_at = datetime.now(timezone.utc).isoformat()
    elif isinstance(data, dict):
        movies = (
            data.get("films")
            or data.get("movies")
            or data.get("items")
            or []
        )
        version = data.get("version", 1)
        generated_at = data.get("generatedAt") or datetime.now(timezone.utc).isoformat()
    else:
        movies = []
        version = 1
        generated_at = datetime.now(timezone.utc).isoformat()

    if not isinstance(movies, list):
        movies = []

    return movies, version, generated_at


def compact_movie(m):
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
        "genres": m.get("genres") or [],
        "overview": m.get("overview") or "",
        "poster": m.get("poster") or "",
        "backdrop": m.get("backdrop") or "",
        "source": m.get("source") or "tmdb",
    }


def main():
    movies, version, generated_at = read_movies()

    movies = [m for m in movies if isinstance(m, dict)]
    movies = [m for m in movies if m.get("poster")]

    DATA_DIR.mkdir(exist_ok=True)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

    for old in CHUNKS_DIR.glob("chunk_*.json"):
        old.unlink()

    chunks = []
    total = len(movies)
    chunk_count = math.ceil(total / CHUNK_SIZE) if total else 0

    for i in range(chunk_count):
        start = i * CHUNK_SIZE
        end = start + CHUNK_SIZE
        chunk_movies = movies[start:end]

        chunk_name = f"chunk_{i + 1:04d}.json"
        chunk_path = CHUNKS_DIR / chunk_name

        chunk_data = {
            "chunk": i + 1,
            "count": len(chunk_movies),
            "items": [compact_movie(m) for m in chunk_movies],
        }

        chunk_path.write_text(
            json.dumps(chunk_data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8"
        )

        chunks.append({
            "file": f"data/chunks/{chunk_name}",
            "count": len(chunk_movies),
        })

    index_data = {
        "version": version,
        "generatedAt": generated_at,
        "count": total,
        "chunkSize": CHUNK_SIZE,
        "chunksCount": chunk_count,
        "chunks": chunks,
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
