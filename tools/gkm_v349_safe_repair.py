#!/usr/bin/env python3
"""Run the V349 repair chain in a deterministic, restartable order."""
from __future__ import annotations

import argparse
import filecmp
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "TEST_REPORT_V349_REPAIR.json"


def run(label: str, relative_script: str, *arguments: str) -> dict:
    path = ROOT / relative_script
    if not path.exists():
        raise SystemExit(f"Missing repair dependency: {relative_script}")
    print(f"\n=== {label} ===")
    started = datetime.now(timezone.utc)
    completed = subprocess.run(
        [sys.executable, str(path), *arguments],
        cwd=ROOT,
        check=False,
    )
    result = {
        "label": label,
        "script": relative_script,
        "returnCode": completed.returncode,
        "startedAt": started.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
    }
    if completed.returncode:
        raise SystemExit(f"{label} failed with code {completed.returncode}")
    return result


def archive_malformed_workflows() -> dict:
    workflow_dir = ROOT / ".github" / "workflows"
    archive_dir = ROOT / ".github" / "workflows-disabled"
    archive_dir.mkdir(parents=True, exist_ok=True)
    archived = []

    for path in workflow_dir.iterdir():
        if not path.is_file() or " " not in path.name:
            continue
        target = archive_dir / "gkm_v3453_full_russian_site.legacy.yml.txt"
        if target.exists():
            if path.read_bytes() == target.read_bytes():
                path.unlink()
                archived.append({"from": str(path.relative_to(ROOT)), "to": str(target.relative_to(ROOT))})
                continue
            target = archive_dir / f"{path.name}.disabled.txt"
        shutil.move(str(path), str(target))
        archived.append({"from": str(path.relative_to(ROOT)), "to": str(target.relative_to(ROOT))})

    return {
        "label": "Archive malformed workflow filenames",
        "script": "internal:archive_malformed_workflows",
        "returnCode": 0,
        "archived": archived,
    }


def mirror_fast_data() -> dict:
    source = ROOT / "data" / "fast"
    destination = ROOT / "film" / "data" / "fast"

    if not source.exists():
        raise SystemExit("Cannot mirror missing data/fast")

    print("\n=== Mirror fast data to /film ===")
    destination.mkdir(parents=True, exist_ok=True)

    source_entries = {
        path.relative_to(source)
        for path in source.rglob("*")
    }
    for path in sorted(
        destination.rglob("*"),
        key=lambda value: len(value.parts),
        reverse=True,
    ):
        if path.relative_to(destination) in source_entries:
            continue
        if path.is_dir():
            path.rmdir()
        else:
            path.unlink()

    # Copy in place. This is slower than a directory rename but remains stable
    # on GitHub runners and workspace overlay filesystems.
    shutil.copytree(source, destination, dirs_exist_ok=True, copy_function=shutil.copy2)

    for relative in ("search_index.json", "search_lite.json", "meta.json", "home.json"):
        left = source / relative
        right = destination / relative
        if not right.exists() or not filecmp.cmp(left, right, shallow=False):
            raise SystemExit(f"Fast mirror verification failed: {relative}")

    return {
        "label": "Mirror fast data to /film",
        "script": "internal:mirror_fast_data",
        "returnCode": 0,
        "files": sum(path.is_file() for path in destination.rglob("*")),
        "bytes": sum(path.stat().st_size for path in destination.rglob("*") if path.is_file()),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-russian-sync",
        action="store_true",
        help="Keep current localized primary chunks (use only for local diagnostics).",
    )
    parser.add_argument(
        "--skip-static-pages",
        action="store_true",
        help="Do not repair legacy film/*.html pages.",
    )
    parser.add_argument(
        "--skip-final-strict",
        action="store_true",
        help="Generate the final report without failing on remaining data defects.",
    )
    args = parser.parse_args()

    steps = []
    started = datetime.now(timezone.utc)
    status = "success"

    try:
        steps.append(archive_malformed_workflows())

        if not args.skip_russian_sync:
            steps.append(
                run(
                    "Offline Russian cache synchronization",
                    "tools/gkm_v3453_1_sync_after_update.py",
                )
            )

        if not args.skip_static_pages:
            steps.append(
                run(
                    "Repair static page identity",
                    "tools/gkm_v349_repair_static_pages.py",
                )
            )

        steps.append(run("Rebuild root fast data", "tools/build_fast_site_data.py"))
        steps.append(run("Rebuild poster wall", "tools/gkm_v344_build_poster_wall.py"))
        steps.append(
            run(
                "Compact root and mirror search indexes",
                "tools/gkm_v3460_compact_search_index.py",
            )
        )
        steps.append(
            run(
                "Rebuild anime top and studio data",
                "tools/gkm_v3454_rebuild_anime_buttons.py",
            )
        )
        steps.append(
            run("Synchronize catalog metadata", "tools/gkm_v3460_sync_meta.py")
        )
        steps.append(mirror_fast_data())
        steps.append(
            run("Refresh health snapshot", "tools/gkm_v3460_health_audit.py")
        )

        audit_arguments = () if args.skip_final_strict else ("--strict",)
        steps.append(
            run(
                "Run final V349 integrity gate",
                "tools/gkm_v349_integrity_audit.py",
                *audit_arguments,
            )
        )
    except BaseException:
        status = "failed"
        raise
    finally:
        report = {
            "version": "V349",
            "status": status,
            "startedAt": started.isoformat(),
            "finishedAt": datetime.now(timezone.utc).isoformat(),
            "steps": steps,
        }
        REPORT_PATH.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print("\nV349 repair report:")
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
