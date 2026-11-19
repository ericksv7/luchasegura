# Glosario, fuentes y evidencia

## Glosario

| Término | Significado en LuchaSegura |
| --- | --- |
| Antecedente | Episodio histórico registrado por el deportista. |
| Molestia | Reporte actual, susceptible de generar alerta si cumple una regla. |
| Alerta | Registro derivado que facilita la priorización y actuación profesional. |
| Seguimiento | Actuación profesional posterior almacenada en el mismo historial. |
| Adherencia | Relación entre sesiones declaradas y sesiones previstas hasta la semana activa. |
| Fecha civil | Día del calendario expresado sin hora; el programa usa referencia de Bogotá. |
| Seudonimización | Sustitución de identificadores y reducción de campos de exposición. |
| JWT | Credencial firmada para autorizar una sesión web. |
| SMTP | Protocolo de transferencia de correo utilizado por Nodemailer. |
| Prisma | Capa de acceso tipado a PostgreSQL y herramienta de migraciones. |
| Idempotencia | Propiedad que permite repetir una solicitud reconocida sin duplicar su efecto. |
| TLS | Protección criptográfica de una conexión en tránsito. |

## Fuentes del proyecto

- Cruz, N., Martínez, N. y López, A. *Proyecto Deporte de Lucha Libre Olímpica*. Universidad del Rosario e IDRD. PDF fuente ubicado en `docs/referencias/`. Se consultaron objetivos, metodología, instrumentos y procedimiento.
- Repositorio LuchaSegura. `frontend/src/app/app.routes.ts`, componentes de rol, rutas de Express, servicios de dominio, esquema Prisma y seis migraciones. La [referencia técnica](18_INVENTARIOS_TECNICOS.md) contiene el inventario de implementación.
- Informes de evolución y verificación en `docs/avance/`. Fases 2 a 5, mejora de desplegables y recuperación de correo real. El directorio `docs/claude-handoff/` contiene análisis históricos revisados frente al código vigente.
- Evidencias sintéticas de Excel en `docs/avance/evidencias-fase-4/`. Dos libros con modos identificable y seudonimizado. La carpeta `docs/entrega/capturas/` conserva las imágenes de navegación y los recortes de acciones verificadas.

## Trazabilidad de la entrega

Las capturas nuevas se tomaron con la compilación Angular de desarrollo, backend compilado y PostgreSQL temporal migrado en Brave. Algunas capturas de detalle sobre Excel y actuaciones provienen de pruebas previas del mismo repositorio. El formulario de nueva contraseña se capturó con un token sintético sembrado para documentar la pantalla. Sus datos son ficticios. La [matriz de requisitos](06_MATRIZ_DE_REQUISITOS.md) relaciona funciones y evidencia y los [resultados](07_PRUEBAS_Y_RESULTADOS.md) distinguen las ejecuciones.

El índice editable y las instrucciones de regeneración están en `docs/entrega/README.md`.
