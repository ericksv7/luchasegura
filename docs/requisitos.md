# Requisitos y módulos

Propuesta inicial basada en el documento del proyecto. **No son requisitos definitivos**: se ajustan tras la reunión con el equipo de Fisioterapia. La columna Estado se actualiza a medida que se construye.

Prioridad: V1 se construye primero, V2 si hay tiempo.

## Módulo 1. Perfil del deportista

| Código | Función | Prioridad | Estado |
| --- | --- | --- | --- |
| RF-01 | Registro con consentimiento informado (y acudiente en menores) | V1 | API lista (registro) |
| RF-02 | Datos generales: edad, peso, categoría, estilo, experiencia | V1 | API lista |
| RF-03 | Antecedentes de lesión | V1 | API lista |
| RF-04 | Campo libre de observaciones | V1 | API lista (notas) |
| RF-05 | Prácticas preventivas actuales | V2 | Pendiente |

## Módulo 2. Identificación de factores de riesgo

| Código | Función | Prioridad | Estado |
| --- | --- | --- | --- |
| RF-06 | Reporte de molestia (zona, intensidad 0 a 10, momento, mecanismo, limitación) | V1 | API lista |
| RF-07 | Alerta automática al superar el umbral | V1 | API lista (regla básica) |
| RF-08 | Historial de molestias por zona | V1 | Parcial |
| RF-09 | Pruebas funcionales (SEBT/YBT, FMS, T-test, goniometría) | V2 | Modelo de datos listo |
| RF-10 | Escalas clínicas opcionales | V2 | Pendiente |

## Módulo 3. Orientación preventiva

| Código | Función | Prioridad | Estado |
| --- | --- | --- | --- |
| RF-11 | Programa de 8 semanas, 3 sesiones por semana | V1 | Modelo de datos listo |
| RF-12 | Ficha de ejercicios | V1 | Modelo de datos listo |
| RF-13 | Marcar sesión completada | V1 | Modelo de datos listo |
| RF-14 | Consejos de recuperación y comunicación de molestias | V1 | Pendiente |
| RF-15 | Recordatorios | V2 | Pendiente |

El contenido del programa lo define y valida el equipo de fisioterapia.

## Módulo 4. Seguimiento

| Código | Función | Prioridad | Estado |
| --- | --- | --- | --- |
| RF-16 | Progreso del deportista (cumplimiento, evolución del dolor) | V1 | Pendiente |
| RF-17 | Panel del entrenador y del fisioterapeuta | V1 | Parcial (lista de deportistas) |
| RF-18 | Registro semanal de adherencia y lesiones | V1 | Pendiente |
| RF-19 | Comparación inicial y final | V2 | Pendiente |
| RF-20 | Exportación a Excel | V1 | Pendiente |

## Fuera del alcance

Diagnóstico o prescripción automática, medir pruebas con el celular, publicación en tiendas de aplicaciones, integración con sensores.

## Preguntas abiertas para la reunión

1. ¿Las pruebas funcionales se cargarán en la aplicación?
2. ¿Cuántos deportistas la usarán y para qué fecha debe estar lista?
3. ¿Está definido el programa de ejercicios de las 8 semanas?
4. ¿Quién define los umbrales de alerta del dolor?
5. ¿Existen el consentimiento informado y el aval del IDRD y la universidad?
6. ¿El entrenador ve todos los reportes o solo los que el deportista autorice?
