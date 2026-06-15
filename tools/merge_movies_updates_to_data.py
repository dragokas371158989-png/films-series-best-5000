import json
import os
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")
INDEX_PATH = DATA_DIR / "index.json"
UPDATES_PATH = Path("movies_updates.json")
CHUNK_SIZE = int(os.environ.get("GKM_CHUNK_SIZE", "500"))


def load_json(path, default):
    if not path.exists():
        return default

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Не смог прочитать {path}: {e}")
        return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def extract_items(data):
    if isinstance(data, list):
        return data

    if not isinstance(data, dict):
        return []

    for key in ("movies", "items", "data", "results", "titles"):
        value = data.get(key)
        if isinstance(value, list):
            return value

    return []


def extract_updates():
    data = load_json(UPDATES_PATH, {"movies": []})
    return extract_items(data)


def chunk_path_from_entry(entry):
    if isinstance(entry, str):
        return DATA_DIR / entry

    if isinstance(entry, dict):
        for key in ("file", "path", "url", "src", "href"):
            value = entry.get(key)
            if value:
                value = str(value).lstrip("/")
                if value.startswith("data/"):
                    return Path(value)
                return DATA_DIR / value

    return None


def discover_chunk_files(index_data):
    files = []

    if isinstance(index_data, dict):
        chunks = index_data.get("chunks")

        if isinstance(chunks, list):
            for entry in chunks:
                p = chunk_path_from_entry(entry)
                if p and p.exists():
                    files.append(p)

    if not files:
        files = sorted(DATA_DIR.glob("chunk*.json"))

    if not files:
        files = sorted(DATA_DIR.glob("*.chunk.json"))

    return files


def load_main_database():
    index_data = load_json(INDEX_PATH, [])
    index_items = extract_items(index_data)

    if index_items:
        return index_data, index_items, []

    chunk_files = discover_chunk_files(index_data)
    items = []

    for file in chunk_files:
        chunk_data = load_json(file, [])
        chunk_items = extract_items(chunk_data)
        items.extend(chunk_items)

    return index_data, items, chunk_files


def normalize_text(value):
    return " ".join(str(value or "").strip().lower().split())


def make_keys(item):
    keys = set()

    item_id = item.get("id")
    tmdb_id = item.get("tmdbId") or item.get("tmdb_id")
    item_type = normalize_text(item.get("type"))
    year = normalize_text(item.get("year"))
    ru = normalize_text(item.get("ru") or item.get("title_ru"))
    en = normalize_text(item.get("en") or item.get("title_en") or item.get("original_title") or item.get("original_name"))

    if item_id not in (None, ""):
        keys.add(f"id:{item_id}")

    if tmdb_id not in (None, ""):
        keys.add(f"tmdb:{tmdb_id}:{item_type}")

    if en:
        keys.add(f"en:{en}:{year}:{item_type}")

    if ru:
        keys.add(f"ru:{ru}:{year}:{item_type}")

    return keys


def is_good_value(value):
    if value is None:
        return False

    if isinstance(value, str) and not value.strip():
        return False

    if isinstance(value, list) and not value:
        return False

    return True


def merge_item(base, update):
    # Обновляем только полезные поля, пустотой старое не затираем.
    preferred_fields = [
        "ru",
        "en",
        "year",
        "type",
        "episodes",
        "status",
        "studio",
        "rating",
        "votes",
        "poster",
        "backdrop",
        "overview",
        "genres",
        "source",
        "tmdbId",
        "id",
    ]

    for key in preferred_fields:
        if key in update and is_good_value(update.get(key)):
            base[key] = update[key]

    return base


def build_index(items):
    by_key = {}
    result = []

    for item in items:
        if not isinstance(item, dict):
            continue

        keys = make_keys(item)
        found = None

        for key in keys:
            if key in by_key:
                found = by_key[key]
                break

        if found is None:
            result.append(item)
            for key in keys:
                by_key[key] = item
        else:
            merge_item(found, item)
            for key in make_keys(found):
                by_key[key] = found

    return result, by_key


def update_manifest(index_data, chunk_files, count):
    generated_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    if not isinstance(index_data, dict):
        return {
            "version": 1,
            "generatedAt": generated_at,
            "count": count,
            "chunkSize": CHUNK_SIZE,
            "chunks": [p.name for p in chunk_files],
        }

    index_data["generatedAt"] = generated_at
    index_data["count"] = count
    index_data["total"] = count
    index_data["chunkSize"] = CHUNK_SIZE

    old_chunks = index_data.get("chunks")

    if isinstance(old_chunks, list) and old_chunks and isinstance(old_chunks[0], dict):
        new_chunks = []

        for idx, path in enumerate(chunk_files):
            new_chunks.append({
                "file": path.name,
                "count": count_items_in_file(path),
                "index": idx,
            })

        index_data["chunks"] = new_chunks
    else:
        index_data["chunks"] = [p.name for p in chunk_files]

    # Чтобы старые поля тоже были живые, если сайт их читает.
    if "movies" in index_data and isinstance(index_data.get("movies"), list):
        index_data.pop("movies", None)

    if "items" in index_data and isinstance(index_data.get("items"), list):
        index_data.pop("items", None)

    return index_data


def count_items_in_file(path):
    data = load_json(path, [])
    return len(extract_items(data))


def write_chunks(items):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Удаляем старые chunk-файлы, чтобы не осталось мусора.
    for old in DATA_DIR.glob("chunk*.json"):
        try:
            old.unlink()
        except Exception:
            pass

    chunk_files = []

    for start in range(0, len(items), CHUNK_SIZE):
        num = len(chunk_files) + 1
        path = DATA_DIR / f"chunk_{num:03d}.json"
        part = items[start:start + CHUNK_SIZE]
        save_json(path, part)
        chunk_files.append(path)

    return chunk_files


def main():
    if not UPDATES_PATH.exists():
        raise SystemExit("movies_updates.json не найден. Сначала запусти update_movies_updates.py")

    index_data, main_items, old_chunk_files = load_main_database()
    update_items = extract_updates()

    if not update_items:
        raise SystemExit("В movies_updates.json нет movies/items для вливания.")

    merged_items, by_key = build_index(main_items)
    before = len(merged_items)

    updated = 0
    added = 0

    for update in update_items:
        if not isinstance(update, dict):
            continue

        keys = make_keys(update)
        found = None

        for key in keys:
            if key in by_key:
                found = by_key[key]
                break

        if found is None:
            merged_items.append(update)
            for key in make_keys(update):
                by_key[key] = update
            added += 1
        else:
            merge_item(found, update)
            for key in make_keys(found):
                by_key[key] = found
            updated += 1

    # Сортировка: рейтинг + голоса, чтобы лучшие были выше.
    def score(x):
        try:
            rating = float(x.get("rating") or 0)
        except Exception:
            rating = 0

        try:
            votes = int(x.get("votes") or 0)
        except Exception:
            votes = 0

        return rating * 100000 + min(votes, 100000)

    merged_items.sort(key=score, reverse=True)

    # Если index.json был прямым списком или прямым объектом с movies/items — сохраняем проще.
    if isinstance(index_data, list):
        save_json(INDEX_PATH, merged_items)
    elif isinstance(index_data, dict) and isinstance(index_data.get("movies"), list):
        index_data["movies"] = merged_items
        index_data["count"] = len(merged_items)
        index_data["generatedAt"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        save_json(INDEX_PATH, index_data)
    elif isinstance(index_data, dict) and isinstance(index_data.get("items"), list):
        index_data["items"] = merged_items
        index_data["count"] = len(merged_items)
        index_data["generatedAt"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        save_json(INDEX_PATH, index_data)
    else:
        chunk_files = write_chunks(merged_items)
        manifest = update_manifest(index_data, chunk_files, len(merged_items))
        save_json(INDEX_PATH, manifest)

    print("GKM merge movies updates to data complete")
    print(f"Before: {before}")
    print(f"Updates source: {len(update_items)}")
    print(f"Updated: {updated}")
    print(f"Added: {added}")
    print(f"Final: {len(merged_items)}")
    print(f"Written: {INDEX_PATH}")


if __name__ == "__main__":
    main()
