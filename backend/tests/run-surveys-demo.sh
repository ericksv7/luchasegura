#!/usr/bin/env bash
set -euo pipefail
umask 077

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
demo_dir="$HOME/.local/share/luchasegura-alert-tests-fase7-demo"
data="$demo_dir/data"
pg_port=55437
web_port=4277

mkdir -p -- "$demo_dir"
if [[ -L "$demo_dir" || -L "$data" ]]; then
  echo "La carpeta de demostración y su directorio data deben ser directorios locales." >&2
  exit 1
fi
chmod 700 -- "$demo_dir"
exec 9>"$demo_dir/run.lock"
flock -n 9 || { echo "Ya hay una demostración en marcha." >&2; exit 1; }

node - "$pg_port" "$web_port" <<'NODE'
const net = require('node:net');
for (const port of process.argv.slice(2).map(Number)) {
  const server = net.createServer();
  server.on('error', error => {
    console.error(`127.0.0.1:${port} no está disponible (${error.code}).`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => server.close());
}
NODE

pg_started=0
web_pid=
cleanup() {
  if [[ -n "$web_pid" ]]; then
    kill -TERM "$web_pid" 2>/dev/null || true
    wait "$web_pid" 2>/dev/null || true
  fi
  if [[ "$pg_started" == 1 ]]; then
    pg_ctl -D "$data" -m fast -w stop
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ ! -f "$demo_dir/postgres.password" ]]; then
  openssl rand -hex 24 > "$demo_dir/postgres.password"
fi
if [[ ! -f "$demo_dir/jwt.secret" ]]; then
  openssl rand -hex 32 > "$demo_dir/jwt.secret"
fi
if [[ ! -f "$data/PG_VERSION" ]]; then
  initdb -D "$data" -U ls_test --auth-local=reject --auth-host=scram-sha-256 \
    --pwfile="$demo_dir/postgres.password" --no-locale --encoding=UTF8
fi
if pg_ctl -D "$data" status >/dev/null 2>&1; then
  echo "El clúster de demostración ya está iniciado." >&2
  exit 1
fi
pg_ctl -D "$data" -l "$demo_dir/postgres.log" -o "-h 127.0.0.1 -p $pg_port -k ''" -w start 9>&-
pg_started=1

address="postgresql://ls_test:$(<"$demo_dir/postgres.password")@127.0.0.1:$pg_port"
expected="$pg_port|$(cd -- "$data" && pwd -P)"
actual="$(psql -XAt -v ON_ERROR_STOP=1 "$address/postgres" \
  -c "SELECT inet_server_port(), current_setting('data_directory')")"
if [[ "$actual" != "$expected" ]]; then
  echo "El destino PostgreSQL no coincide con el clúster aislado." >&2
  exit 1
fi
if [[ "$(psql -XAt -v ON_ERROR_STOP=1 "$address/postgres" \
  -c "SELECT 1 FROM pg_database WHERE datname = 'luchasegura_alert_test'")" != 1 ]]; then
  psql -X -v ON_ERROR_STOP=1 "$address/postgres" -c 'CREATE DATABASE luchasegura_alert_test'
fi

export DATABASE_URL="$address/luchasegura_alert_test"
export JWT_SECRET="$(<"$demo_dir/jwt.secret")"
export NODE_ENV=development DOTENV_CONFIG_PATH=/dev/null MAIL_TRANSPORT=disabled
export ALERT_REVIEW_TESTS=1 PREVENTIVE_SURVEYS_DEMO=1 CORS_ORIGIN="http://127.0.0.1:$web_port"
npm --prefix "$root/backend" run db:deploy
npm --prefix "$root/frontend" run build -- --configuration development --output-path "$demo_dir/build"
cd -- "$root/backend"
node --import tsx tests/preventive-surveys-demo.ts "$demo_dir/build/browser" &
web_pid=$!
wait "$web_pid"
