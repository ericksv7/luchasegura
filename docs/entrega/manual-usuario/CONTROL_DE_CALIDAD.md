# Control de calidad · Manual de Usuario de LuchaSegura

## Resultado

- **29 páginas A4** con portada, índice interactivo y nueve capítulos.
- **27 capturas originales de la aplicación**, presentadas en 33 encuadres y 34 apariciones, incluida la portada. Se reutilizaron escenas sintéticas de la Fase 6 y de las evidencias de seguimiento. Los encuadres reducen espacio sobrante y conservan el contenido visible de la aplicación.
- **28 destinos internos y 90 enlaces**. Se comprobó que los destinos coinciden con el índice impreso, que el PDF tiene marcadores y que los enlaces apuntan a destinos existentes.
- Se revisaron visualmente todas las páginas y se ampliaron los recortes de acciones prioritarias. Se verificó numeración, legibilidad de controles, continuidad de pasos, ausencia de páginas vacías y ubicación del texto dentro de los límites de página.
- El PDF usa lenguaje de usuario y explica las funciones desde la interfaz. Se verificó la ausencia de código, rutas internas, instrucciones de infraestructura, credenciales, enlaces privados y datos de personas reales.

## Cobertura y revisión de comprensión

| Capítulo | Qué puede hacer el lector después de consultarlo |
| --- | --- |
| 1 · Conoce LuchaSegura | Reconocer el propósito, los cuatro perfiles y el alcance de una alerta. |
| 2 · Primeros pasos | Entrar, crear una cuenta de deportista, reconocer el menú, guardar, salir y cambiar la apariencia. |
| 3 · Administrador | Buscar, crear y editar cuentas, cambiar estados, eliminar cuentas elegibles y asignar entrenadores. |
| 4 · Fisioterapeuta | Priorizar pendientes, abrir fichas, distinguir antecedentes y molestias, revisar y seguir alertas, consultar sesiones y evaluaciones, gestionar ejercicios y umbrales, y descargar Excel. |
| 5 · Deportista | Editar su perfil y antecedentes, reportar una molestia, consultar el plan, marcar una sesión, interpretar sus gráficos y cambiar contraseña. |
| 6 · Entrenador | Consultar el avance, las alertas visibles, las fichas asignadas, las sesiones y los ejercicios dentro de su perfil. |
| 7 · Recuperación | Solicitar el mensaje, cambiar la contraseña y actuar si el correo se demora o el enlace vence. |
| 8 · Ejemplo práctico | Seguir un caso ficticio desde la creación de la cuenta hasta el seguimiento, las sesiones y el reporte. |
| 9 · Preguntas frecuentes | Resolver dudas habituales y volver directamente al procedimiento. |

La revisión editorial se hizo desde la perspectiva de una persona que usa LuchaSegura por primera vez. Se recorrieron los procedimientos leyendo el nombre del menú, la acción, los datos solicitados y el resultado esperado. Se contrastaron etiquetas y restricciones con la interfaz vigente. La revisión de comprensión fue una simulación editorial, sin participantes externos.

No quedaron pendientes de documentación en los módulos solicitados. La guía describe **Evaluaciones** como consulta de registros existentes y **Excel** como descarga. La validación de esta edición fue documental y visual. Para recuperación se usaron vistas ficticias de solicitud y cambio de contraseña, sin enviar correo en esta fase.

## Conservación y archivos para un futuro commit

Se comprobó que los archivos preexistentes de `docs/entrega/`, incluido el PDF integral de 69 páginas, conservan su contenido. La edición solo añade los archivos que se enumeran aquí. No se ejecutaron migraciones ni se usaron datos de la base habitual.

```text
docs/entrega/LuchaSegura_Manual_de_Usuario.pdf
docs/entrega/manual-usuario/CONTROL_DE_CALIDAD.md
docs/entrega/manual-usuario/README.md
docs/entrega/manual-usuario/capitulos/01-conoce.md
docs/entrega/manual-usuario/capitulos/02-primeros-pasos.md
docs/entrega/manual-usuario/capitulos/03-administrador.md
docs/entrega/manual-usuario/capitulos/04-fisioterapia.md
docs/entrega/manual-usuario/capitulos/05-deportista.md
docs/entrega/manual-usuario/capitulos/06-entrenador.md
docs/entrega/manual-usuario/capitulos/07-recuperacion.md
docs/entrega/manual-usuario/capitulos/08-ejemplo.md
docs/entrega/manual-usuario/capitulos/09-preguntas.md
docs/entrega/manual-usuario/generar.py
docs/entrega/manual-usuario/manual.css
docs/entrega/manual-usuario/plantilla.html
docs/entrega/manual-usuario/recortes.json
```

La lista corresponde a la Fase 7. La regeneración desde otro checkout requiere además las capturas y el impresor preexistentes que se describen en el [procedimiento de edición](README.md).
