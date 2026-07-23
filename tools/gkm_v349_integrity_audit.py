#!/usr/bin/env python3
"""V349 read-only repository audit for workflows, code and generated data."""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "TEST_REPORT_V349_INTEGRITY.json"
SAFETY_LIMIT = 94 * 1024 * 1024
LITE_LIMIT = 15000
CYR = re.compile(r"[А-Яа-яЁё]")


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def text(value: Any) -> str:
    return str(value or "").strip()


def norm(value: Any) -> str:
    value = text(value).lower().replace("ё", "е")
    value = re.sub(r"[^\wа-я]+", " ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def extract_items(value: Any) -> list[dict]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("items", "movies", "data", "results", "records"):
            if isinstance(value.get(key), list):
                return [item for item in value[key] if isinstance(item, dict)]
    return []


def load_primary() -> list[dict]:
    index = read_json(ROOT / "data" / "index.json", {})
    rows: list[dict] = []
    for entry in index.get("chunks", []) if isinstance(index, dict) else []:
        raw = entry if isinstance(entry, str) else entry.get("file") or entry.get("path")
        path = ROOT / str(raw or "")
        if path.exists():
            rows.extend(extract_items(read_json(path, [])))
    return rows


def title_of(item: dict) -> str:
    for key in ("ru", "title_ru", "nameRu", "title", "name", "en", "originalTitle"):
        value = text(item.get(key))
        if value:
            return value
    return ""


def parse_page_rows(base: Path) -> tuple[int, int, list[str]]:
    search = read_json(base / "search_index.json", [])
    by_id = {
        text(item.get("id")): item
        for item in search
        if isinstance(item, dict) and text(item.get("id"))
    }
    rows = 0
    mismatches = 0
    examples = []
    for path in sorted((base / "pages").glob("**/*.json")):
        value = read_json(path, {})
        items = value.get("items", []) if isinstance(value, dict) else []
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict):
                continue
            rows += 1
            iid = text(item.get("id"))
            source = by_id.get(iid)
            if (
                not source
                or norm(item.get("ru")) != norm(source.get("ru"))
                or norm(item.get("type")) != norm(source.get("type"))
            ):
                mismatches += 1
                if len(examples) < 30:
                    examples.append(
                        f"{path.relative_to(ROOT)}:{iid}:"
                        f"{text(item.get('ru'))} != {title_of(source or {})}"
                    )
    return rows, mismatches, examples


def static_page_stats() -> dict:
    stats = {
        "pages": 0,
        "withoutStableId": 0,
        "invalidJsonLd": 0,
        "titleQueryMismatches": 0,
    }
    examples = []
    for path in sorted((ROOT / "film").glob("*.html")):
        if not re.fullmatch(r"(tv_)?\d+", path.stem):
            continue
        stats["pages"] += 1
        source = path.read_text(encoding="utf-8", errors="replace")
        if not re.search(r'\bdata-id=["\'][^"\']+["\']', source):
            stats["withoutStableId"] += 1

        ld_match = re.search(
            r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>',
            source,
            re.I | re.S,
        )
        try:
            ld = json.loads(html.unescape(ld_match.group(1))) if ld_match else None
            if not isinstance(ld, dict):
                raise ValueError("JSON-LD is not an object")
        except Exception:
            stats["invalidJsonLd"] += 1

        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", source, re.I | re.S)
        query = re.search(r"\bkp_query=([^\"&]+)", source, re.I)
        if h1 and query:
            import urllib.parse

            query_title = urllib.parse.unquote_plus(query.group(1))
            if norm(html.unescape(h1.group(1))) != norm(query_title):
                stats["titleQueryMismatches"] += 1
                if len(examples) < 30:
                    examples.append(
                        f"{path.name}: {html.unescape(h1.group(1))} != {query_title}"
                    )
    stats["mismatchExamples"] = examples
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    tests = []

    def check(name: str, passed: bool, severity: str, details: Any = None) -> None:
        tests.append(
            {
                "name": name,
                "pass": bool(passed),
                "severity": severity,
                "details": details,
            }
        )

    required = [
        "app.js",
        "index.html",
        "data/index.json",
        "data/fast/search_index.json",
        "data/fast/search_lite.json",
        "data/fast/meta.json",
        "data/fast/poster_wall_v333/manifest.json",
        "data/fast/anime_top_manual.json",
        "data/fast/anime_studios_top.json",
        "data/fast/anime_studios_detail.json",
        "tools/build_fast_site_data.py",
        "tools/gkm_v3453_1_full_russianize_dedupe.py",
        "tools/gkm_v3460_compact_search_index.py",
    ]
    missing = [path for path in required if not (ROOT / path).exists()]
    check("required-files", not missing, "critical", missing)

    js_files = [
        ROOT / "app.js",
        ROOT / "features_v344.js",
        ROOT / "ai_search_worker_v344.js",
    ]
    js_errors = {}
    for path in js_files:
        result = subprocess.run(
            ["node", "--check", str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            js_errors[path.name] = (result.stderr or result.stdout)[-1000:]
    check("javascript-syntax", not js_errors, "critical", js_errors)

    app_source = (ROOT / "app.js").read_text(encoding="utf-8")
    check("no-dynamic-eval", "eval(" not in app_source, "critical")

    builder_source = (ROOT / "tools" / "build_fast_site_data.py").read_text(encoding="utf-8")
    russian_source = (
        ROOT / "tools" / "gkm_v3453_1_full_russianize_dedupe.py"
    ).read_text(encoding="utf-8")
    check(
        "safe-title-rules",
        "Existing official Russian titles are authoritative" in builder_source
        and "nc in normalized_names" in builder_source,
        "critical",
    )
    check(
        "recursive-page-sync",
        "data/fast/pages/**/*.json" in russian_source
        and "film/data/fast/pages/**/*.json" in russian_source,
        "critical",
    )
    check(
        "no-static-filename-id-fallback",
        "iid = match.group(1) if match else path.stem" not in russian_source,
        "critical",
    )

    workflow_dir = ROOT / ".github" / "workflows"
    workflows = list(workflow_dir.glob("*.yml")) + list(workflow_dir.glob("*.yaml"))
    malformed_names = [path.name for path in workflows if " " in path.name]
    check("workflow-filenames", not malformed_names, "critical", malformed_names)

    v344_listeners = []
    for path in workflows:
        source = path.read_text(encoding="utf-8", errors="replace")
        if (
            "workflow_run:" in source
            and "GKM V344 Safe Daily Catalog Update" in source
            and "if: ${{ false }}" not in source
        ):
            v344_listeners.append(path.name)
    check(
        "single-v344-downstream-listener",
        v344_listeners == ["gkm_v3453_1_sync_after_update.yml"],
        "critical",
        v344_listeners,
    )

    master_source = (
        workflow_dir / "gkm_v3460_master_pipeline.yml"
    ).read_text(encoding="utf-8")
    downstream_dispatches = [
        name
        for name in (
            "gkm_v3453_1_sync_after_update.yml",
            "gkm_v3454_rebuild_anime_buttons.yml",
            "gkm_v3460_sync_meta.yml",
            "gkm_v3460_health_audit.yml",
        )
        if re.search(
            r"dispatch_and_wait(?:(?!wait_for_run).){0,220}"
            + re.escape(name),
            master_source,
            re.S,
        )
    ]
    check("master-does-not-double-dispatch", not downstream_dispatches, "critical", downstream_dispatches)

    primary = load_primary()
    search = read_json(ROOT / "data" / "fast" / "search_index.json", [])
    lite = read_json(ROOT / "data" / "fast" / "search_lite.json", [])
    meta = read_json(ROOT / "data" / "fast" / "meta.json", {})
    check("primary-catalog-readable", bool(primary), "critical", len(primary))
    check("search-index-readable", isinstance(search, list) and bool(search), "critical", len(search))
    check("search-lite-readable", isinstance(lite, list) and bool(lite), "critical", len(lite))

    search_ids = [text(item.get("id")) for item in search if isinstance(item, dict)]
    duplicate_ids = [iid for iid, count in Counter(search_ids).items() if iid and count > 1]
    empty_ids = sum(not iid for iid in search_ids)
    check("search-ids-valid", not duplicate_ids and not empty_ids, "critical", {
        "duplicateExamples": duplicate_ids[:30],
        "emptyIds": empty_ids,
    })
    check(
        "meta-count-matches-search",
        int(meta.get("count") or 0) == len(search),
        "critical",
        {"meta": meta.get("count"), "search": len(search)},
    )
    check(
        "search-lite-limited",
        1000 <= len(lite) <= min(LITE_LIMIT, len(search)),
        "critical",
        len(lite),
    )

    represented_ids = set(search_ids)
    for item in search:
        if isinstance(item, dict):
            represented_ids.update(text(value) for value in item.get("mergedDuplicateIds", []) if text(value))
    primary_ids = {text(item.get("id")) for item in primary if text(item.get("id"))}
    missing_primary_ids = sorted(primary_ids - represented_ids)
    check(
        "primary-ids-preserved-after-dedupe",
        not missing_primary_ids,
        "critical",
        {"missingCount": len(missing_primary_ids), "examples": missing_primary_ids[:50]},
    )

    untranslated = [
        (text(item.get("id")), title_of(item))
        for item in search
        if title_of(item)
        and not CYR.search(title_of(item))
        and not re.sub(
            r"[\W_]+",
            "",
            title_of(item),
            flags=re.UNICODE,
        ).isdigit()
    ]
    check(
        "russian-display-titles",
        not untranslated,
        "critical",
        {"count": len(untranslated), "examples": untranslated[:30]},
    )

    for base in (ROOT / "data" / "fast", ROOT / "film" / "data" / "fast"):
        if not base.exists():
            continue
        label = str(base.relative_to(ROOT))
        full = base / "search_index.json"
        lite_path = base / "search_lite.json"
        check(
            f"{label}-search-size",
            full.exists() and full.stat().st_size < SAFETY_LIMIT,
            "critical",
            full.stat().st_size if full.exists() else None,
        )
        mirror_lite = read_json(lite_path, [])
        check(
            f"{label}-lite-limit",
            isinstance(mirror_lite, list)
            and 1000 <= len(mirror_lite) <= LITE_LIMIT,
            "critical",
            len(mirror_lite) if isinstance(mirror_lite, list) else None,
        )
        page_rows, page_mismatches, examples = parse_page_rows(base)
        check(
            f"{label}-page-index-consistency",
            page_mismatches == 0,
            "critical",
            {
                "rows": page_rows,
                "mismatches": page_mismatches,
                "examples": examples,
            },
        )

    if (ROOT / "film" / "data" / "fast").exists():
        root_search = read_json(ROOT / "data" / "fast" / "search_index.json", [])
        film_search = read_json(ROOT / "film" / "data" / "fast" / "search_index.json", [])
        check(
            "film-mirror-count",
            len(root_search) == len(film_search),
            "critical",
            {"root": len(root_search), "film": len(film_search)},
        )

    top = read_json(ROOT / "data" / "fast" / "anime_top_manual.json", {})
    studios = read_json(ROOT / "data" / "fast" / "anime_studios_top.json", {})
    studio_detail = read_json(ROOT / "data" / "fast" / "anime_studios_detail.json", {})
    wall = read_json(ROOT / "data" / "fast" / "poster_wall_v333" / "manifest.json", {})
    check("anime-top-data", len(top.get("items", [])) >= 50, "critical", len(top.get("items", [])))
    check("anime-studio-data", bool(studios.get("studios")) and bool(studio_detail.get("studios")), "critical")
    check("poster-wall-data", int(wall.get("total") or 0) > 0, "critical", wall.get("total"))

    static = static_page_stats()
    check(
        "static-pages-have-stable-id",
        static["withoutStableId"] == 0,
        "critical",
        static,
    )
    check(
        "static-pages-jsonld",
        static["invalidJsonLd"] == 0,
        "critical",
        static["invalidJsonLd"],
    )
    check(
        "static-title-query-review",
        static["titleQueryMismatches"] == 0,
        "warning",
        {
            "count": static["titleQueryMismatches"],
            "examples": static["mismatchExamples"],
        },
    )

    critical_failures = [
        test for test in tests if test["severity"] == "critical" and not test["pass"]
    ]
    warnings = [
        test for test in tests if test["severity"] == "warning" and not test["pass"]
    ]
    report = {
        "version": "V349",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "success" if not critical_failures else "failed",
        "summary": {
            "tests": len(tests),
            "passed": sum(test["pass"] for test in tests),
            "criticalFailures": len(critical_failures),
            "warnings": len(warnings),
            "primaryRecords": len(primary),
            "searchRecords": len(search),
        },
        "tests": tests,
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict and critical_failures:
        raise SystemExit(f"V349 critical failures: {len(critical_failures)}")


if __name__ == "__main__":
    main()
