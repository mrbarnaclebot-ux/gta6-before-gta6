#!/usr/bin/env bash
# Rebuilds the whole Blender asset library from the repo root: every family's GLBs and
# previews, then the Meshopt copies in public/assets, then the size check.
#   bash assets-src/blender/build.sh
# BLENDER overrides the Blender binary (default: the macOS app bundle).
set -euo pipefail
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
for family in cars houses props; do
  "$BLENDER" -b --factory-startup --python-exit-code 1 -P "assets-src/blender/$family.py" \
    | grep -E '^(STATS|EXPORTED)'
done
node scripts/compress-assets.mjs models | grep -E '(car_|houses|street_kit|awnings|lifeguard)'
node assets-src/blender/check-glb.mjs
