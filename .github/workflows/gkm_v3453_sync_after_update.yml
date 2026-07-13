name: GKM V3453 Sync Russian Cache After Daily Update

on:
  workflow_run:
    workflows:
      - GKM V344 Safe Daily Catalog Update
    types:
      - completed
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: gkm-v3453-daily-sync
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
          python-version: "3.11"

      - name: Reapply completed Russian cache
        run: python tools/gkm_v3453_sync_after_update.py

      - name: Commit synchronized data
        shell: bash
        run: |
          set -euo pipefail
          git config user.name "gkm-v3453-sync-bot"
          git config user.email "gkm-v3453-sync-bot@users.noreply.github.com"
          git add data film anime-tv TEST_REPORT_V3453_FULL_RUSSIAN.json
          if git diff --cached --quiet; then
            echo "Already synchronized"
            exit 0
          fi
          git commit -m "Reapply V3453 Russian localization after catalog update"
          git pull --rebase origin main
          git push origin HEAD:main
