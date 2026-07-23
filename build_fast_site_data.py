name: GKM V3460.3.3 One-Button Stable Update

on:
  workflow_dispatch:
    inputs:
      max_wait_minutes:
        description: "Maximum waiting time for each stage"
        required: false
        default: "180"

permissions:
  actions: write
  contents: read

concurrency:
  group: gkm-v3460-3-one-button-stable-update
  cancel-in-progress: false

jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 360
    env:
      GH_TOKEN: ${{ github.token }}
      TARGET_BRANCH: main

    steps:
      - name: Checkout current master tools
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Verify required workflows and scripts
        shell: bash
        run: |
          set -euo pipefail

          required=(
            ".github/workflows/gkm_v344_safe_auto_update.yml"
            ".github/workflows/gkm_v3453_1_sync_after_update.yml"
            ".github/workflows/gkm_v3454_rebuild_anime_buttons.yml"
            ".github/workflows/gkm_v3460_sync_meta.yml"
            ".github/workflows/gkm_v3460_health_audit.yml"
            "tools/gkm_v3460_verify_master_pipeline.py"
          )

          missing=0
          for path in "${required[@]}"; do
            if [[ ! -f "$path" ]]; then
              echo "::error::Missing required file: $path"
              missing=1
            fi
          done

          if [[ "$missing" -ne 0 ]]; then
            exit 1
          fi

      - name: Check that no conflicting update is already running
        shell: bash
        run: |
          set -euo pipefail

          workflows=(
            "gkm_v344_safe_auto_update.yml"
            "gkm_v3453_1_sync_after_update.yml"
            "gkm_v3454_rebuild_anime_buttons.yml"
            "gkm_v3460_sync_meta.yml"
            "gkm_v3460_health_audit.yml"
          )

          conflict=0
          for workflow in "${workflows[@]}"; do
            response="$(gh api \
              "repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?branch=${TARGET_BRANCH}&per_page=30")"

            active="$(jq '[.workflow_runs[] | select(.status == "queued" or .status == "in_progress")] | length' <<<"$response")"

            if [[ "$active" -gt 0 ]]; then
              echo "::error::Workflow $workflow already has $active active run(s). Wait for them to finish."
              conflict=1
            fi
          done

          if [[ "$conflict" -ne 0 ]]; then
            exit 1
          fi

      - name: Run the complete stable update chain
        id: chain
        shell: bash
        env:
          MAX_WAIT_MINUTES: ${{ inputs.max_wait_minutes }}
        run: |
          set -euo pipefail
          mkdir -p .pipeline-runs

          max_wait="${MAX_WAIT_MINUTES:-180}"
          if ! [[ "$max_wait" =~ ^[0-9]+$ ]] || [[ "$max_wait" -lt 10 ]]; then
            echo "::error::max_wait_minutes must be an integer of at least 10"
            exit 1
          fi

          wait_for_run() {
            local sequence="$1"
            local label="$2"
            local workflow="$3"
            local event="$4"
            local since="$5"
            local timeout_seconds=$((max_wait * 60))
            local started_epoch
            started_epoch="$(date +%s)"
            local run_json=""
            local run_id=""

            echo "Waiting for: $label"
            echo "Workflow: $workflow"
            echo "Event: $event"
            echo "Created after: $since"

            while true; do
              response="$(gh api \
                "repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?branch=${TARGET_BRANCH}&per_page=50")"

              run_json="$(jq -c \
                --arg since "$since" \
                --arg event "$event" \
                '
                [
                  .workflow_runs[]
                  | select(.created_at >= $since)
                  | select(.event == $event)
                ]
                | sort_by(.created_at)
                | .[0] // empty
                ' <<<"$response")"

              if [[ -n "$run_json" && "$run_json" != "null" ]]; then
                run_id="$(jq -r '.id' <<<"$run_json")"
                break
              fi

              now_epoch="$(date +%s)"
              if (( now_epoch - started_epoch >= timeout_seconds )); then
                echo "::error::Timed out waiting for $label ($workflow)"
                exit 1
              fi

              sleep 10
            done

            run_url="$(jq -r '.html_url' <<<"$run_json")"
            echo "Found $label run: $run_url"

            gh run watch "$run_id" --exit-status --interval 10

            completed="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}")"
            conclusion="$(jq -r '.conclusion // ""' <<<"$completed")"
            updated_at="$(jq -r '.updated_at' <<<"$completed")"

            if [[ "$conclusion" != "success" ]]; then
              echo "::error::$label finished with conclusion: $conclusion"
              exit 1
            fi

            jq \
              --arg sequence "$sequence" \
              --arg label "$label" \
              --arg workflow "$workflow" \
              '{
                sequence: ($sequence | tonumber),
                label: $label,
                workflow: $workflow,
                runId: .id,
                runNumber: .run_number,
                event: .event,
                status: .status,
                conclusion: .conclusion,
                createdAt: .created_at,
                updatedAt: .updated_at,
                headSha: .head_sha,
                url: .html_url
              }' <<<"$completed" > ".pipeline-runs/${sequence}.json"

            LAST_UPDATED_AT="$updated_at"
          }

          dispatch_and_wait() {
            local sequence="$1"
            local label="$2"
            local workflow="$3"
            local dispatched_at

            dispatched_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

            echo "Dispatching: $label"
            echo "Workflow: $workflow"
            echo "Dispatch time: $dispatched_at"

            gh workflow run "$workflow" --ref "$TARGET_BRANCH"

            wait_for_run \
              "$sequence" \
              "$label" \
              "$workflow" \
              "workflow_dispatch" \
              "$dispatched_at"
          }

          pipeline_start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
          echo "Master pipeline started at: $pipeline_start"
          echo "Dispatching V344 once; downstream workflow_run events continue the chain."

          dispatch_and_wait \
            "1" \
            "V344 — обновление каталога" \
            "gkm_v344_safe_auto_update.yml"

          wait_for_run \
            "2" \
            "V3453.1 — возврат русификации" \
            "gkm_v3453_1_sync_after_update.yml" \
            "workflow_run" \
            "$LAST_UPDATED_AT"

          wait_for_run \
            "3" \
            "V3454 — топ аниме и студии" \
            "gkm_v3454_rebuild_anime_buttons.yml" \
            "workflow_run" \
            "$LAST_UPDATED_AT"

          wait_for_run \
            "4" \
            "V3460.2 — синхронизация meta.json" \
            "gkm_v3460_sync_meta.yml" \
            "workflow_run" \
            "$LAST_UPDATED_AT"

          wait_for_run \
            "5" \
            "V3460 — финальная проверка здоровья" \
            "gkm_v3460_health_audit.yml" \
            "workflow_run" \
            "$LAST_UPDATED_AT"

      - name: Refresh repository after final health commit
        shell: bash
        run: |
          set -euo pipefail
          git fetch origin main
          git reset --hard origin/main

      - name: Run the final health gate
        shell: bash
        run: python tools/gkm_v3460_verify_master_pipeline.py

      - name: Publish one-button pipeline summary
        if: always()
        shell: bash
        run: |
          python - <<'PY' >> "$GITHUB_STEP_SUMMARY"
          import json
          from pathlib import Path

          print("### GKM V3460.3.3 — единое стабильное обновление")
          print()

          report_path=Path("TEST_REPORT_V3460_3_MASTER_PIPELINE.json")
          if report_path.exists():
              report=json.loads(report_path.read_text(encoding="utf-8"))
              icon="✅" if report.get("status") == "success" else "❌"
              print(f"{icon} **Итог:** `{report.get('status')}`")
              print(f"- Каталог: **{report.get('catalogCount',0)}**")
              print(f"- meta.json: **{report.get('metaCount',0)}**")
              print(f"- Health: **{report.get('healthStatus')}**")
              print()

          run_files=sorted(Path(".pipeline-runs").glob("*.json"))
          if run_files:
              print("| Этап | Результат |")
              print("|---|---|")
              for path in run_files:
                  row=json.loads(path.read_text(encoding="utf-8"))
                  icon="✅" if row.get("conclusion") == "success" else "❌"
                  label=row.get("label","")
                  url=row.get("url","")
                  print(f"| {label} | {icon} [Открыть запуск]({url}) |")
          PY

      - name: Upload master pipeline report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: gkm-v3460-3-master-pipeline-report
          retention-days: 14
          if-no-files-found: warn
          path: |
            .pipeline-runs/*.json
            TEST_REPORT_V3460_3_MASTER_PIPELINE.json
