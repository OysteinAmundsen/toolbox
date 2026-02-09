#!/bin/bash
# Watch grid source files and rebuild on changes

cd "$(dirname "$0")/.."

# Handle CTRL+C gracefully
trap 'echo ""; echo "Stopping watcher..."; exit 0' INT TERM

echo "Watching libs/grid/src for changes... (CTRL+C to stop)"
exec npx chokidar-cli \
  'libs/grid/src/**/*.ts' \
  'libs/grid/src/**/*.css' \
  --debounce 2000 \
  --polling \
  -c 'bun run build:grid && bun run link:push'
