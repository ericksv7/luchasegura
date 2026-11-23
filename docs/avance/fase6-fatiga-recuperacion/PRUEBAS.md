# Pruebas de Fase 6

Los ensayos de escritura usan clústeres PostgreSQL temporales y datos sintéticos. Desde la raíz, con Node.js 22.23.5, OpenSSL y las herramientas PostgreSQL en el PATH:

```sh
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix backend run typecheck
npm --prefix backend run build
(cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json && ./node_modules/.bin/tsc --noEmit -p tsconfig.spec.json)
npm --prefix frontend run build
```

Con Chrome o Chromium y Playwright 1.65.1 configurados como en CI:

```sh
export BROWSER_BIN=/usr/bin/google-chrome
export CHROME_BIN="$BROWSER_BIN"
export PLAYWRIGHT_CORE_PATH=/ruta/absoluta/node_modules/playwright-core
npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
npm --prefix backend test -- --wellbeing-only
npm --prefix backend test -- --availability --mail-browser
npm --prefix backend test -- --wellbeing-browser
npm --prefix backend test -- --browser-only
DISCLOSURE_VISUAL=1 npm --prefix backend test -- --browser-only
node backend/tests/run-catalog-migrations.cjs
git diff --check
```

## Resultados locales

- Ambos typechecks y builds aprobaron. El build inicial Angular quedó en 497,19 kB frente al presupuesto de 500 kB. Permanece el aviso de SweetAlert2 en CommonJS.
- Pasaron 36 casos Angular y 58 casos backend sin omisiones. Backend incluye 30 casos de flujos, seis de Excel, 16 de seguridad y bienestar y seis SMTP con navegador. Los cuatro casos de bienestar se ejecutaron también de forma focalizada.
- PostgreSQL temporal aplicó 15 migraciones. Pasaron instalación limpia, actualización desde Fase 5, despliegue repetido, conservación de evaluaciones y catálogo, restricciones únicas y técnicas, y restauración de dos versiones de bienestar. Prisma no detectó diferencias de esquema.
- Chromium verificó 16 combinaciones de ancho y tema a 320, 360, 390, 414, 768, 1024, 1440 y 896 × 414 px. Verificó foco, teclado, tamaño de controles, contraste de texto, texto ampliado al 200 %, zoom manual habilitado y desplazamiento con una altura simulada de 350 px. También pasó registro, reintento tras fallo de red, conflicto de edición, historial, gráfica con alternativa textual, revocación, reapertura y permisos.
- Pasaron la regresión general de los cuatro perfiles y el recorrido visual existente de 60 combinaciones móviles de acceso, desplegables, foco y Excel. La expectativa del menú de deportista incorpora la nueva opción. Las capturas sintéticas de bienestar en móvil oscuro y escritorio claro se inspeccionaron localmente.
- Queda pendiente la validación física con Safari/iOS, Android, teclado virtual real y lector de pantalla. Las comprobaciones de contraste cubren los elementos ensayados y no constituyen una auditoría completa de WCAG.

## Ampliación · Evolución del sueño

Se repitieron los typechecks y builds frontal y backend y la suite de API y SMTP con Brave. Pasaron 39 pruebas Angular y 60 pruebas backend sin omisiones. El ensayo focalizado de bienestar pasó los seis casos, incluidos exactitud de horas y fechas, omisiones y ceros, periodos históricos, separación por propietario, asignación, consentimiento, revocación, protección de menores y bloqueo de producción mientras el texto sigue en borrador.

Con el build final pasó la regresión general de los cuatro roles en Brave. La prueba de sueño verificó la gráfica en los tres perfiles, 14 combinaciones de ancho y tema, el acceso por teclado a la tabla, foco, contraste de texto, zoom de texto al 200 % y retirada del permiso desde Mi bienestar. El ensayo de migraciones aplicó las 16 migraciones sobre PostgreSQL aislado, verificó el esquema con Prisma y restauró una autorización sintética revocada. Se usó la caché ignorada del proyecto para los clústeres tras agotarse el espacio en `/tmp`.

Para repetir, usa los comandos anteriores con `BROWSER_BIN=/usr/bin/brave`, `CHROME_BIN=/usr/bin/brave` y la ruta local de Playwright. Con espacio insuficiente en `/tmp`, ejecuta desde la raíz:

```sh
mkdir -p .angular/pg
export TMPDIR="$PWD/.angular/pg"
npm --prefix backend test -- --wellbeing-only
npm --prefix backend test -- --wellbeing-browser
```

Quedan pendientes la prueba física en Safari/iOS y Android y la validación con lector de pantalla. La autorización de entrenador en producción requiere la aprobación institucional de los dos textos. Cualquier habilitación para menores requiere además un procedimiento específico.

## Cierre estable desde 852e27f

Aprobaron los typechecks de Angular (aplicación y pruebas) y backend, ambos
builds, las 39 pruebas Angular en Brave headless y las 60 pruebas backend
sin omisiones. Estas últimas cubren inicio de sesión, revocación, permisos,
bienestar, consentimiento, evaluaciones, alertas, Excel y recuperación SMTP.

`node backend/tests/run-catalog-migrations.cjs` verificó instalación limpia,
actualización histórica, despliegue repetido, 40 SVG y restauración sintética.
Las 16 migraciones incluyen `20261123120000_wellbeing_entries` y
`20261124120000_sleep_sharing`. Todas las operaciones de base de datos usaron
clústeres de prueba.

Con `--wellbeing-browser`, Brave comprobó el formulario en 16 combinaciones
de tamaño y tema y la gráfica de sueño en 14, incluidos 320, 390, 414, 768 y
1440 px en ambos temas. Pasaron las comprobaciones de contraste de los
controles probados, foco, reflow con fuente raíz al 200 %, tabla de sueño,
historial, errores recuperables y revocación al recuperar el foco. Se
inspeccionaron capturas nuevas de Mi bienestar a 414 px en oscuro y 1440 px en
claro. La captura móvil conserva la estructura de la referencia previa al
rediseño. Las capturas contienen datos sintéticos y quedan en el área de
trabajo ignorada por Git.

El recorrido general `--browser-only` comprobó la navegación y los permisos
de los cuatro perfiles, incluido «Saltar al contenido» con Enter y foco en
el área principal. También cubrió evaluaciones, alertas, seguimientos,
biblioteca y descarga Excel en el navegador.
La primera repetición del recorrido de bienestar agotó la espera después
de enviar la autorización. La prueba ahora espera a que el botón esté
habilitado y comprueba el HTTP 204 antes de continuar al panel del entrenador.
El recorrido focalizado aprobó tras ese ajuste.

La suite focalizada `--mail-only --mail-browser` también aprobó sus seis
casos con la compilación recuperada, incluida la recuperación completa por
SMTP TLS en Brave.

Pendientes manuales: lector de pantalla, Safari en iPhone, Android físico y
zoom del navegador al 200 % en esos entornos. Los avisos de consentimiento
siguen en borrador y mantienen bloqueada la compartición en producción. El
flujo de menores requiere autorización institucional específica.

Para repetir los recorridos con el build de la rama actual:

```bash
npm --prefix frontend run build -- --output-path ../.angular/fase6-cierre
npm --prefix backend run build
export BROWSER_BIN=/usr/bin/brave
export BROWSER_FRONTEND_DIST="$PWD/.angular/fase6-cierre/browser"
export WELLBEING_CAPTURE_DIR="$PWD/.angular/fase6-cierre-capturas"
npm --prefix backend test -- --browser-only
npm --prefix backend test -- --mail-only --mail-browser
```
