# Propuesta preventiva · v1

Fuente académica consultada directamente: [Proyecto de deporte de lucha libre olímpica](../../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OL%C3%8DMPICA.pdf), apartados de recolección de información y procedimiento. Plantea encuesta inicial, preguntas al entrenador, seguimiento durante ocho semanas y repetición al cierre. Las preguntas y periodos exactos de esta versión son una propuesta de implementación.

| Instrumento | Periodo de referencia |
| --- | --- |
| Inicial | 56 días, desde inicio menos 63 hasta inicio menos 8. Termina antes de la apertura de semana 0 para que todo el periodo haya transcurrido cuando se responde. |
| Final | 56 días, desde la fecha de inicio hasta inicio más 55 inclusive. |
| Entrenador | Siete días anteriores a la creación del primer borrador. La fecha se fija con el catálogo. |

- **Antecedentes**. `history` pregunta por lesiones anteriores al periodo inicial. Opciones sí, no o duda. Este antecedente queda fuera de la comparación entre ventanas.
- **Lesiones en el periodo**. `injury` es obligatoria al enviar (sí, no o duda). Una respuesta afirmativa habilita cantidad aproximada `episodes` (1–100), zona corporal `zone`, tipo conocido `injuryType`, recurrencia `recurrence`, contexto `context` (entrenamiento, competencia, otra actividad o no recuerda), mecanismo `mechanism`, atención `care`, limitación `limitation` y ausencia `absence`. Si hubo ausencia, `days` admite 0–56 días. Los detalles se refieren a la lesión más reciente, salvo la cantidad aproximada.
- **Prácticas**. `warmup`, `mobility`, `strength`, `balance`, `recovery` y `communication` usan todos los entrenamientos, más de la mitad, la mitad o menos al menos una vez, ninguno y no aplica. Comunicación usa no aplica cuando no hubo molestias. `knowledge` consulta conocimiento declarado con sí, no o duda.
- **Entrenador**. `warmup`, `mobility`, `strength`, `communication` y `followup` usan las frecuencias anteriores aplicadas al entrenamiento del grupo. Calentamiento es obligatorio al enviar. `observations` admite una observación general de hasta 240 caracteres. Se pide excluir nombres, antecedentes y diagnósticos.

El catálogo ejecutable contiene los enunciados, identificadores y opciones exactos. La ficha aporta categoría, modalidad y experiencia como contexto de lectura. El formulario conserva esos valores al crear el primer borrador. Los antecedentes, molestias, sesiones y evaluaciones existentes siguen siendo registros independientes. La ausencia de respuesta se conserva como omisión. El módulo presenta declaraciones descriptivas.
