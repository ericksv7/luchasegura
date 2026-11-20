# Contraste inicial del plan maestro

Base auditada: `b6d4e87`. Los recorridos y conteos de la fase anterior siguen registrados como evidencia histórica. Esta matriz distingue lo encontrado en el código de las verificaciones repetidas y de los riesgos pendientes.

| ID / prioridad | Módulo | Requisito | Implementación y evidencia | Prueba y resultado inicial | Estado | Riesgo y acción pendiente |
| --- | --- | --- | --- | --- | --- | --- |
| A2-01 P1 | Antecedentes y nacimiento | Fecha civil opcional, límites de Bogotá y PATCH sin alterar fechas omitidas | Rutas injuries, athletes, auth; columna historyDate | Casos controlados en alert-reviews.test.ts y civil-date.spec.ts | PARCIAL | Repetir suite y ampliar zonas de navegador |
| A2-02 P2 | Agenda | El encabezado y el estado del seguimiento corresponden al día de Bogotá | overview.page.ts fija dos fechas al montar, una en la zona del navegador | Inspección identifica divergencia y estado obsoleto al cruzar medianoche | NO IMPLEMENTADO | Usar una referencia reactiva de Bogotá y probar la transición |
| B2-01 P1 | Prisma y catálogo | Probar instalación, actualización, integridad y restauración | 12 migraciones, script run-catalog-migrations.cjs | Resultado histórico disponible | PARCIAL | Repetir con clúster segregado y documentar las cinco migraciones |
| B2-02 P1 | Entorno habitual | Aplicar migraciones de forma autorizada y reversible | Procedimiento en DECISIONES_Y_RIESGOS.md | Última lectura documentada 7 de 12 | BLOQUEADO | Ventana y autorización independiente |
| C2-01 P1 | Seguridad | Autorizar por rol, propietario y asignación; revocar credenciales ante cambios de cuenta | middleware/auth.ts y rutas admin, team y auth | security.test.ts y alert-reviews.test.ts | PARCIAL | Repetir regresiones y cotejar límites de permisos |
| C2-02 P1 | Sesión | Expiración y fin de sesión | JWT con expiración, inactividad en navegador, cierre local mediante AuthService | Revisión estática | PARCIAL | Diferenciar cierre local y revocación individual en el servidor |
| C2-03 P1 | Dependencias y perímetro | Auditar artefactos, cabeceras y secretos | Helmet, no-store, CORS; CI audita ambas dependencias de ejecución | Verificación histórica y revisión de código | PARCIAL | Actualizar auditoría y verificar perímetro en el ensayo |
| D2-01 P1 | Consentimiento | Versión vigente en servidor y evidencia transaccional | Rutas auth y athletes, migration consent_evidence, página pública | security.test.ts y browser test | PARCIAL | Repetir prueba de versión, huella y menores |
| D2-02 P0 para datos reales | Privacidad | Consentimiento aprobado, responsables y procedimiento para menores | Bloqueo de registro de producción por aviso en borrador | Inspección de registrationNotice | BLOQUEADO | Aprobación institucional pendiente |
| E2-01 P1 | Cuatro perfiles | Recorridos positivos y negativos, estados, edición y restricciones | Guards de rutas Angular y permisos Express | alert-review-browser.ts y suites API | PARCIAL | Repetir recorrido completo sobre la versión consolidada |
| F2-01 P2 | Interfaz | Jerarquía, formularios, ambos temas y responsive | SCSS global y componentes; capturas históricas | REVISION_DE_INTERFAZ.md | PARCIAL | Repetir inspección de pantallas y estados secundarios |
| G2-01 P1 | Accesibilidad | Foco, teclado, contraste, zoom y movimiento reducido | Estilos globales y verificación DISCLOSURE_VISUAL | Registro histórico de Brave | PARCIAL | Repetir verificación y evaluar herramientas de asistencia |
| G2-02 P2 | Accesibilidad física | Lector de pantalla y equipo táctil real | Evidencia de emulación histórica | Cobertura física pendiente | BLOQUEADO | Requiere dispositivos o tecnología disponible |
| H2-01 P1 | Recuperación | Caducidad, uso único, revocación y secreto fuera de la URL visible | auth.ts, password-recovery.ts, reset.page.ts | mail-recovery.test.ts con SMTP local | PARCIAL | Repetir prueba API y Brave |
| H2-02 P1 | Correo externo | Entrega real y recuperación en origen HTTPS objetivo | Procedimiento documentado | Cobertura externa pendiente | BLOQUEADO | Requiere infraestructura y autorización |
| I2-01 P1 | Excel | Permisos, fechas y seudonimización predeterminada | team-report.ts, team-export.ts | team-export.test.ts comprueba XLSX, relaciones y límites | PARCIAL | Repetir lectura y descarga |
| I2-02 P2 | Excel de escritorio | Probar apertura e interpretación de fechas | Archivo XLSX compatible con lectura programática | Microsoft Excel pendiente | BLOQUEADO | Requiere instalación de escritorio |
| J2-01 P1 | Programa y catálogo | Sesiones, cumplimiento, historial, SVG y dosificación | Servicios program y exercise, scripts de catálogo | Integración API y recorrido Brave | PARCIAL | Repetir regresión integrada |
| J2-02 P1 | Fisioterapia | Aprobar evaluaciones, dosis, umbrales e ilustraciones | Evaluaciones disponibles para consulta | Validación técnica previa | BLOQUEADO | Aprobación académica y clínica |
| K2-01 P1 | Resiliencia | Responder a PostgreSQL caído y recuperar respaldos | checkProductionStart y ensayo de restauración | Pruebas disponibles en los scripts aislados | PARCIAL | Repetir 503, migraciones y restore |
| K2-02 P2 | Rendimiento | Medir tamaño de bundles y límites de exportación | Builds Angular y límites del reporte | Baseline histórico documentado | PARCIAL | Comparar builds y dejar explícito el volumen objetivo no ensayado |
| L2-01 P1 | CI | Instalar, compilar y probar con PostgreSQL y SMTP segregados | .github/workflows/ci.yml | Primera fase ejecutó comandos localmente | PARCIAL | Repetir pasos ejecutables y cotejar dependencias de CI |
| L2-02 P1 | GitHub Actions | Confirmar ejecución remota | Workflow configurado | Sin informe remoto de esta rama | BLOQUEADO | Requiere publicación autorizada |
| M2-01 P1 | Operación | Preparar configuración, recuperación y despliegue segregado | docs/entrega e inventario de riesgos | Restauración histórica sintética | PARCIAL | Validar procedimiento contra el código actual |
| M2-02 P1 | Entorno institucional | Verificar HTTPS, proxy, secretos y observabilidad | Configuración y precondiciones en continuidad | Sin entorno objetivo autorizado | BLOQUEADO | Coordinar ensayo institucional |
| N2-01 P2 | Documentación | Mantener acordes manuales, guías y evidencia | docs/entrega, docs/ux y referencias académicas | Inventario disponible | PARCIAL | Cotejar documentos afectados y actualizar continuidad |

## Resultados de la segunda fase

| ID | Resultado y evidencia | Estado |
| --- | --- | --- |
| A2-01 | La suite API repitió los casos de fecha opcional, reintento y transición de Bogotá. Queda pendiente el inventario en otros motores. | PARCIAL |
| A2-02 | El encabezado usa el día de Bogotá de la agenda y se actualiza al cruzar medianoche. «Hoy» y «Ayer» se calculan por día civil. Dos regresiones nuevas en `overview.page.spec.ts` y `civil-date.spec.ts`. | COMPLETADO |
| B2-01 | Pasaron instalación limpia, actualización histórica, repetición de deploy y seeds, restauración y verificación de 40 SVG en `run-catalog-migrations.cjs`. | COMPLETADO |
| B2-02 | La transacción de solo lectura confirmó siete migraciones con checksums coincidentes y cinco pendientes en `localhost:5432/luchasegura`. | BLOQUEADO para aplicar |
| C2-01 | Pasaron las suites de seguridad y permisos de API disponibles. Falta completar la cuadrícula endpoint × rol. | PARCIAL |
| C2-03 | Cero avisos npm de ejecución. Prisma 6.19.3, Effect 3.22.1 y deepmerge-ts 8.0.0 instalados. Quedan 16 avisos moderados de desarrollo y revisión perimetral. | PARCIAL |
| D2-01 | Pasaron casos sintéticos de consentimiento, conflicto de versión y edición de datos de menores. Queda el ensayo del procedimiento institucional. | PARCIAL |
| H2-01 | Seis pruebas pasaron, incluida la recuperación en Brave con el enlace recibido por SMTP TLS de loopback. | COMPLETADO en aislamiento |
| I2-01 | Seis pruebas de exportación pasaron. Brave descargó el XLSX filtrado, cotejó bytes y comprobó el error de red. | PARCIAL. Falta Excel de escritorio. |
| K2-01 | Se verificaron arranque de producción, 503 controlado y restauración sintética. | COMPLETADO en aislamiento |
| L2-01 | El arranque de producción agotó el plazo inicial con compilaciones concurrentes. Ahora tiene plazo de 30 s y solicitudes acotadas. Pasó con conexión y con PostgreSQL inaccesible. | PARCIAL. Falta GitHub Actions remoto. |
| L2-03 P2 | La prueba de agenda quedó esperando el estado vacío. El reemplazo de JSON reutilizaba cabeceras de la respuesta original, incluido su Content-Length. Ahora se confirma el dato real y se construye la respuesta de prueba con cabeceras coherentes para cada estado. | PARCIAL hasta repetir Brave. |

### Hallazgo visual pendiente

**F2-02 P2 · Avisos flotantes en móvil.** En la agenda a 320 px, dos avisos transitorios se superponen a las filas inferiores. El contenido permanece desplazable. Falta verificar si pueden ocultar por completo el control enfocado y ajustar la presentación sin interrumpir los anuncios accesibles. Estado **PARCIAL**. [WCAG 2.2, foco no oculto](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

La repetición de Brave cerró el fallo de instrumentación L2-03. E2-01 y F2-01 tienen evidencia actual de los cuatro perfiles y 144 combinaciones de ruta, ancho y tema. G2-01 conserva estado **PARCIAL** por la cobertura manual y asistencia pendiente. La comprobación de programa y biblioteca J2-01 pasó en los recorridos cubiertos. Los requisitos institucionales de J2-02 se mantienen **BLOQUEADOS**.

| ID | Prioridad | Hallazgo nuevo | Corrección | Prueba y estado |
| --- | --- | --- | --- | --- |
| C2-04 | P1 | La lectura de asignaciones de ejercicios comprobaba el entrenador en una consulta anterior. Un cambio concurrente podía dejar la lectura de filas sin el filtro del entrenador. | Aplicar el alcance en la consulta de asignaciones. Conservar la respuesta 404 fuera de alcance y 200 con lista vacía para el deportista autorizado. | `alert-reviews.test.ts` cubre retirada y restitución en la misma sesión y acceso de fisioterapia. Regresión consolidada iniciada. |
| D2-03 | P2 | La indicación libre de una asignación de ejercicio también es visible para el entrenador asignado. La etiqueta se dirige al deportista y omite esa visibilidad. | Confirmar alcance institucional y, si se conserva el acceso, indicarlo al fisioterapeuta junto al campo. | Inspección de `exercises.ts` y `athlete-exercises.ts`. PARCIAL. |

C2-04 quedó **COMPLETADO** en `5f6dce4`. Se repitió la verificación de API, SMTP, disponibilidad y Brave sobre la misma versión. El bloque C permanece **PARCIAL** por C2-02 y C2-03. En G se añadió evidencia de la página legal en Firefox a 360 px. El estado global de G sigue **PARCIAL**.

## Fase 3

| ID | Estado | Evidencia |
| --- | --- | --- |
| C2-02 | Revocación individual verificada en API y Angular | `bd4655d`. Dos JWT simultáneos distintos, 204 idempotente, rechazo del revocado en rutas protegidas y segunda sesión activa. Se repitió en un proceso backend nuevo. |
| C2-01 | Cobertura de guards ampliada | [Matriz por método y ruta](MATRIZ_PERMISOS.md). 36 rutas probadas sin sesión, con JWT revocado y con roles excluidos. La cobertura positiva y de pertenencia sigue siendo por escenarios. |
| B2-01 | 13 migraciones probadas en aislamiento | Instalación, actualización, repetición y restauración de datos sintéticos. |
| F2-02 / G2-01 | Avisos reorganizados para preservar el foco | Flujo normal en todos los anchos, pausa de caducidad al enfocar el botón y anuncios en dos regiones persistentes. Consultar el registro de pruebas para el resultado del navegador. |
| C2-03 | Avisos vigentes comprobados | npm informa cero avisos de ejecución y 16 moderados del árbol de desarrollo del frontend. Se mantiene la evaluación de actualizaciones mayores en una fase separada. |
