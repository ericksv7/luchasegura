# Desplegables y estados informativos

## Vistas y patrón compartido

- Los paneles nativos de Excel, reapertura, contexto de antecedentes, campos opcionales, ficha, resultados y pruebas contempladas, sesiones del programa y consentimiento usan el mismo encabezado. Conservan `details` y `summary`, incluido el comportamiento de apertura exclusiva en las sesiones.
- El historial de alertas y el editor de inicio del programa usan botones con `aria-expanded` y `aria-controls`. El panel cerrado queda fuera de la navegación mediante `inert`. Al volver a abrir el editor se conserva la fecha introducida.
- Los selectores de formularios se unificaron en estilos globales. Se conservó el menú nativo, incluido el del entrenador asignado en administración, perfil y antecedentes del deportista, catálogo, umbrales, filtros, semana y Excel. Los formularios que se abren para crear, editar o asignar conservan sus acciones y su comportamiento de cancelación. Los controles de navegación y los diálogos conservan su patrón.

El chevron SVG es compartido. En un acordeón rota 180° y el encabezado abierto cambia de fondo. La transición de 240 ms ajusta la altura real y la opacidad. Los paneles nativos usan `::details-content` e interpolación de tamaño cuando el navegador los admite. Los paneles controlados por Angular usan filas de cuadrícula. El movimiento reducido aplica el estado de forma inmediata. Los selectores conservan su menú de sistema y recuperan su indicador nativo en colores forzados.

El patrón reside en `frontend/src/styles.scss`. Las vistas que lo aplican son `register.page.ts`, `team-report-panel.ts`, `alert-review.page.ts`, `athlete-detail.page.ts`, `athlete-evaluations.ts`, `athlete-program.ts` y `athlete-reviews.ts`. La etiqueta de revisión reutiliza el icono `check` del componente existente.

## Revisión registrada

En la ficha, el texto proviene de `ALERT_LABEL.REVIEWED` y el elemento original era un `span` con estilo de chip interactivo, sin clic. Ahora es un texto de estado con un icono de verificación y sin apariencia de botón. **Consultar revisión** abre el detalle y **Ver historial** controla la expansión. El historial documentado y la reapertura conservan su lógica.

## Pruebas y alcance

- Typecheck de aplicación y especificaciones Angular, compilación de producción y 22 pruebas Angular aprobadas.
- Recorrido de regresión de los cuatro roles en Brave con API real y datos sintéticos. Se comprobaron navegación, filtros, historial, reapertura, botones expansivos existentes y descarga filtrada con contenido cotejado.
- Prueba específica en Brave a 320, 390, 768, 1024 y 1440 px, en claro y oscuro. Midió alturas y ángulos intermedios al abrir y cerrar, verificó la posición de los campos obligatorios y el reporte, y probó teclado, toque, movimiento reducido, historial vacío y borradores extensos. La descarga seudonimizada se abrió como libro de ocho hojas.
- PostgreSQL descartable inicializado directamente desde el esquema para los recorridos. No se ejecutaron migraciones ni se usó la base habitual.

La animación de la altura de `details` depende del soporte del navegador. En versiones sin soporte, la apertura y el cierre nativos continúan disponibles. El menú emergente de cada selector lo gestiona el sistema operativo. Pendiente comprobar otros navegadores y equipos táctiles físicos.


## Capturas

- [Excel en escritorio, tema claro](capturas-desplegables/excel-escritorio.png)
- [Campos opcionales en móvil, tema oscuro](capturas-desplegables/seguimiento-movil.png)
- [Estado de revisión separado de sus acciones](capturas-desplegables/revision-registrada.png)
