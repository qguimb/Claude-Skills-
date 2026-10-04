#!/usr/bin/env bash
# Concatenate the sources into one self-contained page.
#   index.html          standalone document (open it directly in a browser)
#   dist/artifact.html  same page without the document skeleton, for claude.ai artifacts
# The game code runs as a classic script once window.THREE exists; if the jsDelivr copy of
# three.js did not load, it tries unpkg before reporting the failure on the menu.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/shell.html
  echo '<script>'
  echo '(function () {'
  echo 'function main() {'
  echo "'use strict';"
  cat src/01_core.js src/02_textures.js src/03_world.js src/04_skater.js src/05_physics.js src/05b_softrender.js src/06_game.js
  echo '}'
  cat <<'JS'
function fail() { window.__skateStatus('Could not download the 3D engine (three.js) from cdn.jsdelivr.net or unpkg.com. Check your connection or ad blocker, then reload the page.', true); }
function run() { try { main(); } catch (e) { window.__skateStatus('The game could not start: ' + e.message + '. Try reloading the page.', true); console.error(e); } }
if (window.THREE) run();
else {
  var s = document.createElement('script');
  s.src = 'https://unpkg.com/three@0.159.0/build/three.min.js';
  s.onload = function () { window.THREE ? run() : fail(); };
  s.onerror = fail;
  document.head.appendChild(s);
}
})();
</script>
JS
} > dist/artifact.html
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
  cat dist/artifact.html
  echo '</body></html>'
} > index.html
echo "built $(wc -c < index.html) bytes"
