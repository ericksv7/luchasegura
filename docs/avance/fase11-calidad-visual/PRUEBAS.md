# Pruebas de Fase 11

Entorno verificado con Angular 20.3.35, CLI 20.3.42, TypeScript 5.9.3, Node 26.13.1, npm 12.2.2, Express 4.22.3, Prisma 6.19.3, PostgreSQL 18.7, Brave 157.1.99.57 y Playwright Core 1.65.1. El frontend compila SCSS. El manifiesto y la configuración de Angular carecen de integración Tailwind.

## Cobertura

- **Inventario y matriz.** 27 rutas de página y 37 vistas contando los roles de cada una. 666 combinaciones de ruta, rol, ancho y tema y 20 comprobaciones de secciones de ficha. Los anchos fueron 320, 360, 390, 430, 768, 1024, 1280, 1440 y 1920 px. Se verificaron ventanas de 390 y 560 px de alto en la matriz.
- **Interacción.** Validación del login, visibilidad de contraseña, navegación real, selector de tema, secciones de ficha, confirmación de salida, Escape, restauración de foco y cierre de sesión de los cuatro roles. El sidebar conservó nodo, tamaño y estado durante 17 transiciones y se muestreó su visibilidad cuadro a cuadro.
- **Aserciones.** Ancho de documento, controles accesibles en regiones desplazables, etiquetas de formularios, dimensiones y colisiones de controles, separación de acciones de administración y contraste de tokens. La relación mínima observada fue 5,51:1. La comparación de contraste abarca texto principal y secundario frente a la superficie estándar.
- **Inspección directa.** Las capturas elegidas de registro, recuperación, bienestar, resumen, seguimiento, ficha de entrenador, usuarios e informe grupal se inspeccionaron en Brave. La galería reúne pares antes/después cuando documentan una corrección. [Galería](galeria/index.html)

## Regresión funcional

| Verificación | Ejecución |
|---|---|
| Typechecks Angular | `tsc --noEmit -p tsconfig.app.json` y `tsc --noEmit -p tsconfig.spec.json`, correctos |
| Matriz final de Brave | `VISUAL_MODE=full`, 686 comprobaciones, 17 transiciones y cero incidencias detectadas |
| Comparación de imágenes | `VISUAL_MODE=reference`, 9/9 dentro de tolerancia, RMSE máximo 0,0000181 frente a 0,025 |
| Angular | `npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless`, 57/57 |
| API de informes | `TMPDIR=/tmp npm --prefix backend test -- --reports-only`, 10/10 |
| Brave de informes | `--reports-browser`, navegación, error de red, permisos, revocación y descargas aprobados |
| Brave integral existente | `--browser-only`, recorridos funcionales de cuatro roles, alertas, biblioteca, bienestar, sueño, encuestas y exportación aprobados |
| Brave de evaluaciones | `--assessments-browser`, FMS, LESS, semana 0, lesiones, comparación e informe en Excel aprobados |

Las pruebas de navegador y API usaron bases desechables en loopback. La regresión de evaluaciones comprobó guardado y correcciones. El build de producción pasó con 498,73 kB iniciales frente al aviso presupuestario de 500 kB. La línea base medía 498,43 kB. Se conserva el aviso CommonJS de SweetAlert2.

## Límites

La matriz comprueba las vistas iniciales y las interacciones indicadas. Quedan fuera una inspección con lector de pantalla, dispositivos físicos, los extremos de todos los campos y las respuestas tardías de cada operación. El restablecimiento por correo se abrió en estado de enlace inválido en esta matriz. Una primera comparación detectó que el orden de usuarios variaba por las marcas simultáneas de las fixtures. Se asignaron marcas distintas a las cuentas sintéticas. La comparación final de regresión usa nueve vistas estabilizadas y el resto de la matriz utiliza aserciones de DOM. El detalle de los campos y acciones iniciales está en el [inventario](INVENTARIO.md).
