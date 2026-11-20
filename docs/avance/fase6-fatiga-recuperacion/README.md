# Fase 6 · Mi bienestar

Mi bienestar reúne autorregistros voluntarios de sueño, descanso, fatiga y recuperación durante el programa preventivo. El deportista puede dejar respuestas sin contestar, consultar fechas anteriores, corregir sus datos y revisar sus versiones.

## Recorrido

1. En un entorno con datos sintéticos, entra como fisioterapia y registra el inicio desde **Equipo → Deportistas → Ficha → Programa**.
2. Entra con la cuenta del deportista y abre **Mi bienestar → Registrar bienestar**. Elige una fecha disponible, responde al menos un campo y guarda.
3. En **Mis registros**, abre **Detalles → Corregir registro** o **Ver historial de cambios**. En **Evolución**, filtra los registros cargados por semana y abre **Consultar datos por fecha**.
4. Para la consulta profesional, abre **Equipo → Deportistas → Ficha → Bienestar** con una cuenta de fisioterapia que haya documentado una revisión clínica o una evaluación de ese deportista.

| Rol | Acceso |
| --- | --- |
| Deportista | Sus registros, correcciones, versiones y observaciones privadas. |
| Fisioterapia | Consulta de los valores vigentes para deportistas con atención documentada por esa cuenta. |
| Entrenador y administrador | Acceso denegado al contenido del módulo. |

Las rutas nuevas son `/deportista/bienestar`, `/equipo/deportistas/:id?tab=wellbeing`, `/api/athletes/me/wellbeing` y `/api/team/athletes/:id/wellbeing`. La ruta propia permite listar, crear, consultar un registro, corregirlo y consultar versiones. La ruta profesional solo lista.

La interpretación clínica, la política institucional de acceso y conservación y la aprobación del tratamiento de datos reales se revisan por separado. [Decisiones](DECISIONES.md) · [Pruebas](PRUEBAS.md)

## Ampliación · Evolución del sueño

- **Deportista → Progreso → Evolución del sueño**. Selecciona intervención y semana con datos. Abre **Ver tabla de horas de sueño** para consultar cada fecha y valor exacto.
- **Fisioterapia → Deportistas → Ficha → Bienestar**. La gráfica usa el mismo alcance de atención documentada que el resto de la pestaña.
- **Entrenador → Deportistas → Ficha → Sueño**. Selecciona un deportista asignado. La gráfica se habilita solo si ese deportista autorizó expresamente a esa cuenta de entrenador.

Para ensayar la autorización, registra un adulto sintético con el flujo normal de consentimiento y asigna su entrenador desde Administración. En la cuenta del deportista, abre **Mi bienestar → Privacidad del sueño**, verifica el destinatario, marca la autorización y guárdala. Registra horas y consulta la gráfica como entrenador. Vuelve a **Privacidad del sueño**, elige **Retirar acceso al sueño** y vuelve a abrir la ficha como entrenador. La consulta queda denegada inmediatamente en el servidor. La vista ya abierta se vuelve a validar al recuperar el foco.
