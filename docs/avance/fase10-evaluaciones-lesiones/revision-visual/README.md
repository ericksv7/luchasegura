# Fase 10.1 · Revisión en Brave

Capturas inspeccionadas antes y después con la misma demostración sintética. Los formularios reutilizan las tarjetas, controles, desplegables, estados y temas existentes.

| Vista | Hallazgo y corrección | Evidencia |
|---|---|---|
| Informe, 390 px claro | Un 404 ofrecía reintentar y apuntaba a la ficha. El estado ahora ofrece volver al listado sin divulgar la causa del 404 | [Antes](antes/informe.png) · [Después](despues/informe.png) |
| FMS, 1440 px claro | Selectores de ancho completo y lados separados verticalmente. La cuadrícula agrupa cada patrón y alinea los controles bilaterales. El aviso se retira al corregir el campo | [Antes](antes/fms.png) · [Después](despues/fms.png) |
| LESS, 390 px oscuro | La columna de selectores dificultaba encontrar cada ítem. Las filas mantienen etiqueta y control juntos. Cada intento conserva el contador y separa contacto, desplazamiento y valoración global | [Antes](antes/less.png) · [Después](despues/less.png) |
| Lesión, 390 px claro | La insignia comprimía el editor dentro de la fila. La caracterización ocupa ahora todo el ancho y conserva secciones e historial | [Antes](antes/lesion.png) · [Después](despues/lesion.png) |
| Semana 0, 1440 px oscuro | La columna de campos utilizaba todo el ancho. La cuadrícula separa los datos de referencia y distingue las observaciones privadas | [Antes](antes/semana-0.png) · [Después](despues/semana-0.png) |

`sin-alcance-fase8@example.test` recibió HTTP 404 tanto para un deportista conocido fuera de su alcance como para el UUID de la captura. El nombre truncado del sidebar no permite identificar la cuenta de la sesión original. El 403 por rol tiene su propio estado y el 401 conserva el flujo de sesión existente. Los errores temporales y de conexión permiten reintentar.

La verificación focalizada cubrió 320, 390, 768, 1024 y 1440 px en ambos temas con Brave. Comprobó foco visible, validación de fecha, guardado parcial de FMS y LESS, historial, estado completo, caracterización, denegación, semana 0, informes y descarga. La regresión de informes comprobó red, reintento, alcance y descargas. A 390 px se verificaron controles de al menos 44 px y texto ampliado al 200 % en los formularios. Queda pendiente una revisión con lector de pantalla y el control nativo de zoom.

Para repetir el recorrido y guardar capturas en una carpeta de trabajo:

```bash
ASSESSMENT_CAPTURE_DIR=/tmp/ls101-capturas TMPDIR=/tmp npm --prefix backend test -- --assessments-browser
```

Configura Brave y Playwright como en [Pruebas de Fase 10](../PRUEBAS.md). El ejecutor arranca y detiene su propio clúster PostgreSQL.
