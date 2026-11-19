"""Compone un único PDF maestro a partir de los capítulos Markdown."""
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

EDITORIAL = Path(__file__).resolve().parent
ENTREGA = EDITORIAL.parent
REPO = ENTREGA.parent.parent
PARTES = json.loads((EDITORIAL / "partes.json").read_text())
ROMANOS = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")
ARCHIVOS = [nombre for _, capitulos in PARTES for nombre in capitulos]
TITULOS = {
    nombre: (ENTREGA / f"{nombre}.md").read_text().splitlines()[0].removeprefix("# ")
    for nombre in ARCHIVOS
}
PDF = ENTREGA / "LuchaSegura_Documentacion_Integral.pdf"

def ejecutar(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def recurso(path):
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    return html.escape(path.as_uri(), quote=True)

def transformar(nombre):
    texto = (ENTREGA / f"{nombre}.md").read_text()
    diagramas = iter(sorted((ENTREGA / "diagramas").glob(f"{nombre[:2]}-*.svg")))
    def diagrama(_):
        return f"![]({next(diagramas).relative_to(ENTREGA).as_posix()})"
    texto = re.sub(r"^```mermaid\n.*?^```[ \t]*$", diagrama, texto, flags=re.M | re.S)
    fragmento = ejecutar("md2html", "--gfm", input=texto, text=True, capture_output=True).stdout
    fragmento = re.sub(r"<(/?)h([1-5])>", lambda m: f"<{m[1]}h{int(m[2])+1}>", fragmento)
    figura = re.compile(r'<p><img src="([^"]+)" alt="([^"]*)"\s*/?></p>')
    def imagen(match):
        src, caption = match.groups()
        path = ENTREGA / unquote(html.unescape(src))
        if not path.is_file():
            raise FileNotFoundError(path)
        tipo = ' class="diagram"' if path.suffix == ".svg" else ""
        leyenda = f"<figcaption>{caption}</figcaption>" if caption else ""
        return f'<figure{tipo}><img src="{recurso(path)}" alt="{caption}">{leyenda}</figure>'
    fragmento = figura.sub(imagen, fragmento)
    def enlace(match):
        href, label = match.groups()
        url = urlsplit(html.unescape(href))
        if url.scheme or not url.path:
            return match[0]
        target = (ENTREGA / unquote(url.path)).resolve()
        if target.parent == ENTREGA and target.stem in ARCHIVOS:
            return f'<a href="#{target.stem}">{label}</a>'
        titulo = html.escape(str(target.relative_to(REPO)), quote=True)
        return f'<span class="reference" title="{titulo}">{label}</span>'
    return re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>', enlace, fragmento, flags=re.S)

def componer(paginas):
    grupos, partes = [], []
    for numeral, (titulo, nombres) in zip(ROMANOS, PARTES, strict=True):
        ancla = f"parte-{numeral}"
        etiqueta = f"{numeral}. {html.escape(titulo)}"
        accesos = " · ".join(f'<a href="#{nombre}">{html.escape(TITULOS[nombre])}</a>' for nombre in nombres)
        grupos.append(f'<div class="group"><a href="#{ancla}">{etiqueta}'
                      f'<span class="page-number">{paginas.get(ancla, )}</span></a><p>{accesos}</p></div>')
        capitulos = [
            f'<article class="chapter" id="{nombre}">{transformar(nombre)}'
            '<p class="back"><a href="#indice">Volver al índice general</a></p></article>'
            for nombre in nombres
        ]
        partes.append(
            f'<section class="part" id="{ancla}"><header><div class="eyebrow">Parte {numeral}</div>'
            f'<h1>{html.escape(titulo)}</h1></header>{"".join(capitulos)}</section>'
        )
    logo = recurso(REPO / "frontend/public/logo-mark.svg")
    css = recurso(EDITORIAL / "impresion.css")
    return f"""<!doctype html>
<html lang="es"><meta charset="utf-8"><title>LuchaSegura · Documentación integral</title>
<link rel="stylesheet" href="{css}">
<body>
  <section class="cover">
    <img src="{logo}" alt="Escudo de LuchaSegura">
    <div class="eyebrow">Documentación integral</div>
    <h1>LuchaSegura</h1>
    <div class="subtitle">Plataforma de seguimiento preventivo en lucha libre olímpica</div>
    <div class="details">Manual de uso, documentación técnica y presentación académica<br>Fase 6 · Noviembre de 2026</div>
  </section>
  <nav class="toc" aria-label="Índice general">
    <h1 id="indice">Índice general</h1>
    {"".join(grupos)}
  </nav>
  <main>{"".join(partes)}</main>
</body></html>"""

def destinos(pdf):
    reporte = ejecutar("pdfinfo", "-dests", str(pdf), text=True, capture_output=True).stdout
    return {nombre: int(pagina) for pagina, nombre in
            re.findall(r'^\s*(\d+) \[.*?\] "([^"]+)"', reporte, re.M)}

def main():
    with tempfile.TemporaryDirectory(prefix="ls-editorial-") as tmp:
        maestro = Path(tmp) / "maestro.html"
        salida = Path(tmp) / PDF.name
        paginas = {}
        for _ in range(3):
            maestro.write_text(componer(paginas))
            ejecutar("node", str(EDITORIAL / "imprimir.mjs"), str(maestro), str(salida))
            nuevas = destinos(salida)
            requeridos = {"indice", *ARCHIVOS, *(f"parte-{n}" for n in ROMANOS)}
            if requeridos - nuevas.keys():
                raise RuntimeError(f"Faltan destinos: {requeridos - nuevas.keys()}")
            if paginas == nuevas:
                break
            paginas = nuevas
        else:
            raise RuntimeError("La paginación del índice no se estabilizó")
        if not salida.read_bytes().startswith(b"%PDF-"):
            raise RuntimeError("Salida PDF inválida")
        PDF.write_bytes(salida.read_bytes())
    print(PDF)

if __name__ == "__main__":
    main()
