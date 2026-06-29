name: Apply GKM V196 Site Docs

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  apply-v196-site-docs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.x"
      - name: Apply V196 docs
        run: python tools/gkm_v196_apply_site_docs.py
      - name: Commit V196 docs
        run: |
          git config user.name "actions-user"
          git config user.email "actions@github.com"
          git add docs/GKM_SITE_MAP_V1.md docs/GKM_FEATURES_HISTORY.md docs/GKM_BUTTONS_AND_ACTIONS.md docs/GKM_DEBUG_CHECKLIST.md docs/GKM_FLOWCHART.md README_V196_SITE_DOCS.txt tools/gkm_v196_apply_site_docs.py .github/workflows/apply_gkm_v196_site_docs.yml
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Add GKM V196 site flow documentation"
            git push
          fi
