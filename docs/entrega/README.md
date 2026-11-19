# Entrega integral de LuchaSegura

El documento de presentación es [LuchaSegura_Documentacion_Integral.pdf](LuchaSegura_Documentacion_Integral.pdf). El PDF reúne diez partes y los siguientes 19 capítulos editables.

| Parte | Capítulos fuente |
| --- | --- |
| I · Presentación | [Informe general](01_INFORME_GENERAL.md) |
| II · Introducción | [Acceso y navegación](02_MANUAL_DE_USUARIO.md) |
| III · Manuales | [Administrador](12_ADMINISTRADOR.md), [fisioterapeuta](13_FISIOTERAPEUTA.md), [deportista](14_DEPORTISTA.md), [entrenador](15_ENTRENADOR.md) |
| IV · Procesos | [Diagramas](03_DIAGRAMAS_DE_FLUJO.md), [Excel y recuperación](16_REPORTES_Y_RECUPERACION.md) |
| V · Fundamentos | [Trazabilidad académica e instrumentos](17_FUNDAMENTOS_ACADEMICOS.md) |
| VI · Documentación técnica | [Arquitectura](04_ARQUITECTURA_TECNICA.md), [modelo de datos](05_MODELO_DE_DATOS.md) |
| VII · Operación | [Instalación](08_INSTALACION_Y_EJECUCION.md), [despliegue, respaldo y mantenimiento](09_PREPARACION_DESPLIEGUE.md) |
| VIII · Seguridad y calidad | [Pruebas y permisos](07_PRUEBAS_Y_RESULTADOS.md), [limitaciones](10_LIMITACIONES_Y_PENDIENTES.md) |
| IX · Presentación y valor | [Demostración y valoración](11_RESUMEN_PARA_PRESENTACION.md) |
| X · Anexos | [Inventarios técnicos](18_INVENTARIOS_TECNICOS.md), [matriz de cobertura](06_MATRIZ_DE_REQUISITOS.md), [glosario y referencias](19_GLOSARIO_Y_REFERENCIAS.md) |

## Regenerar el PDF

Instala Python 3.10 o posterior, Node.js 20 o posterior, `md2html` de MD4C, `pdfinfo` de Poppler, Brave o Chromium reciente y la familia Noto Sans. Desde la raíz, ejecuta:

```sh
python docs/entrega/editorial/generar.py
```

El orden está en `editorial/partes.json` y el diseño en `editorial/impresion.css`. La fuente maestra HTML se compone a partir de los Markdown, en un directorio temporal. La generación se detiene si falta un recurso o un destino del índice. Usa `BROWSER_BIN` para indicar otro ejecutable Chromium. Con el mismo entorno y recursos, el diseño y la paginación son reproducibles. Los metadatos de fecha del PDF corresponden a la ejecución.

Los SVG de los capítulos de flujos, arquitectura y datos se vinculan en orden de aparición con los bloques Mermaid. Si cambias un bloque, actualiza su SVG homólogo. El flujo de recuperación usa Graphviz:

```sh
dot -Tsvg docs/entrega/diagramas/16-01.dot -o docs/entrega/diagramas/16-01.svg
```

## Regenerar capturas de navegación

Con las dependencias del proyecto instaladas, usa desde la raíz:

```sh
npm --prefix backend run build
npm --prefix frontend run build -- --configuration development
bash docs/entrega/editorial/capturar.sh
```

El script requiere Brave y binarios PostgreSQL en `PATH`. Levanta un clúster y una aplicación temporales en bucle local, aplica las migraciones y utiliza identidades ficticias. Puedes configurar los puertos con `LS_CAPTURE_PG_PORT` y `LS_CAPTURE_PORT`. Las capturas históricas de Excel y seguimiento se conservan como evidencias de detalle de los informes en `docs/avance/`.
