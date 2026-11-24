# Fase 11 · Calidad visual integral

Rama `feature/fase11-calidad-visual-integral` basada en `15d8377` de Fase 10.1. El orden de integración es Fase 9, Fase 10 con Fase 10.1 y Fase 11.

- [Galería local](galeria/index.html)
- [Inventario generado](INVENTARIO.md)
- [Hallazgos](HALLAZGOS.md)
- [Pruebas](PRUEBAS.md)

## Ejecutar

Desde la raíz del repositorio, con las dependencias principales y Prisma Client listos según la [guía de instalación](../../entrega-academica/INSTALACION.md):

```bash
npm install --prefix "$PWD/.angular/visual-tools" --no-save --package-lock=false --ignore-scripts playwright-core@1.65.1
npm --prefix frontend run build
TMPDIR=/tmp npm --prefix backend run qa:visual
TMPDIR=/tmp VISUAL_MODE=full npm --prefix backend run qa:visual
```

El ejecutor detecta Brave en `/usr/bin/brave`. Configura `BROWSER_BIN` si el ejecutable está en otra ruta. Puede reutilizar una instalación de Playwright Core mediante `PLAYWRIGHT_CORE_PATH`. La matriz usa una instancia de Brave, contextos separados por rol y un clúster temporal que el ejecutor detiene y retira. La corrida rápida visita todas las rutas en 390 y 1440 px. La completa añade siete anchos, dos alturas reducidas, secciones de ficha y recorridos de interacción.

Los resultados y las capturas se guardan en `.angular/qa-visual`. Para regenerar el inventario y la galería a partir de una corrida inspeccionada:

```bash
node backend/tests/visual/artifacts.cjs .angular/qa-visual docs/avance/fase11-calidad-visual
```

Para comparar contra una referencia completa aprobada y conservada en otro directorio, usa ImageMagick y ejecuta:

```bash
TMPDIR=/tmp VISUAL_MODE=reference VISUAL_BASELINE_DIR="$PWD/.angular/referencia-visual" \
  VISUAL_OUTPUT="$PWD/.angular/comparacion-visual" npm --prefix backend run qa:visual
```

El modo de referencia compara nueve vistas a 390 px en claro con una distancia RMSE normalizada máxima de 0,025. La comparación supone el mismo Brave, fuentes disponibles y fixtures del mismo corte civil. La galería documenta las capturas que se inspeccionaron directamente.

La demostración interactiva usa `TMPDIR=/tmp npm --prefix backend test -- --reports-demo`. Las [cuentas ficticias](../../entrega-academica/DEMOSTRACION.md) permiten recorrer los cuatro roles desde `http://127.0.0.1:4288/login`.
