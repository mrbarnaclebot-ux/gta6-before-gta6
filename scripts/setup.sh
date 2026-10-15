#!/usr/bin/env bash
# One-command setup: dependencies plus the Chromium build Playwright drives.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm install
pnpm exec playwright install chromium
