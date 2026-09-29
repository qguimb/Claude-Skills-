#!/usr/bin/env bash
# Package the council as a standalone skill for claude.ai chat
# (Settings > Capabilities > Skills > Upload). The role prompts are copied
# into roles/ because a chat skill upload does not include the plugin's agents/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
mkdir -p "$tmp/credit-council/roles"
cp "$here/skills/credit-council/SKILL.md" "$tmp/credit-council/"
cp "$here"/agents/*.md "$tmp/credit-council/roles/"
rm -f "$here/credit-council-skill.zip"
(cd "$tmp" && zip -qr "$here/credit-council-skill.zip" credit-council)
rm -rf "$tmp"
echo "Built $here/credit-council-skill.zip"
