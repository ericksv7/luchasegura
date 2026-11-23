# Sistema visual

Propuesta de diseño completa con prototipo interactivo: ver el documento de diseño compartido con el equipo (pantallas del deportista, panel del entrenador y sistema visual).

## Principios

- Verde azulado como color principal (salud y recuperación). Ámbar y rojo solo para avisos.
- Modo claro y oscuro con los mismos tokens. Cada color tiene versión para ambos modos.
- Interfaz del deportista pensada para celular, con barra inferior para Inicio, Reportar, Mi plan, Progreso, Bienestar y Perfil.
- Tipografía Manrope. Textos en español claro, sin términos clínicos innecesarios.
- Zonas táctiles de al menos 44 px.

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

`--motion-control` y `--ease-control` fijan el feedback de controles en 140 ms con salida suave. Color, borde, superficie y opacidad pueden interpolarse. Hover, foco y pulsación conservan el rectángulo y la posición de los controles. El icono del destino lateral vuelve a señalar el cambio de ruta mediante opacidad. Con `prefers-reduced-motion: reduce` la selección, el foco y el contenido siguen disponibles de inmediato.

## Estructuras protegidas

- **Inicio del deportista.** Tres tarjetas superiores alineadas. Bienestar compacto y evolución del dolor en la segunda fila.
- **Mi bienestar.** Resumen, gráfica, historial y privacidad conservan su orden y proporciones. En la ficha profesional, las dos superficies superiores se alinean por arriba y cada una toma la altura de su contenido.
- **Login.** Correo y contraseña comparten geometría. El ojo tiene superficie transparente y foco interior.
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
