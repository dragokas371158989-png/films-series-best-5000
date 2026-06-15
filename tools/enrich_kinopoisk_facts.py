import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

FAST_DIR = Path("data/fast")
SEARCH_INDEX = FAST_DIR / "search_index.json"
HOME_JSON = FAST_DIR / "home.json"
META_JSON = FAST_DIR / "meta.json"
CACHE_JSON = Path("data/kinopoisk_facts_cache.json")

API_BASE = "https://api.kinopoisk.dev/v1.4"
API_KEY = os.environ.get("KINOPOISK_API_KEY", "").strip()
LIMIT = int(os.environ.get("GKM_KINOPOISK_FACT_LIMIT", "800"))
SLEEP = float(os.environ.get("GKM_KINOPOISK_FACT_SLEEP", "0.18"))


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def norm(value):
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-я]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def key_of(item):
    return "|".join([
        str(item.get("type") or ""),
        norm(item.get("ru") or item.get("en")),
        str(item.get("year") or ""),
    ])


def title_of(item):
    return str(item.get("ru") or item.get("en") or item.get("title") or item.get("name") or "").strip()


def has_facts(item):
    return bool(item.get("episodes") or item.get("studio") or item.get("country"))


def clean_list(values, limit=4):
    out = []
    for value in values or []:
        if isinstance(value, dict):
            value = value.get("name") or value.get("title") or value.get("alternativeName") or ""
        value = str(value or "").strip()
        if value and value not in out:
            out.append(value)
    return out[:limit]


def episode_count(doc):
    total = 0
    for season in doc.get("seasonsInfo") or []:
        if not isinstance(season, dict):
            continue
        total += int(season.get("episodesCount") or season.get("episodeCount") or season.get("episodes") or 0)
    return total or doc.get("episodes") or doc.get("episodeCount") or doc.get("numberOfEpisodes") or ""


def extract_facts(doc):
    if not isinstance(doc, dict):
        return {}
    studios = clean_list((doc.get("productionCompanies") or []) + (doc.get("networks") or []))
    countries = clean_list(doc.get("countries") or [])
    facts = {
        "kinopoiskId": doc.get("id") or doc.get("kinopoiskId") or "",
        "episodes": episode_count(doc),
        "studio": studios,
        "country": countries,
        "status": doc.get("status") or "",
        "ageRating": (str(doc.get("ageRating")) + "+") if doc.get("ageRating") else "",
    }
    return {k: v for k, v in facts.items() if v not in ("", [], None)}


def request_json(url):
    req = urllib.request.Request(
        url,
        headers={
            "accept": "application/json",
            "X-API-KEY": API_KEY,
            "User-Agent": "GKM fact enricher",
        },
    )
    with urllib.request.urlopen(req, timeout=25) as res:
        return json.loads(res.read().decode("utf-8"))


def fetch_facts(item, cache):
    k = key_of(item)
    if k in cache:
        return cache[k]

    query = title_of(item)
    if not query:
        cache[k] = {}
        return {}

    params = urllib.parse.urlencode({"page": 1, "limit": 5, "query": query})
    url = f"{API_BASE}/movie/search?{params}"
    data = request_json(url)
    docs = data.get("docs") if isinstance(data, dict) else []
    if not isinstance(docs, list):
        docs = []

    year = str(item.get("year") or "")[:4]
    found = None
    if year:
        found = next((doc for doc in docs if str(doc.get("year") or "") == year), None)
    if not found:
        found = docs[0] if docs else None

    facts = extract_facts(found)
    cache[k] = facts
    return facts


def apply_facts(item, facts):
    if not isinstance(item, dict) or not facts:
        return False
    changed = False
    for field in ("kinopoiskId", "episodes", "studio", "country", "status", "ageRating"):
        if item.get(field) in ("", None, [], {}) and facts.get(field) not in ("", None, [], {}):
            item[field] = facts[field]
            changed = True
    if changed and item.get("source") in ("", None):
        item["source"] = "kinopoisk.dev"
    return changed


def update_nested_items(data, facts_by_key):
    changed = 0
    if isinstance(data, dict):
        for key in ("items", "movies", "data", "results", "records", "list"):
            if isinstance(data.get(key), list):
                for item in data[key]:
                    changed += int(apply_facts(item, facts_by_key.get(key_of(item), {})))
        if isinstance(data.get("sections"), dict):
            for items in data["sections"].values():
                if isinstance(items, list):
                    for item in items:
                        changed += int(apply_facts(item, facts_by_key.get(key_of(item), {})))
    elif isinstance(data, list):
        for item in data:
            changed += int(apply_facts(item, facts_by_key.get(key_of(item), {})))
    return changed


def main():
    if not API_KEY:
        print("KINOPOISK_API_KEY is empty. Skipping facts enrichment.")
        return
    if not SEARCH_INDEX.exists():
        raise SystemExit("data/fast/search_index.json not found")

    items = load_json(SEARCH_INDEX, [])
    if not isinstance(items, list):
        raise SystemExit("search_index.json is not a list")

    cache = load_json(CACHE_JSON, {})
    if not isinstance(cache, dict):
        cache = {}

    candidates = [
        item for item in items
        if isinstance(item, dict)
        and not has_facts(item)
        and int(item.get("votes") or 0) >= 50
        and title_of(item)
    ]
    candidates.sort(key=lambda x: (int(x.get("votes") or 0), float(x.get("rating") or 0)), reverse=True)
    candidates = candidates[:LIMIT]

    facts_by_key = {}
    api_calls = 0
    enriched = 0

    for idx, item in enumerate(candidates, 1):
        k = key_of(item)
        try:
            facts = fetch_facts(item, cache)
            api_calls += int(k not in facts_by_key)
        except Exception as exc:
            print(f"Kinopoisk facts failed: {title_of(item)} ({item.get('year')}) -> {exc}")
            facts = {}
            cache[k] = facts
        facts_by_key[k] = facts
        if apply_facts(item, facts):
            enriched += 1
        if idx % 25 == 0:
            print(f"Processed {idx}/{len(candidates)}, enriched={enriched}")
        time.sleep(SLEEP)

    save_json(SEARCH_INDEX, items)
    save_json(CACHE_JSON, cache)

    changed_files = 1
    for path in [HOME_JSON, *FAST_DIR.glob("pages/*/page_*.json")]:
        data = load_json(path, None)
        if data is None:
            continue
        if update_nested_items(data, facts_by_key):
            save_json(path, data)
            changed_files += 1

    meta = load_json(META_JSON, {})
    if isinstance(meta, dict):
        meta["kinopoiskFacts"] = {
            "enabled": True,
            "limit": LIMIT,
            "processed": len(candidates),
            "enriched": enriched,
            "cacheSize": len(cache),
            "version": "v96-kinopoisk-server-side-facts-2026-06-15",
        }
        save_json(META_JSON, meta)

    print(f"Kinopoisk facts ready: processed={len(candidates)} enriched={enriched} changedFiles={changed_files}")


if __name__ == "__main__":
    main()
