# Fase 5 · Seguridad, calidad y pruebas

## Correcciones prioritarias

- El formulario Excel usa una cuadrícula con filas compartidas para las etiquetas, los selectores y sus ayudas. Separa alcance y filtros de periodo, bloquea el doble envío y muestra completas las selecciones extensas bajo el control nativo. Mantiene la advertencia de seudonimización y los contratos de exportación.
- El detalle de alerta distribuye reporte, editor e historial en paneles independientes. El acordeón nativo conserva los valores y el foco. Al expandirlo se desplaza el contenido que sigue en el flujo, mientras el reporte y los campos anteriores conservan su posición. En móvil los paneles se apilan.
- Brave comprobó ambos formularios a **320, 390, 768, 1024 y 1440 px**, en claro y oscuro. Se verificaron dimensiones, alineación, ausencia de desbordamiento, teclado, contenido extenso y descarga real. El recorrido general volvió a comprobar botones expansivos por hover, foco y tacto, y el tema con movimiento reducido.

| Pantalla | Escritorio | Móvil |
| --- | --- | --- |
| Exportación | [1440 px, claro](capturas-fase-5/excel-1440-light.png) | [390 px, oscuro](capturas-fase-5/excel-390-dark.png) |
| Seguimiento | [1440 px, oscuro](capturas-fase-5/seguimiento-1440-dark.png) | [390 px, claro](capturas-fase-5/seguimiento-390-light.png) |

Las capturas y las escrituras de pruebas usaron datos sintéticos en un clúster temporal.

## Hallazgos

| Prioridad | Hallazgo | Resultado |
| --- | --- | --- |
| P0 | Pérdida de datos o exposición grave | No se confirmó un hallazgo P0 en los recorridos probados. |
| P1 | Un cambio de contraseña podía conservar un JWT anterior emitido en el mismo segundo | El JWT incorpora una versión precisa de contraseña. Cambios simultáneos rechazan el estado obsoleto. Una respuesta tardía de una descarga tampoco puede cerrar una sesión posterior. |
| P1 | Dos restablecimientos podían intentar consumir el mismo enlace. La solicitud anunciaba un correo sin canal de entrega y el modo de desarrollo registraba enlaces | Consumo atómico y de un solo uso, revocación de enlaces y respuesta uniforme 503 mientras el canal siga pendiente. Se retiró el registro de enlaces. |
| P1 | Nueva contraseña truncada por bcrypt y fechas imposibles de registro | Límite explícito de 72 bytes UTF-8 y validación de fechas de calendario. |
| P1 | Un cambio de fecha de inicio podía competir con el primer registro de sesión | Revalidación dentro de una transacción serializable y reintento acotado. Se conserva la idempotencia de la confirmación. |
| P1 | Confianza implícita en el proxy, validación de origen y respuestas técnicas en fallos de infraestructura | Proxy explícito, origen exacto, API sin caché y errores públicos genéricos. La BD no disponible produce 503. |
| P1 | Dependencias auditadas | Actualización dirigida de Zod y UUID transitivo de ExcelJS. La auditoría de frontend no devolvió avisos. Backend conserva tres entradas altas de la misma cadena Prisma CLI, `@prisma/config`, `deepmerge-ts` (GHSA-ggr8-5vv4-36mx). El remedio sugerido cambia la versión mayor de Prisma. Pendiente de evaluar antes de uso institucional. |
| P2 | Desalineación de Excel y desplazamiento de campos en seguimiento | Corregidos y comprobados en Brave. |

## Roles y flujos

| Rol | Comprobación |
| --- | --- |
| Administración | Alta, edición y acceso de cuentas, desactivación y bloqueo con credenciales anteriores, asignaciones y primer administrador con cambio obligatorio. |
| Deportista | Perfil, antecedentes, reintento de molestia, programa y sesiones, asignaciones propias y bloqueo de registros ajenos. |
| Fisioterapia | Agenda y ficha, atención de alertas, historial, biblioteca, asignaciones, programa, consulta de evaluaciones y Excel. |
| Entrenamiento | Menú, deportistas asignados, ficha y programa autorizados. API deniega el alcance ajeno y el acceso a notas, evaluaciones y Excel clínico. |

| Flujo | Evidencia |
| --- | --- |
| A · Alta y acceso | Creación y edición desde formulario, acceso del usuario y menú correspondiente. Navegador y API. |
| B · Molestia y alerta | Envío desde formulario, reintento y alerta consultable por fisioterapia. Navegador, API y PostgreSQL. |
| C · Atención | Revisión, seguimiento, finalización, reapertura e historial persistente. Navegador, API y PostgreSQL. |
| D · Ejercicios | Dosificación, consulta en el plan y retiro, con preservación de la asignación histórica en la biblioteca. API y navegador. |
| E · Sesiones | Confirmación, idempotencia, avance y protección frente a cambios concurrentes de inicio. API y PostgreSQL. |
| F · Excel | Descarga real, bytes cotejados con la respuesta, apertura y validación automatizada. API, navegador y PostgreSQL. |

## Excel, resiliencia y privacidad

Se conserva el consolidado de ocho hojas y las descargas específicas. La regresión abre los libros para comprobar hojas, filas, tipos, fechas inclusivas, porcentajes, texto literal, estado actual y filtro por deportista. Cubre ámbito ajeno, roles sin permiso y el rechazo explícito ante más de 5.000 registros procesados. Brave verificó el estado de generación, la descarga filtrada a 390 px y el mensaje al fallar la red. La variante seudonimizada sigue requiriendo acceso restringido.

Se probaron sesiones expiradas, cierre de sesión, contraseñas temporales, respuestas tardías, 401, 403, 404, 409, 429, 500, solicitudes inválidas y fallos de consulta. La comprobación de disponibilidad inicia el servidor de producción apuntando a un puerto aislado sin PostgreSQL. No se modificó la base habitual ni se aplicaron migraciones allí. No se realizó una prueba de carga representativa de producción ni una auditoría externa.

## Resultados de pruebas

| Comprobación | Resultado |
| --- | --- |
| TypeScript y compilación de producción | Frontend, especificaciones Angular y backend correctos. |
| Angular en Brave | 21 de 21. Incluye la protección contra respuestas binarias tardías y la regresión del formulario de revisión. |
| Integración con PostgreSQL aislado | 35 de 35. Son 22 pruebas funcionales, 5 de reportes y 8 de seguridad e integridad. |
| Inicio de producción y disponibilidad | Conexión normal verificada. Con PostgreSQL inaccesible, salud e inicio de sesión dieron 503. |
| Prisma | Esquema válido. Migraciones aplicadas en el clúster aislado en dos pasos con un registro previo. Estado y comparación del esquema correctos. |
| Brave y API real | Recorrido completo de los cuatro roles, con 144 combinaciones generales de pantalla, ancho y tema, además de verificaciones específicas de alertas y fichas. |

El backend se comprueba con `npm run build` y `npm test -- --availability`. Para el navegador, ejecutar `npm test -- --browser-only` con `PLAYWRIGHT_CORE_PATH` apuntando a una instalación de Playwright Core y `BROWSER_BIN` al ejecutable de Brave si es necesario. Añadir `PHASE5_VISUAL=1` y definir `UX_CAPTURE_DIR` para repetir la comprobación visual dirigida y guardar sus capturas. Las pruebas Angular se ejecutaron con `npm test -- --watch=false --browsers=ChromeHeadless` y `CHROME_BIN` configurado para Brave.

## Requisitos de entrega

La modalidad demostrativa emplea datos sintéticos. Para uso institucional quedan pendientes la autorización y política de tratamiento de información de salud y menores, retención y accesos auditables, recuperación de cuenta por un canal verificado y revisión de Prisma. También se debe validar la topología HTTPS, CORS y proxy reales, almacenamiento y rotación de secretos, protección del límite de peticiones en una eventual instalación con varias instancias, y restauración de respaldos. El cierre de sesión limpia la sesión del navegador. Un JWT copiado sigue sujeto a expiración, versión de contraseña y estado de cuenta.

La instalación limpia desde ambos archivos de bloqueo se probó con `npm ci --ignore-scripts` y generación explícita de Prisma. Entorno verificado con Node.js 26.13.1, npm 12.2.2 y PostgreSQL 18.7. En un entorno autorizado, aplicar migraciones revisadas con `npm run db:deploy` y crear el primer administrador con `npm run db:create-admin -- correo@dominio.com "Nombre Apellido"`. Entregar su acceso temporal por un canal seguro y exigir el cambio en el primer ingreso. Validar el manejo de credenciales y la puesta en marcha antes de cualquier publicación.

## Propuesta de commit

La rama es `develop`. Las fases 3 y 4 ya tenían cambios sin confirmar al comenzar. Comparten archivos con esta fase, entre ellos la vista de alertas, la ruta del programa, las pruebas de navegador, el panel Excel y la hoja de estilos. Se propone un commit integrado con la lista explícita de abajo. Para separar fases, recuperar primero una referencia verificable de las fases previas en una copia de trabajo y revisar los fragmentos mezclados con `git add -p`; el panel Excel nuevo requiere reconstruir su estado previo antes de dividirlo.

| Cambios de Fase 5 | Archivos |
| --- | --- |
| Interfaz y pruebas de los formularios | `team-report-panel.ts`, `alert-review.page.ts`, `alert-review.page.spec.ts`, `styles.scss`, `alert-review-browser.ts` |
| Sesión y recuperación en Angular | `auth.interceptor.ts`, `auth.interceptor.spec.ts`, `auth.service.ts`, `field.ts`, `forgot.page.ts` |
| API e inicialización | `app.ts`, `config.ts`, `middleware/api-error.ts`, `middleware/auth.ts`, `routes/auth.ts`, `routes/program.ts`, `prisma/create-admin.ts`, `.env.example` |
| Dependencias y verificación | `backend/package.json`, `backend/package-lock.json`, `security.test.ts`, `run-alert-reviews.cjs` |
| Evidencias y entrega | Los dos documentos de Fase 5 y cuatro capturas de `capturas-fase-5` |

La lista excluye archivos de entorno locales, dependencias instaladas, productos de compilación, logs, respaldos y artefactos temporales. Se revisaron los patrones de claves privadas y tokens versionados y la presencia de archivos de entorno y respaldos. Las capturas y libros enumerados son evidencias sintéticas documentadas. Los archivos `.env.example` contienen parámetros de ejemplo. Ejecutar los siguientes comandos únicamente después de aprobar el alcance.

```sh
git add -- \
  backend/.env.example \
  backend/package-lock.json \
  backend/package.json \
  backend/prisma/create-admin.ts \
  backend/src/app.ts \
  backend/src/config.ts \
  backend/src/middleware/api-error.ts \
  backend/src/middleware/auth.ts \
  backend/src/routes/alert-reviews.ts \
  backend/src/routes/auth.ts \
  backend/src/routes/program.ts \
  backend/src/routes/team-export.ts \
  backend/src/routes/team.ts \
  backend/src/services/alert-status.ts \
  backend/src/services/program.ts \
  backend/src/services/team-report.ts \
  backend/tests/alert-review-browser.ts \
  backend/tests/run-alert-reviews.cjs \
  backend/tests/security.test.ts \
  backend/tests/team-export.test.ts \
  docs/avance/ESTADO_GENERAL_LUCHASEGURA.md \
  docs/avance/FASE_3_UX_UI.md \
  docs/avance/FASE_4_DATOS_Y_EXPORTACIONES.md \
  docs/avance/FASE_5_SEGURIDAD_Y_PRUEBAS.md \
  docs/avance/capturas-fase-3/administrador-asignaciones-390-claro.png \
  docs/avance/capturas-fase-3/administrador-usuarios-768-oscuro.png \
  docs/avance/capturas-fase-3/deportista-plan-390-oscuro.png \
  docs/avance/capturas-fase-3/deportista-reportar-390-claro.png \
  docs/avance/capturas-fase-3/entrenador-programa-768-claro.png \
  docs/avance/capturas-fase-3/fisioterapia-ejercicio-390-tactil.png \
  docs/avance/capturas-fase-3/fisioterapia-eliminar-hover-320-claro.png \
  docs/avance/capturas-fase-3/fisioterapia-evaluaciones-1440-oscuro.png \
  docs/avance/capturas-fase-3/fisioterapia-seguimientos-768-claro.png \
  docs/avance/capturas-fase-5/excel-1440-light.png \
  docs/avance/capturas-fase-5/excel-390-dark.png \
  docs/avance/capturas-fase-5/seguimiento-1440-dark.png \
  docs/avance/capturas-fase-5/seguimiento-390-light.png \
  docs/avance/evidencias-fase-4/consolidado-identificable-sintetico.xlsx \
  docs/avance/evidencias-fase-4/consolidado-seudonimizado-sintetico.xlsx \
  frontend/src/app/admin/assignments.page.ts \
  frontend/src/app/admin/users.page.ts \
  frontend/src/app/athlete/home.page.ts \
  frontend/src/app/athlete/plan.page.ts \
  frontend/src/app/athlete/profile.page.ts \
  frontend/src/app/athlete/progress.page.ts \
  frontend/src/app/athlete/report.page.ts \
  frontend/src/app/core/active-btn.ts \
  frontend/src/app/core/auth.interceptor.spec.ts \
  frontend/src/app/core/auth.interceptor.ts \
  frontend/src/app/core/auth.service.ts \
  frontend/src/app/core/del-btn.ts \
  frontend/src/app/core/edit-btn.ts \
  frontend/src/app/core/field.ts \
  frontend/src/app/pages/forgot.page.ts \
  frontend/src/app/team/alert-review.page.spec.ts \
  frontend/src/app/team/alert-review.page.ts \
  frontend/src/app/team/alerts.page.ts \
  frontend/src/app/team/athlete-detail.page.ts \
  frontend/src/app/team/athlete-evaluations.ts \
  frontend/src/app/team/athlete-exercises.ts \
  frontend/src/app/team/athlete-program.ts \
  frontend/src/app/team/athlete-row.ts \
  frontend/src/app/team/athletes.page.ts \
  frontend/src/app/team/exercises.page.ts \
  frontend/src/app/team/overview.page.ts \
  frontend/src/app/team/review-history.ts \
  frontend/src/app/team/rules.page.ts \
  frontend/src/app/team/team-report-panel.spec.ts \
  frontend/src/app/team/team-report-panel.ts \
  frontend/src/styles.scss
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git commit -m "feat: consolidate LuchaSegura delivery candidate"
```
