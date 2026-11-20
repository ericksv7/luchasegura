# Fase 5 · Evaluaciones funcionales

## Inventario inicial

Base de trabajo `97dc42a` de `develop`. Prisma ya tenía `FunctionalTest`, relacionado con `Athlete`, con fase inicial o final, tipo libre, resultado JSON y fecha de medición. Express ya ofrecía consulta exclusiva de fisioterapia en `GET /api/team/athletes/:id/evaluations`. La pestaña Evaluaciones de la ficha organizaba ese resultado por fase. Las pruebas de API y navegador verificaban esa lectura y que el entrenador y el administrador quedaran fuera.

El programa vigente e inicio civil de intervención ya existían por separado. Faltaban escritura, asociación con la intervención, autoría de la medición, historial de cambios y una consulta del deportista con campos autorizados. Las matrices de cierre integral y entrega describen los cortes anteriores a esta implementación. [Fundamentos académicos](../../entrega/17_FUNDAMENTOS_ACADEMICOS.md) · [Modelo de datos](../../entrega/05_MODELO_DE_DATOS.md) · [Matriz histórica](../cierre-integral/MATRIZ_HALLAZGOS.md)

## Implementación técnica

| Área | Decisión |
| --- | --- |
| Registro | Fisioterapia registra fase inicial o final. El profesional se obtiene de la sesión y la ficha usa el alcance vigente de fisioterapia, que permite consultar a los deportistas atendidos por ese rol en la aplicación. |
| Intervención | Cada registro nuevo guarda el programa vigente y una copia de la fecha civil de inicio. La API coteja ambos contra lo consultado por el formulario. Una corrección posterior del inicio conserva la asociación histórica. |
| Fecha | Se guarda una fecha `DATE` sin hora. Se valida calendario y que el día no sea futuro en Bogotá. La fase se registra explícitamente. La ventana clínica respecto al inicio y al cierre queda por aprobar. |
| Correcciones | Fecha, mediciones y nota pueden corregirse. Instrumento, fase, deportista y asociación quedan fijados al crear. Cada corrección guarda una versión con autor, nombre registrado, fecha y valores. Un reintento idéntico devuelve la versión original y dos guardados distintos con la misma versión no se pisan. |
| Acceso | Fisioterapia consulta registros históricos y nuevos, notas privadas e historial. El deportista abre **Mis evaluaciones funcionales** en su perfil y recibe solo sus mediciones originales vigentes de registros nuevos. Entrenador y administrador quedan fuera de las rutas clínicas. La baja de un profesional con evaluaciones conserva su autoría mediante desactivación. |
| Legado | Los registros existentes conservan resultado, hora y fase. Se muestran como consulta en fisioterapia. Su JSON libre requiere una revisión de contenido antes de compartir datos históricos con el deportista. |
| Migración | `20261122120000_functional_evaluation_revisions` agrega la asociación y versión al modelo existente, con versión 0 para el legado. Crea `FunctionalTestRevision` con un identificador de operación único y unicidad por evaluación y versión. Las escrituras de aplicación son transaccionales. |

Los límites de 24 intentos por registro, 40 caracteres para dirección y 1000 para observaciones acotan la entrada técnica. Las notas van en el campo reservado. El campo de dirección se muestra al deportista junto a las mediciones y debe contener solo la denominación de la dirección registrada.

El formulario SEBT usa texto libre para la dirección. Puede registrar alcances de distintas variantes, sin exigir un conjunto ni comprobar que se haya completado. El SEBT original comprende ocho direcciones. Una variante modificada usa tres. La opción de captura actual no certifica la aplicación de ninguna variante. [SEBT de ocho direcciones](https://doi.org/10.2519/JOSPT.2006.36.3.131) · [Estudio de la variante de tres direcciones](https://pmc.ncbi.nlm.nih.gov/articles/PMC6571006/)

## Validación funcional y clínica

| Instrumento | Captura técnica | Pendiente de aprobación |
| --- | --- | --- |
| SEBT y YBT-LQ | Son opciones distintas. Alcance crudo en centímetros por intento, lado de apoyo y dirección según lo anotado por el profesional. Valor finito no negativo. | Variante y equipo autorizados, conjunto y nombres de direcciones, cantidad y validez de intentos, longitud de miembro, normalización, asimetría y comparación. |
| Agility T-test | Tiempo crudo en segundos por intento. Valor finito mayor que cero. | Montaje, cronometraje, variante, intentos válidos, selección de resultado y comparación. |
| FMS | Consulta profesional de registros anteriores si existen. | Patrones y variantes autorizados, observaciones, tratamiento de dolor y reglas de puntuación. Falta la ficha aprobada para habilitar captura nueva. |
| LESS | Consulta profesional de registros anteriores si existen. | Protocolo de aterrizaje y observación, criterios, ensayos y reglas de puntuación. Falta la ficha aprobada para habilitar captura nueva. |

La aplicación presenta mediciones originales y distingue las fases. La interpretación del cambio, las referencias, los umbrales y el uso con datos clínicos reales requieren aprobación institucional. La migración de cualquier entorno habitual debe valorarse y autorizarse por separado. Conservar las tablas y versiones al revertir una aplicación desplegada evita perder trazabilidad. Una restauración necesitaría su propio ensayo y autorización.

## Archivos y revisión

- Prisma y migración en `backend/prisma/`. Control de acceso, captura y consulta en `backend/src/routes/functional-evaluations.ts`, `team.ts`, `athletes.ts` y `admin.ts`.
- Ficha y formulario en `frontend/src/app/team/athlete-evaluations.{ts,html}`. La consulta propia usa el mismo componente, enlazado desde el perfil. El cliente HTTP está en `frontend/src/app/core/team-athlete-api.ts`.
- Cobertura de API, navegador y restauración en `backend/tests/alert-reviews.test.ts`, `alert-review-browser.ts` y `run-catalog-migrations.cjs`. Especificaciones Angular en `frontend/src/app/team/athlete-evaluations.spec.ts`.

Para revisar el flujo con cuentas sintéticas, entrar como fisioterapia y abrir **Equipo → Deportistas → ficha → Programa**. Registrar el inicio si falta y después abrir **Evaluaciones**. Guardar una evaluación inicial y una final, corregir una medida y abrir su historial. Con la cuenta del mismo deportista, ir a **Mi perfil → Mis evaluaciones funcionales** y comprobar sus valores vigentes. La prueba táctil automatizada usa controles de 16 px como mínimo y conserva el zoom manual. La comprobación física de iOS y Android de la fase estable no cubre este formulario nuevo.

Para ejecutar contra PostgreSQL temporal, usar Node 22.23.5, las dependencias instaladas y `initdb`, `pg_ctl`, `psql` y OpenSSL disponibles. Exportar `BROWSER_BIN` y `PLAYWRIGHT_CORE_PATH` como en el [registro de CI](../cierre-integral/REGISTRO_DE_PRUEBAS.md#pr-1--recuperación-de-contraseña-en-chromium).

```sh
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix frontend run build
npm --prefix backend run build
npm --prefix backend test -- --availability --mail-browser
EVALUATIONS_BROWSER_ONLY=1 npm --prefix backend test -- --browser-only
node backend/tests/run-catalog-migrations.cjs
```

## Resultados de verificación local

- Typechecks de aplicación y especificaciones Angular y typecheck de backend aprobados. Builds de producción aprobados con Node.js 22.23.5. El build Angular conserva el aviso existente de SweetAlert2 en CommonJS.
- Angular pasó 32 casos. Backend pasó 54 sin omisiones, incluidos 30 de flujos, 6 de Excel, 12 de seguridad y 6 SMTP. Los casos nuevos cubren la medianoche de Bogotá, fases, entradas inválidas, permisos, propiedad, versiones, concurrencia y reintentos.
- Chromium completó el flujo táctil focalizado a 320 y 414 px, con ambos temas, validación del formulario, registro, corrección, historial y consulta propia. Pasaron la regresión general de los cuatro roles y la regresión visual de móvil, foco, teclado, contraste, zoom, desplegables y Excel.
- PostgreSQL aislado aplicó las 14 migraciones. Prisma no detectó diferencias de esquema. La restauración sintética conservó el registro legado y ambas versiones de la evaluación nueva. El catálogo conservó sus 40 SVG.
