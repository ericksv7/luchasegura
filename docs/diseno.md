# Sistema visual

Propuesta de diseño completa con prototipo interactivo: ver el documento de diseño compartido con el equipo (pantallas del deportista, panel del entrenador y sistema visual).

## Principios

- Verde azulado como color principal (salud y recuperación). Ámbar y rojo solo para avisos.
- Modo claro y oscuro con los mismos tokens. Cada color tiene versión para ambos modos.
- Interfaz del deportista pensada para celular, con barra inferior para Inicio, Reportar, Mi plan, Progreso, Bienestar y Perfil.
- Tipografía Manrope. Textos en español claro, sin términos clínicos innecesarios.
- Zonas táctiles de al menos 44 px.
- **Independencia estructural.** El contenido variable de un panel puede desplazar lo que viene después en su flujo. La posición de elementos anteriores o independientes se calcula con su propio contenedor.

## Tokens (`frontend/src/styles.scss`)

| Token | Claro | Oscuro |
| --- | --- | --- |
| `--pri` | #0b6e5c | #3fb9a0 |
| `--soft` | #d9f0ea | #16332d |
| `--warn` | #a86a0c | #d9a441 |
| `--bad` | #c0392b | #e8857a |
| `--bg` | #f4f6f8 | #0f171d |
| `--surf` | #ffffff | #151f26 |
| `--surf2` | #eef2f5 | #1b2730 |
| `--ink` | #0d1b24 | #d5dee4 |

El título de página, las secciones, los mensajes y los controles usan los tamaños `--text-*`. Los radios `--r` y `--r-lg` son de 10 y 14 px. `--line` separa superficies y `--control-line` marca los controles. `--h` conserva una altura mínima de 44 px y crece con la fuente. Las acciones usan los iconos SVG de `app-icon`.

## Componentes y estados

| Componente | Invariante |
| --- | --- |
| Navegación principal | La ruta determina el destino actual. La superficie neutra de hover desaparece al retirar el cursor. El foco interior se distingue de la selección y la pulsación conserva la caja. |
| Secciones de ficha | Los enlaces conservan su semántica de navegación. El parámetro permitido por el rol determina una única sección actual y su contenido. Resumen es el valor por defecto. La tira conserva una sola fila y desplaza dentro de ella los enlaces cuando falta espacio. La selección queda a la vista sin mover el foco ni desplazar la página. |
| Regreso | Enlace `.back` con el SVG `arrow-left` y texto visible. Encuestas conserva el destino contextual según el rol. |
| Botones y formularios | Una acción principal por flujo cuando corresponda. El foco usa un contorno. El error conserva su texto y el borde asociado al campo. El estado ocupado conserva las dimensiones y bloquea el envío repetido. |
| Cabeceras y tarjetas | El título y el contexto orientan antes de las acciones. Las superficies se ajustan al contenido. El espacio entre secciones expresa su jerarquía. |
| Carga, vacío, alertas y éxito | La carga anuncia progreso. El vacío explica qué falta y ofrece acción cuando existe. El error y la confirmación se distinguen por texto además del color. |

`--motion-control` y `--ease-control` fijan el feedback de controles en 140 ms con salida suave. Color, borde, superficie y opacidad pueden interpolarse. Hover, foco y pulsación conservan el rectángulo y la posición de los controles. El icono lateral escala de 1 a 1,12 y vuelve a 1 en 240 ms. La pulsación se reinicia con cada activación y se limpia al terminar. El enlace y el texto conservan su caja. La navegación dentro del mismo marco mantiene visible el DOM durante el cambio. Con `prefers-reduced-motion: reduce` el feedback usa la superficie y el estado de ruta.

## Estructuras protegidas

- **Inicio del deportista.** Tres tarjetas superiores alineadas. Bienestar compacto y evolución del dolor en la segunda fila.
- **Mi bienestar.** Resumen, gráfica, historial y privacidad conservan su orden y proporciones. En la ficha profesional, las dos superficies superiores comparten la altura intrínseca de su fila. Cuando se apilan, cada una recupera su altura natural.
- **Login.** Correo y contraseña comparten geometría. El ojo tiene superficie transparente y foco interior.
- **Registro.** La marca se distribuye según la altura del viewport y el espacio que necesita su propio contenido. El formulario crece desde el inicio de su columna. El consentimiento usa `details` y el scroll del documento.
- **Encuestas.** Pasos, borradores, historial, consulta y consentimiento conservan sus flujos. El acceso de fisioterapia vive en Evaluaciones y el del entrenador en Resumen.

## Referencias visuales y regresión

La prueba `backend/tests/visual-audit-browser.cjs --navigation` usa Brave y la demostración sintética local. Ejecuta el script de demostración y después lanza la prueba con `PLAYWRIGHT_CORE_PATH` y `UX_CAPTURE_DIR`. Guarda vistas representativas y verifica geometría, selección, navegación y movimiento. Registra junto a cada referencia el commit, la ruta y el rol, viewport, tema, foco o hover, y preferencia de movimiento. Espera el contenido, la fuente y el fin de las transiciones antes de capturar.

Compara el build anterior y el candidato con los mismos datos sintéticos y las mismas condiciones. Conserva la evidencia de un defecto por separado de una referencia aceptada. Una actualización de referencia requiere revisar la diferencia visible y contrastarla con las invariantes de esta guía. Las capturas candidatas quedan pendientes de revisión de diseño.

### Estabilización de navegación

Capturas de Brave con la cuenta sintética de fisioterapia y viewport de 1440 × 900 en tema claro, salvo la vista móvil. Las capturas anteriores corresponden a `307f528`. Las candidatas corresponden al cambio que introduce esta sección.

| Ruta y estado | Evidencia anterior | Candidata |
| --- | --- | --- |
| Ficha con `?tab=wellbeing` y puntero en Resumen | [Doble resaltado y fila huérfana](ux/navegacion/ficha-antes.png) | [Fila única y estados distintos](ux/navegacion/ficha-despues.png) |
| Misma ficha con puntero en Alertas | [Sidebar anterior](ux/navegacion/sidebar-antes.png) | [Hover y ruta activa](ux/navegacion/sidebar-despues.png) |
| Encuestas desde la ficha, con el contenido cargado | [Regreso sin flecha](ux/navegacion/regreso-antes.png) | [Regreso con el icono del sistema](ux/navegacion/regreso-despues.png) |
| Ficha en Bienestar a 320 × 900 en tema oscuro | | [Selección visible y desplazamiento local](ux/navegacion/ficha-movil-despues.png) |

Las imágenes fijan composición y jerarquía. La animación, los rectángulos de interacción y el regreso por rol se verifican en la prueba de navegador.

### Estabilidad estructural y movimiento

Se cotejaron `940b457` para Inicio, `a7fbe1c` para Mi bienestar y `9c7089f`, `307f528`, `50fe8b5` para controles y navegación. La línea base de las nuevas mediciones fue `50fe8b5`. Las capturas de esta sección son evidencia de Brave con datos sintéticos.

| Problema | Causa raíz | Archivo y corrección | Evidencia y prueba |
| --- | --- | --- | --- |
| Registro desplaza la marca y los campos anteriores | El panel flex distribuía su contenido según la altura de toda la fila. El formulario se centraba mientras cabía en esa fila. | `core/auth-shell.scss` asigna un mínimo del viewport al contenido de marca e inicia el registro en el borde superior de su columna con un espacio dependiente del viewport. `register.page.ts` conserva el desplegable nativo. | A 1440 × 900 el título de marca se movía 237,38 px y el encabezado del formulario 70,56 px. La regresión mide marca y campos al abrir y cerrar con teclado y mide los elementos independientes ante errores. |
| Bienestar profesional deja un borde inferior desigual | La cuadrícula y el host de Sueño se alineaban al inicio. | `wellbeing.page.scss` estira la fila. `sleep-card.scss` transmite el alto a la tarjeta interna cuando la ficha solicita `stretch-card`. | Brave observó 23,19 px de diferencia en vacío. La regresión mide ambos bordes, contenido y apilamiento en cinco estados de respuesta. |
| El sidebar pierde su pulsación y la transición de ruta puede ocultar el icono | La animación dependía de la clase de ruta activa y solo variaba la opacidad. | `core/shell-frame.ts` pulsa el icono al activar el enlace o cambiar el destino actual. `styles.scss` oculta la captura de ruta dentro del marco sin interferir con la transición de tema. | En Brave se toman muestras por cuadro de la escala del SVG y de los rectángulos de los enlaces. Se prueba clic repetido, Enter y movimiento reducido. |
| Ficha apretada en escritorio intermedio | Los enlaces tenían ancho intrínseco sin ajuste de línea. | `core/section-nav.ts` reparte el espacio y permite dos líneas de texto dentro de un enlace de escritorio. La tira móvil conserva el desplazamiento local. | Selección única, foco, hover, visibilidad, cambio de deportista, historial del navegador y query params. |
| Progreso deja una tercera columna vacía y Resumen desalineaba valores | Autoajuste de pistas con tarjetas de ancho completo. Los KPI distribuían su contenido con distinta cantidad de filas. | `athlete/progress.page.ts` declara dos columnas según el ancho disponible. `team/overview.page.ts` alinea el inicio de valores y etiquetas. El hover de enlaces KPI usa el borde. | Capturas de Progreso y Resumen. La regresión mide los bordes de la primera fila de Progreso frente al ancho de la gráfica. |

Para revisar desde la raíz del repositorio, deja iniciada la demostración aislada en una terminal y abre Brave con el enlace que imprime. El puerto de PostgreSQL habitual queda fuera de este entorno.

```bash
bash backend/tests/run-surveys-demo.sh
```

```bash
brave http://127.0.0.1:4277/login
PLAYWRIGHT_CORE_PATH=/ruta/a/playwright-core UX_CAPTURE_DIR=/tmp/luchasegura-ux \
  node backend/tests/visual-audit-browser.cjs --navigation
PLAYWRIGHT_CORE_PATH=/ruta/a/playwright-core UX_CAPTURE_DIR=/tmp/luchasegura-ux \
  node backend/tests/visual-audit-browser.cjs
```

| Captura de Brave | Antes | Después |
| --- | --- | --- |
| Registro a 1440 × 900, cerrado | [Antes](ux/estabilidad/registro-cerrado-antes.png) | [Después](ux/estabilidad/registro-cerrado-despues.png) |
| Registro a 1440 × 900, consentimiento abierto y documento completo | [Antes](ux/estabilidad/registro-abierto-antes.png) | [Después](ux/estabilidad/registro-abierto-despues.png) |
| Bienestar profesional vacío, tema claro | [Antes](ux/estabilidad/bienestar-antes.png) | [Después](ux/estabilidad/bienestar-despues.png) |
| Progreso del deportista, tema claro | [Antes](ux/estabilidad/progreso-antes.png) | [Después](ux/estabilidad/progreso-despues.png) |
| Resumen de fisioterapia, tema claro | [Antes](ux/estabilidad/resumen-antes.png) | [Después](ux/estabilidad/resumen-despues.png) |

Vistas de control del candidato en tema claro. [Inicio del deportista](ux/estabilidad/inicio-1440-light.png), [Mi bienestar](ux/estabilidad/bienestar-1440-light.png) y [Login](ux/estabilidad/login-1440-light.png).

La ficha profesional a 1440 × 900 midió 135,28 px por tarjeta en vacío y 479,64 px con el historial de sueño sintético. La diferencia de bordes fue de 0 px en ambos temas. [Historial en tema oscuro](ux/estabilidad/bienestar-con-historial-oscuro.png) · [Ficha móvil](ux/estabilidad/ficha-movil.png).

El título institucional y la descripción conservaron sus posiciones de 362,11 y 491,39 px al abrir y cerrar el consentimiento a 1440 × 900. El logo, el encabezado del formulario, la contraseña y el resumen del consentimiento conservaron sus rectángulos. [Consentimiento a 320 px con texto al 200 %](ux/estabilidad/registro-abierto-320-200-oscuro.png).

Brave midió un pico de escala de 1,12 con clic y 1,117 con Enter, un retorno a 1 y un desplazamiento de 0 px en los enlaces. Con movimiento reducido midió 1 en toda la interacción. [Hover y selección](ux/estabilidad/sidebar-hover.png) · [Consulta y enlace de regreso](ux/estabilidad/encuesta-presentada.png).
