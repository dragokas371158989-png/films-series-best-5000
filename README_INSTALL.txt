GKM V62 CLEAN ONLY REPLACE ROOT

ВАЖНО: В архиве больше нет app_БЛОКНОТ и лишних дублей, чтобы не выбрать неправильный файл.
Нужный файл только один: app.js в корне архива.

EXPECTED ROOT app.js:
first line: const GKM_APP_CLEAN_VERSION = "v62-clean-only-replace-root-2026-06-13";
size_bytes: 185605

CHECKS:
- node app.js: OK
- python build_fast_site_data.py: OK
- python post_fix_fast_data.py: OK
- first_line_v62: OK
- runtime_guard: OK
- more_buttons_fix: OK
- helper_html: OK
- workflow_postfix: OK

REPLACE THESE EXACT PATHS IN GITHUB ROOT:
app.js
index.html
style.css
tools/build_fast_site_data.py
tools/post_fix_fast_data.py
.github/workflows/build_fast_site_data.yml

DO NOT UPLOAD THE ZIP FOLDER AS A FOLDER.
DO NOT USE app_БЛОКНОТ files.
DO NOT rename app.js.

LIVE CHECK:
GKM_APP_CLEAN_VERSION
GKM_CLEAN_ONLY_PACKAGE_VERSION
GKM_MORE_BUTTONS_FIX_VERSION
GKM_RUNTIME_GUARD_VERSION