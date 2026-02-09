#!/bin/bash
# Watch all library source files and rebuild on changes.
# Nx caching ensures only changed libs (and their dependents) are rebuilt.

cd "$(dirname "$0")/.."

# Handle CTRL+C gracefully
trap 'echo ""; echo "Stopping watcher..."; exit 0' INT TERM

echo "Watching libs/*/src for changes... (CTRL+C to stop)"
exec npx chokidar-cli \
  'libs/grid/src/**/*.{ts,css}' \
  'libs/grid-angular/src/**/*.ts' \
  'libs/grid-react/src/**/*.{ts,tsx}' \
  'libs/grid-vue/src/**/*.{ts,vue}' \
  'libs/themes/*.css' \
  --debounce 2000 \
  -c 'bun run build:libs && bun run link:push'
