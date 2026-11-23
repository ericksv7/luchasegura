# Verificación

La validación se hizo con PostgreSQL temporal, datos sintéticos y Brave 157. La demostración local arrancó en el puerto 4288 y se comprobó su cierre y la limpieza del clúster propio. No se usó PostgreSQL habitual.

| Verificación | Resultado local |
|---|---|
| Typecheck de aplicación y pruebas Angular. Typecheck y build del backend | Aprobados |
| Build de producción Angular | 498,13 kB iniciales frente al umbral de 500 kB. Aviso existente de SweetAlert2 en CommonJS |
| Angular en Brave Headless mediante Karma | 53 aprobadas |
| Informes en Node y PostgreSQL | 6 aprobadas. Emparejamiento, separación de intervenciones, revisión vigente, procedimiento opcional, adherencia, denominador cero, muchos reportes, roles, expiración, revocación, agregados sintéticos y exportación. El texto con apariencia de fórmula se exporta como cadena |
| Informes en Brave | 20 combinaciones de ancho y tema. Ambos informes a 320, 390, 768, 1024 y 1440 px en claro y oscuro. Teclado, recuperación de foco del selector, historial, recarga, descargas Excel, error de red y reintento, acceso denegado, ausencia de intervención y revocación |
| Regresión histórica integrada | 63 pruebas de API y SMTP aprobadas. Brave verificó los cuatro roles, alertas, evaluaciones, Inicio, Plan, Progreso, Bienestar, Sueño y encuestas |
| Navegación y renderizado del shell | 160 navegaciones muestreadas cuadro a cuadro. Pulso del sidebar de 1,12, vuelta a 1 y desplazamiento cero. Se sincronizó la prueba de tema con el fondo calculado tras observar una muestra prematura. |
| Regresión de desplegables | Aprobada en Brave. Apertura, cierre, teclado, toque, registro, Excel y geometría móvil |
| Prisma | Las 17 migraciones existentes aplicaron en aislamiento. Sin diferencias de esquema. Instalación limpia, actualización histórica y restauración sintética aprobadas |
| Git | `git diff --check` aprobado. Validaciones locales. Los nuevos pasos de CI se ejecutarán al publicar la rama |

## Repetición

Con dependencias instaladas, Brave, Playwright Core y PostgreSQL temporal disponible:

```bash
export BROWSER_BIN=/usr/bin/brave CHROME_BIN=/usr/bin/brave
export PLAYWRIGHT_CORE_PATH=/ruta/a/node_modules/playwright-core
npm --prefix frontend exec -- tsc --noEmit -p frontend/tsconfig.app.json
npm --prefix frontend exec -- tsc --noEmit -p frontend/tsconfig.spec.json
npm --prefix frontend run build -- --configuration production
npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend test -- --reports-only
REPORT_CAPTURE_DIR=/tmp/luchasegura-fase8-capturas npm --prefix backend test -- --reports-browser
npm --prefix backend test -- --availability --mail-browser --browser
DISCLOSURE_VISUAL=1 npm --prefix backend test -- --browser-only
node backend/tests/run-catalog-migrations.cjs
git diff --check
```

## Capturas inspeccionadas

- [Informe individual a 1440 px, claro](capturas/individual-1440-light.png)
- [Informe individual a 390 px, oscuro](capturas/individual-390-dark.png)
- [Informe grupal a 1440 px, claro](capturas/grupal-1440-light.png)
- [Informe grupal a 390 px, oscuro](capturas/grupal-390-dark.png)

Los resultados de las capturas son exclusivamente sintéticos. La matriz automatizada comprobó el ancho global y el encuadre de la gráfica semanal. La revisión de las capturas permitió verificar jerarquía, densidad de tarjetas, lectura de unidades, identificación del ciclo y presentación de estados sin datos.
