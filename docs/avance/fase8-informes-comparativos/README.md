# Fase 8 · Informes comparativos

El informe del programa consulta los registros existentes por intervención. Incluye participación, comparación descriptiva de evaluaciones, molestias y seguimiento, bienestar y encuestas autorizadas. El informe grupal demuestra agregaciones de cobertura y participación con fixtures sintéticas. Ambos generan Excel a partir de los mismos datos autorizados que la vista.

## Demostración local

Desde la raíz, con Node, dependencias instaladas y herramientas PostgreSQL locales:

```bash
npm --prefix frontend run build -- --configuration production
npm --prefix backend test -- --reports-demo
```

Abre `http://127.0.0.1:4288/login`. El ejecutor imprime la ruta exacta de la ficha sintética. Todas las cuentas usan la contraseña ficticia `Informes-sinteticos1`. Cada ejecución crea un clúster nuevo en `/tmp`. Ctrl+C detiene la API y el clúster. La demostración persistente de Fase 7 es independiente.

| Cuenta sintética | Recorrido |
|---|---|
| `completa-fase8@example.test` | Mi progreso → Ver informe del programa. Compara el ciclo actual y el histórico, consulta Excel y encuestas presentadas |
| `parcial-fase8@example.test` | Mismo informe con evaluación inicial, adherencia cero y registros pendientes |
| `sin-intervencion-fase8@example.test` | Mismo informe con estado vacío |
| `fisioterapia-fase8@example.test` | Resumen → Informe grupal. Equipo → Deportistas → ficha de completa sintética → Evaluaciones → Informe del programa |
| `sin-alcance-fase8@example.test` | La URL directa del informe individual se deniega. El agregado de demostración no incluye personas fuera de su alcance |
| `entrenador-fase8@example.test` | Conserva su panel y los deportistas asignados. La ruta de informes clínicos no concede acceso |
| `administracion-fase8@example.test` | Conserva la administración de usuarios y asignaciones |

Rutas de Angular: `/deportista/progreso/informe`, `/equipo/deportistas/:id/informe` y `/equipo/informes-programa`. La selección individual se conserva en la URL. Los endpoints `/api/program-reports/me`, `/api/program-reports/athletes/:id` y `/api/program-reports/group` tienen variantes `.xlsx`.

Las consultas de fisioterapia requieren atención documentada según el alcance existente de Bienestar. Administradores y entrenadores quedan fuera de los endpoints de informes clínicos. Las respuestas privadas llevan `no-store`. Los informes revalidan permisos y consentimiento en cada consulta y descarga. La vista retira los datos previos al volver a la ventana, al cambiar de intervención y al reintentar. Mientras se mantiene abierta, revalida cada 30 segundos y retira los resultados si el servidor rechaza o no confirma la consulta. El Excel individual omite nombre, identificadores, datos de contacto y notas privadas. Conserva datos de salud, por lo que su manejo sigue sujeto a los permisos y condiciones de privacidad aplicables.

Consulta [Datos y métricas](DATOS_Y_METRICAS.md), [Pruebas](PRUEBAS.md) y [Pendientes](PENDIENTES.md).

Consulta el [sistema de diseño y los ejemplos Excel](EXCEL.md).
