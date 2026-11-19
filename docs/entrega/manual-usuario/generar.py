"""Compone e imprime el manual de usuario mediante los recursos del repositorio."""
from html import escape
import json
from pathlib import Path
import re
from string import Template
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image

BASE = Path(__file__).resolve().parent
ENTREGA = BASE.parent
REPO = ENTREGA.parent.parent
SALIDA = ENTREGA / "LuchaSegura_Manual_de_Usuario.pdf"
IMAGEN = re.compile(r'<p><img src="([^"]+)" alt="([^"]*)"\s*/?></p>')
ENLACE = re.compile(r'href="#([^"]+)"')


def preparar_imagenes(destino):
    archivos = {}
    for clave, (origen, caja) in json.loads((BASE / "recortes.json").read_text()).items():
        ruta = ENTREGA / "capturas" / (origen if origen.endswith(".png") else f"{origen}.png")
        with Image.open(ruta) as imagen:
            ancho, alto = imagen.size
            limites = tuple(round(factor * medida) for factor, medida in zip(caja, (ancho, alto) * 2))
            salida = destino / f"{clave}.png"
            imagen.crop(limites).save(salida)
            archivos[clave] = salida.as_uri()
    return archivos


def paginas(imagenes):
    hojas, indice, destinos = [], [], {"indice": 2}
    for numero, archivo in enumerate(sorted((BASE / "capitulos").glob("*.md")), 1):
        titulo, texto = archivo.read_text().split("\n", 1)
        titulo = escape(titulo.removeprefix("# "))
        temas = re.split(r'^## (.+?) \{#([a-z0-9-]+)\}(?: \[(lateral|par|historia)\])?\n',
                         texto, flags=re.M)
        if temas[0].strip() or len(temas) < 5:
            raise ValueError(f"Revisa la estructura de {archivo}")
        enlaces = []
        for inicio in range(1, len(temas), 4):
            nombre, id_tema, diseno, fuente = temas[inicio:inicio + 4]
            if id_tema in destinos:
                raise ValueError(f"Tema duplicado: {id_tema}")
            pagina = len(hojas) + 3
            destinos[id_tema] = pagina
            contenido = subprocess.run(["md2html", "--gfm"], input=fuente, check=True,
                                       capture_output=True, text=True).stdout
            figuras = []

            def figura(coincidencia):
                clave, leyenda = coincidencia.groups()
                figuras.append(f'<figure><img src="{imagenes[clave]}" alt="{leyenda}">'
                               f'<figcaption>{leyenda}</figcaption></figure>')
                return ""

            if diseno in {"lateral", "par", "historia"}:
                contenido = IMAGEN.sub(figura, contenido)
                contenido = (f'<div class="{diseno}"><div class="instrucciones">{contenido}</div>'
                             f'<div class="evidencia">{"".join(figuras)}</div></div>')
            else:
                contenido = IMAGEN.sub(
                    lambda m: f'<figure><img src="{imagenes[m[1]]}" alt="{m[2]}">'
                    f'<figcaption>{m[2]}</figcaption></figure>', contenido)
            primera = inicio == 1
            cabecera = (f'<div class="chapter-number">Capítulo {numero}</div><h1>{titulo}</h1>'
                        if primera else f'<div class="chapter-number">{numero} / {titulo}</div>')
            hojas.append(
                f'<article class="sheet chapter c{numero}" id="{id_tema}"><header>{cabecera}'
                f'<h2>{escape(nombre)}</h2></header>{contenido}'
                '<p class="back"><a href="#indice">Volver al índice</a></p></article>')
            if primera:
                entrada = f'<a class="toc-title" href="#{id_tema}">{titulo}<span>{pagina:02}</span></a>'
            enlaces.append(f'<a href="#{id_tema}">{escape(nombre)}</a>')
        indice.append(f'<li>{entrada}<div>{" · ".join(enlaces)}</div></li>')
    return "".join(hojas), "".join(indice), destinos


def verificar(pdf, destinos, total):
    datos = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
    paginas_pdf = int(re.search(r"^Pages:\s+(\d+)", datos, re.M)[1])
    datos = subprocess.run(["pdfinfo", "-dests", str(pdf)], check=True,
                           capture_output=True, text=True).stdout
    encontrados = {nombre: int(num) for num, nombre in
                   re.findall(r'^\s*(\d+) \[.*?\] "([^"]+)"', datos, re.M)}
    if paginas_pdf != total or encontrados != destinos:
        diferencias = {nombre: encontrados.get(nombre) for nombre, pagina in destinos.items()
                       if encontrados.get(nombre) != pagina}
        raise RuntimeError(f"Páginas esperadas: {total}. Obtenidas: {paginas_pdf}. Destinos desplazados: {diferencias}")


def main():
    with TemporaryDirectory(prefix="ls-manual-") as temp:
        temp = Path(temp)
        imagenes = preparar_imagenes(temp)
        hojas, indice, destinos = paginas(imagenes)
        fuente = Template((BASE / "plantilla.html").read_text()).substitute(
            css=(BASE / "manual.css").as_uri(), logo=(REPO / "frontend/public/logo-mark.svg").as_uri(),
            cover=imagenes["portada"], indice=indice, pages=hojas)
        if set(ENLACE.findall(fuente)) != destinos.keys():
            raise ValueError("Los enlaces internos y sus destinos deben coincidir")
        html = temp / "manual.html"
        html.write_text(fuente)
        pdf = temp / SALIDA.name
        subprocess.run(["node", str(ENTREGA / "editorial/imprimir.mjs"), str(html), str(pdf)], check=True)
        verificar(pdf, destinos, len(destinos) + 1)
        SALIDA.write_bytes(pdf.read_bytes())
    print(SALIDA)


if __name__ == "__main__":
    main()
