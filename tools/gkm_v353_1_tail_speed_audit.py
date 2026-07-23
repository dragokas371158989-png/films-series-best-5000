#!/usr/bin/env python3
"""Audit the accelerated tail of the GKM V353.1 poster wall."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "TEST_REPORT_V353_1_TAIL_SPEED.json"


def checks() -> dict[str, bool]:
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    return {
        "cache_bumped_to_v3531": (
            'GKM_DATA_CACHE_VERSION = "3531"' in app
            and "app.js?v=3531" in index
        ),
        "tail_speed_runtime_marker": "GKM_V353_1_TAIL_SPEED_VERSION" in app,
        "concurrency_no_longer_drops_to_24": (
            "const FIRST_CONCURRENCY = 48" in app
            and "const REST_CONCURRENCY = 72" in app
            and "const TAIL_CONCURRENCY = 108" in app
            and "REST_CONCURRENCY = 24" not in app
        ),
        "adaptive_tail_boost_enabled": (
            "progress<.22" in app
            and "progress<.78?REST_CONCURRENCY:TAIL_CONCURRENCY" in app
        ),
        "tail_requests_have_short_deadline": (
            "TAIL_PRIMARY_TIMEOUT_MS = 2300" in app
            and "TAIL_FALLBACK_TIMEOUT_MS = 1900" in app
            and "timer=setTimeout(startFallback,primaryTimeout)" in app
        ),
        "raw_poster_fallback_preserved": (
            "const raw=fullPosterUrl(item)" in app
            and "img.src=raw" in app
        ),
        "completed_and_failed_are_counted": (
            "completedCount++" in app
            and "failedCount++" in app
            and "itemSettled[index]=true" in app
        ),
        "tail_can_finish_with_broken_urls": (
            "completedCount===wallItems.length" in app
            and "Недоступных ссылок" in app
        ),
        "reveal_queue_accelerated_but_bounded": (
            "TILE_FADE_MS = 170" in app
            and "MAX_ACTIVE_REVEALS = 144" in app
            and "REVEALS_PER_FRAME = 36" in app
        ),
        "v353_fullscreen_background_preserved": all(
            marker in app
            for marker in (
                "balancedLayout",
                "loadBackdrop(wallItems,backgroundToken).finally",
                "bufferCtx.drawImage(backdropCanvas,0,0)",
                "renderSoftFisheye",
                "openItem(item)",
            )
        ),
    }


def estimated_worst_tail_seconds(
    remaining: int,
    concurrency: int,
    primary_timeout_ms: int,
    fallback_timeout_ms: int,
) -> float:
    waves = (remaining + concurrency - 1) // concurrency
    return round(waves * (primary_timeout_ms + fallback_timeout_ms) / 1000, 1)


def main() -> None:
    results = checks()
    report = {
        "version": "V353.1",
        "goal": "prevent the final 20 percent of posters from slowing down",
        "checks": results,
        "tailConcurrency": 108,
        "previousTailConcurrency": 24,
        "concurrencyIncrease": 4.5,
        "estimatedWorstCaseForLast600BrokenUrlsSeconds": estimated_worst_tail_seconds(
            remaining=600,
            concurrency=108,
            primary_timeout_ms=2300,
            fallback_timeout_ms=1900,
        ),
    }
    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))

    failed = [name for name, passed in results.items() if not passed]
    if failed:
        raise SystemExit("V353.1 audit failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
