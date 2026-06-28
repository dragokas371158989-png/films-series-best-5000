name: Apply GKM V162 Franchise Pages

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  apply-v162-franchises:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.x"

      - name: Apply V162 patch
        run: python tools/gkm_v162_apply_franchise_pages.py

      - name: Commit V162 files
        run: |
          git config user.name "actions-user"
          git config user.email "actions@github.com"
          git add app.js index.html film/index.html downloads/index.html tools/gkm_v162_apply_franchise_pages.py || true
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Apply GKM V162 franchise pages"
            git push
          fi
