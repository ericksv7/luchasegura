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
