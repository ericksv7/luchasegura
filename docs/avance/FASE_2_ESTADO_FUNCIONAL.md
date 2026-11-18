# Fase 2 · Estado funcional de LuchaSegura

La verificación usa Brave, la API de Express y PostgreSQL temporal con las migraciones del repositorio. Las cuentas y los registros de prueba son ficticios. La base habitual quedó fuera de las escrituras de la fase.

## Matriz de verificación

| Rol | Módulo | Operación | Estado | Evidencia | Pendientes |
| --- | --- | --- | --- | --- | --- |
| Administrador | Usuarios | Crear personal, buscar, consultar, editar nombre y correo, cambiar roles de personal sin vínculos incompatibles, activar y desactivar. | Implementado y probado | API «Fase 2 A» y navegador. Alta desde el formulario, edición, recarga y acceso del usuario creado con cambio obligatorio de contraseña. | El deportista se registra con su consentimiento desde el acceso público. |
| Administrador | Asignaciones | Asignar, cambiar o retirar entrenador. Rechazar roles incorrectos y conservar perfiles o cuentas con vínculos protegidos. | Implementado y probado | API «Fase 2 A» comprueba el vínculo en PostgreSQL y los rechazos. El navegador retira y restablece la asignación. | El modelo relaciona al deportista con su entrenador. Fisioterapia tiene alcance profesional global. |
| Deportista | Perfil y antecedentes | Consultar y editar campos permitidos, crear y editar antecedentes propios, retirar antecedentes permitidos. | Implementado y probado | API «Fase 2 B y E» valida propiedad, campos restringidos, fechas y borrado. Brave guarda peso y un antecedente, lo edita y recarga. | — |
| Deportista | Molestias | Validar, enviar, reintentar, consultar y retirar cuando las reglas vigentes lo permiten. | Implementado y probado | API «Fase 2 B y E». Brave pierde la respuesta después del guardado, conserva el formulario y reintenta. PostgreSQL mantiene un reporte y una alerta. | La clave de reintento se conserva mientras el formulario sigue abierto. |
| Deportista | Plan | Consultar semana, sesiones y asignaciones, marcar o desmarcar una sesión y conservar el avance. | Implementado y probado | API «la sesión confirmada se refleja en el plan y la ficha». Brave verifica asignación visible, fallo de red sin éxito, guardado y recarga. | Las sesiones y los ejercicios del programa requieren un programa configurado. |
| Fisioterapeuta | Resumen, deportistas y ficha | Buscar y abrir ficha, consultar antecedentes, alertas, programa y estados agregados. | Implementado y probado | Brave recorre las pestañas y consulta los indicadores. La API contrasta estados, contadores y valores guardados. | — |
| Fisioterapeuta | Umbrales, revisiones y seguimientos | Guardar umbral, abrir alerta, revisar, programar con o sin fecha, consultar vencimientos, finalizar y reabrir. | Implementado y probado | API «Fase 2 B y E» y regresiones de historial. Brave genera la alerta desde una molestia, guarda la actuación, verifica autor y fecha y comprueba el estado vencido. | — |
| Fisioterapeuta | Biblioteca y asignaciones | Crear, consultar, filtrar, editar, asignar con dosificación e indicación, retirar y archivar ejercicios vinculados. | Implementado y probado | API «Fase 2 D». Brave abre el detalle, filtra, edita, archiva, asigna y retira. La asignación se consulta desde el plan del deportista. | — |
| Fisioterapeuta | Programa preventivo | Consultar sesiones y avance, registrar o editar el inicio con las restricciones vigentes. | Implementado y probado | Regresiones de inicio, semana y sesiones históricas. Brave guarda el inicio y la API comprueba que equipo y deportista ven el mismo avance. | El flujo usa un programa ya configurado. La aplicación actual carece de un editor para definir programas y sesiones desde cero. |
| Fisioterapeuta | Evaluaciones | Consultar resultados guardados, fase y fecha. | Implementado y probado | La API comprueba ambos tipos de fase y los permisos. Brave abre un resultado persistido. | — |
| Fisioterapeuta | Evaluaciones | Capturar y actualizar mediciones e interpretar los resultados. | Requiere validación externa | La interfaz explica la dependencia y no ofrece captura. | Confirmar la batería SEBT/YBT-LQ, FMS, LESS y Agility T-test, además de protocolos, unidades, puntuación y reglas de registro. |
| Entrenador | Equipo y ficha | Consultar dashboard, molestias operativas, programa y progreso de sus deportistas. | Implementado y probado | Brave valida menú y navegación. La API comprueba el alcance por asignación y bloquea la revisión profesional, las evaluaciones y el acceso a datos clínicos privados. | — |

## Flujos de extremo a extremo

- **A · Creación de usuarios.** El administrador creó una cuenta, cambió su nombre y rol y verificó su persistencia. El usuario inició sesión con la contraseña temporal, definió la propia y entró al espacio de fisioterapia. La API también verificó desactivación y reactivación.
- **B · Reporte y atención.** Fisioterapia guardó un umbral. El deportista envió una molestia y reintentó tras perder la respuesta. La alerta única apareció en el espacio profesional, donde se registró la revisión y se programó un seguimiento.
- **C · Programa.** Fisioterapia registró el inicio. El deportista consultó la semana y completó una sesión. El estado sobrevivió la recarga y la ficha profesional reflejó el avance. Se verificó también la desmarcación y la idempotencia de los reintentos.
- **D · Asignación.** Se asignó un ejercicio con dosificación e indicaciones. El deportista lo consultó en su plan y fisioterapia pudo retirar la asignación. Archivar el ejercicio conservó la asignación hasta el retiro explícito.
- **E · Historial.** La revisión y el seguimiento conservaron autor, fecha, observaciones y transiciones. La API bloqueó el borrado de un reporte con atención profesional. Los recorridos verificaron finalización y reapertura.

## Pruebas

- TypeScript y compilación de producción de frontend y backend. Validación de Prisma y comparación del esquema en PostgreSQL aislado.
- 18 pruebas unitarias de Angular. 22 pruebas de API e integración con PostgreSQL. Recorrido Brave con el frontend compilado, API real y verificación de persistencia.
- Para repetir la integración, ejecutar `npm --prefix backend test`. Para incluir Brave, compilar primero ambos proyectos y ejecutar `PLAYWRIGHT_CORE_PATH=<ruta-a-playwright-core> npm --prefix backend test -- --browser`. El ejecutor crea y detiene un clúster temporal.
- La comprobación de tamaños se realizó en navegador automatizado. Queda pendiente la revisión manual en dispositivos físicos y otros navegadores.
