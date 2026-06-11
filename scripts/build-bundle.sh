#!/bin/sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/www/static/js/bundle.js"

cat \
  "$REPO_ROOT/www/static/js/includes/shader.js" \
  "$REPO_ROOT/www/static/js/includes/gameObject.js" \
  "$REPO_ROOT/www/static/js/prefab.js" \
  "$REPO_ROOT/www/static/js/screens/achievementMenu.js" \
  "$REPO_ROOT/www/static/js/screens/mainMenu.js" \
  "$REPO_ROOT/www/static/js/screens/settingsMenu.js" \
  "$REPO_ROOT/www/static/js/screens/gameScreen.js" \
  "$REPO_ROOT/www/static/js/main.js" \
  > "$OUT"

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
