# Edición y regeneración del manual de usuario

El material para distribuir es [LuchaSegura_Manual_de_Usuario.pdf](../LuchaSegura_Manual_de_Usuario.pdf). Los archivos de esta carpeta permiten editarlo y verificarlo.

## Actualizar un procedimiento

- Edita el capítulo correspondiente en `capitulos/`. Cada encabezado de segundo nivel representa una página. Su identificador entre llaves se usa en el índice y en las referencias internas.
- En un encabezado, `[lateral]` coloca instrucciones y capturas lado a lado. `[par]` y `[historia]` colocan las capturas debajo de los pasos. Sin marca, las imágenes ocupan el ancho disponible en el orden del texto.
- Para insertar una captura, usa la sintaxis Markdown de imagen y escribe como destino la clave de `recortes.json`. La leyenda también describe la imagen en el PDF.
- `recortes.json` identifica la captura original y sus cuatro límites proporcionales, en orden izquierda, arriba, derecha y abajo. Los recortes se generan temporalmente a partir de las capturas sintéticas de la Fase 6 y sus evidencias previas. El escudo procede de la aplicación.
- Edita `plantilla.html` para cambios de estructura y `manual.css` para cambios visuales. El manual reutiliza el impresor de la Fase 6.

## Regenerar

Desde la raíz del proyecto, con Python 3.10 o posterior y Pillow, Node.js 20 o posterior, MD4C `md2html`, Poppler `pdfinfo`, Noto Sans y Brave o Chromium reciente:

```sh
python docs/entrega/manual-usuario/generar.py
```

Si es necesario, indica el ejecutable de Brave o Chromium en `BROWSER_BIN`. El script verifica la cantidad de páginas y los destinos internos antes de escribir el PDF. Después de editar, revisa visualmente las páginas que cambiaron y actualiza el [control de calidad](CONTROL_DE_CALIDAD.md).
