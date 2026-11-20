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

## Segunda fase de cierre

Esta revisión parte de `b6d4e87` y conserva la evidencia original. El balance detallado de cada área está en la [matriz A–N](MATRIZ_FASE_2.md) y en el [registro de pruebas](REGISTRO_DE_PRUEBAS.md).

| Nivel de entrega | Estado de esta revisión |
| --- | --- |
| Demostración local | Builds y suites Angular y API aprobados con datos sintéticos. |
| Evaluación técnica segregada | Instalación y actualización PostgreSQL, catálogo y restauración probados. SMTP de loopback y descarga Excel verificados. La revisión integral de permisos y accesibilidad sigue abierta. |
| Integración a `develop` | Pendiente. La regresión consolidada pasó. Sigue abierto el tratamiento del cierre local de sesión. |
| Ensayo de despliegue | La configuración y los procedimientos están documentados. Falta validarlos en el entorno de destino con HTTPS, proxy, monitoreo y SMTP acordados. |
| Uso institucional con datos reales | Bloqueado por consentimiento, procedimiento para menores, validación clínica y ventana autorizada de PostgreSQL. |

El PostgreSQL habitual confirmó siete migraciones aplicadas y cinco pendientes. Los requisitos de aprobación, el impacto del lote y el procedimiento permanecen en [decisiones y riesgos](DECISIONES_Y_RIESGOS.md).

La regresión consolidada terminó en verde tras corregir el alcance de entrenador. La evaluación técnica segregada es viable en los flujos verificados. La integración sigue pendiente por la revocación individual de sesión, la cobertura incompleta de permisos y accesibilidad y las validaciones externas documentadas. Los resultados de esta fase corresponden a una verificación interna con datos sintéticos.

## Fase 3 · revocación, permisos y foco

La revocación individual se verificó en PostgreSQL aislado y desde un proceso backend nuevo. El JWT revocado recibe 401 en rutas protegidas y otro JWT de esa cuenta conserva acceso. La revocación global por cambios de correo, rol, contraseña, recuperación y desactivación se mantuvo en las regresiones disponibles. Véase la [matriz de permisos](MATRIZ_PERMISOS.md).

Se verificaron typechecks, builds, 30 pruebas Angular, 52 de API y SMTP y el ensayo aislado de 13 migraciones con restauración. Los avisos quedan en el flujo del documento y se verificaron con texto al 200 %, ambos temas y seis anchos. La evaluación con lectores de pantalla y hardware táctil sigue pendiente.

La nueva migración debe ejecutarse antes de iniciar el backend de fase 3. El lote habitual esperado contiene seis pendientes, sujeto a cotejo y autorización previa. La base habitual permaneció fuera de las pruebas. La propuesta de integración sigue siendo local y requiere revisión autorizada. La preparación técnica con datos sintéticos no aprueba el despliegue institucional ni el uso de datos reales.

La rama es candidata a revisión para integración técnica con los datos sintéticos verificados. Brave completó los cuatro perfiles y 144 combinaciones de ruta, ancho y tema. La comprobación de guards cubre 36 rutas y la pertenencia se verifica en escenarios específicos. Las auditorías de accesibilidad y consistencia visual tienen el alcance descrito en el registro. La ejecución remota de CI y las aprobaciones de despliegue y datos reales siguen separadas.

## Fase 4 · experiencia móvil y límites de entrega

El mínimo de 16 px en entradas móviles se aplica en las reglas que controlan la tipografía de los formularios. El marco de acceso mantiene desplazamiento vertical y utiliza un tamaño mínimo de viewport estable. La ampliación manual sigue habilitada. La matriz de motores y dimensiones se conserva en el [registro](REGISTRO_DE_PRUEBAS.md).

**Validaciones externas pendientes, fuera del alcance de cierre técnico.** Microsoft Excel de escritorio, dominio con HTTPS, SMTP con proveedor real, consentimiento y procedimiento para menores, programa y dosificaciones clínicas, umbrales y protocolos de evaluación. Las comprobaciones e instrucciones históricas siguen disponibles. Los controles de protección vigentes siguen aplicándose.

La prueba física de iPhone y Android y la verificación con lector de pantalla tienen alcance propio. La publicación, los cambios en `develop` y cualquier operación futura de escritura en la base habitual requieren autorización.

El cierre móvil queda listo para revisión de integración técnica en el alcance verificado. Pasaron los cuatro perfiles, 216 combinaciones responsivas, 60 combinaciones móviles de acceso, 30 pruebas Angular y 52 pruebas backend y SMTP. La revisión visual y editorial se concentró en los flujos ejercitados y en el patrón de estilos modificado. No representa una inspección aislada de cada texto o estado en todos los motores.

## Propuesta de integración estable

Se recomienda publicar `feature/cierre-integral-calidad` y abrir una PR hacia `develop` para revisión técnica. Integrar cuando apruebe la revisión y GitHub Actions confirme el mismo HEAD. El usuario informó pruebas satisfactorias en iPhone 11 y Android. El [registro de pruebas](REGISTRO_DE_PRUEBAS.md#cierre-de-integración--20-de-noviembre-de-2026) delimita la confirmación física y recoge los resultados.

Pasaron typechecks y builds de frontend y backend, 30 pruebas Angular y 52 de backend y SMTP. Pasaron también el recorrido focalizado de accesibilidad y formularios móviles y el ensayo de catálogo, migraciones y restauración aislada. Se conserva la evidencia del recorrido general de navegador de fase 4 sobre el mismo código.

### Alcance de la rama

El cierre partió de un árbol limpio en `1bb9555`. La referencia local, la referencia de seguimiento y la consulta remota de `develop` coincidieron en `1ba2a81`. La rama aún no existía en `origin`. La base es ancestro directo, con cero commits exclusivos de destino y 19 commits candidatos antes del cierre documental. Sin divergencia en ese punto, la integración conserva todos los commits anteriores de `develop`.

```text
46df651 26c8f48 b242692 eca3570 524293d c99c96d 793f38d b6d4e87
9772e59 1de2cb9 5f6dce4 56b3157 bd4655d baed433 222245c 1183e69
578aff5 4d6dee8 1bb9555
```

El rango original contiene 34 archivos añadidos, 50 modificados y una eliminación. `frontend/src/app/core/consent.ts` se sustituyó por el consentimiento versionado servido por la API. El lote consolida fechas civiles y de Bogotá, recuperación y revocación de sesiones, evidencia de consentimiento, permisos de entrenador, exportación codificada, accesibilidad, formularios móviles y CI aislado. Los 40 SVG y el script de render estático preexistente no tienen diferencias frente a `develop`. No reapareció el generador experimental en los commits candidatos.

### Seguridad, datos y dependencias

- Se revisaron el árbol versionado y los blobs añadidos o modificados por los commits candidatos. Se comprobaron archivos de entorno, credenciales y cadenas de conexión, claves privadas, tokens, respaldos, archivos temporales y logs. Las coincidencias de conexión en los archivos versionados corresponden a ejemplos locales. El entorno real permanece ignorado. Las diez capturas nuevas muestran campos vacíos, interfaces o ejemplos sintéticos. Se revisaron los cambios de documentación y no se incorporaron PDFs ni planillas en el rango. No se detectaron secretos operativos ni datos personales o clínicos reales en esas evidencias. Git conserva los metadatos de autor habituales.
- La consulta habitual de solo lectura verificó 13 de 13 migraciones con hashes coincidentes. El rango agrega cuatro migraciones frente a `develop`: fecha histórica, revocación global, evidencia de consentimiento y revocación individual. Las cuatro ya están aplicadas en la base habitual. Para otro destino, cotejar primero historial y checksums, ensayar la actualización sobre una copia descartable, verificar el respaldo y, con autorización expresa, aplicar únicamente lo pendiente antes de recibir tráfico con el nuevo backend. El cierre no incluye operaciones sobre ese destino.
- `npm audit --omit=dev` devolvió cero avisos en los dos proyectos. La auditoría completa de backend también devolvió cero. En frontend quedan 16 avisos moderados de desarrollo, derivados de `glob` y `minimatch` en la cadena de Angular CLI. El remedio que propone npm actualiza Angular CLI de 20 a 22. Se difiere esa actualización para evaluarla con sus pruebas de compatibilidad.
- El riesgo directo de pérdida de datos por integrar Git es bajo. CI escribe en clústeres temporales y la PR no ejecuta despliegues. En un destino que requiera migraciones, considerar bloqueos y conservar el respaldo previo. El rollback de aplicación debe preservar la revocación de sesiones. Si la versión anterior ignora las revocaciones, se requiere invalidar los JWT afectados mediante un procedimiento autorizado antes de reabrir el acceso.
- Fuera del cierre técnico quedan el lector de pantalla, Microsoft Excel de escritorio, HTTPS y SMTP reales, la aprobación institucional del consentimiento y del flujo de menores y la validación clínica de ejercicios, dosificaciones y protocolos.

### GitHub Actions

`CI` se dispara con pushes a `main` o `develop` y con pull requests a cualquier base, incluida `develop`. Una PR candidata ejecutará `quality` con instalaciones desde lockfile, typechecks, builds, auditoría de ejecución, Angular, API, SMTP, las dos regresiones de navegador y el ensayo de catálogo y restauración. Se revisan nombres de archivos y patrones de clave antes de instalar dependencias. Utiliza el token implícito de solo lectura, un PostgreSQL temporal por ensayo y SMTP TLS en loopback. No requiere secretos configurados ni rutas hacia servicios de la aplicación en producción. El build Angular sí requiere acceso a las fuentes remotas. La ejecución y los registros se podrán consultar desde la PR antes del merge. La disponibilidad, aprobación y obligatoriedad de los checks remotos deben confirmarse en GitHub.

### Publicación y revisión autorizadas

Ejecutar desde el checkout con `gh` autenticado. Inspeccionar el rango y confirmar que la base remota siga en el punto revisado. Si avanzó, volver a comprobar el rango resultante y su CI antes de integrar.

```sh
git status --short --branch
git ls-remote --heads origin refs/heads/develop
git log --reverse --oneline develop..feature/cierre-integral-calidad
git diff --check develop...feature/cierre-integral-calidad
git push --set-upstream origin feature/cierre-integral-calidad
pr_body=$(mktemp /tmp/luchasegura-pr.XXXXXX)
awk '/^## Propuesta de integración estable$/{mostrar=1;next} /^### Publicación y revisión autorizadas$/{exit} mostrar' \
  docs/avance/cierre-integral/INFORME_FINAL.md > "$pr_body"
gh pr create --base develop --head feature/cierre-integral-calidad \
  --title "LuchaSegura: cierre integral de calidad" \
  --body-file "$pr_body"
```

La apertura de la PR dispara CI. Con el número de PR, revisa el resultado y los registros. En `gh run view` utiliza el identificador de la ejecución cuyo evento sea `pull_request` y cuyo `headSha` coincida con el de la PR.

```sh
gh pr view feature/cierre-integral-calidad --json number,baseRefName,headRefOid,reviewDecision,mergeStateStatus,statusCheckRollup
gh pr checks feature/cierre-integral-calidad --watch --fail-fast
gh run list --workflow ci.yml --event pull_request --branch feature/cierre-integral-calidad --json databaseId,headSha,conclusion,url
gh run view ID_DE_EJECUCION
# Si falla:
gh run view ID_DE_EJECUCION --log-failed
# Solo para reintentar un fallo de infraestructura:
gh run rerun ID_DE_EJECUCION --failed
```

Después de confirmar la aprobación, el estado verde de `quality` y las reglas de protección de `develop`, usar el SHA exacto revisado. La estrategia de merge commit conserva los commits candidatos y facilita una reversión conjunta. Si las reglas del repositorio exigen otra estrategia, confirmarla en la revisión.

```sh
gh pr merge feature/cierre-integral-calidad --merge --match-head-commit SHA_APROBADO
```

### Recuperación

Antes del merge, detener la integración ante un fallo, examinar el paso afectado y subir una corrección acotada como commit nuevo. Pedir nueva revisión cuando cambie el SHA. Tras el merge, si se necesita revertir el lote, abrir una PR de reversión desde una rama nueva basada en `origin/develop`. Con un merge commit, usar `git revert -m 1 SHA_DEL_MERGE` en esa rama y validar CI y los permisos antes de integrar la reversión. Mantener las columnas y tablas aditivas mientras se decide el retorno de aplicación. Cualquier cambio de base de datos, rotación de firma o restauración requiere autorización y una recuperación ensayada por separado.
