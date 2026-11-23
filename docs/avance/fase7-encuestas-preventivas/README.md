# Fase 7 · Encuestas preventivas

El deportista entra desde **Mi plan → Encuestas preventivas**. La pantalla muestra la encuesta inicial, la final y el historial por intervención. Puede autorizar la demostración, responder por pasos, guardar un borrador, revisar las omisiones y presentar. El envío queda inmutable y el historial conserva las versiones de trabajo.

En **Equipo → Deportistas → Ficha**, fisioterapia con atención documentada consulta estados y respuestas presentadas con autorización vigente. El entrenador asignado abre desde esa ficha su cuestionario profesional. Administración gestiona las cuentas y las asignaciones con las herramientas existentes, con el contenido protegido por la API.

## Probar en navegador

1. Desde la raíz, regenera el cliente con `DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate`. Después usa el procedimiento [Abrir una instancia sintética](../fase6-fatiga-recuperacion/README.md#abrir-una-instancia-sintética) para confirmar el destino temporal, aplicar las migraciones, cargar ejemplos y arrancar la API. Antes de ejecutar el comando de arranque de la API, añade `export PREVENTIVE_SURVEYS_DEMO=1` dentro del subshell de ese procedimiento. Usa exclusivamente datos ficticios.
2. Desde la raíz, en otra terminal, ejecuta `npm --prefix frontend start`. Abre `/usr/bin/brave http://localhost:4200`.
3. Registra un adulto de prueba. En fisioterapia, configura un inicio dentro de los próximos siete días. En Administración, asigna el entrenador de prueba.
4. Como deportista, autoriza la demostración en Encuestas, guarda un borrador y vuelve a abrirlo. Presenta la inicial y comprueba el estado futuro de la final. Elige otro deportista sintético con inicio hace al menos 56 días para probar la final.
5. Documenta una revisión clínica o evaluación para el primer deportista con la cuenta de fisioterapia y comprueba su lectura. Prueba el cuestionario propio del entrenador y retira la autorización de demostración desde la cuenta del deportista para comprobar la denegación posterior.

El [catálogo](CUESTIONARIO.md), las [decisiones](DECISIONES.md) y los [pendientes](PENDIENTES.md) describen el alcance de la demostración.
