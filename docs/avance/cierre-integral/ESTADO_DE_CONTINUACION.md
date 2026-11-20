# Continuidad

La batería local final pasó en Node.js 22.23.5. La rama de estabilización está preparada para revisión técnica con datos sintéticos. Consulta el [informe y propuesta de integración](INFORME_FINAL.md) y la [matriz](MATRIZ_HALLAZGOS.md).

El siguiente paso autorizado es revisar los commits y acordar un ensayo institucional segregado. Publicar la rama, integrar a `develop`, probar SMTP real y ejecutar operaciones en la base habitual requieren autorizaciones independientes. Para datos reales siguen abiertas la aprobación del consentimiento, el procedimiento para menores, el programa y sus validaciones clínicas.

La base habitual `luchasegura:5432` conserva siete migraciones aplicadas según consulta de solo lectura. Están pendientes dos del catálogo y tres de la rama. El entorno sintético verificó las doce migraciones.

## Segunda fase · punto de recuperación

Consulta la [matriz A–N](MATRIZ_FASE_2.md), el [registro](REGISTRO_DE_PRUEBAS.md) y los [riesgos ampliados](DECISIONES_Y_RIESGOS.md). La base de esta segunda fase es `b6d4e87`. Se corrigieron los cambios de día de la agenda y de las etiquetas del equipo, con dos pruebas Angular. También se ajustaron las verificaciones de arranque y de los estados de agenda del recorrido Brave.

Para reanudar las verificaciones, compilar primero ambos proyectos y luego ejecutar desde `backend` con Node.js 22.23.5, los binarios locales de PostgreSQL en PATH y `BROWSER_BIN` y `PLAYWRIGHT_CORE_PATH` apuntando al navegador y paquete disponibles.

```sh
MAIL_BROWSER=1 npm test -- --availability --browser
DISCLOSURE_VISUAL=1 npm test -- --browser-only
node tests/run-catalog-migrations.cjs
```

La siguiente revisión de producto es la revocación de un JWT individual al cerrar sesión, con una prueba que conserve otra sesión legítima de la misma cuenta. Después, completar el inventario endpoint × rol y verificar el foco móvil frente a avisos transitorios.

Punto de recuperación de fechas: `9772e59` en `feature/cierre-integral-calidad`. Abarca `overview.page.ts`, `team-store.ts` y las dos especificaciones Angular.

Puntos de recuperación adicionales: `1de2cb9` para la instrumentación de Brave y el arranque aislado, y `5f6dce4` para el alcance del entrenador en la consulta de asignaciones. Los tres commits son locales. `develop` permanece en `1ba2a81`.

La regresión consolidada pasó con los cambios de producto hasta `5f6dce4`, 29 casos Angular y 49 backend. Pasaron también el recorrido completo de los cuatro perfiles en Brave y el ensayo de 12 migraciones. El siguiente bloque es C2-02, revocación individual al cerrar sesión, seguido de F2-02 y la cobertura insuficiente de G2-01. Si se añade una migración para sesiones, volver a ejecutar los tres comandos de la sección y actualizar el inventario habitual sin aplicarla allí.

## Fase 3 · sesión y permisos

- `bd4655d` implementa la revocación persistente del JWT actual con `POST /api/auth/logout` y amplía la cobertura de autorización.
- `baed433` organiza los avisos en el flujo del documento, separa anuncios urgentes y ordinarios y mantiene visible el botón enfocado. Incluye el caso de Brave con fallo de red.
- `222245c` comprueba persistencia en un proceso backend nuevo y revocación global al cambiar correo o rol.

La nueva migración requiere aplicarse antes de arrancar el backend actualizado. Solo se ejecutó en bases sintéticas. Tras añadirla, el lote habitual previsto contiene seis migraciones pendientes según el último inventario conocido. Consulta [decisiones y riesgos](DECISIONES_Y_RIESGOS.md).

La [matriz de permisos](MATRIZ_PERMISOS.md) detalla la cobertura automatizada. Para un cierre institucional quedan lectores de pantalla y dispositivos físicos, revisión clínica y consentimiento, GitHub Actions remoto, y validación de HTTPS, SMTP y la ventana de PostgreSQL.

La regresión general y el recorrido visual de Brave terminaron correctamente. El siguiente paso es revisión de los commits y de la matriz de permisos antes de autorizar una integración. Para el entorno candidato, aplicar la migración nueva antes de levantar el backend y verificar salud, logout de dos sesiones, respaldo y reversión. Conservar la ejecución remota de CI y las validaciones institucionales como pasos con autorización propia.
