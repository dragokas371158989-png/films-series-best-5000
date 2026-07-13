name: GKM V3452.2 Sync Official Russian Cache

on:
  workflow_dispatch:
  workflow_run:
    workflows:
      - GKM V344 Safe Daily Catalog Update
    types:
      - completed

permissions:
  contents: write

concurrency:
  group: gkm-v3452-2-sync-official-cache
  cancel-in-progress: false

jobs:
  sync:
    if: >
      github.event_name == 'workflow_dispatch' ||
      github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - name: Checkout latest main
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Sync official Russian cache into live data
        run: python tools/gkm_v3452_2_sync_official_cache.py

      - name: Validate JSON and JavaScript
        shell: bash
        run: |
          set -euo pipefail
          python - <<'PY'
          import json
          from pathlib import Path

          report=json.loads(Path("TEST_REPORT_V3452_2_SYNC.json").read_text(encoding="utf-8"))
          controls=report.get("controlTitles",{})
          assert controls and all(x.get("pass") for x in controls.values()), controls

          for path in (
              Path("data/fast/search_index.json"),
              Path("data/fast/search_lite.json"),
              Path("data/fast/poster_wall_v333/manifest.json"),
          ):
              json.loads(path.read_text(encoding="utf-8"))

          print("Control titles:",controls)
          print("JSON validation: PASS")
          PY
          node --check app.js
          node --check features_v344.js
          node --check ai_search_worker_v344.js

      - name: Commit synchronized site
        shell: bash
        run: |
          set -euo pipefail
          git config user.name "gkm-russian-sync-bot"
          git config user.email "gkm-russian-sync-bot@users.noreply.github.com"
          git add data film anime-tv tools/gkm_v3452_2_sync_official_cache.py \
            .github/workflows/gkm_v3452_2_sync_official_cache.yml \
            TEST_REPORT_V3452_2_SYNC.json
          if git diff --cached --quiet; then
            echo "Official Russian cache is already synchronized"
            exit 0
          fi
          git commit -m "Sync V3452.2 official Russian titles into live site"
          for attempt in 1 2 3; do
            git pull --rebase origin main
            git push origin HEAD:main && exit 0
            sleep 6
          done
          exit 1

      - name: Summary
        if: always()
        shell: bash
        run: |
          echo "### GKM V3452.2" >> "$GITHUB_STEP_SUMMARY"
          echo "Official cache synchronized after catalog rebuild." >> "$GITHUB_STEP_SUMMARY"
          echo "Report: \`TEST_REPORT_V3452_2_SYNC.json\`" >> "$GITHUB_STEP_SUMMARY"
