# Evaluación de entrega de LuchaSegura

La rama `feature/cierre-integral-calidad` parte de `develop` en `1ba2a81`. La recomendación es evaluar la rama en un entorno segregado con datos sintéticos. La publicación institucional requiere cerrar las decisiones de privacidad, clínica y operación de esta matriz.

## Matriz de aceptación

| Área | Estado | Evidencia y condición |
| --- | --- | --- |
| Frontend y backend | Listo y verificado en aislamiento | Typechecks, builds, 27 casos Angular, 49 casos backend; Node.js 22.23.5. |
| Fechas, perfil y antecedentes | Listo y verificado en aislamiento | Fecha civil nullable, instante histórico conservado, transición Bogotá–UTC y regresión de edición en los cuatro perfiles. |
| PostgreSQL, migraciones y catálogo | Listo y verificado en el entorno sintético | Instalación limpia, actualización desde siete migraciones, repetición y recuperación. La base habitual conserva siete migraciones aplicadas y cinco pendientes en esta rama. |
| Roles, autenticación, alertas y seguimientos | Listo y verificado en aislamiento | Pruebas de alcance por propietario, asignación y rol. Revisión, historial, reapertura, revocación y errores controlados. |
| Programa preventivo y ejercicios | Implementado, pendiente de validación clínica | 24 sesiones de demostración, 40 SVG estáticos, asignaciones y relaciones históricas verificadas. Fisioterapia debe aprobar programa, umbrales, dosis y correspondencia de ilustraciones. |
| Evaluaciones | Implementado como consulta | La captura, protocolos, puntuaciones e interpretación requieren aprobación académica. |
| Excel | Listo en el alcance verificado | Descarga real y lectura de XLSX en pruebas. Seudonimizado por defecto y texto literal. Microsoft Excel de escritorio pendiente. |
| Recuperación por correo | Implementado, pendiente de validación externa | Brave y SMTP TLS sintético verificaron caducidad, uso único y revocación. Pendientes SMTP real y origen HTTPS de entrega. |
| Privacidad y menores | Bloqueado para registro público real | Aviso versionado por el servidor, evidencia reproducible y restricción de cambios que involucran a menores. El borrador bloquea el registro público en producción. La institución debe aprobar el aviso y definir responsables, canales, finalidades, retención y procedimiento para menores. |
| Accesibilidad y diseño | Implementado, validación ampliada pendiente | Contraste de controles, teclado, foco, movimiento reducido, siete anchos, dos temas y 200 % de texto en Excel. Firefox verificó la página legal; quedan lectores de pantalla, equipos físicos y auditoría formal WCAG. |
| Seguridad y dependencias | Listo en las comprobaciones locales | Prisma 6.19.3 con correcciones transitivas y auditoría de producción sin hallazgos npm en ambos proyectos. Las herramientas de desarrollo del frontend mantienen 16 avisos moderados. Quedan la revisión del artefacto publicado, la CSP del frontend, proxy y controles de logs de infraestructura. |
| CI y operación | Implementado, validación externa pendiente | Pipeline actualizado con PostgreSQL y SMTP locales, navegador, auditoría y verificación de archivos sensibles. Comandos probados localmente. La ejecución del workflow en GitHub se comprobará al publicar una rama autorizada. |
| Respaldo y despliegue | Restauración sintética verificada; despliegue pendiente | No se tomó un respaldo habitual ni se desplegó. Validar secretos, HTTPS, restauración controlada, monitoreo y responsables institucionales. |
| Documentación | Actualizada en los archivos afectados | Manual operativo, inventario de API, modelo y limitaciones actualizados. PDFs y material académico conservados. |

## Rendimiento y límites de la evidencia

La compilación de referencia tenía 485,88 kB iniciales y 126,93 kB estimados de transferencia. La compilación de estabilización medida quedó en 487,03 kB y 127,19 kB. Se conservó la carga diferida de las rutas. La prueba Excel cubre paginación y rechazo del límite; la capacidad con volumen institucional y varias instancias sigue pendiente. El build de producción sigue consultando Manrope y emite el aviso conocido de SweetAlert2 como CommonJS.

## Propuesta de integración

La revisión, integración, publicación y migración habitual requieren autorizaciones separadas. Cotejar primero el remoto y revisar los archivos concurrentes. Si `develop` avanzó, resolver las diferencias y repetir las pruebas en una rama de integración antes de continuar.

```sh
git fetch origin develop
git status --short --branch
git log --left-right --oneline origin/develop...feature/cierre-integral-calidad
git diff --check origin/develop...feature/cierre-integral-calidad
git diff --name-status origin/develop...feature/cierre-integral-calidad
git merge-tree --write-tree origin/develop feature/cierre-integral-calidad
```

Solo tras la autorización de integración y con el árbol limpio:

```sh
git switch develop
git merge --ff-only origin/develop
git merge --no-ff feature/cierre-integral-calidad
```

La ventana de base de datos y recuperación se describe en [Decisiones y riesgos](DECISIONES_Y_RIESGOS.md). El siguiente paso es revisar la rama y aprobar una prueba de entrega segregada con los responsables técnicos e institucionales. Los registros de pruebas y capturas están en [continuidad](README.md).
