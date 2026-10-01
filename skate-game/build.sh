#!/usr/bin/env bash
# Concatenate the sources into one self-contained page.
#   index.html     standalone document (open it directly in a browser)
#   dist/artifact.html  same page without the document skeleton, for claude.ai artifacts
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/shell.html
  echo '<script type="module">'
  cat src/01_core.js src/02_textures.js src/03_world.js src/04_skater.js src/05_physics.js src/06_game.js
  echo '</script>'
} > dist/artifact.html
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
  cat dist/artifact.html
  echo '</body></html>'
} > index.html
echo "built $(wc -c < index.html) bytes"
