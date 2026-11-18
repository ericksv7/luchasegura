# Fase 4 · Integridad de datos y exportaciones Excel

El panel **Resumen → Exportar reporte a Excel** usa el endpoint autenticado `GET /api/team/export` y la dependencia existente ExcelJS. El libro se genera a partir de una lectura consistente de PostgreSQL. La Fase 4 conserva los contratos de navegación y el alcance profesional existente.

## Modelos y correcciones

- `User` y `Athlete` identifican el rol y la ficha. `Athlete.coachId` delimita las consultas del entrenador. El modelo actual da alcance global a fisioterapia. Excel conserva esa autorización y omite correos, documentos de consentimiento, fecha de nacimiento, notas del perfil y credenciales.
- `Injury` distingue antecedentes y molestias. `Alert` registra el estado actual y `AlertEntry` conserva la actuación, la transición y la fecha de seguimiento. Se compartió el filtro de estados con la API de alertas. El dashboard deja de devolver una fecha de seguimiento de una revisión anterior cuando una alerta ya no tiene seguimiento pendiente.
- `Program`, `ProgramSession`, `SessionExercise` y `CompletedSession` representan la configuración, el contenido de las sesiones y la actividad registrada. La ficha, el dashboard y Excel usan el mismo cálculo de semana, sesiones previstas y adherencia. El guardado de sesiones ahora comprueba que la sesión pertenezca al programa vigente. Los registros históricos se conservan y aparecen en su propia hoja.
- `Exercise` y `ExerciseAssignment` conservan las asignaciones vigentes y el estado del ejercicio en la biblioteca. El archivo indica si el ejercicio sigue disponible o está archivado. El modelo elimina el vínculo al retirarlo y por ello no hay un historial de retiros para exportar.
- `FunctionalTest` permite consultar mediciones ya registradas. Se excluyó del libro porque la definición académica de campos, unidades y representación sigue pendiente.

## Exportaciones y permisos

| Reporte | Hojas y campos | Fuente PostgreSQL | Rol |
| --- | --- | --- | --- |
| Consolidado | Resumen con fecha de generación, periodo, alcance, conteos por estado y adherencia disponible, más las hojas de los cinco módulos. | Conjunto de las fuentes siguientes con un mismo corte. | Fisioterapeuta |
| Deportistas | Código por archivo y nombre en modo identificable. El código permite distinguir homónimos y unir hojas. | `Athlete`, `User` | Fisioterapeuta |
| Molestias y antecedentes | Código, tipo, fecha, intensidad, limitación, días de ausencia y recurrencia. Zona y notas en el modo identificable. | `Injury` | Fisioterapeuta |
| Alertas y seguimientos | Referencia del libro, fecha de la alerta, estado actual, fecha sugerida, agenda y zona en modo identificable. El historial añade versión, transición y fecha. Observaciones, actuación y autor solo en modo identificable. | `Alert`, `AlertEntry`, `Injury` | Fisioterapeuta |
| Programa preventivo | Programa al corte, inicio, semana, sesiones previstas y completadas, adherencia y estado del cálculo. La hoja de sesiones registra programa, semana, número y fecha de cada sesión realizada en el periodo. | `Athlete`, `Program`, `ProgramSession`, `CompletedSession` | Fisioterapeuta |
| Ejercicios asignados | Código, ejercicio o código de ejercicio, componente, fecha y estado en la biblioteca. Dosificación e indicaciones solo en modo identificable. | `ExerciseAssignment`, `Exercise` | Fisioterapeuta |

Administrador, entrenador, deportista y solicitudes sin sesión quedan excluidos en servidor. Cambiar el ID a mano no concede autorización. Un ID bien formado inexistente devuelve 404 al rol autorizado. Todos los libros se sirven como adjuntos privados sin caché.

El modo **identificable** incluye nombres y los textos profesionales especificados en la tabla. El modo **seudonimizado**, seleccionado inicialmente en la interfaz, omite los identificadores directos y el texto libre. Usa códigos nuevos por archivo, sin exportar la correspondencia con los IDs de la base. Conserva fechas y atributos que aún pueden permitir reidentificación. El parámetro anterior `anon=1` sigue aceptándose como alias de este modo. La interfaz no ofrece anonimización.

## Filtros y cálculo

- Se puede elegir un deportista o el conjunto bajo alcance de fisioterapia. El listado de deportistas es un corte actual, sin filtro de fechas.
- Desde y hasta son inclusivos y opcionales. Las marcas de tiempo se consultan y muestran en hora de Bogotá. Las fechas civiles de inicio, antecedentes y seguimiento conservan el día registrado.
- El filtro de estado actual se aplica a alertas e historial profesional en el consolidado y el reporte de alertas. El periodo incluye alertas generadas o con actuaciones en ese intervalo. El historial solo muestra actuaciones del intervalo solicitado.
- El periodo filtra registros de sesiones completadas, no recalcula un corte histórico de adherencia. La adherencia usa el programa vigente y el día de generación. Sin sesiones previstas, la celda de porcentaje queda vacía y se indica el motivo.
- La selección limita el trabajo a 5000 registros procesados por informe, incluidas las filas que alimentan el avance. Al superar el límite se devuelve 422 con la indicación de acotar el alcance, el módulo o el periodo. El servidor admite dos generaciones simultáneas por proceso. No se entrega un archivo truncado.

## Validación

- TypeScript y compilación de producción de ambos proyectos, `prisma validate`, 20 pruebas unitarias de Angular y 27 de API e integración con PostgreSQL aislado, incluidas cinco comprobaciones nuevas de Excel e integridad.
- ExcelJS reabrió los libros y verificó hojas, tipos, valores, fechas límite, porcentajes, encabezados, filtros, paneles inmovilizados, caracteres especiales, texto parecido a fórmulas y códigos. Se cotejaron los conteos de alertas con el dashboard y el listado API, y el avance con el programa vigente.
- Se probaron alcance vacío, uno y varios registros, 301 filas completas, exceso de límite sin archivo, permisos, IDs ajenos y filtros inválidos. El libro seudonimizado se revisó también buscando texto e identificadores excluidos.
- Brave descargó en un viewport de 390 px, validó el nombre y el estado de error y cotejó el archivo byte a byte con la respuesta del endpoint. Se reabrió el archivo descargado y se comprobó el número de alertas contra PostgreSQL. El entrenador no recibe el panel.
- LibreOffice Calc abrió y volvió a guardar copias temporales de los dos libros. Las ocho hojas y las 197 celdas del identificable y 158 del seudonimizado conservaron su tipo y valor.
- El panel no activa la descarga hasta recibir un .xlsx no vacío con su tipo MIME y muestra un error específico ante respuestas fallidas. Los valores aportados por personas se escriben como strings, sin fórmulas.

## Evidencias y límites

Los dos libros fueron generados por el endpoint y validados contra registros sintéticos en la base aislada. Se incluyen sin modificaciones.

- [Consolidado identificable sintético](./evidencias-fase-4/consolidado-identificable-sintetico.xlsx)
- [Consolidado seudonimizado sintético](./evidencias-fase-4/consolidado-seudonimizado-sintetico.xlsx)

La medición de rendimiento se limitó al conjunto aislado y a sus casos de volumen. Microsoft Excel de escritorio y dispositivos físicos quedan pendientes de revisión manual. La evaluación académica y el uso de información real fuera del seguimiento autorizado requieren las definiciones y autorizaciones correspondientes.
