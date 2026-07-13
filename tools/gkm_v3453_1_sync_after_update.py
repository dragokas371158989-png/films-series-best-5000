#!/usr/bin/env python3
"""V3453.1 lightweight sync after daily catalog updates."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
official_cache = root / "data" / "ru_complete_cache_v3453_1.json"
machine_cache = root / "data" / "ru_machine_cache_v3453_1.json"

if not official_cache.exists():
    raise SystemExit("V3453.1 official cache is missing; run the full V3453.1 workflow first")
if not machine_cache.exists():
    raise SystemExit("V3453.1 machine translation cache is missing; run the full V3453.1 workflow first")

subprocess.run(
    [
        sys.executable,
        str(root / "tools" / "gkm_v3453_1_full_russianize_dedupe.py"),
        "--offline",
    ],
    cwd=root,
    check=True,
)
