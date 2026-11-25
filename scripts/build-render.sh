#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm --prefix frontend ci --include=dev
NG_BUILD_MAX_WORKERS=2 npm --prefix frontend run build
test -s frontend/dist/frontend/browser/index.html

npm --prefix backend ci --include=dev
npm --prefix backend run db:generate
npm --prefix backend run build
test -s backend/dist/src/index.js
