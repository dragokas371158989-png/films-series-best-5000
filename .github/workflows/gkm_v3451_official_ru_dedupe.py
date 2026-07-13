name: GKM V3451 Official Russian Localization and Dedupe

on:
  workflow_dispatch:
    inputs:
      tmdb_limit:
        description: "Maximum TMDB records per run; 0 means all"
        required: false
        default: "0"

permissions:
  contents: write

concurrency:
  group: gkm-v3451-official-russian-dedupe
  cancel-in-progress: false

jobs:
  russianize:
    runs-on: ubuntu-latest
    timeout-minutes: 360
    env:
      KINOPOISK_API_KEY: ${{ secrets.KINOPOISK_API_KEY }}
      TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
      TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}
      GKM_RU_TMDB_LIMIT: ${{ inputs.tmdb_limit }}
      GKM_RU_TMDB_WORKERS: "8"
      GKM_RU_KP_WORKERS: "4"

    steps:
      - name: Checkout full repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create safety backup branch
        shell: bash
        run: |
          set -euo pipefail
          BACKUP="backup-before-v3451-${GITHUB_RUN_ID}"
          git branch "$BACKUP"
          git push origin "$BACKUP"
          echo "BACKUP_BRANCH=$BACKUP" >> "$GITHUB_ENV"

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Run official Russian localization and dedupe
        shell: bash
        run: |
          set -euo pipefail
          python tools/gkm_v3451_official_ru_dedupe.py .

      - name: Validate JavaScript
        shell: bash
        run: |
          set -euo pipefail
          node --check app.js
          node --check features_v344.js
          node --check ai_search_worker_v344.js

      - name: Validate JSON, wall and duplicates
        shell: bash
        run: |
          set -euo pipefail
          python - <<'PY'
          import glob, json, re, collections

          bad=[]
          for path in glob.glob('data/**/*.json',recursive=True):
              try:
                  json.load(open(path,encoding='utf-8'))
              except Exception as exc:
                  bad.append((path,str(exc)))
          if bad:
              print(bad[:20])
              raise SystemExit(f'Broken JSON files: {len(bad)}')

          items=[]
          for path in glob.glob('data/chunk_*.json'):
              items.extend(json.load(open(path,encoding='utf-8')))

          ids=collections.Counter(str(x.get('id') or '') for x in items)
          duplicate_ids=[(key,count) for key,count in ids.items() if key and count>1]
          if duplicate_ids:
              print(duplicate_ids[:20])
              raise SystemExit(f'Duplicate IDs remain: {len(duplicate_ids)}')

          cyr=re.compile(r'[А-Яа-яЁё]')
          no_ru=[x for x in items if not cyr.search(str(x.get('ru') or ''))]
          if no_ru:
              print(no_ru[:20])
              raise SystemExit(f'Items without Cyrillic display title: {len(no_ru)}')

          wall=[]
          for path in glob.glob('data/fast/poster_wall_v333/*.json'):
              if path.endswith(('manifest.json','seed_all.json')):
                  continue
              value=json.load(open(path,encoding='utf-8'))
              if isinstance(value,list):
                  wall.extend(value)
          wall_ids=[str(row[0]) for row in wall if isinstance(row,list) and row]
          duplicate_wall=[x for x,count in collections.Counter(wall_ids).items() if x and count>1]
          if duplicate_wall:
              print(duplicate_wall[:20])
              raise SystemExit(f'Poster wall duplicate IDs remain: {len(duplicate_wall)}')

          print('JSON: PASS')
          print('Primary records:',len(items))
          print('Poster wall records:',len(wall))
          print('Russian display titles: PASS')
          print('Duplicate IDs: PASS')
          PY

      - name: Commit V3451 result
        shell: bash
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          if git diff --cached --quiet; then
            echo "No changes to commit"
            exit 0
          fi
          git commit -m "Apply V3451 official Russian localization and dedupe"
          git push origin HEAD:main

      - name: Summary
        shell: bash
        run: |
          echo "### GKM V3451 completed" >> "$GITHUB_STEP_SUMMARY"
          echo "Backup branch: \`${BACKUP_BRANCH}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "Report: \`TEST_REPORT_V3451_OFFICIAL_RU_DEDUPE.json\`" >> "$GITHUB_STEP_SUMMARY"
          echo "Unresolved official names: \`data/unresolved_official_ru_v3451.json\`" >> "$GITHUB_STEP_SUMMARY"
