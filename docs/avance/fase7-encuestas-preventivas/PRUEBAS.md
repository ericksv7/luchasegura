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

## Regresión de la consulta en fisioterapia

Se comprobó la rama `feature/fase7-encuestas-preventivas` con los commits `c627b85` y `1f85fcf`. Brave, con la compilación de referencia y una base sintética, abrió la encuesta inicial presentada desde la ficha tras un único GET a `/api/preventive-surveys/team/:athleteId` con HTTP 200 y `eligible: false`. El mensaje exacto reportado estaba en el manejador de HTTP 403 y 404. La única condición que usaba `eligible` controlaba la oferta de consentimiento al deportista. Con el entorno del informe abreviado no se pudo atribuir aquel mensaje al HTTP 200.

La regresión reproducible apareció al navegar entre dos identificadores dentro de la ruta de encuestas. Angular reutilizaba el componente, cuyo `snapshot.paramMap` fijaba tanto la URL de API como el enlace de regreso al primer deportista. La prueba llegó a la lectura con la compilación anterior y falló al esperar el estado de acceso del nuevo identificador. La pantalla ahora observa `paramMap`, cancela solicitudes en curso, limpia el estado anterior y carga el identificador activo. La recarga directa conserva los guards de rol y el manejo de sesión del interceptor.

- `enabled` indica disponibilidad del módulo. `eligible` se refiere al deportista que responde o consiente. La consulta profesional se verifica en servidor con rol, atención documentada y consentimiento vigente.
- `consent: false` bloquea los datos. Para profesionales, `revoked` permanece en `false` conforme al contrato. La respuesta incorpora el nombre del deportista para fisioterapia con autorización vigente y el nombre de la intervención cuando existe.
- `context` describe la intervención. `slots` muestran el estado actual y `records` permiten consultar el historial por intervención. Fisioterapia ve el estado de los borradores y las respuestas presentadas. Las versiones guardadas de un registro siguen reservadas al autor autorizado.
- La pantalla diferencia consulta vacía, falta de consentimiento, 403 y 404. La conexión fallida y los errores del servidor ofrecen reintento de la consulta. El 401 mantiene la salida de sesión existente. La navegación entre deportistas y el rechazo de acceso retiran los datos que la pantalla conservaba.

La verificación aprobó 49 pruebas Angular y 63 de integración de API y SMTP con Brave. La revisión de la consulta profesional cubrió 320, 360, 390, 414, 768, 1024 y 1440 px en ambos temas, lectura por teclado, foco al abrir respuestas, contraste del texto de respuesta y reflow con texto al 200 %. Se revisaron capturas a 320 y 1440 px. Las pruebas incluyen consulta inicial y final, histórico por intervención, cambio de deportista, recarga, retiro de consentimiento, JWT caducado, sesión revocada, denegaciones de rol y reintentos. Se aprobaron los typechecks, builds y verificación de las 17 migraciones en PostgreSQL temporal. El bundle inicial de Angular quedó en 498,81 kB con el aviso existente de SweetAlert2. Quedan fuera de esta verificación el entorno manual original, dispositivos físicos y una auditoría formal con tecnologías de asistencia.

### Repetir en Brave

1. Usa exclusivamente un entorno de demostración aislado con `PREVENTIVE_SURVEYS_DEMO=1`, PostgreSQL temporal y datos sintéticos. El ejecutor `npm --prefix backend test -- --surveys-browser` prepara su propio clúster y lo detiene al terminar. Usa `BROWSER_BIN=/usr/bin/brave` y apunta `BROWSER_FRONTEND_DIST` al directorio `browser` del build. Si Playwright Core está fuera del repositorio, define `PLAYWRIGHT_CORE_PATH` con su ruta. `SURVEY_CAPTURE_DIR` permite guardar capturas.
2. En el entorno aislado, registra a una persona adulta ficticia y establece el inicio del programa de ocho semanas entre uno y siete días después del día civil actual en Bogotá. Registra una atención de fisioterapia mediante una revisión profesional de alerta o de evaluación funcional.
3. Como deportista, entra en **Mi plan → Encuestas preventivas**, acepta la autorización de demostración y presenta la inicial.
4. En otra pestaña, inicia sesión como el fisioterapeuta que documentó la atención. Abre **Equipo → Deportistas → ficha del deportista → Encuestas preventivas**. En la pestaña Red de Brave verifica el GET de equipo con HTTP 200, `enabled: true`, `eligible: false`, `consent: true` y el registro `INITIAL` presentado.
5. Abre **Consultar respuestas** y comprueba el nombre, la intervención, la fecha de presentación, el periodo, la versión y las respuestas. Recarga Brave, abre de nuevo la encuesta y vuelve a la ficha. Alterna con otro deportista autorizado sin registros y confirma el estado vacío.
6. Con una cuenta de fisioterapia sin atención documentada, la misma URL debe mostrar el mensaje neutral de recurso no disponible o sin acceso. Retira después el consentimiento desde la cuenta del deportista y recarga la consulta con el fisioterapeuta autorizado. Debe aparecer **Sin autorización vigente** y desaparecer la acción de consulta.
