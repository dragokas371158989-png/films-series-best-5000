#!/usr/bin/env python3
"""V3453 lightweight sync after daily catalog updates."""
from pathlib import Path
import json, subprocess, sys

root = Path(__file__).resolve().parents[1]
cache = root / "data" / "ru_complete_cache_v3453.json"
if not cache.exists():
    raise SystemExit("V3453 cache is missing; run GKM V3453 Full Russian Site first")

# Full script is idempotent. Offline mode avoids API/model downloads and reapplies
# the completed cache to freshly rebuilt catalog files.
subprocess.run(
    [sys.executable, str(root / "tools" / "gkm_v3453_full_russianize_dedupe.py"), "--offline"],
    cwd=root,
    check=True,
)
