# Cierre, pendientes y uso real

## Clasificación de los pendientes

| Prioridad | Pendiente | Decisión o condición de cierre |
|---|---|---|
| A · Cobertura académica | FMS, LESS, semana 0 y caracterización de lesiones se capturan de forma estructurada. Sigue pendiente el alta profesional independiente de lesiones | Presentar la cobertura y las brechas de la [matriz](MATRIZ.md). La concordancia íntegra con el PDF requiere revisión del equipo académico |
| B · Datos reales | Consentimiento de registro provisional; encuestas restringidas; permisos específicos implementados para encuestas y sueño | Aprobar el circuito institucional de consentimiento, retiro y autorización de representantes. Mantener deshabilitadas las funciones de demostración en producción |
| B · Datos reales | Protocolos de evaluación, dosificación y alertas por validar | Fisioterapia aprueba instrumentos, variantes, criterios de comparación y escalamiento de molestias |
| B · Datos reales | Operación, acceso y custodia de descargas | Revisar configuración, mínimos privilegios, TLS, respaldo, restauración, auditoría de accesos e incidentes |
| C · Mejora futura | Adherencia histórica por ciclo limitada | Identidad explícita de ciclo, calendario congelado y eventos persistentes de cumplimiento |
| C · Mejora futura | Cierre formal de intervención | Definir transición de cierre, correcciones y conservación de asociaciones históricas |
| D · Dependencia institucional | Política de informe grupal | Acordar mínimos de grupo, reglas de exclusión, destinatarios y divulgación |
| D · Dependencia institucional | Política de conservación y retiro | Fijar plazos y procedimiento para datos activos, archivos y respaldos |

## Controles de seguridad revisados

- Registro y cambios de contraseña usan bcrypt con coste 12 en la aplicación. Las fixtures aisladas pueden usar un coste menor para pruebas. El servidor limita solicitudes de autenticación y usa respuestas uniformes en recuperación. Las pruebas de recuperación emplean SMTP TLS local.
- El JWT tiene expiración configurable, dos horas por defecto. Se verifica cuenta activa, rol y versiones de revocación. Cerrar sesión almacena el hash del token hasta su vencimiento. Angular guarda el token en `sessionStorage` y aplica inactividad de 30 minutos. El impacto de un script que se ejecute en el origen y la persistencia de los límites en despliegues distribuidos deben revisarse antes de un piloto.
- El servidor aplica autorización a las rutas y descargas. Las respuestas privadas usan `no-store`. El Excel individual omite identificadores y notas privadas, pero contiene información sensible. Una revocación evita nuevas consultas dentro de su alcance y exige un procedimiento separado para archivos ya descargados.
- Las variables de entorno habilitan secretos y correo. La API usa Helmet, CORS con origen configurado y límite de JSON. Maneja indisponibilidad de PostgreSQL con una respuesta pública acotada. Los errores de API registran método y estado. Recuperación clasifica fallos SMTP sin imprimir el enlace.
- El registro local guarda el texto aceptado, su versión y evidencia asociada. El nombre suministrado de un acudiente es un campo de demostración. En producción, el registro público y las encuestas conservan sus restricciones.
- El rastreo de secretos se hizo sobre rutas versionadas y patrones seleccionados, sin imprimir valores. La auditoría de npm se ejecutó sobre ambos lockfiles. Consulta el [informe de pruebas](PRUEBAS.md).

## Condiciones previas a un piloto

1. Formalizar responsables, autorización de universidad e IDRD, aval ético cuando aplique y un protocolo de estudio aprobado.
2. Validar instrumentos, programa, comparaciones y criterios de atención con el equipo profesional.
3. Aprobar consentimiento informado, procedimiento de representación legal y participación del menor según edad y madurez. Verificar evidencias y cómo se tramita el retiro.
4. Identificar responsable y encargados del tratamiento, finalidades, datos mínimos, destinatarios, política aplicable y canal de derechos del titular.
5. Revisar matriz de permisos, asignación y revocación, bitácoras, reglas de exportación y condiciones para informes grupales.
6. Definir conservación, eliminación, respaldo cifrado, restauración probada y tratamiento de copias distribuidas.
7. Designar responsables de monitoreo e incidentes, con procedimiento de contención, comunicación y revisión.
8. Pedir revisión jurídica y ética colombiana de la versión vigente y su aplicabilidad. Los datos de salud son sensibles y el tratamiento de datos de menores tiene condiciones adicionales. Para investigación en salud, confirmar con el comité el régimen vigente y los requisitos de consentimiento y asentimiento. [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) · [Decreto 1074 de 2015, capítulo 25](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm) · [Resolución 8430 de 1993](https://minsalud.gov.co/Normatividad_Nuevo/RESOLUCION%208430%20DE%201993.pdf)

## Conclusiones

**Entrega académica con datos sintéticos.** El alcance demostrable es un prototipo de seguimiento, desde el programa hasta los informes. La conformidad con la batería íntegra del PDF queda condicionada a la decisión académica de alcance. El informe de pruebas documenta cualquier verificación técnica pendiente.

**Piloto o uso real.** Pendiente de autorización. Requiere aprobación institucional, ética y profesional, garantías de tratamiento de datos sensibles y de menores y procedimientos de operación y retiro.

## Matriz final

| Área | Estado | Evidencia | Pendiente | ¿Bloquea entrega? |
|---|---|---|---|---|
| Frontend | Build y pruebas Angular aprobados | [Pruebas](PRUEBAS.md) | Regresión en dispositivos físicos y tecnologías de asistencia del público objetivo | No para demo local |
| Backend | Build, tipos y regresión API aprobados | [Pruebas](PRUEBAS.md) | Operación institucional para un piloto | No |
| Base de datos | Arranque desde vacío, actualización y restauración sintética | [Pruebas de Fase 10](../avance/fase10-evaluaciones-lesiones/PRUEBAS.md) | Procedimiento operativo para datos reales | No |
| Autenticación | Login, cambio, recuperación, revocación y registro local | `security.test.ts`, `mail-recovery.test.ts` | Política y canal de correo del piloto | No |
| Roles | Cuatro roles con controles en API | `security.test.ts`, recorridos Brave | Validar alcance de atención institucional | No |
| Deportista | Perfil, plan, sesiones, molestias y progreso | `alert-reviews.test.ts`, caso activo de demo | Trazabilidad histórica completa | No |
| Fisioterapia | Evaluaciones, atención, programa e informes | `alert-reviews.test.ts`, `program-reports.test.ts` | Aprobación institucional de instrumentos y protocolos | No para demo local |
| Entrenador | Asignados, información deportiva, cuestionario sintético | `security.test.ts`, `preventive-surveys.test.ts` | Aprobación del cuestionario | No para demo local |
| Administración | Gestión de cuentas y asignación | `alert-reviews.test.ts`, `security.test.ts` | Procedimiento institucional | No |
| Evaluaciones | Semana 0, SEBT/YBT, Agility T-test, FMS y LESS con revisiones | [Matriz](MATRIZ.md) | Validación profesional de los protocolos y su aplicación | No para demo local |
| Encuestas | Inicial, final y entrenador en demostración | `preventive-surveys.test.ts` | Instrumento y autorización institucional | No para demo local |
| Bienestar | Diario, historial y sueño con permiso específico | `wellbeing.test.ts` | Validación profesional de la aplicación | No |
| Informes | Individual y agregado sintético | `program-reports.test.ts` | Política grupal y cierre formal | No para demo local |
| Excel | Plantillas aprobadas preservadas | [Ejemplos](../avance/fase8-informes-comparativos/EXCEL.md), `program-reports.test.ts` | Custodia de las copias con datos reales | No |
| Seguridad | Controles revisados y auditorías ejecutadas | [Pruebas](PRUEBAS.md) | 16 alertas moderadas de desarrollo Angular y condiciones operativas | No para demo local |
| Instalación | Dependencias limpias, cliente generado y servicios aislados | [Instalación](INSTALACION.md), [Pruebas](PRUEBAS.md) | Tener herramientas nativas y acceso de descarga | No |
| Documentación | Paquete indexado | [Manifiesto](README.md) | Aceptación del alcance por parte del equipo académico | No |
| Demostración | Casos activos y de cierre | [Manual y guion](DEMOSTRACION.md) | Ensayo con la máquina y archivo de presentación definitivos | No |
| Uso con datos reales | Pendiente de autorización y validación | Condiciones previas de este documento | Gobernanza, consentimiento, instrumentos, operación y revisión jurídica | Sí para piloto |
