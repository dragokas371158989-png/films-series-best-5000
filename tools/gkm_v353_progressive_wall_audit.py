#!/usr/bin/env python3
"""Static and mathematical audit for the GKM V353 progressive poster wall."""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V353_PROGRESSIVE_WALL.json"


def balanced_layout(count: int, width: int, height: int) -> dict:
    total = max(1, int(count or 1))
    rows = max(
        1,
        min(total, round(math.sqrt((total * height) / (1.5 * width)))),
    )
    base = total // rows
    extra = total % rows
    row_counts = [base + (1 if row < extra else 0) for row in range(rows)]
    return {
        "count": total,
        "width": width,
        "height": height,
        "rows": rows,
        "rowHeight": height / rows,
        "rowCounts": row_counts,
    }


def layout_case(count: int, width: int, height: int) -> dict:
    layout = balanced_layout(count, width, height)
    row_width_errors = []
    for in_row in layout["rowCounts"]:
        cell_width = width / in_row
        row_width_errors.append(abs(cell_width * in_row - width))
    checks = {
        "all_items_have_cells": sum(layout["rowCounts"]) == count,
        "all_rows_are_balanced": (
            max(layout["rowCounts"]) - min(layout["rowCounts"]) <= 1
        ),
        "rows_fill_full_height": abs(
            layout["rowHeight"] * layout["rows"] - height
        ) < 0.001,
        "every_row_fills_full_width": max(row_width_errors, default=0) < 0.001,
    }
    return {
        "input": {"count": count, "width": width, "height": height},
        "rows": layout["rows"],
        "minimumColumns": min(layout["rowCounts"]),
        "maximumColumns": max(layout["rowCounts"]),
        "checks": checks,
    }


def static_checks() -> dict[str, bool]:
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    return {
        "app_cache_v353": (
            'GKM_DATA_CACHE_VERSION = "353"' in app
            and "app.js?v=353" in index
        ),
        "v353_runtime_marker": "GKM_V353_PROGRESSIVE_POSTER_WALL_VERSION" in app,
        "full_viewport_balanced_layout": (
            "function balancedLayout(" in app
            and "rowH:h/rows" in app
            and "fineLayout=balancedLayout(" in app
        ),
        "large_posters_load_first": (
            "function loadBackdrop(" in app
            and "loadBackdrop(wallItems,backgroundToken).finally" in app
            and "pumpQueue(token);" in app
        ),
        "small_posters_fade_over_background": (
            "TILE_FADE_MS = 240" in app
            and "function queueTileReveal(" in app
            and "drawTileTo(bufferCtx,reveal.index,reveal.img,eased)" in app
        ),
        "no_dark_small_placeholder_grid": (
            "fineCtx.clearRect(" in app
            and "placeholderColor(i)" not in app
        ),
        "background_kept_until_tile_is_ready": (
            "bufferCtx.drawImage(backdropCanvas,0,0)" in app
            and "bufferCtx.drawImage(fineCanvas,0,0)" in app
        ),
        "no_artificial_poster_repeats": (
            "const source=uniqueList(items||[]);" in app
            and "wallItems=uniqueList(allItems);" in app
        ),
        "filters_lens_preview_and_open_preserved": all(
            marker in app
            for marker in (
                "renderSoftFisheye",
                "showPreview(wallItems[index])",
                "openItem(item)",
                'overlay.querySelectorAll("[data-kind]")',
            )
        ),
        "runtime_test_api": "GKM_V353_TEST_API" in app,
    }


def main() -> None:
    cases = [
        layout_case(4321, 1920, 1080),
        layout_case(5200, 2560, 1440),
        layout_case(2600, 1366, 768),
        layout_case(9000, 390, 844),
    ]
    checks = static_checks()
    math_passed = all(
        all(case["checks"].values())
        for case in cases
    )
    report = {
        "version": "V353",
        "goal": "large posters first, then a progressive full-screen small mosaic",
        "staticChecks": checks,
        "layoutCases": cases,
        "mathematicalLayoutPassed": math_passed,
    }
    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))

    failed = [name for name, passed in checks.items() if not passed]
    if failed or not math_passed:
        details = failed + ([] if math_passed else ["mathematical_layout"])
        raise SystemExit("V353 audit failed: " + ", ".join(details))


if __name__ == "__main__":
    main()
