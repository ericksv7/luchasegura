# Informe de pruebas · Fase 9

## Entorno y aislamiento

Ejecución del 23 de noviembre de 2026 en Linux, con Node.js 26.13.1, npm 12.2.2, PostgreSQL 18.7, Brave 157.1.99.57, Playwright Core 1.65.1 y Prisma 6.19.3. Node 22.23.5 es la versión configurada en CI. En esta ejecución se utilizó la versión instalada de Node.

Se extrajo la rama de base mediante `git archive` a un árbol separado y se copiaron los tres archivos de fixture de Fase 9. Se instalaron 320 dependencias de backend y 545 de frontend mediante `npm ci` sobre ese árbol. El primer intento agotó el espacio de `/tmp`. Se rehicieron ambos `npm ci` en una carpeta de trabajo ignorada por Git y en un volumen con espacio suficiente. PostgreSQL y Brave requirieron una ruta corta para sus sockets. La primera corrida de informes, con un directorio dentro de `/tmp`, activó el bloqueo previsto del agregado. Ambos ejecutores de informes se repitieron con `TMPDIR=/tmp` y aprobaron.

La instalación independiente verificó con SQL el nombre, puerto y directorio de la base nueva antes de aplicar las migraciones. Las pruebas crearon otros clústeres temporales. La base habitual quedó fuera de las conexiones y de las operaciones de la fase.

## Resultados

| Verificación | Comando o evidencia | Resultado |
|---|---|---|
| Dependencias | `npm ci --prefix backend`, `npm ci --prefix frontend` | Ambos terminados en la copia limpia |
| Cliente Prisma y compilación backend | `db:generate`, `typecheck`, `build` | Cliente 6.19.3 generado y ambos pasos correctos |
| Tipos Angular | `tsc --noEmit -p tsconfig.app.json`, `tsc --noEmit -p tsconfig.spec.json` | Ambos correctos |
| Build Angular | `npm --prefix frontend run build` | Correcto. Advertencia CommonJS de SweetAlert2 |
| Angular | `npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` con Brave | 53 de 53 |
| API y recuperación | `npm --prefix backend test -- --availability --mail-browser` | 63 de 63. Incluye 30 de flujos y permisos, 6 Excel de equipo, 18 de seguridad y bienestar, 3 de encuestas y 6 de SMTP TLS. Verificado 503 sanitizado ante PostgreSQL inaccesible |
| Regresión general en Brave | Suite `alert-review-browser.ts` de `--browser-only` | Comprobaciones de los cuatro roles, formularios, ficha, permisos, evaluaciones, alertas, teclado, movimiento y descarga Excel completadas |
| Desplegables en Brave | `DISCLOSURE_VISUAL=1 npm --prefix backend test -- --browser-only` | Comprobaciones de animación, teclado, toque, contraste, zoom, ambos temas, borradores, registro y Excel completadas |
| Bienestar y sueño en Brave | `npm --prefix backend test -- --wellbeing-browser` | Correcto. Persistencia, acceso, revocación, errores de red, contraste y geometría |
| Encuestas en Brave | `npm --prefix backend test -- --surveys-browser` | Correcto. Borrador, conflicto, envío, ficha profesional, cambio de deportista, recarga, revocación y ambos temas |
| Informes y Excel | `TMPDIR=/tmp npm --prefix backend test -- --reports-only` | 7 de 7. Verificados cálculos, alcance, revocación, celdas y equivalencia con las vistas |
| Informes en Brave | `TMPDIR=/tmp npm --prefix backend test -- --reports-browser` | Navegación, teclado, geometría en ambos temas, descarga individual y grupal, revocación, reintento y estado vacío. El sidebar conserva su nodo al navegar al informe |
| Migraciones desde vacío | `db:deploy` y `prisma migrate status` | 17 aplicadas. Estado actualizado |
| Migraciones con legado y restauración | `node backend/tests/run-catalog-migrations.cjs` | Correcto. Actualización con datos anteriores, despliegue y carga repetidos, 40 SVG y restauración sintética de módulos versionados |
| Arranque separado | API :3000, Angular :4200, PostgreSQL :55439 | Salud OK en API y a través del proxy. Inicio de sesión en Brave y cierre de los puertos de la ejecución |
| Demostración | Modalidad de informes con Angular compilado y PostgreSQL temporal | Inicio de sesión, 24 sesiones con ejercicios, persistencia de cumplimiento y bienestar, alerta nueva, informe grupal con descarga Excel y cierre del sitio y retiro del clúster |
| Auditoría total backend | `npm audit --json` | 0 alertas |
| Auditoría total frontend | `npm audit --json` | 16 moderadas de herramientas de desarrollo, propagadas desde alertas de `glob` y `minimatch`. 0 altas y 0 críticas |
| Auditoría de producción | `npm audit --omit=dev --json` en ambas carpetas | 0 alertas en ambos resultados |
| Secretos versionados | `git ls-files` y `git grep -l` por nombres de artefactos y patrones de claves privadas y tokens | Sin coincidencias en los patrones revisados. Inspección limitada al árbol versionado |

La ejecución de navegador integrada se interrumpió después de las comprobaciones generales. Se detuvo su clúster por el directorio exacto y se retomaron por separado las suites de Bienestar y Encuestas.

Los avisos de instalación de npm 12 para scripts de dependencias opcionales del frontend y el aviso de configuración antigua de Prisma fueron compatibles con los builds y las pruebas de este entorno. Para reproducir, consulta [Instalación](INSTALACION.md).

## Brave a cinco anchos y en ambos temas

A 320, 390, 768, 1024 y 1440 px se abrió cada vista y se verificó que el ancho del documento cupiera en la ventana. Se comprobó login, registro, inicio del deportista, bienestar, evaluaciones, encuestas, informe propio, ficha de fisioterapia e informe individual profesional.

Se inspeccionaron la [ficha de fisioterapia a 1440 px en claro](evidencias/ficha-1440-light.png) y el [informe individual a 390 px en oscuro](evidencias/informe-individual-390-dark.png). Las capturas contienen datos ficticios. Esta revisión se ejecutó en Brave sin interfaz y con emulación de tamaños. Quedan fuera las diferencias de dispositivos físicos y el uso prolongado con tecnologías de asistencia.
