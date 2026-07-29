#!/usr/bin/env python3
"""Build a balanced local 48x72 poster atlas for every Canvas category."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import ssl
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageFile, ImageOps

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
SEARCH_PATH = ROOT / "data" / "fast" / "search_index.json"
DEST = ROOT / "data" / "fast" / "poster_atlas_v364"
TMP = ROOT / "data" / "fast" / ".poster_atlas_v364_tmp"
REPORT = ROOT / "TEST_REPORT_V364_POSTER_ATLAS.json"
CACHE = ROOT / ".gkm_v364_atlas_cache"

TILE_W = 48
TILE_H = 72
SHEET_COLS = 20
SHEET_ROWS = 20
PER_SHEET = SHEET_COLS * SHEET_ROWS
DEFAULT_TARGET = 400
DEFAULT_WORKERS = 48
USER_AGENT = "Mozilla/5.0 (compatible; GKM-Poster-Atlas-V364/1.0)"
TLS = ssl.create_default_context()
LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def norm(value: Any) -> str:
    value = clean(value).lower().replace("ё", "е")
    return re.sub(r"[^0-9a-zа-я]+", " ", value, flags=re.I).strip()


def kind_of(item: dict) -> str:
    item_type = norm(item.get("type") or item.get("category"))
    if "аниме" in item_type or item_type == "anime":
        return "anime"
    if "мульт" in item_type or "cartoon" in item_type:
        return "cartoons"
    if "сериал" in item_type or item_type in {"series", "tv"}:
        return "series"
    return "movies"


def atlas_key(item: dict) -> str:
    source = norm(item.get("source") or "catalog") or "catalog"
    item_id = clean(
        item.get("id")
        or item.get("tmdbId")
        or item.get("kinopoiskId")
        or item.get("mal_id")
    )
    if item_id:
        return f"{kind_of(item)}|{source}|{item_id}"
    return f"{kind_of(item)}|{norm(item.get('ru') or item.get('en'))}|{clean(item.get('year'))}"


def poster_identity(url: str) -> str:
    value = clean(url)
    if not value:
        return ""
    try:
        parsed = urlparse(value)
        path = re.sub(r"/t/p/[^/]+/", "/t/p/_/", parsed.path, flags=re.I)
        path = re.sub(r"/\d+x\d+$", "/_", path, flags=re.I)
        return f"{parsed.netloc.lower()}{path.lower()}"
    except Exception:
        return value.lower()


def small_url(raw: str) -> str:
    value = clean(raw)
    if not re.match(r"^https?://", value, re.I):
        return ""
    try:
        parsed = urlparse(value)
        host = parsed.hostname.lower() if parsed.hostname else ""
        if host in {"image.tmdb.org", "media.themoviedb.org"}:
            value = re.sub(r"/t/p/[^/]+/", "/t/p/w185/", value, count=1, flags=re.I)
        elif "avatars.mds.yandex.net" in host:
            value = re.sub(r"/\d+x\d+(?:_\d+)?$", "/300x450", value, count=1, flags=re.I)
        elif "cdn.myanimelist.net" in host:
            return re.sub(r"l(\.[a-z0-9]+)$", r"\1", value, count=1, flags=re.I)
        elif host in {"images.weserv.nl", "wsrv.nl"}:
            return value
    except Exception:
        return value
    remote = re.sub(r"^https?://", "", value, flags=re.I)
    return (
        "https://wsrv.nl/?url="
        + quote(remote, safe="")
        + f"&w={TILE_W}&h={TILE_H}&fit=cover&output=webp&q=68"
    )


def download_tile(item: dict, timeout: float) -> tuple[str, Image.Image] | None:
    url = small_url(item.get("poster"))
    if not url:
        return None
    cache_key = hashlib.sha1(poster_identity(item.get("poster")).encode("utf-8")).hexdigest()
    cache_path = CACHE / f"{cache_key}.webp"
    if cache_path.exists():
        try:
            with Image.open(cache_path) as cached:
                cached.load()
                return atlas_key(item), cached.convert("RGB").copy()
        except Exception:
            cache_path.unlink(missing_ok=True)
    try:
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
        )
        with urlopen(request, timeout=timeout, context=TLS) as response:
            content_type = str(response.headers.get("content-type") or "")
            if "image" not in content_type.lower():
                return None
            payload = response.read(2_000_000)
        if len(payload) < 250:
            return None
        with Image.open(io.BytesIO(payload)) as source:
            source.load()
            if source.width < 20 or source.height < 30:
                return None
            image = ImageOps.fit(
                source.convert("RGB"),
                (TILE_W, TILE_H),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
        CACHE.mkdir(parents=True, exist_ok=True)
        try:
            image.save(cache_path, "WEBP", quality=72, method=3)
        except Exception:
            pass
        return atlas_key(item), image
    except Exception:
        return None


def category_candidates(rows: list[dict], kind: str, limit: int) -> list[dict]:
    output = []
    seen_keys = set()
    seen_posters = set()
    for item in rows:
        if not isinstance(item, dict) or kind_of(item) != kind:
            continue
        poster = clean(item.get("poster"))
        key = atlas_key(item)
        poster_key = poster_identity(poster)
        if not poster or not key or key in seen_keys or not poster_key or poster_key in seen_posters:
            continue
        seen_keys.add(key)
        seen_posters.add(poster_key)
        output.append(item)
    def transport_rank(item: dict) -> tuple[int, int]:
        host = (urlparse(clean(item.get("poster"))).hostname or "").lower()
        if "avatars.mds.yandex.net" in host or "cdn.myanimelist.net" in host:
            return (0, -int(item.get("votes") or 0))
        if host in {"image.tmdb.org", "media.themoviedb.org"}:
            return (2, -int(item.get("votes") or 0))
        return (1, -int(item.get("votes") or 0))
    output.sort(key=transport_rank)
    return output[:limit]


def fetch_category(
    rows: list[dict],
    kind: str,
    target: int,
    workers: int,
    timeout: float,
) -> tuple[list[tuple[str, Image.Image]], dict[str, int]]:
    candidates = category_candidates(rows, kind, max(target * 3, target + 600))
    successes: list[tuple[str, Image.Image]] = []
    attempted = 0
    batch_size = max(120, workers * 4)

    for start in range(0, len(candidates), batch_size):
        if len(successes) >= target:
            break
        batch = candidates[start:start + batch_size]
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(download_tile, item, timeout) for item in batch]
            for future in as_completed(futures):
                attempted += 1
                result = future.result()
                if result is not None:
                    successes.append(result)
                    if len(successes) >= target:
                        for pending in futures:
                            pending.cancel()
                        break

    return successes[:target], {
        "candidates": len(candidates),
        "attempted": attempted,
        "available": min(target, len(successes)),
        "failed": max(0, attempted - len(successes)),
    }


def save_category(
    kind: str,
    tiles: list[tuple[str, Image.Image]],
    entries: dict[str, list[Any]],
) -> list[dict[str, int | str]]:
    sheets = []
    for start in range(0, len(tiles), PER_SHEET):
        page = tiles[start:start + PER_SHEET]
        sheet = Image.new("RGB", (SHEET_COLS * TILE_W, SHEET_ROWS * TILE_H), (3, 10, 25))
        file_name = f"{kind}_{start // PER_SHEET + 1:02d}.webp"
        for offset, (key, image) in enumerate(page):
            col = offset % SHEET_COLS
            row = offset // SHEET_COLS
            x = col * TILE_W
            y = row * TILE_H
            sheet.paste(image, (x, y))
            entries[key] = [file_name, x, y]
        path = TMP / file_name
        sheet.save(path, "WEBP", quality=72, method=4)
        sheets.append(
            {
                "file": file_name,
                "start": start,
                "count": len(page),
                "available": len(page),
                "bytes": path.stat().st_size,
            }
        )
    return sheets


def reuse_legacy_category(
    rows: list[dict],
    entries: dict[str, list[Any]],
    kind: str,
    target: int,
) -> tuple[list[dict[str, int | str]], int]:
    legacy = ROOT / "data" / "fast" / "poster_atlas_v358"
    manifest_path = legacy / "manifest.json"
    if not manifest_path.exists():
        return [], 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_id: dict[str, list[dict]] = {}
    for item in rows:
        if isinstance(item, dict) and kind_of(item) == kind:
            by_id.setdefault(clean(item.get("id")), []).append(item)
    used_files = set()
    available = 0
    for legacy_id, tile in (manifest.get("entries") or {}).items():
        if not isinstance(tile, list) or len(tile) < 3:
            continue
        candidates = by_id.get(clean(legacy_id), [])
        if len(candidates) != 1:
            continue
        file_name = clean(tile[0])
        source = legacy / file_name
        if not source.exists():
            continue
        entries[atlas_key(candidates[0])] = [file_name, int(tile[1]), int(tile[2])]
        used_files.add(file_name)
        available += 1
    if available < target:
        return [], 0
    for file_name in used_files:
        shutil.copy2(legacy / file_name, TMP / file_name)
    old_sheets = manifest.get("categories", {}).get(kind, {}).get("sheets", [])
    sheets = [
        {
            "file": clean(sheet.get("file")),
            "start": int(sheet.get("start") or 0),
            "count": int(sheet.get("count") or 0),
            "available": int(sheet.get("available") or 0),
            "bytes": (TMP / clean(sheet.get("file"))).stat().st_size,
        }
        for sheet in old_sheets
        if isinstance(sheet, dict) and clean(sheet.get("file")) in used_files
    ]
    return sheets, available


def write_json(path: Path, value: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        ),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--legacy-only",
        action="store_true",
        help="convert the current verified atlas without network downloads",
    )
    args = parser.parse_args()
    target = max(100, min(1000, args.target))
    workers = max(4, min(64, args.workers))

    rows = json.loads(SEARCH_PATH.read_text(encoding="utf-8"))
    source_sha = hashlib.sha256(SEARCH_PATH.read_bytes()).hexdigest()
    old_manifest = {}
    if (DEST.joinpath("manifest.json").exists()):
        old_manifest = json.loads(DEST.joinpath("manifest.json").read_text(encoding="utf-8"))
    if (
        not args.force
        and old_manifest.get("sourceSha256") == source_sha
        and int(old_manifest.get("targetPerCategory") or 0) == target
        and all(
            int(old_manifest.get("categories", {}).get(kind, {}).get("available") or 0) >= target
            for kind in ("movies", "series", "anime", "cartoons")
        )
    ):
        print(json.dumps({"version": "364", "status": "up-to-date"}, ensure_ascii=False))
        return 0

    if TMP.exists():
        shutil.rmtree(TMP)
    TMP.mkdir(parents=True)

    entries: dict[str, list[Any]] = {}
    categories = {}
    fetch_stats = {}
    for kind in ("movies", "series", "anime", "cartoons"):
        if args.legacy_only or kind == "movies":
            sheets, available = reuse_legacy_category(
                rows,
                entries,
                kind,
                0 if args.legacy_only else target,
            )
            if args.legacy_only or available >= target:
                categories[kind] = {
                    "sheets": sheets,
                    "total": available,
                    "available": available,
                }
                fetch_stats[kind] = {
                    "candidates": available,
                    "attempted": 0,
                    "available": available,
                    "failed": 0,
                    "reusedLegacy": 1,
                }
                print(f"{kind}: reused {available} verified local posters")
                continue
        tiles, stats = fetch_category(rows, kind, target, workers, args.timeout)
        if len(tiles) < min(target, 600):
            raise RuntimeError(
                f"{kind}: only {len(tiles)} posters downloaded; at least {min(target, 600)} required"
            )
        sheets = save_category(kind, tiles, entries)
        categories[kind] = {
            "sheets": sheets,
            "total": stats["candidates"],
            "available": len(tiles),
        }
        fetch_stats[kind] = stats
        print(f"{kind}: {len(tiles)}/{stats['attempted']} posters")

    manifest = {
        "version": "364",
        "generatedAt": now_iso(),
        "source": "data/fast/search_index.json",
        "sourceSha256": source_sha,
        "targetPerCategory": target,
        "tileWidth": TILE_W,
        "tileHeight": TILE_H,
        "sheetColumns": SHEET_COLS,
        "sheetRows": SHEET_ROWS,
        "entries": entries,
        "categories": categories,
        "available": len(entries),
        "total": target * 4,
    }
    write_json(TMP / "manifest.json", manifest)
    if DEST.exists():
        shutil.rmtree(DEST)
    TMP.rename(DEST)

    report = {
        "version": "V364",
        "generatedAt": now_iso(),
        "status": "legacy-converted" if args.legacy_only else "success",
        "targetPerCategory": target,
        "available": len(entries),
        "categories": fetch_stats,
    }
    write_json(REPORT, report, pretty=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
