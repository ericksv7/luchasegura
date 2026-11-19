# Instalación y ejecución

## Preparar el entorno

Usa una versión de Node.js admitida por Angular 20 y el backend, npm, y PostgreSQL disponible. Para pruebas aisladas también se necesitan los binarios `initdb`, `pg_ctl`, `createdb` y `psql`. Crea una base local y un usuario dedicado con los permisos correspondientes. El entorno de referencia está en el informe de pruebas.

Abre una terminal en `backend`. Copia `.env.example` a `.env` solamente en una instalación nueva. Configura `DATABASE_URL` para tu base, un `JWT_SECRET` aleatorio, el puerto y el origen de frontend. Mantén el archivo fuera del control de versiones.

```sh
npm ci --ignore-scripts
npm run db:generate
npx prisma validate
npx prisma migrate status
npm run db:deploy
npm run db:create-admin -- correo@example.test "Administración de prueba"
npm run dev
```

El estado previo de una base nueva puede mostrar migraciones pendientes. Confirma que la conexión corresponde a la base prevista antes de aplicar cambios. El comando de administración entrega una contraseña temporal. Transmítela por un canal seguro y cámbiala en el primer acceso.

En una segunda terminal, desde `frontend`:

```sh
npm ci --ignore-scripts
npm start
```

Abre `http://localhost:4200`. Angular envía `/api` por el proxy de desarrollo al puerto 3000. Abre `http://localhost:3000/api/health` para comprobar que la base responde.

### Datos iniciales

Las migraciones crean la estructura. El programa requiere un registro con sesiones. El script `db:seed` crea cuentas de demostración y un programa en borrador cuando falta, pero el borrador carece de sesiones. Reserva ese script para una base de demostración aislada. Para una demostración completa, usa el recorrido automatizado con sus datos sintéticos o prepara un programa autorizado mediante un procedimiento revisado. [Inicialización existente](../../backend/prisma/seed.ts) · [Flujo del programa](../ux/programa-ejercicios_flujo.md)

## Compilación, ejecución y pruebas

| Directorio | Comandos |
| --- | --- |
| `backend` | `npm run typecheck`, `npm run build`, `npm start` |
| `frontend` | `npx tsc --noEmit -p tsconfig.app.json`, `npx tsc --noEmit -p tsconfig.spec.json`, `npm run build` |
| `backend` con PostgreSQL local para pruebas | `npm test` o, tras compilar, `npm test -- --availability` |
| `backend` con Brave y Playwright Core | `npm test -- --browser-only`, con `PLAYWRIGHT_CORE_PATH` y opcionalmente `BROWSER_BIN` |
| `frontend` con navegador compatible | `npm test -- --watch=false --browsers=ChromeHeadless`, con `CHROME_BIN` si se necesita |

En producción establece `NODE_ENV=production`, publica el contenido de `frontend/dist/frontend/browser` con redirección de rutas Angular a `index.html` y dirige `/api` al proceso Express. El proxy de Angular CLI sirve durante desarrollo. [Preparación para despliegue](09_PREPARACION_DESPLIEGUE.md)

## Problemas frecuentes

| Síntoma | Comprobación |
| --- | --- |
| API devuelve 503 | Verifica servicio de PostgreSQL, destino de `DATABASE_URL`, usuario y permisos. |
| Angular no llega a API | Comprueba puerto y `proxy.conf.json` o enrutamiento de producción. |
| Prisma Client ausente | Ejecuta `npm run db:generate` desde backend. |
| Error al compilar por Manrope | La configuración existente resuelve Google Fonts durante la compilación. Comprueba la conectividad autorizada. |
| Plan vacío | Comprueba el programa con sesiones y el inicio de intervención. |
| Acceso denegado | Revisa rol, estado activo y cambio de contraseña solicitado. |

[Scripts frontend](../../frontend/package.json) · [Scripts backend](../../backend/package.json)
