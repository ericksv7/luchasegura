# Sistema de diseño para Excel

## Auditoría inicial

Se descargaron y reabrieron con ExcelJS tres libros del generador anterior usando las cuentas sintéticas de Fase 8. Los dos individuales contenían ocho hojas y el grupal una. Todas las columnas tenían ancho 30, prácticamente todo se presentaba como filas planas, las fechas eran cadenas y los porcentajes usaban la escala de 0 a 100 sin formato de porcentaje. No había áreas de impresión ni resumen visual. Los mismos endpoints que servían los informes JSON comprobaban permisos y consentimiento al descargar.

## Plantilla reutilizable

`backend/src/services/reporting/workbook-design.ts` concentra la paleta, Calibri, portada, bloques KPI, espacios, tablas, totales, formatos, impresión y pie numerado. Se eligió una plantilla programática con ExcelJS porque cada libro puede incluir cantidades distintas de filas y secciones opcionales. Así se controlan rangos, formatos y saltos sin mantener un binario base que deba conservarse al editarlo.

`backend/src/services/reporting/program-workbook.ts` coloca los datos del DTO autorizado en esos componentes. La ruta solo entrega el libro generado. Las cifras del backend conservan su precisión. Los porcentajes se dividen entre 100 para almacenarlos como fracción de Excel y se presentan a dos decimales. Las fechas son valores nativos de Excel. La hora de generación y de presentación se expresa en Bogotá. Los guiones indican datos ausentes o no calculables. El cero se conserva.

Las portadas imprimen en A4 vertical. Las tablas anchas usan orientación horizontal y las demás vertical. Cada hoja de detalle repite su encabezado al imprimir, se ajusta a una página de ancho y usa tantas páginas de alto como necesite. Las tablas tienen filtros, encabezados fijos y celdas independientes. Las barras neutras de adherencia comparan completadas frente al máximo semanal previsto de ese calendario. El porcentaje publicado es el del corte. El DTO no aporta porcentajes semanales ni desglose grupal por instrumento, por lo que la presentación no añade esos indicadores.

## Hojas

| Individual | Grupal |
|---|---|
| Resumen ejecutivo. Contexto, seis KPI y lectura descriptiva | Resumen grupal. Contexto, seis KPI y denominadores principales |
| Evaluaciones funcionales. Fechas, unidades, valores y cambios compatibles | Participación y adherencia. Cantidades y denominadores según la métrica |
| Adherencia. Semanas, barras y total al corte si es atribuible | Cobertura de evaluaciones. Inicial, final y pares agregados |
| Molestias y seguimiento, Bienestar, Trazabilidad, Encuestas y Respuestas comparables cuando existen datos autorizados pertinentes | Metodología. Población, fuentes y límites |
| Metodología y definiciones | |

El identificador individual usa programa y fecha de inicio. Se mantiene el rechazo de descarga cuando no hay intervención. Los libros no incluyen identidades personales, datos de contacto ni notas privadas. Los textos se escriben como cadenas, incluso cuando empiezan por un símbolo de fórmula. Tras revocar el consentimiento desaparecen las hojas de encuestas y sus respuestas. El informe grupal sigue restringido a demostración sintética aislada.

## Ejemplos sintéticos

- [Individual completo](ejemplos-excel/individual-completo.xlsx)
- [Individual parcial](ejemplos-excel/individual-parcial.xlsx)
- [Grupal sintético](ejemplos-excel/grupal-sintetico.xlsx)

Desde la raíz, con las dependencias instaladas y las herramientas PostgreSQL disponibles:

```bash
export REPORT_EXAMPLE_DIR="$PWD/docs/avance/fase8-informes-comparativos/ejemplos-excel"
npm --prefix backend test -- --reports-examples
libreoffice --calc "$REPORT_EXAMPLE_DIR/individual-completo.xlsx"
```

El comando autentica las cuentas de prueba y descarga desde la API en loopback. Crea y retira su propio PostgreSQL temporal. Las fechas se generan con relación al día de ejecución. También se puede abrir cualquiera de los tres archivos con Microsoft Excel.

## Verificación

```bash
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend test -- --reports-only
BROWSER_BIN=/usr/bin/brave PLAYWRIGHT_CORE_PATH=/ruta/a/playwright-core npm --prefix backend test -- --reports-browser
```

Las pruebas reabren los libros y cotejan el contenido con los resultados autorizados. Incluyen ausencia de intervención, permisos, revocación, grupo sintético, valores faltantes, ceros, texto largo, 60 registros, tipado, totales, encabezados, combinaciones, anchos, filtros, congelación, configuración de impresión y texto con prefijo de fórmula.

Pasaron siete casos de informes, los typechecks, el build del backend y la descarga real en Brave. LibreOffice abrió los tres libros y generó 9, 6 y 4 páginas A4 respectivamente. Se inspeccionaron las portadas, la tabla de evaluaciones, las barras, los pies y la paginación. Un cuarto libro de prueba con 60 reportes se abrió y se imprimió en 10 páginas. Su tabla de molestias ocupó cuatro páginas con encabezados repetidos, texto largo completo y prefijos de fórmula visibles como texto.
