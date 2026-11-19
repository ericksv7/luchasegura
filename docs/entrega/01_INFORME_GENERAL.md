# Informe general

## Resumen ejecutivo

LuchaSegura reúne el registro de molestias, la atención por fisioterapia y el seguimiento de sesiones preventivas. La aplicación local permite que cuatro perfiles trabajen sobre los mismos registros con permisos diferenciados y que fisioterapia genere reportes Excel. Las pruebas con datos sintéticos respaldan una demostración funcional.

## Introducción, problema y justificación

El proyecto académico describe la lucha olímpica como un deporte de contacto que exige fuerza, potencia, resistencia y control corporal. Propone incorporar hábitos preventivos y reconocer oportunamente las molestias para favorecer la continuidad deportiva. El software aborda una necesidad operativa de ese proyecto: reunir en un mismo entorno lo que reporta el deportista, lo que documenta fisioterapia y el avance del programa que puede consultar el personal autorizado. [Proyecto académico, secciones 1–3](../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OLÍMPICA.pdf)

## Objetivos académicos y contribución del software

El objetivo general del proyecto académico es favorecer la prevención de lesiones en luchadores olímpicos competitivos mediante hábitos preventivos y fortalecimiento específico, para apoyar su salud y la continuidad deportiva.

| Objetivo específico del proyecto, sintetizado | Contribución del software |
| --- | --- |
| Promover hábitos relativos a fatiga, recuperación, descanso y reconocimiento de molestias | Facilita registrar molestias y consultar indicaciones. |
| Fomentar el fortalecimiento y el calentamiento preventivo adaptados a las exigencias de la lucha | Organiza sesiones y ejercicios, y permite registrar su realización. |
| Identificar prácticas actuales de prevención y preparación física | Ofrece registros del programa y antecedentes. El estudio de prácticas requiere su propia metodología. |
| Sensibilizar sobre la comunicación oportuna de molestias | Ofrece un canal de reporte y seguimiento profesional. |

[Proyecto académico, sección 3](../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OLÍMPICA.pdf)

## Alcance, usuarios y módulos

| Usuario | Módulos y alcance |
| --- | --- |
| Administrador | Usuarios, roles, estado de cuentas y asignación de entrenadores. |
| Deportista | Perfil, antecedentes, molestias, plan, progreso y ejercicios individuales propios. |
| Fisioterapeuta | Resumen, fichas, alertas, revisiones, seguimientos, programa, biblioteca, umbrales, consulta de evaluaciones y Excel. |
| Entrenador | Resumen y fichas de deportistas asignados, programa y avance, con acceso limitado a información deportiva. |

## Desarrollo y arquitectura

El historial registra estabilización, integración de cuatro roles y consolidación de la versión demostrativa. La aplicación usa Angular standalone y Signals, TypeScript y SCSS en el navegador, Node.js y Express para la API, y Prisma con PostgreSQL para persistencia. ExcelJS genera libros en el servidor. [Arquitectura](04_ARQUITECTURA_TECNICA.md) · [Estado funcional](../avance/FASE_2_ESTADO_FUNCIONAL.md)

## Programa, molestias y atención

La propuesta académica considera ocho semanas y tres sesiones semanales. En la aplicación, el calendario parte de la fecha de intervención que registra fisioterapia. La adherencia compara sesiones declaradas como realizadas con las previstas hasta la semana activa, incluida esa semana. Las asignaciones individuales tienen dosificación e indicaciones propias y se consultan por separado.

El deportista registra antecedentes y molestias. Si una molestia actual cumple el umbral aplicable, el sistema crea una alerta. Fisioterapia documenta la revisión, puede mantener o finalizar un seguimiento y puede reabrir una alerta. Las actuaciones se conservan en el historial con autor y fecha. Finalizar un seguimiento indica el cierre de la actuación registrada.

La biblioteca permite crear, editar y gestionar ejercicios. Los ejercicios de una sesión forman parte del plan. Una asignación individual vincula un ejercicio con un deportista; el registro de sesiones corresponde al programa. [Procesos](03_DIAGRAMAS_DE_FLUJO.md)

## Excel, seguridad y privacidad

Fisioterapia puede descargar un consolidado de ocho hojas o reportes específicos. Los filtros dependen del reporte. El consolidado incluye Resumen, Deportistas, Molestias y antecedentes, Alertas y seguimientos, Historial profesional, Programa preventivo, Sesiones completadas y Ejercicios asignados. El libro puede tener identificación directa o códigos seudonimizados y debe mantenerse bajo acceso restringido.

La API valida identidad, estado de la cuenta y permisos. El deportista tiene acceso a sus propios registros y el entrenador tiene un alcance limitado a sus asignaciones. Se preserva el historial profesional y se aplican controles de entrada y límites de solicitudes. [Modelo](05_MODELO_DE_DATOS.md) · [Fase 4](../avance/FASE_4_DATOS_Y_EXPORTACIONES.md)

## Pruebas y resultados de desarrollo

La Fase 5 registró 21 pruebas Angular y 35 de API e integración correctas. Brave comprobó rutas de los cuatro roles, descargas y pantallas responsive. Los casos emplearon datos sintéticos en PostgreSQL aislado. Los resultados muestran funcionamiento técnico en el entorno de prueba. [Pruebas y resultados](07_PRUEBAS_Y_RESULTADOS.md)

## Limitaciones, pendientes y conclusiones

El software está preparado para demostración local. Las evaluaciones funcionales ofrecen consulta de datos existentes. La captura y la interpretación necesitan definición y aprobación académicas. El recorrido con un enlace enviado vía Gmail sigue pendiente de verificación. También quedan la revisión de dependencias, pruebas manuales y la validación de alojamiento, protección de datos y autorizaciones institucionales.

La entrega demuestra que los registros de deportistas, las actuaciones profesionales y el avance del programa pueden conectarse y consultarse. La eficacia preventiva requiere una evaluación independiente con el diseño y las autorizaciones del proyecto académico. [Limitaciones](10_LIMITACIONES_Y_PENDIENTES.md) · [Preparación para despliegue](09_PREPARACION_DESPLIEGUE.md)
