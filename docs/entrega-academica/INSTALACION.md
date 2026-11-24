# Instalación y ejecución local

Usa una cuenta de sistema sin privilegios de administrador. Se necesitan Git, Node.js 22 a partir de 22.12 o Node.js 24 LTS, npm y PostgreSQL con `initdb`, `pg_ctl`, `createdb` y `psql` en el PATH. CI usa Node 22.23.5. Consulta el [informe de pruebas](PRUEBAS.md) para las versiones verificadas en Fase 9. La instalación independiente usa Bash y OpenSSL. Para pruebas se necesitan además Brave o Chromium, Playwright Core, `pg_dump` y `pg_restore`. La primera instalación requiere acceso a npm y a los binarios de Prisma.

```bash
node -v
npm -v
pg_config --version
export PATH="$(pg_config --bindir):$PATH"
command -v initdb pg_ctl createdb psql openssl
git status -sb
npm ci --prefix backend
npm ci --prefix frontend
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix frontend run build
```

Los dos `npm ci` instalan las versiones bloqueadas. Prisma debe indicar que generó el cliente. El build del backend produce `backend/dist/src/index.js` y Angular escribe `frontend/dist/frontend/browser/index.html`.

## Demostración integrada

```bash
TMPDIR=/tmp npm --prefix backend test -- --reports-demo
```

El ejecutor crea un clúster temporal exclusivo en loopback, comprueba el directorio de datos mediante SQL, aplica las migraciones y carga las fixtures. El sitio sirve Angular y la API en el mismo puerto, normalmente 4288. Abre `http://127.0.0.1:4288/login` y sigue el [guion](DEMOSTRACION.md). `/api/health` devuelve el estado del servicio y PostgreSQL. Ctrl+C cierra el servidor, detiene su clúster y retira el directorio temporal.

Si el puerto está ocupado, identifica primero el proceso con `ss -ltnp 'sport = :4288'`. Puedes cambiar el puerto con `TMPDIR=/tmp PROGRAM_REPORT_DEMO_PORT=4289 npm --prefix backend test -- --reports-demo`. En Linux, el informe grupal exige que el clúster esté directamente bajo `/tmp`. Asegúrate de que ese volumen tenga espacio libre. Para las otras suites puedes usar un `TMPDIR` corto y escribible. Los sockets Unix de PostgreSQL y Brave tienen un límite de longitud. Si falta el sitio compilado, repite el build Angular. Si Prisma no obtiene el binario durante la instalación, comprueba el acceso de red y repite `db:generate` antes de iniciar la API.

## Desarrollo con dos servicios y base independiente

Usa este modo en un equipo de desarrollo con acceso de red controlado. El servidor independiente de Express escucha en las interfaces disponibles. Comprueba que 3000, 4200 y 55439 estén libres con `ss -ltnp` antes de ejecutar el bloque. Si cambias el puerto de API, actualiza también el destino de `frontend/proxy.conf.json` en tu copia local. En una terminal Bash, desde la raíz:

```bash
(
set -e
ls_db="$(mktemp -d)"
initdb -D "$ls_db/data" -U ls_local --auth=trust --no-locale --encoding=UTF8
pg_ctl -D "$ls_db/data" -l "$ls_db/postgres.log" -o "-h 127.0.0.1 -p 55439 -k $ls_db" -w start
trap 'pg_ctl -D "$ls_db/data" -m fast -w stop' EXIT
createdb -h 127.0.0.1 -p 55439 -U ls_local luchasegura_local
export DATABASE_URL=postgresql://ls_local@127.0.0.1:55439/luchasegura_local
export JWT_SECRET="$(openssl rand -hex 32)"
export DOTENV_CONFIG_PATH=/dev/null MAIL_TRANSPORT=disabled NODE_ENV=development
export PORT=3000 CORS_ORIGIN=http://localhost:4200 FRONTEND_PUBLIC_URL=http://localhost:4200
npm --prefix backend run db:deploy
npm --prefix backend run db:seed
npm --prefix backend start
)
```

Prisma debe aplicar las migraciones versionadas. El seed imprime «Datos de ejemplo cargados». En otra terminal ejecuta `npm --prefix frontend start -- --host localhost --port 4200`, abre `http://localhost:4200/login` e inicia sesión con `deportista@demo.local` y la contraseña ficticia `Cambiar123!`. `curl -fsS http://localhost:4200/api/health` verifica también el proxy. Detén primero Angular y luego la API con Ctrl+C en sus terminales. Al salir del bloque, el trap detiene únicamente el clúster que creó. Su directorio queda disponible para inspección local. La autenticación PostgreSQL de confianza se usa únicamente en este entorno temporal en loopback.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL. La demostración la asigna al clúster temporal |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Secreto aleatorio de al menos 32 caracteres y duración con unidad, por defecto `2h` |
| `PORT`, `CORS_ORIGIN` | Puerto y origen de frontend autorizados en la API independiente |
| `TRUST_PROXY_HOPS` | Por defecto `0`. Solo se configura detrás de proxies controlados |
| `MAIL_TRANSPORT`, `FRONTEND_PUBLIC_URL` | En demo, correo deshabilitado. En un entorno autorizado, la URL del frontend se usa para los enlaces de recuperación |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Configuración de SMTP, necesaria únicamente al activar ese transporte |
| `PROGRAM_REPORT_DEMO_PORT`, `TMPDIR` | Puerto de la demostración y raíz temporal para su clúster |

`backend/.env.example` contiene valores de ejemplo. Para una instalación independiente con `.env`, configura valores propios y conserva el archivo fuera de Git. El ejecutor de demostración ignora el `.env` local y controla los indicadores de encuestas e informes sintéticos.

## Regresión

```bash
browser_tools="$(mktemp -d)"
npm install --prefix "$browser_tools" --no-save --package-lock=false --ignore-scripts playwright-core@1.65.1
export PLAYWRIGHT_CORE_PATH="$browser_tools/node_modules/playwright-core"
export BROWSER_BIN="$(command -v brave)"
export CHROME_BIN="$BROWSER_BIN"
npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
npm --prefix backend test -- --availability --mail-browser
npm --prefix backend test -- --browser-only
DISCLOSURE_VISUAL=1 npm --prefix backend test -- --browser-only
TMPDIR=/tmp npm --prefix backend test -- --reports-only
TMPDIR=/tmp npm --prefix backend test -- --reports-browser
node backend/tests/run-catalog-migrations.cjs
```

`BROWSER_BIN` puede apuntar al ejecutable local de Brave o Chromium. La recuperación usa un SMTP TLS de prueba en loopback. Los ejecutores de API y navegador gestionan su propia base temporal. Una vez terminados, cada ejecutor informa el cierre de su clúster.
