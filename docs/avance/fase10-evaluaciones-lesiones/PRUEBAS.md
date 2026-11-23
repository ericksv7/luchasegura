# Pruebas de Fase 10

Entorno local con Node 26.13.1, npm 12.2.2, PostgreSQL 18.7, Prisma 6.19.3 y Brave 157.1.99.57. Las pruebas de integración usaron clústeres PostgreSQL temporales en loopback.

| Verificación | Comando | Resultado |
|---|---|---|
| Tipos y build backend | `npm --prefix backend run typecheck` y `npm --prefix backend run build` | Correctos |
| Tipos Angular | `tsc --noEmit -p tsconfig.app.json` y `tsc --noEmit -p tsconfig.spec.json` desde `frontend/` | Correctos |
| Angular | `npm --prefix frontend run build` y `npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | Build correcto y 53 de 53 pruebas |
| API y SMTP local | `npm --prefix backend test -- --availability --mail-browser` | 63 de 63. Incluye permisos, revocación, evaluaciones, encuestas, bienestar, reportes y recuperación |
| API e informes | `TMPDIR=/tmp npm --prefix backend test -- --reports-only` | 10 de 10. Incluye FMS, LESS, ficha de lesiones, semana 0, privacidad y Excel |
| Formularios nuevos en Brave | `TMPDIR=/tmp npm --prefix backend test -- --assessments-browser` | Captura parcial, correcciones, semana 0, 390/768/1440 px en claro y oscuro, comparaciones y Excel |
| Arranque de la demo | `TMPDIR=/tmp npm --prefix backend test -- --reports-demo` | Salud OK, inicio de la fixture de Fase 10 y cierre del clúster temporal |
| Informes en Brave | `TMPDIR=/tmp npm --prefix backend test -- --reports-browser` | Regresión aprobada, incluidas ambas descargas |
| Evaluaciones anteriores en Brave | `EVALUATIONS_BROWSER_ONLY=1 npm --prefix backend test -- --browser-only` | Flujo aprobado y esquema Prisma sin diferencias |
| Migraciones y respaldo | `node backend/tests/run-catalog-migrations.cjs` | 20 migraciones en base vacía y actualización desde etapas previas. Se comprobaron los índices parciales y la restauración de la nueva caracterización junto con el reporte original |

Para las pruebas en navegador, configura `BROWSER_BIN=/usr/bin/brave`, `CHROME_BIN=/usr/bin/brave` y `PLAYWRIGHT_CORE_PATH` con la ubicación de Playwright Core 1.65.1. Consulta la [guía de instalación](../../entrega-academica/INSTALACION.md).

Las pruebas de API comprobaron borradores, revisión, dolor y asimetría en FMS, puntuaciones y promedio en LESS, rechazo de incompatibilidades, control de acceso y persistencia. También comprobaron el cambio de peso del perfil después de registrar semana 0 y la exclusión de notas privadas de los informes. La comprobación de migraciones cotejó el conjunto de nombres aplicados con el directorio versionado, en lugar del conteo fijo anterior.
