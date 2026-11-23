# Decisiones de Fase 6

## Fundamento académico

Los objetivos específicos promueven el manejo de la fatiga, la recuperación, el descanso y la comunicación de molestias. El procedimiento ubica las sesiones en las semanas 1 a 8 y prevé seguimiento de adherencia y lesiones. La frecuencia del autorregistro y las categorías descriptivas son decisiones del módulo. El documento base no prescribe un instrumento para medir bienestar. [Proyecto de Lucha Libre Olímpica](../../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OL%C3%8DMPICA.pdf)

## Registro e intervención

- Se admite una fecha por deportista y programa. Para registros nuevos se usa el programa vigente según la regla existente y el inicio real informado en la ficha. Se aceptan fechas pasadas dentro de ese periodo hasta el día civil actual en Bogotá. Sin inicio, o fuera de la ventana, se pueden consultar o corregir registros existentes, sin crear uno nuevo para ese periodo.
- Se conservan el identificador de programa, el inicio original y la semana calculada al guardar. Un cambio posterior del inicio no mueve los registros existentes. El sistema actual no mantiene un inventario completo de participaciones previas. Las nuevas entradas retrospectivas solo se asocian a la intervención que pueda verificarse en la ficha.
- Cero horas indica una respuesta explícita. Se usan incrementos de una décima entre 0 y 24, sin interpretación clínica. Descanso, fatiga y recuperación usan categorías sin puntaje. Las omisiones se guardan como valores nulos. Se requiere al menos una medición o percepción. Las notas son opcionales, con un máximo de 500 caracteres.
- Cada cambio crea una versión. Las transacciones conservan la consistencia del contador y del historial. Cada operación tiene un identificador único y los conflictos devuelven un estado recuperable. La consulta pagina de 14 en 14. El filtro y la gráfica usan los registros cargados y solo muestran mediciones presentes.

## Acceso y aprobación

La ficha general de fisioterapia no concede acceso automático a bienestar. Una revisión de alerta o una versión de evaluación funcional escrita por el profesional acredita una relación documentada. Esta regla reduce el alcance en un sistema que carece de asignación explícita de fisioterapia. La revisión institucional debe definir vigencia, retiro del acceso asistencial y conservación. La API profesional excluye notas e historial. Se conserva el control vigente de autenticación, revocación y menores.

Antes de uso institucional con datos reales, validar el texto de consentimiento, el alcance asistencial y el manejo de grandes periodos de seguimiento. La gráfica presenta horas por fecha y la alternativa textual conserva las categorías originales. El módulo no genera alertas clínicas a partir de las respuestas.

La migración aditiva `20261123120000_wellbeing_entries` crea `WellbeingEntry` y `WellbeingRevision`, con claves foráneas, unicidad y restricciones técnicas. Debe aprobarse por separado su aplicación en cualquier entorno habitual.

## Ampliación · Consulta y compartición de sueño

La consulta devuelve únicamente fechas y horas registradas en la versión vigente y su contexto mínimo de programa, inicio y semana. Sirve series de hasta 12 intervenciones por página. Una respuesta omitida deja la fecha fuera de la gráfica. Cero horas registradas sí aparece en la tabla. Las fechas son civiles de Bogotá y la gráfica de barras usa el componente de Progreso con eje en horas.

El entrenador requiere asignación vigente, cuenta activa y autorización específica de un deportista adulto con fecha de nacimiento y consentimiento adulto vigente verificable. La aceptación se vincula a la cuenta del entrenador mostrado, a la versión y huella del texto específico y a la fecha de nacimiento. Abarca las mediciones históricas y futuras mientras esté activa. Retirar el acceso, cambiar de asignación o corregir la fecha de nacimiento invalida el permiso. El servidor deniega las consultas posteriores, sin posibilidad de retirar información ya vista por una persona.

El texto específico y el consentimiento general siguen en borrador. La autorización se puede ensayar con adultos sintéticos fuera de producción. Producción permanece cerrada para la compartición hasta aprobar ambos textos. Los menores, los perfiles sin fecha y los que carecen de evidencia adulta verificable quedan fuera. La autorización de acudiente declarada en el registro general no acredita este permiso específico.

La migración aditiva `20261124120000_sleep_sharing` crea la preferencia de compartición con sus referencias y marcas de alta y revocación. No concede autorizaciones iniciales ni modifica mediciones existentes.
