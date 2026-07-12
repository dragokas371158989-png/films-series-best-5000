#!/usr/bin/env python3
"""GKM V344 repository maintenance.

Idempotent maintenance for SEO pages, sitemap, assets, stale workflows,
search_lite, and project hygiene. Designed for GitHub Actions and local runs.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://dragokas371158989-png.github.io/films-series-best-5000/"
FILM_DIR = ROOT / "film"
FAST_DIR = ROOT / "data" / "fast"
ARCHIVE_DIR = ROOT / "docs" / "archive" / "workflows"
REPORT_PATH = ROOT / "TEST_REPORT_V344_MAINTENANCE.json"

OBSOLETE_WORKFLOWS = [
    "apply_gkm_v162_franchise_pages.yml",
    "apply_gkm_v175_watch_order_grid_sort.yml",
    "apply_gkm_v184_big_site_features.yml",
    "apply_gkm_v185_safe_big_site_features.yml",
    "apply_gkm_v186_buttons_menu_fix.yml",
    "gkm_v196_apply_site_docs.py",
    "gkm_v339_safe_auto_update.yml",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def save_json(path: Path, data: object, pretty: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (",", ":")),
        encoding="utf-8",
    )


def archive_obsolete_workflows() -> dict:
    workflows = ROOT / ".github" / "workflows"
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archived = []
    missing = []
    for name in OBSOLETE_WORKFLOWS:
        src = workflows / name
        if not src.exists():
            missing.append(name)
            continue
        dst = ARCHIVE_DIR / f"{name}.txt"
        content = src.read_text(encoding="utf-8", errors="replace")
        header = (
            "Archived by GKM V344. This file is documentation only and is not executed by GitHub Actions.\n\n"
        )
        dst.write_text(header + content, encoding="utf-8")
        src.unlink()
        archived.append(name)
    return {"archived": archived, "alreadyMissing": missing}


def fix_dedupe_script() -> dict:
    old = ROOT / "tools" / "dedupe_database_v112"
    new = ROOT / "tools" / "dedupe_database_v112.py"
    changed = False
    if old.exists():
        if not new.exists():
            shutil.copy2(old, new)
        old.unlink()
        changed = True
    return {"changed": changed, "exists": new.exists()}


def replace_asset_references() -> dict:
    touched = 0
    replacements = {
        "logo-banner.png.png": "logo-banner.webp",
        "favicon.png.png": "favicon-192.png",
    }
    for path in ROOT.rglob("*.html"):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        new_text = text
        for old, new in replacements.items():
            new_text = new_text.replace(old, new)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            touched += 1
    removed = []
    for name in replacements:
        path = ROOT / name
        if path.exists():
            path.unlink()
            removed.append(name)
    obsolete_files = [
        ROOT / "1",
        ROOT / "ai_search_worker_v343.js",
        ROOT / "tools" / "gkm_v339_build_poster_wall.py",
    ]
    for path in obsolete_files:
        if path.exists():
            path.unlink()
            removed.append(str(path.relative_to(ROOT)))
    return {"htmlTouched": touched, "removed": removed}


JSONLD_RE = re.compile(
    r'(<script\s+type=["\']application/ld\+json["\'][^>]*>)(.*?)(</script>)',
    re.IGNORECASE | re.DOTALL,
)


def fix_jsonld_pages() -> dict:
    checked = 0
    changed = 0
    valid = 0
    failures = []
    if not FILM_DIR.exists():
        return {"checked": 0, "changed": 0, "valid": 0, "failures": ["film directory missing"]}

    for path in sorted(FILM_DIR.glob("*.html")):
        if path.name == "index.html":
            continue
        checked += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        match = JSONLD_RE.search(text)
        if not match:
            continue
        raw = match.group(2).strip()
        decoded = html.unescape(raw)
        try:
            parsed = json.loads(decoded)
        except Exception as exc:
            failures.append({"file": str(path.relative_to(ROOT)), "error": str(exc)})
            continue
        clean = json.dumps(parsed, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        new_text = text[: match.start(2)] + clean + text[match.end(2) :]
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed += 1
        valid += 1
    return {"checked": checked, "changed": changed, "valid": valid, "failures": failures[:20]}


def generate_sitemap() -> dict:
    paths = [""]
    preferred = ["film/", "downloads/", "anime-tv/"]
    for rel in preferred:
        if (ROOT / rel / "index.html").exists():
            paths.append(rel)
    film_pages = [p for p in sorted(FILM_DIR.glob("*.html")) if p.name != "index.html"] if FILM_DIR.exists() else []
    for page in film_pages:
        paths.append(f"film/{quote(page.name)}")

    urls = []
    generated = now_iso()[:10]
    for rel in paths:
        loc = BASE_URL + rel
        priority = "1.0" if not rel else ("0.8" if rel.endswith("/") else "0.6")
        changefreq = "daily" if not rel else ("weekly" if rel.endswith("/") else "monthly")
        urls.append(
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{generated}</lastmod>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>"
        )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "\n".join(urls)
    xml += "\n</urlset>\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    manifest = {
        "version": "V344",
        "generatedAt": now_iso(),
        "policy": "Curated static SEO subset; the interactive catalog remains the source of truth for the full database.",
        "baseUrl": BASE_URL,
        "staticFilmPages": len(film_pages),
        "sitemapUrls": len(paths),
    }
    save_json(ROOT / "data" / "seo_manifest.json", manifest)
    return manifest



def fill_missing_search_overviews() -> dict:
    path = FAST_DIR / "search_index.json"
    if not path.exists():
        return {"changed": False, "error": "search_index.json missing"}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("search_index.json must be a list")
    changed = 0
    for item in data:
        if not isinstance(item, dict) or str(item.get("overview") or "").strip():
            continue
        title = str(item.get("ru") or item.get("en") or "Проект").strip()
        kind = str(item.get("type") or "проект").strip().lower()
        year = str(item.get("year") or "").strip()
        genres = [str(x).strip() for x in (item.get("genres") or []) if str(x).strip()]
        year_text = f" {year} года" if year else ""
        genre_text = f" Жанры: {', '.join(genres[:3])}." if genres else ""
        item["overview"] = f"«{title}» — {kind}{year_text} из каталога «ГОЛУБЬ Каталог Мира».{genre_text} Описание будет дополнено после обновления источника."
        item["overviewGenerated"] = True
        changed += 1
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"changed": bool(changed), "generated": changed, "count": len(data)}

def build_search_lite(limit: int = 15000) -> dict:
    src = FAST_DIR / "search_index.json"
    dst = FAST_DIR / "search_lite.json"
    if not src.exists():
        return {"created": False, "error": "search_index.json missing"}
    data = json.loads(src.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("search_index.json must be a list")
    rows = data[: max(1000, min(limit, len(data)))]
    dst.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"created": True, "sourceCount": len(data), "liteCount": len(rows), "bytes": dst.stat().st_size}


def add_root_seo_meta() -> dict:
    path = ROOT / "index.html"
    if not path.exists():
        return {"changed": False, "error": "index.html missing"}
    text = path.read_text(encoding="utf-8")
    new = text
    if 'name="twitter:card"' not in new:
        anchor = '  <meta property="og:locale" content="ru_RU">'
        block = anchor + (
            '\n  <meta name="twitter:card" content="summary_large_image">'
            '\n  <meta name="twitter:title" content="ГОЛУБЬ Каталог Мира">'
            '\n  <meta name="twitter:description" content="Фильмы, сериалы, аниме и мультфильмы с поиском, фильтрами и рейтингами.">'
            '\n  <meta name="twitter:image" content="https://dragokas371158989-png.github.io/films-series-best-5000/logo-banner.webp">'
        )
        new = new.replace(anchor, block)
    new = new.replace('app.js?v=343', 'app.js?v=344')
    if new != text:
        path.write_text(new, encoding="utf-8")
    return {"changed": new != text}


def validate() -> dict:
    result = {
        "app": (ROOT / "app.js").exists(),
        "index": (ROOT / "index.html").exists(),
        "features": (ROOT / "features_v344.js").exists(),
        "aiWorker": (ROOT / "ai_search_worker_v344.js").exists(),
        "searchLite": (FAST_DIR / "search_lite.json").exists(),
        "sitemap": (ROOT / "sitemap.xml").exists(),
        "favicon": (ROOT / "favicon-192.png").exists(),
        "logo": (ROOT / "logo-banner.webp").exists(),
        "dedupeScript": (ROOT / "tools" / "dedupe_database_v112.py").exists(),
    }
    result["ok"] = all(result.values())
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["all", "fast", "seo", "cleanup"], default="all")
    parser.add_argument("--search-lite-limit", type=int, default=15000)
    args = parser.parse_args()

    report = {"version": "V344", "generatedAt": now_iso(), "mode": args.mode}
    if args.mode in {"all", "cleanup"}:
        report["workflows"] = archive_obsolete_workflows()
        report["dedupeScript"] = fix_dedupe_script()
        report["assets"] = replace_asset_references()
        report["rootSeo"] = add_root_seo_meta()
    if args.mode in {"all", "seo"}:
        report["jsonLd"] = fix_jsonld_pages()
        report["sitemap"] = generate_sitemap()
    if args.mode in {"all", "fast"}:
        report["generatedOverviews"] = fill_missing_search_overviews()
        report["searchLite"] = build_search_lite(args.search_lite_limit)
    report["validation"] = validate()
    save_json(REPORT_PATH, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["validation"]["ok"]:
        raise SystemExit("V344 maintenance validation failed")
    if report.get("jsonLd", {}).get("failures"):
        raise SystemExit("V344 JSON-LD validation failed")


if __name__ == "__main__":
    main()
