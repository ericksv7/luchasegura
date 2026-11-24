# Manual y guion de demostración

Arranca el sitio con `TMPDIR=/tmp npm --prefix backend test -- --reports-demo` después del build Angular. Abre `http://127.0.0.1:4288/login`. Las cuentas usan la contraseña ficticia `Informes-sinteticos1`. Usa el menú de la cuenta para cerrar sesión antes de cambiar de rol. Los cambios duran hasta detener el ejecutor.

| Cuenta | Uso |
|---|---|
| `completa-fase8@example.test` | Caso al final del ciclo, con registros, comparación e informe |
| `parcial-fase8@example.test` | Caso activo en semana 2 para registrar sesión, bienestar y molestia |
| `sin-intervencion-fase8@example.test` | Estado sin intervención |
| `fisioterapia-fase8@example.test` | Ficha, atención, evaluaciones, informes y Excel |
| `sin-alcance-fase8@example.test` | Verificación del acceso restringido al informe individual |
| `entrenador-fase8@example.test` | Consulta de asignados y cuestionario permitido |
| `administracion-fase8@example.test` | Cuentas, roles, estados y asignaciones |

## Recorridos por rol

**Deportista.** En el caso completo, abre Mi perfil, Mi plan, Mi bienestar, Mis evaluaciones y Mi progreso. En el informe selecciona el ciclo con registros inicial y final y descarga el Excel. El ciclo histórico muestra datos incompletos. En el caso activo, abre la semana disponible de Mi plan y confirma una sesión. En Mi bienestar, registra el día de hoy. En Reportar, guarda una molestia ficticia con intensidad 6 para generar una alerta con la regla sintética. Recarga las vistas para confirmar los registros. La encuesta inicial del caso activo pertenece a semana 0 y la final aún está fuera de ventana. El caso completo tiene ambas encuestas presentadas.

**Fisioterapia.** Abre Resumen y Equipo → Deportistas. La consola imprime la ficha del caso activo. Busca la nueva alerta en Alertas, registra su revisión con actuación ficticia y marca seguimiento si corresponde. Regresa a la ficha para consultar programa, evaluaciones y la historia de atención. En el caso completo abre Informe del programa desde Evaluaciones o usa la ruta que imprime la consola. En Resumen abre Informe grupal, revisa la cobertura y descarga el Excel.

**Entrenador.** Abre Equipo → Deportistas y elige un deportista asignado. Consulta el programa y el progreso permitido. Abre Encuestas para consultar el cuestionario del entrenador y su disponibilidad. Las vistas clínicas y de informes conservan su restricción por rol.

**Administración.** Abre Usuarios para revisar roles y estados. En Asignaciones verifica la relación entre entrenador y deportista. Puedes mostrar los controles de edición sin alterar las cuentas que se usarán en la presentación.

## Presentación breve, 5–7 minutos

| Tiempo orientativo | Cuenta y pantalla | Qué decir y hacer | Resultado esperado |
|---|---|---|---|
| 1 min | Login | Expón el problema y las cuatro responsabilidades | Se entiende para qué sirve la aplicación |
| 2 min | Caso completo, Mi plan y Mi bienestar | Muestra ocho semanas, sesiones registradas y diario | Se ve la relación entre intervención y seguimiento |
| 2 min | Caso completo, Mi progreso → Informe | Contrasta mediciones inicial y final y descarga el Excel | Se ve la comparación y se abre el archivo profesional |
| 1–2 min | Fisioterapia, Resumen → Informe grupal | Explica permisos y que los valores son sintéticos. Menciona FMS, LESS y validación pendiente | Queda delimitado el alcance académico |

## Presentación completa, 12–15 minutos

| Tiempo orientativo | Cuenta y pantalla | Qué decir y hacer | Resultado esperado |
|---|---|---|---|
| 2 min | Login | Explica problema, población prevista, semana 0, semanas 1–8 y evaluación final | El público conoce el diseño descriptivo y el propósito |
| 3 min | Caso activo, Mi plan, Mi bienestar y Reportar | Confirma una sesión, guarda bienestar y registra una molestia ficticia | Persisten los registros y se genera una alerta |
| 3 min | Fisioterapia, Alertas y ficha del caso activo | Revisa la alerta, documenta seguimiento y muestra la evaluación inicial | Se ve la historia de atención y la autoría profesional |
| 3 min | Caso completo y fisioterapia, informes | Muestra fases, encuesta y cobertura. Descarga los Excel individual y grupal | Los archivos corresponden a las vistas autorizadas |
| 1–2 min | Entrenador y administración | Muestra asignados y cuestionario. Abre Usuarios y Asignaciones con administración | Se distinguen las funciones deportivas y de gestión |
| 1–2 min | Informe o diapositiva de cierre | Distingue resultados del software, datos descriptivos ficticios y resultados clínicos por estudiar | El público entiende brechas y requisitos para un piloto |
