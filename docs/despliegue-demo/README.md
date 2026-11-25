# Publicar la demostración académica

Render Free sirve Angular y Express bajo el mismo dominio HTTPS. Neon Free conserva las cuentas y los registros en PostgreSQL. El entorno es exclusivo para datos ficticios. [Render Free](https://render.com/docs/free) · [Render Blueprints](https://render.com/docs/blueprints) · [Prisma con Neon](https://neon.com/docs/guides/prisma)

## 1. Aprovisionar Neon y preparar las cuentas

1. En [Neon Console](https://console.neon.tech), crea un proyecto Free dedicado. En **Branches → Databases**, crea la base `luchasegura_presentacion`. En **Connect**, selecciona esa base y el rol propietario que creó Neon. Desactiva **Connection pooling** para copiar la conexión directa con TLS.
2. En el repositorio, cambia a `feature/deploy-demo-academica`. Usa Node 22, Bash y una terminal privada sin grabación. Desde la raíz ejecuta:

   ```bash
   npm --prefix backend ci --include=dev
   npm --prefix backend run db:generate
   bash -c 'read -rsp "Conexión directa de Neon: " PRESENTATION_DIRECT_URL; printf "\n"; export PRESENTATION_DIRECT_URL; npm --prefix backend run db:seed:presentacion'
   ```

   El seed verifica el destino, ejecuta `prisma migrate deploy` sobre la conexión directa y carga la base con una transacción. Repetirlo conserva los registros, las fechas y las contraseñas vigentes. En nuevas versiones con migraciones, repite este paso antes de desplegar. El comando usa una variable transitoria y conserva la conexión fuera del historial y de Render.

3. Abre el archivo privado `~/.luchasegura-presentacion.json` (permisos 600) con un editor de confianza. Importa las contraseñas a tu gestor y entrega cada acceso individualmente por un canal privado. Guarda administración para el responsable de la presentación. El cambio de contraseña se hace dentro de la aplicación. Tras un cambio, actualiza el gestor de contraseñas y retira la copia inicial cuando ya no se necesite.

| Cuenta | Correo de demostración |
| --- | --- |
| Administración | `admin@luchasegura.example.test` |
| Fisioterapia | `fisio@luchasegura.example.test` |
| Entrenamiento | `entrenador@luchasegura.example.test` |
| Deportista A | `deportista-a@luchasegura.example.test` |
| Deportista B | `deportista-b@luchasegura.example.test` |

A tiene las ocho semanas previstas transcurridas, sesiones registradas y evaluaciones iniciales y finales comparables. B comienza la segunda semana al aprovisionar, con evaluaciones iniciales, sesiones, bienestar y una molestia en seguimiento. Las ventanas se calculan con la fecha del primer aprovisionamiento en Bogotá. Los estados describen el período del programa. Los resultados son simulados y sirven para probar las pantallas.

## 2. Publicar en Render

1. En [Render Dashboard](https://dashboard.render.com), elige **New → Blueprint**, autoriza GitHub, selecciona `ericksv7/luchasegura` y la rama `feature/deploy-demo-academica`. Usa `render.yaml` desde la raíz. La rama aísla esta publicación académica de `develop` y `main`.
2. En **Connect** de Neon, activa **Connection pooling** para la misma base. En el formulario privado del Blueprint, o en **Web Service → Environment**, coloca esa URL en `DATABASE_URL`. Conserva `sslmode=require` y añade `&connection_limit=3&connect_timeout=15&pool_timeout=15` a la URL de Neon. Los secretos se introducen en los paneles y en la terminal privada.
3. Aplica el Blueprint y confirma que el servicio es **Free**. Render genera `JWT_SECRET` con 256 bits. Si eliges **New → Web Service** manualmente, copia los ajustes de `render.yaml` al panel y genera un valor fresco para `JWT_SECRET` con `openssl rand -hex 32` en privado.

| Ajuste del servicio | Valor |
| --- | --- |
| Directorio raíz | Raíz del repositorio, déjalo en blanco en el formulario manual |
| Build | `bash scripts/build-render.sh` |
| Start | `npm --prefix backend start` |
| Health check | `/api/health` |
| Entorno | `NODE_ENV=production`, `NODE_VERSION=22.23.5` |
| Proxy | `TRUST_PROXY_HOPS=1` |
| Angular | `ANGULAR_BROWSER_DIR=../frontend/dist/frontend/browser`, relativo al directorio `backend/` |
| Aviso académico | `PRESENTATION_NOTICE=1` |
| Credenciales del servicio | `DATABASE_URL` agrupada, `JWT_SECRET` generado por Render |
| Puerto | `PORT` asignado por Render, escucha en `0.0.0.0` |

El build limita los workers de Angular a dos y genera `frontend/dist/frontend/browser` y `backend/dist/src/index.js`. Arranque y reinicios reutilizan la base de Neon. Mantén `MAIL_TRANSPORT=disabled` para las direcciones de ejemplo. El registro público permanece cerrado por el aviso de consentimiento en borrador. Las encuestas quedan deshabilitadas en producción. El informe grupal y su Excel se reservan a la demostración local aislada por la regla de divulgación pendiente. El informe individual y la exportación de seguimiento conservan sus permisos.

## 3. Verificar, reiniciar y retirar

- Abre la URL `https://…onrender.com` **del panel** desde otro equipo. Comprueba `/api/health`, inicia sesión por rol, visita los perfiles A y B, plan, bienestar, FMS y LESS, molestias y alertas. Desde fisioterapia y Deportista A, abre el informe individual y descarga el Excel. Revisa una ruta interna al recargar, la consola y la navegación móvil. Comparte la URL cuando pasen esas pruebas.
- Para reiniciar en Render, usa **Manual Deploy → Deploy latest commit** con la misma configuración. Verifica de nuevo salud, login y que los datos se conservan. El primer acceso tras inactividad puede tardar alrededor de un minuto. Si salud devuelve 503, verifica en los paneles que Neon está accesible, que la conexión agrupada señala la base correcta y que TLS sigue configurado. Si falla el seed, revisa la conexión directa, el rol propietario y el historial de migraciones en privado.
- Para comprobar localmente, ejecuta `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix backend test -- --reports-only` y `npm --prefix frontend run build`. Como respaldo de presentación, usa `npm --prefix backend test -- --reports-demo` con los artefactos Angular compilados y el PostgreSQL temporal del ejecutor. Abre la URL local que indique el comando. Mantén sus credenciales de fixture dentro del entorno local.
- Al terminar, suspende el servicio desde Render para retirar el acceso. Cuando el responsable confirme la limpieza definitiva, elimina únicamente el servicio y el proyecto Neon dedicados desde sus respectivos paneles y retira las contraseñas de presentación de tu gestor y de la copia local.
