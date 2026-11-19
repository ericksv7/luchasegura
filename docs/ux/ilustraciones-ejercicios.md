# Ilustraciones del catálogo de ejercicios

Las demostraciones son archivos SVG independientes en `frontend/public/exercises/`. Angular los publica bajo `/exercises/`. El campo `Exercise.illustration` apunta a esa ruta para la biblioteca incluida. TypeScript carga el archivo y permite elegir entre las ilustraciones aprobadas. El formulario también conserva la compatibilidad con imágenes raster propias de ejercicios personalizados.

El generador `frontend/tools/render_exercise_art.py` reúne la geometría de cada postura, los rótulos, el equipamiento y las flechas de movimiento. La API valida las rutas locales aceptadas. Si una imagen falta o falla, se muestra un icono de categoría con el aviso «Ilustración no disponible» en la ficha.

## Sustituir una ilustración

1. Tras la revisión de fisioterapia, actualiza la postura, los rótulos y los elementos correspondientes en el generador. Cuando se trate del mismo ejercicio, conserva el nombre del SVG para reutilizar la ruta desde fichas y asignaciones.
2. Desde la raíz, ejecuta `python3 frontend/tools/render_exercise_art.py` y verifica el resultado con `python3 frontend/tools/render_exercise_art.py --check`.
3. Abre la ficha a ancho de móvil y escritorio en ambos temas. Comprueba que apoyos, articulaciones, recorrido e implementos coincidan con las instrucciones.
4. Si se crea un recurso para un ejercicio nuevo, añade su ruta al selector en `frontend/src/app/core/exercise-api.ts` y a la validación de `backend/src/routes/exercises.ts`. En el registro del ejercicio, usa la ruta `/exercises/<nombre>.svg`.

Los activos históricos siguen publicados porque los ejercicios archivados pueden aparecer en sesiones y asignaciones antiguas. Fisioterapia tiene pendiente revisar la movilidad de tobillo y decidir qué ejercicios especializados conviene reincorporar.
