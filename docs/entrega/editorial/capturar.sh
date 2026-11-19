#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../backend"
temp=$(mktemp -d)
pg_port=${LS_CAPTURE_PG_PORT:-55492}
export PORT=${LS_CAPTURE_PORT:-45492}
export DATABASE_URL="postgresql://ls_docs@127.0.0.1:$pg_port/ls_docs"
export JWT_SECRET='solo-capturas-locales-clave-temporal-2026'
export MAIL_TRANSPORT=disabled NODE_ENV=test
export FRONTEND_PUBLIC_URL="http://127.0.0.1:$PORT"
cleanup() {
  pg_ctl -D "$temp/db" -m fast -w stop >/dev/null 2>&1 || true
  rm -rf -- "$temp"
}
trap cleanup EXIT
initdb -D "$temp/db" -U ls_docs --auth=trust --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$temp/db" -l "$temp/postgres.log" -o "-h 127.0.0.1 -p $pg_port -k $temp -F" -w start
createdb -h 127.0.0.1 -p "$pg_port" -U ls_docs ls_docs
npm run db:deploy
npm run db:seed
node ../docs/entrega/editorial/capturar.mjs
