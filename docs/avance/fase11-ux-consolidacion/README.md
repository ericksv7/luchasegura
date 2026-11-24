# Fase 11.2 · Consolidación de experiencia

Rama `feature/fase11-ux-consolidacion` basada en `3fa769f` de Fase 11. Integra Fase 11 antes de esta rama. [Galería antes/después](galeria.html)

## Reglas visuales

| Intención | Patrón |
|---|---|
| Navegar | Enlace, pestaña o elemento de menú. Las consultas de una evaluación se muestran como enlaces junto a sus registros |
| Acción principal | `.btn` verde sólido. Crear o registrar en la vista y guardar en el formulario tienen la prioridad de su contexto |
| Acción secundaria | `.btn.secondary` con borde. Sirve para exportar o elegir opciones complementarias |
| Acción contextual | `.btn.tertiary` sin fondo en reposo. Se usa para cancelar, corregir o consultar el historial. Las acciones de fila con icono conservan texto accesible y foco |
| Acción destructiva | `.btn.danger` para confirmar. El icono de eliminar usa el color semántico de peligro |
| Formulario | Campos y ayudas en orden de trabajo. `.form-actions` reúne las acciones al final y admite salto de línea en móvil |

## Componentes y cambios

- **Ficha profesional y de entrenador.** Cumplimiento y pendientes comparten superficie, con los datos generales como bloque secundario. Los accesos a informe y encuestas se agrupan junto a Evaluaciones para fisioterapia. Se conservan los alcances de cada rol.
- **Evaluaciones.** El encabezado distingue el registro nuevo de las consultas. LESS agrupa los ítems por fase del aterrizaje dentro de cada intento y usa dos columnas cuando hay anchura suficiente. Se conserva el índice y el significado de cada puntuación. En el piloto, el selector corto recortaba «Pendiente». El ancho final se comprobó a 390 px.
- **Usuarios.** Una superficie con divisores reemplaza las tarjetas repetidas. «Nuevo usuario» tiene prioridad en el encabezado y las acciones de cada fila quedan subordinadas.
- **Formularios y confirmaciones.** Administración, bienestar, perfil, lesiones, evaluaciones y ejercicios reutilizan el mismo tratamiento para cancelar. El diálogo compartido conserva la confirmación como acción principal y el foco de seguridad de las operaciones destructivas.

## Repetir la comprobación

Desde la raíz, con Brave y Playwright Core configurados como en [Fase 11](../fase11-calidad-visual/README.md):

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.app.json
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.spec.json
npm --prefix frontend run build
CHROME_BIN=/usr/bin/brave npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
TMPDIR=/tmp VISUAL_MODE=full npm --prefix backend run qa:visual
TMPDIR=/tmp PLAYWRIGHT_CORE_PATH="$PWD/.angular/visual-tools/node_modules/playwright-core" npm --prefix backend test -- --assessments-browser
```

Las referencias de Fase 11 se conservan. Las capturas de esta fase se documentan por separado. Las comprobaciones usan PostgreSQL temporal y datos sintéticos.

## Resultados

- Typecheck de aplicación y pruebas correcto. Angular ejecutó 57 pruebas con éxito. El build de producción quedó en 499,10 kB de carga inicial frente al presupuesto de 500 kB.
- La auditoría completa en Brave recorrió 27 rutas, 37 vistas por rol, 686 comprobaciones de layout y 17 transiciones sin incidencias. Incluyó acceso público y los cuatro roles, claro y oscuro a 320, 360, 390, 430, 768, 1024, 1280, 1440 y 1920 px. Probó validación, nombre largo y cancelación en el formulario de alta de usuarios.
- La regresión focalizada comprobó guardado y correcciones de FMS, LESS, lesiones y semana 0, las comparaciones, la descarga Excel y el 404 protegido para una cuenta fuera de alcance. También comprobó que el botón de guardar queda deshabilitado mientras espera la respuesta y que se ven los 17 controles de un intento LESS, con «Pendiente» completo a 390 px.
- La comparación puntual a 390 px en claro dio RMSE normalizado de 0 en registro, recuperación, inicio de bienestar, informe grupal y seguimiento de alerta.
- La galería recoge la inspección directa de la ficha, el listado de usuarios y LESS. Los cambios intencionales se documentan con pares antes/después.

## Límites

La inspección visual directa se concentró en las vistas con cambios de jerarquía. La matriz automatizada recorre las rutas restantes. La evaluación con lector de pantalla y en dispositivos físicos continúa pendiente.
