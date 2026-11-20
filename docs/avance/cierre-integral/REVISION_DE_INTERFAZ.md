# Revisión de interfaz y accesibilidad

La revisión toma [WCAG 2.2](https://www.w3.org/TR/WCAG22/) como referencia. La evidencia cubre funcionalidades y pantallas representativas. Una evaluación formal y la revisión con tecnologías de asistencia están pendientes.

| Pantallas | Revisión reproducible |
| --- | --- |
| Inicio de sesión, registro, solicitud de recuperación, restablecimiento, cambio obligatorio e información legal | Pruebas Angular, flujo SMTP en Brave, registro táctil y verificación del nombre y estado requerido de campos. Firefox mostró la página de información legal a 360 px. |
| Administración y asignaciones | Navegación por rol, listados, búsquedas, edición, estado, confirmaciones, relación entrenador–deportista, teclado y anchuras responsive en Brave. |
| Resumen, alertas, revisión y seguimiento | Agenda y estados vacíos, carga, reapertura, formularios opcionales, conservación de texto, foco y ambos temas. |
| Deportistas, ficha, programa, evaluaciones, biblioteca y umbrales | Revisión de secciones, pestañas, fichas, imágenes, filtros y asignaciones. El recorrido incluye antecedentes, sesiones y resultados de consulta. |
| Inicio, reporte, plan, progreso y perfil de deportista | Recorrido con sesión, estados vacíos, formularios, confirmaciones y errores, navegación de ancho estrecho y ambos temas. |
| Excel | Filtros, estado vacío, descarga, contraste de bordes, zoom de texto al 200 %, colores forzados y foco por encima de la navegación fija. |

## Cambios verificados

- Los tamaños de encabezados, títulos de tarjetas, etiquetas, texto de controles y mensajes comparten tokens en rem. El tamaño base no depende de una reducción para móviles. El espacio de formularios y de la navegación admite aumento de texto.
- Los bordes funcionales alcanzaron 3:1 frente al fondo de los selectores en los dos temas en Brave. Las primeras mediciones del borde decorativo en blanco eran 1,33:1. El foco de campos pasó a usar un contorno sólido, y el ajuste de navegación fija se comprobó con el botón enfocado a 320 px. [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- Se conservan los menús nativos, campos fechados y movimiento reducido. El formato visible del control de fecha depende del navegador. La prueba verifica los tamaños 320, 360, 390, 768, 1024, 1440 y 1920 px. El ensayo al 200 % cubre el panel de Excel. [1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- La revisión manual examinó capturas de ficha, evaluaciones, seguimiento, Excel e información legal. La cobertura visual, la navegación y las geometrías de Brave se complementan. Quedan pendientes los recorridos completos en otros motores, lectores de pantalla y dispositivos físicos.

## Evidencia

- [Excel en tema claro](capturas/excel-controles-claro.png).
- [Campos de seguimiento en tema oscuro](capturas/seguimiento-controles-oscuro.png).
- [Página de información legal en Firefox](capturas/legal-firefox-360.png).
