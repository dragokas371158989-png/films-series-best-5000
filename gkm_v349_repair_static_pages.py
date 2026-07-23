name: GKM V349 Repair Internal Integrity

on:
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: gkm-v349-integrity-repair
  cancel-in-progress: false

jobs:
  repair:
    runs-on: ubuntu-latest
    timeout-minutes: 360

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

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Synchronize main
        run: git pull --rebase origin main

      - name: Create recovery branch
        shell: bash
        run: |
          set -euo pipefail
          backup="backup-before-v349-${GITHUB_RUN_ID}"
          git branch "$backup"
          git push origin "$backup"
          echo "BACKUP_BRANCH=$backup" >> "$GITHUB_ENV"

      - name: Run deterministic V349 repair
        env:
          GKM_SEARCH_LITE_LIMIT: "15000"
        run: python tools/gkm_v349_safe_repair.py

      - name: Validate generated JSON and file sizes
        shell: bash
        run: |
          set -euo pipefail
          python - <<'PY'
          import json
          import os
          from pathlib import Path

          limit = 94 * 1024 * 1024
          oversized = []
          invalid = []

          for base in (Path("data"), Path("film/data")):
              if not base.exists():
                  continue
              for path in base.rglob("*"):
                  if not path.is_file():
                      continue
                  if path.stat().st_size >= limit:
                      oversized.append((path.as_posix(), path.stat().st_size))
                  if path.suffix == ".json":
                      try:
                          json.loads(path.read_text(encoding="utf-8"))
                      except Exception as error:
                          invalid.append((path.as_posix(), str(error)))

          assert not oversized, oversized[:20]
          assert not invalid, invalid[:20]
          print("JSON validation: PASS")
          print("94 MiB file-size gate: PASS")
          PY

          node --check app.js
          node --check features_v344.js
          node --check ai_search_worker_v344.js
          python tools/gkm_v349_integrity_audit.py --strict

      - name: Commit repaired repository
        shell: bash
        run: |
          set -euo pipefail
          git config user.name "gkm-v349-repair-bot"
          git config user.email "gkm-v349-repair-bot@users.noreply.github.com"
          git add -A

          if git diff --cached --quiet; then
            echo "Repository is already repaired"
            exit 0
          fi

          git status --short
          git diff --cached --stat
          git commit -m "Apply V349 internal integrity repair"

          for attempt in 1 2 3; do
            git fetch origin main
            if ! git rebase origin/main; then
              git rebase --abort || true
              echo "::error::Concurrent catalog update caused a rebase conflict."
              echo "::error::Recovery branch: ${BACKUP_BRANCH}"
              exit 1
            fi
            if git push origin HEAD:main; then
              exit 0
            fi
            sleep $((attempt * 8))
          done

          echo "::error::Could not publish V349 repair."
          echo "::error::Recovery branch: ${BACKUP_BRANCH}"
          exit 1

      - name: Publish summary
        if: always()
        shell: bash
        run: |
          python - <<'PY' >> "$GITHUB_STEP_SUMMARY"
          import json
          import os
          from pathlib import Path

          print("### GKM V349 — проверка и ремонт")
          print()
          path = Path("TEST_REPORT_V349_INTEGRITY.json")
          if path.exists():
              report = json.loads(path.read_text(encoding="utf-8"))
              summary = report.get("summary", {})
              icon = "✅" if report.get("status") == "success" else "❌"
              print(f"{icon} **Статус:** `{report.get('status')}`")
              print(f"- Тестов: **{summary.get('tests', 0)}**")
              print(f"- Критических ошибок: **{summary.get('criticalFailures', 0)}**")
              print(f"- Каталог: **{summary.get('searchRecords', 0)}**")
          print()
          print(f"Ветка восстановления: `{os.environ.get('BACKUP_BRANCH', '')}`")
          PY

      - name: Upload repair reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: gkm-v349-integrity-reports
          retention-days: 30
          if-no-files-found: warn
          path: |
            TEST_REPORT_V349_*.json
            TEST_REPORT_V3460_HEALTH.json
            data/health_v3460.json
