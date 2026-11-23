# Verificación

Desde la raíz, con dependencias instaladas y PostgreSQL local disponible:

```bash
export CHROME_BIN=/usr/bin/brave BROWSER_BIN=/usr/bin/brave
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix backend run typecheck
npm --prefix backend run build
(cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json && ./node_modules/.bin/tsc --noEmit -p tsconfig.spec.json)
npm --prefix frontend run build -- --output-path ../.angular/fase7
npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
export BROWSER_FRONTEND_DIST="$PWD/.angular/fase7/browser"
export SURVEY_CAPTURE_DIR="$PWD/.angular/fase7-capturas"
npm --prefix backend test -- --surveys-only
npm --prefix backend test -- --availability --mail-browser
npm --prefix backend test -- --browser-only
node backend/tests/run-catalog-migrations.cjs
git diff --check
```

Los ejecutores crean sus propios clústeres en loopback y comprueban el destino antes de insertar fixtures. Ninguna prueba usa PostgreSQL habitual.

- Typechecks y builds aprobados. Angular obtuvo 41 casos aprobados. El catálogo y los formularios se cargan en una ruta diferida. La compilación inicial quedó en 498,64 kB, dentro del presupuesto de 500 kB. Permanece el aviso conocido de SweetAlert2 en CommonJS.
- Migración aislada de 16 a 17, instalación limpia, despliegue repetido y restauración de catálogo, evaluaciones, bienestar, consentimiento sintético y revisiones de encuestas. Se conservaron los 40 SVG.
- Prueba focalizada de API con tres casos aprobados. Comprueba catálogo, fechas de Bogotá, consentimiento, menores, roles, concurrencia, reintentos, cierre, histórico y revocación.
- API y SMTP TLS en loopback con Brave: 63 casos aprobados, cero omisiones. Incluye las tres pruebas de encuestas. La API devolvió 503 controlado con el PostgreSQL de prueba inaccesible.
- Navegador: pasaron los recorridos previos de los cuatro roles, alertas, ejercicios, Excel, evaluaciones, bienestar y sueño del ejecutor general. El paso nuevo detectó un selector ambiguo entre encabezado y leyenda. Se corrigió para consultar el encabezado semántico y el recorrido `npm --prefix backend test -- --surveys-browser` aprobó completo.
- Encuestas en Brave: inicial y final, reanudación, falla de red, conflicto y recuperación, consulta de fisioterapia y cuestionario del entrenador. Se verificaron 16 combinaciones de ancho y tema, contraste de etiquetas y selectores, foco visible, reflow con texto al 200 % y controles de al menos 44 px. Se revisaron las capturas sintéticas de móvil, escritorio y roles.
- `DISCLOSURE_VISUAL=1 npm --prefix backend test -- --browser-only` aprobó en repetición aislada. La primera ejecución observó una rotación intermedia en un desplegable existente. Se conservó su prueba y su implementación.
- El arranque de producción confirmó el bloqueo de encuestas con el indicador de demostración activo. Quedan las comprobaciones físicas y la ejecución remota de CI después de publicar la rama.
