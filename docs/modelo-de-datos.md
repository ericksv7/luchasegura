# Modelo de datos

La fuente de verdad es [backend/prisma/schema.prisma](../backend/prisma/schema.prisma). Resumen:

| Entidad | Módulo | Descripción |
| --- | --- | --- |
| User | Todos | Cuenta de acceso con rol (ATHLETE, COACH, PHYSIO, ADMIN) |
| Consent | 1 | Consentimiento informado: versión del texto, acudiente y fecha |
| Athlete | 1 | Perfil: fecha de nacimiento, peso, categoría, estilo, experiencia y entrenador asignado |
| Injury | 2 | Antecedente o molestia: zona, tipo, intensidad 0 a 10, mecanismo, limitación, días de ausencia |
| AlertRule | 2 | Umbral de alerta configurable (lo define el fisioterapeuta) |
| Alert | 2 | Aviso generado cuando una molestia supera el umbral |
| Program, ProgramSession, Exercise, SessionExercise | 3 | Programa preventivo, sesiones por semana y ejercicios |
| CompletedSession | 4 | Sesión que el deportista marcó como completada |
| FunctionalTest | 4 | Resultado de una prueba funcional en fase inicial o final |

## Cómo cambiar el modelo

1. Edita `schema.prisma`.
2. Ejecuta `npx prisma migrate dev --name descripcion_del_cambio`.
3. Sube la carpeta `prisma/migrations` al repositorio.
