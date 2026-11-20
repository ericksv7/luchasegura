# Plan de estabilización

Base confirmada: `develop` y GitHub coinciden en `1ba2a81`. El árbol inicial estaba limpio. El trabajo se realiza en `feature/cierre-integral-calidad`.

| Bloque | Criterio para avanzar |
| --- | --- |
| A · Fechas | Crear, consultar y editar antecedentes con fecha civil opcional. Verificar el límite Bogotá–UTC, compatibilidad histórica y la regresión de Brave. |
| B · Catálogo | Ensayar migraciones en una base nueva y una poblada; conservar relaciones históricas y verificar los 40 SVG. Preparar respaldo y autorización separada para operar en la base habitual. |
| C–D · Seguridad y privacidad | Verificar permisos horizontales y verticales, entradas, dependencias y datos sensibles. Validar consentimiento en servidor y registrar las decisiones institucionales pendientes. |
| E · Flujos | Ejecutar el recorrido de los cuatro perfiles, con cancelación, rechazos y reintentos. |
| F–G · Interfaz y accesibilidad | Inventariar pantallas y verificar foco, teclado, contraste, zoom, ambos temas y responsive. Conservar desplegables y acciones contextuales. |
| H–J · Correo, Excel e intervención | Comprobar recuperación con SMTP aislado, integridad de exportación, programa y catálogo. Mantener evaluaciones en consulta hasta aprobación de protocolos. |
| K–L · Resiliencia y CI | Ensayar indisponibilidad, concurrencia y restauración sintética. Automatizar checks de backend y frontend sin conexiones institucionales. |
| M–N · Entrega | Documentar el ensayo, requisitos y riesgos abiertos sin publicar ni integrar la rama automáticamente. |

Cada punto de recuperación requiere diff revisado, pruebas registradas y pendientes explícitos.
