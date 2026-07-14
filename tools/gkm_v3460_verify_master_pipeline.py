#!/usr/bin/env python3
"""
GKM V3460.3 — final verification for the one-button master pipeline.

Reads:
- data/health_v3460.json
- data/fast/meta.json
- data/fast/search_index.json
- .pipeline-runs/*.json

Writes:
- TEST_REPORT_V3460_3_MASTER_PIPELINE.json

The script fails when the final health state is not fully healthy.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HEALTH_PATH = ROOT / "data" / "health_v3460.json"
META_PATH = ROOT / "data" / "fast" / "meta.json"
SEARCH_PATH = ROOT / "data" / "fast" / "search_index.json"
RUNS_DIR = ROOT / ".pipeline-runs"
REPORT_PATH = ROOT / "TEST_REPORT_V3460_3_MASTER_PIPELINE.json"


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def integer(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def load_stage_runs() -> list[dict]:
    rows = []
    if not RUNS_DIR.exists():
        return rows
    for path in sorted(RUNS_DIR.glob("*.json")):
        value = read_json(path, {})
        if isinstance(value, dict):
            rows.append(value)
    return rows


def main():
    health = read_json(HEALTH_PATH)
    meta = read_json(META_PATH)
    search = read_json(SEARCH_PATH)
    stages = load_stage_runs()

    failures = []

    if not isinstance(health, dict):
        failures.append("health_v3460.json is missing or invalid")
        health = {}

    if not isinstance(meta, dict):
        failures.append("meta.json is missing or invalid")
        meta = {}

    if not isinstance(search, list):
        failures.append("search_index.json is missing or invalid")
        search = []

    summary = health.get("summary") if isinstance(health.get("summary"), dict) else {}

    checks = {
        "healthStatusHealthy": health.get("status") == "healthy",
        "criticalFailuresZero": integer(summary.get("criticalFailures")) == 0,
        "warningsZero": integer(summary.get("warnings")) == 0,
        "untranslatedTitlesZero": integer(summary.get("untranslatedTitles")) == 0,
        "latinGenresZero": integer(summary.get("latinGenres")) == 0,
        "duplicateIdsZero": integer(summary.get("duplicateIds")) == 0,
        "metaMatchesCatalog": integer(meta.get("count")) == len(search),
        "healthCatalogMatches": integer(summary.get("catalogRecords")) == len(search),
        "animeTopReady": integer(summary.get("animeTopRecords")) >= 50,
        "studiosReady": integer(summary.get("studioRecords")) > 0,
        "posterWallReady": integer(summary.get("posterWallRecords")) > 0,
        "allStagesRecorded": len(stages) == 5,
        "allStagesSuccessful": len(stages) == 5 and all(
            stage.get("conclusion") == "success" for stage in stages
        ),
    }

    for name, passed in checks.items():
        if not passed:
            failures.append(name)

    report = {
        "version": "V3460.3",
        "status": "success" if not failures else "failed",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "masterRunId": os.environ.get("GITHUB_RUN_ID", ""),
        "masterRunUrl": (
            f"{os.environ.get('GITHUB_SERVER_URL', '')}/"
            f"{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/"
            f"{os.environ.get('GITHUB_RUN_ID', '')}"
            if os.environ.get("GITHUB_RUN_ID")
            else ""
        ),
        "catalogCount": len(search),
        "metaCount": integer(meta.get("count")),
        "healthStatus": health.get("status"),
        "healthGeneratedAt": health.get("generatedAt"),
        "checks": checks,
        "failures": failures,
        "stages": stages,
    }

    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if failures:
        raise SystemExit("V3460.3 final gate failed: " + ", ".join(failures))


if __name__ == "__main__":
    main()
