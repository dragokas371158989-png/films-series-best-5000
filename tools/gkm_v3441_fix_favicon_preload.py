#!/usr/bin/env python3
"""GKM V344.1: fix favicon links on every HTML page and remove stale preloads.

Safe to run repeatedly. The script:
- removes obsolete poster-wall preload links that cause DevTools warnings;
- replaces existing favicon declarations with canonical relative paths;
- adds favicon declarations to static film pages and other HTML pages;
- writes TEST_REPORT_V3441_FAVICON.json.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V3441_FAVICON.json"

PRELOAD_PATTERNS = (
    re.compile(r"\s*<link\b[^>]*\brel=[\"']preload[\"'][^>]*\bhref=[\"'][^\"']*poster_wall[^\"']*/manifest\.json[^\"']*[\"'][^>]*>\s*", re.I),
    re.compile(r"\s*<link\b[^>]*\brel=[\"']preload[\"'][^>]*\bhref=[\"'][^\"']*poster_wall[^\"']*/seed_all\.json[^\"']*[\"'][^>]*>\s*", re.I),
    re.compile(r"\s*<link\b[^>]*\bhref=[\"'][^\"']*poster_wall[^\"']*/manifest\.json[^\"']*[\"'][^>]*\brel=[\"']preload[\"'][^>]*>\s*", re.I),
    re.compile(r"\s*<link\b[^>]*\bhref=[\"'][^\"']*poster_wall[^\"']*/seed_all\.json[^\"']*[\"'][^>]*\brel=[\"']preload[\"'][^>]*>\s*", re.I),
)

ICON_LINK = re.compile(
    r"\s*<link\b[^>]*\brel=[\"'][^\"']*(?:icon|apple-touch-icon)[^\"']*[\"'][^>]*>\s*",
    re.I,
)


def relative_asset(html_path: Path, asset: str) -> str:
    rel = os.path.relpath(ROOT / asset, html_path.parent)
    return rel.replace(os.sep, "/")


def icon_block(html_path: Path) -> str:
    ico = relative_asset(html_path, "favicon.ico")
    png32 = relative_asset(html_path, "favicon-32.png")
    png192 = relative_asset(html_path, "favicon-192.png")
    return (
        f'  <link rel="icon" href="{ico}" sizes="any">\n'
        f'  <link rel="icon" type="image/png" sizes="32x32" href="{png32}">\n'
        f'  <link rel="icon" type="image/png" sizes="192x192" href="{png192}">\n'
        f'  <link rel="apple-touch-icon" href="{png192}">\n'
    )


def patch_html(path: Path) -> tuple[bool, int]:
    original = path.read_text(encoding="utf-8", errors="replace")
    text = original
    removed_preloads = 0
    for pattern in PRELOAD_PATTERNS:
        text, count = pattern.subn("\n", text)
        removed_preloads += count

    text = ICON_LINK.sub("\n", text)
    block = icon_block(path)

    head_match = re.search(r"<head(?:\s[^>]*)?>", text, re.I)
    if not head_match:
        return False, removed_preloads

    insert_at = head_match.end()
    text = text[:insert_at] + "\n" + block + text[insert_at:]
    text = re.sub(r"\n{3,}", "\n\n", text)

    changed = text != original
    if changed:
        path.write_text(text, encoding="utf-8", newline="\n")
    return changed, removed_preloads


def main() -> int:
    required = [ROOT / "favicon.ico", ROOT / "favicon-32.png", ROOT / "favicon-192.png"]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    if missing:
        print("Missing required assets:", ", ".join(missing))
        return 1

    html_files = sorted(
        p for p in ROOT.rglob("*.html")
        if ".git" not in p.parts and "node_modules" not in p.parts
    )

    changed_files = 0
    preloads_removed = 0
    skipped_no_head: list[str] = []

    for path in html_files:
        changed, removed = patch_html(path)
        preloads_removed += removed
        if changed:
            changed_files += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        if "<head" not in text.lower():
            skipped_no_head.append(str(path.relative_to(ROOT)))

    validation_errors: list[str] = []
    for path in html_files:
        text = path.read_text(encoding="utf-8", errors="replace")
        if "<head" not in text.lower():
            continue
        if "favicon.ico" not in text:
            validation_errors.append(f"favicon.ico missing: {path.relative_to(ROOT)}")
        if re.search(r"poster_wall[^\"']*/(?:manifest|seed_all)\.json[^\"']*[\"'][^>]*\brel=[\"']preload", text, re.I):
            validation_errors.append(f"stale preload: {path.relative_to(ROOT)}")
        if len(validation_errors) >= 50:
            break

    report = {
        "version": "V344.1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "htmlChecked": len(html_files),
        "htmlChanged": changed_files,
        "preloadsRemoved": preloads_removed,
        "skippedNoHead": skipped_no_head,
        "validationErrors": validation_errors,
        "ok": not validation_errors,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
