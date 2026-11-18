# Estado general de LuchaSegura

LuchaSegura es una aplicación de apoyo al seguimiento preventivo de deportistas de lucha libre olímpica. Permite registrar molestias, dar seguimiento profesional y consultar el avance del programa preventivo. Sus indicadores describen registros y actividad del programa.

| Rol | Funciones implementadas |
| --- | --- |
| Administración | Gestiona cuentas, roles, estados y asignaciones de profesionales. |
| Deportista | Gestiona su perfil y antecedentes, registra molestias, consulta indicaciones y confirma sesiones realizadas. |
| Fisioterapia | Consulta fichas autorizadas, atiende alertas, documenta revisiones y seguimientos, administra ejercicios y exporta reportes. |
| Entrenamiento | Consulta deportistas asignados y su avance deportivo dentro de los permisos del rol. |

Una molestia puede generar una alerta según las reglas vigentes. El fisioterapeuta revisa el reporte, documenta su actuación y programa o finaliza un seguimiento. El programa preventivo se organiza por semana desde la fecha de inicio. Las sesiones confirmadas quedan registradas y actualizan el avance que consultan los roles autorizados.

Fisioterapia puede descargar un consolidado Excel de ocho hojas o reportes por módulo, con filtros de alcance, fechas y estado cuando corresponda. Puede elegir identificación directa o códigos seudonimizados. Estos códigos siguen siendo información protegida.

La Fase 5 usó datos ficticios en PostgreSQL aislado. Se probaron los permisos en la API, los recorridos de los cuatro roles en Brave, las transiciones de las alertas y el contenido de los archivos Excel. [Informe de pruebas](FASE_5_SEGURIDAD_Y_PRUEBAS.md)

La captura e interpretación de evaluaciones funcionales sigue sujeta a la validación académica de instrumentos, protocolos y criterios. Para un uso institucional quedan por confirmar las autorizaciones y el tratamiento de datos de salud y menores, habilitar la recuperación segura de credenciales, resolver la revisión de dependencias pendiente y comprobar la configuración real de HTTPS, protección de datos, respaldo y restauración.
