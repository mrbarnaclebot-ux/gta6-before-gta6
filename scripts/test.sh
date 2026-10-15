#!/usr/bin/env bash
# Everything CI runs, in the order a failure is cheapest to find.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
