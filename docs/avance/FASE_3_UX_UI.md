# Fase 3 · Experiencia de usuario e interfaz

Se conservaron la tipografía, la navegación por roles, las tarjetas, los formularios y los componentes de LuchaSegura. Los cambios se hicieron en la presentación y las interacciones de Angular. Los contratos de API, el esquema de PostgreSQL y las reglas clínicas se mantuvieron.

## Cambios y evidencia

| Rol | Pantalla o componente | Estado | Cambio | Evidencia |
| --- | --- | --- | --- | --- |
| Todos | Navegación y acciones | Verificado | Sección activa visible también en móvil. Editar, Eliminar, Activar y Desactivar comparten la transición y los estilos de foco. En táctil mantienen el nombre visible y el área mínima de 44 px. | Brave comprueba expansión, foco, activación, desactivación y edición con toque. |
| Fisioterapeuta | Resumen y alertas | Verificado | Agenda agrupada en vencidos, con fecha próxima y sin fecha. Se muestran hasta dos registros por grupo y un acceso a la lista completa. Se unificaron accesos repetidos a filtros de alertas. | Brave prueba estados de 0, 1 y 8 registros con datos sintéticos y verifica un vencimiento real en PostgreSQL aislado. |
| Fisioterapeuta | Deportistas, ficha y revisiones | Verificado | Acceso «Ver ficha» visible, recuento de resultados y salida de filtros vacíos. Historial con fecha, autor, estado anterior y estado resultante. | Brave recorre las cinco secciones, verifica la consulta del historial y el registro de actuaciones. |
| Fisioterapeuta | Programa y ejercicios | Verificado | Accesos a sesiones y asignaciones individuales que desplazan el foco y conservan la sección de la ficha. La semana, las sesiones y el detalle de cada ejercicio mantienen su separación. | Brave guarda el inicio, verifica avance y asignación, y conserva borradores entre pestañas. |
| Fisioterapeuta | Biblioteca, evaluaciones y umbrales | Verificado | La cuadrícula mantiene el ancho de las tarjetas al filtrar. En escritorio, los iconos de cada pie quedan juntos y se expanden hacia fuera. Evaluaciones explica la consulta y la limitación académica. | Brave verifica geometría relativa, foco, detalle, edición y archivo. La suite carga mediciones sintéticas persistidas y comprueba umbrales. |
| Deportista | Inicio, plan y progreso | Verificado | Se priorizan próxima sesión y acciones frecuentes. El plan muestra sesiones, luego asignaciones individuales y finalmente cuidados. | Brave comprueba navegación, progreso tras recarga, asignaciones y error de guardado. |
| Deportista | Perfil, antecedentes y molestias | Verificado | Campos obligatorios identificados, errores asociados a campos numéricos y controles nativos de intensidad con flechas. Se corrigió el desbordamiento de antecedentes a 320 px. | Brave comprueba teclado, reintentos, registro y edición. |
| Administrador | Usuarios y asignaciones | Verificado | Recuento visible, filtros restablecibles, nombres largos legibles y explicación del guardado al seleccionar entrenador. | Brave prueba alta, edición, cambio de estado, confirmación y asignación. |
| Entrenador | Resumen y ficha | Verificado | Orientación a deportistas asignados, entrada visible a la ficha y acceso al programa como consulta. | Brave comprueba menú, resumen, ficha, programa y ausencia de controles profesionales. |

## Verificación

- Typecheck de la aplicación y las pruebas Angular, compilación de producción, 18 pruebas unitarias y 22 de API con PostgreSQL aislado.
- Brave en 320, 375, 390, 430, 768, 1024, 1280 y 1440 px, en claro y oscuro. Se comprobaron 304 combinaciones de pantalla, ancho y tema en la ficha, los módulos de fisioterapia y las vistas de los demás roles. Se midió el desbordamiento horizontal y se probaron controles específicos de teclado, foco y toque emulado.
- Se comprobó la transición circular desde el botón de tema y su omisión con movimiento reducido. El recorrido de alertas verificó skeletons, animación de entrada y navegación.
- Se ajustaron los colores de texto que acompañan fondos suaves de error, advertencia y activación. En los tres colores ajustados, las combinaciones de texto y fondo suave van de 4,93:1 a 7,28:1 en los dos temas. La medición se limitó a esos pares.

## Capturas

El recorrido visual se puede repetir con `npm --prefix backend test -- --browser-only` después de compilar ambos proyectos. Las capturas se generan con `UX_CAPTURE_DIR` en la suite de navegador y usan cuentas y registros sintéticos en PostgreSQL aislado. La carpeta [capturas de la fase](./capturas-fase-3/) reúne una selección representativa.

## Pendientes

La captura de evaluaciones sigue sujeta a validación académica. La verificación visual usó Brave y dispositivos emulados. Quedan pendientes los dispositivos físicos, otros motores y una evaluación formal de accesibilidad.
