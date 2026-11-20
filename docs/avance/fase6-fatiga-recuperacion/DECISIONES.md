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
