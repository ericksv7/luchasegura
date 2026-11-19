# Matriz de requisitos

Los identificadores se asignan en esta entrega. La correspondencia académica remite a los apartados del PDF original. La evidencia combina verificaciones de fases anteriores y de esta edición. [Proyecto académico](../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OLÍMPICA.pdf) · [Evidencias de pruebas](07_PRUEBAS_Y_RESULTADOS.md)

| ID | Requisito y trazabilidad | Rol y módulo | Estado | Evidencia | Límite |
| --- | --- | --- | --- | --- | --- |
| LS-01 | Acceder al espacio y operar con permisos efectivos | Todos · Sesión | Implementado y probado | Fase 5, cuatro roles en Brave y API | La revocación por cierre es local al navegador. |
| LS-02 | Gestionar cuentas y entrenador asignado | Administración · Usuarios y Asignaciones | Implementado y probado | Flujo A e integración de roles | El deportista usa alta propia. |
| LS-03 | Conservar perfil y aceptación al registrarse | Deportista · Registro y Perfil | Implementado y probado | Fase 2 y regresiones de registro | La aceptación almacenada requiere revisión institucional. |
| LS-04 | Registrar antecedentes, conforme a la ficha descrita en Instrumentos de evaluación | Deportista y fisioterapia · Ficha | Implementado y probado | Fase 5, recorrido y regresión de datos | Edición y borrado sujetos a vínculos y reglas del registro. |
| LS-05 | Comunicar molestias y sus características, sección 3 e Instrumentos | Deportista · Reportar | Implementado y probado | Flujo B | Es un autorreporte. |
| LS-06 | Generar alertas según intensidad y gestionar umbrales | Fisioterapia · Alertas y Umbrales | Implementado con pruebas parciales | Flujo B y precedencia en el código | La generación tiene evidencia automatizada. Falta una regresión específica de todas las operaciones de configuración. |
| LS-07 | Documentar revisión, seguimiento y reapertura | Fisioterapia · Alertas | Implementado y probado | Flujo C, historial, concurrencia e idempotencia | El cierre es operativo. |
| LS-08 | Organizar ocho semanas y registrar sesiones, propuesta de intervención | Deportista, fisioterapia y entrenador · Programa | Implementado y probado | Flujo E, inicio y avance en API | Se requiere un plan con sesiones. El progreso es autorreportado. |
| LS-09 | Gestionar ejercicios y asignaciones individuales | Fisioterapia y deportista · Ejercicios | Implementado y probado | Flujo D y navegador | El cumplimiento individual queda fuera del cálculo de sesiones. |
| LS-10 | Consultar avance deportivo de asignados | Entrenador · Resumen y fichas | Implementado y probado | Brave y API de alcance | Lectura deportiva con campos restringidos. |
| LS-11 | Consultar evaluaciones iniciales y finales registradas | Fisioterapia · Evaluaciones | Implementado y probado | API de consulta y permisos, vista en Brave | Consulta de datos existentes. |
| LS-12 | Captura e interpretación de pruebas funcionales, Instrumentos de evaluación | Fisioterapia y equipo académico · Evaluaciones | Requiere validación externa | Vista informativa y modelo `FunctionalTest` | Definir instrumentos, protocolo, unidades e interpretación. |
| LS-13 | Exportar reportes autorizados | Fisioterapia · Resumen | Implementado y probado | Flujo F y cinco pruebas relacionadas con Excel y plan | Verificación manual en Microsoft Excel pendiente. |
| LS-14 | Recuperar contraseña por correo | Acceso · Gmail SMTP | Implementado, verificación externa parcial | [Flujo](16_REPORTES_Y_RECUPERACION.md) y [pruebas](07_PRUEBAS_Y_RESULTADOS.md) | Falta canje de un enlace recibido vía Gmail. |
| LS-15 | Acreditar impacto de la intervención | Equipo académico · Evaluación del proyecto | Requiere validación externa | El PDF fundamenta el propósito académico | Requiere estudio, datos y autorizaciones. |
| LS-16 | Publicar una instancia institucional | Equipo técnico e institucional · Operación | Pendiente | [Preparación](09_PREPARACION_DESPLIEGUE.md) | Alojamiento, operación y autorización por definir. |
| LS-17 | Consultar documentos por parte, rol y función | Fase 6 · PDF maestro y capítulos editables | Implementado | Índice general, marcadores y archivos de entrega | Las capturas usan datos ficticios. |

## Cobertura de pantallas por perfil

| Perfil | Entradas y pantallas | Evidencia |
| --- | --- | --- |
| Común | Acceso, registro, solicitud, restablecimiento y cambio de contraseña | [Acceso y navegación](02_MANUAL_DE_USUARIO.md) |
| Administración | Usuarios y asignaciones | [Manual del administrador](12_ADMINISTRADOR.md) |
| Fisioterapia | Resumen, alertas, revisión, deportistas, cinco pestañas de ficha, catálogo y umbrales | [Manual del fisioterapeuta](13_FISIOTERAPEUTA.md) |
| Deportista | Inicio, reportar, plan, progreso y perfil | [Manual del deportista](14_DEPORTISTA.md) |
| Entrenador | Resumen, pendientes, deportistas, ficha y catálogo | [Manual del entrenador](15_ENTRENADOR.md) |
| Operación transversal | Antecedentes, molestias, revisión, seguimiento, programa, evaluación, Excel y recuperación | [Procesos](03_DIAGRAMAS_DE_FLUJO.md) · [Excel y recuperación](16_REPORTES_Y_RECUPERACION.md) |
