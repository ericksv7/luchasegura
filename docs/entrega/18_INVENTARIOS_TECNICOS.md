# Referencia de rutas y diccionario de datos

## API REST

**Acceso** P = público, S = sesión autenticada, A = administración, D = deportista, F = fisioterapia, C = entrenador. FC admite ambos perfiles. El alcance por propietario o asignación se verifica donde la operación maneja datos de deportistas. Las rutas relativas se publican bajo el prefijo correspondiente.

| Método y ruta | Acceso | Operación |
| --- | --- | --- |
| `GET /api/health` | P | Estado de API y PostgreSQL |
| `POST /api/auth/register` | P | Registro de deportista |
| `POST /api/auth/login` | P | Ingreso |
| `GET /api/auth/me` | S | Sesión y perfil de cuenta |
| `POST /api/auth/change-password` | S | Cambio con contraseña actual |
| `POST /api/auth/forgot-password` | P | Solicitar correo |
| `GET /api/auth/reset-password/check` | P | Comprobar token |
| `POST /api/auth/reset-password` | P | Consumir enlace |
| `GET /api/athletes/me` | D | Perfil propio |
| `PUT /api/athletes/me` | D | Actualizar perfil |
| `GET /api/athletes` | FC | Listar deportistas del alcance |
| `POST /api/injuries` | D | Crear reporte o antecedente |
| `PATCH /api/injuries/:id/history` | D | Editar antecedente propio |
| `GET /api/injuries/mine` | D | Consultar registros propios |
| `DELETE /api/injuries/:id` | D | Eliminar registro elegible |
| `GET /api/program/current` | D | Consultar plan vigente |
| `POST /api/program/sessions/:id/toggle` | D | Guardar estado de sesión propia |
| `GET /api/team/alerts` | F | Listar alertas por estado |
| `GET /api/team/alerts/counts` | F | Consultar contadores |
| `GET /api/team/alerts/:id` | F | Consultar detalle e historial |
| `POST /api/team/alerts/:id/review` | F | Registrar inicio, revisión, seguimiento o reapertura |
| `GET /api/team/overview` | FC | Resumen del equipo |
| `PATCH /api/team/athletes/:id/program-start` | F | Guardar inicio del programa |
| `GET /api/team/athletes/:id/evaluations` | F | Consultar evaluaciones |
| `GET /api/team/athletes/:id` | FC | Consultar ficha filtrada por rol |
| `GET /api/team/export` | F | Exportar XLSX |
| `GET /api/admin/users` | A | Listar cuentas |
| `POST /api/admin/users` | A | Crear personal |
| `PATCH /api/admin/users/:id` | A | Actualizar cuenta |
| `PATCH /api/admin/athletes/:id/coach` | A | Asignar entrenador |
| `DELETE /api/admin/users/:id` | A | Eliminar cuenta elegible |
| `GET /api/rules` | FC | Consultar reglas |
| `POST /api/rules` | F | Crear o actualizar umbral |
| `DELETE /api/rules/:id` | F | Eliminar regla |
| `GET /api/exercises/mine` | D | Ejercicios asignados propios |
| `GET /api/exercises/athlete/:athleteId` | FC | Asignaciones del deportista |
| `POST /api/exercises/assignments` | F | Asignar ejercicio |
| `DELETE /api/exercises/assignments/:id` | F | Retirar asignación |
| `GET /api/exercises` | FC | Consultar catálogo |
| `POST /api/exercises` | F | Crear ejercicio |
| `PATCH /api/exercises/:id` | F | Editar ejercicio |
| `DELETE /api/exercises/:id` | F | Eliminar o archivar ejercicio |

Inventario de 42 operaciones, contrastado con `backend/src/app.ts` y el registro de rutas. Los errores se devuelven como JSON con mensaje público. Los estados comunes incluyen 400 para validación, 401 para sesión, 403 para permiso, 404 para recurso, 409 para conflicto, 429 para límites y 503 para servicio temporalmente no disponible. La descarga exitosa devuelve XLSX.

## Rutas activas de Angular

| Área | Rutas y pantallas |
| --- | --- |
| Pública | `/login`, `/registro`, `/olvide-contrasena`, `/restablecer`. |
| Sesión autenticada | `/cambiar-contrasena`. |
| Administración | `/admin`, `/admin/asignaciones`. |
| Deportista | `/deportista`, `/deportista/reportar`, `/deportista/plan`, `/deportista/progreso`, `/deportista/perfil`. |
| Equipo | `/equipo`, `/equipo/alertas`, `/equipo/deportistas`, `/equipo/deportistas/:id`, `/equipo/ejercicios`. |
| Fisioterapia | `/equipo/alertas/:id`. El menú de fisioterapia presenta `/equipo/umbrales` y la vista base de umbrales está disponible para consulta de ambos roles de equipo por URL. |
| Redirecciones | La raíz y las rutas desconocidas se dirigen a acceso. Los guards aplican autenticación y rol. |

## Campos persistidos

Se listan campos escalares y tipos Prisma. `?` indica nulabilidad. Las relaciones y restricciones se desarrollan en [Modelo de datos](05_MODELO_DE_DATOS.md).

| Modelo | Campos persistidos |
| --- | --- |
| `User` | `id` (String), `email` (String), `passwordHash` (String), `fullName` (String), `role` (Role), `active` (Boolean), `passwordChangedAt` (DateTime?), `mustChangePassword` (Boolean), `createdAt` (DateTime). |
| `Athlete` | `id` (String), `userId` (String), `coachId` (String?), `birthDate` (DateTime?), `weightKg` (Decimal?), `category` (String?), `style` (String?), `programStartedAt` (DateTime?), `yearsExperience` (Int?), `notes` (String?), `createdAt` (DateTime), `updatedAt` (DateTime). |
| `Consent` | `id` (String), `userId` (String), `textVersion` (String), `guardianName` (String?), `acceptedAt` (DateTime). |
| `Injury` | `id` (String), `athleteId` (String), `isHistory` (Boolean), `bodyZone` (String), `injuryType` (String?), `intensity` (Int?), `whenOccurs` (String?), `mechanism` (String?), `limitation` (Limitation), `daysAbsent` (Int?), `recurrent` (Boolean), `occurredAt` (DateTime), `notes` (String?), `createdAt` (DateTime). |
| `AlertRule` | `id` (String), `bodyZone` (String?), `minIntensity` (Int), `createdById` (String), `createdAt` (DateTime). |
| `Alert` | `id` (String), `injuryId` (String), `status` (AlertStatus), `version` (Int), `createdAt` (DateTime). |
| `AlertEntry` | `id` (String), `alertId` (String), `authorId` (String), `authorName` (String), `requestId` (String), `version` (Int), `kind` (AlertEntryKind), `previousStatus` (AlertStatus), `status` (AlertStatus), `observations` (String), `findings` (String?), `actionTaken` (String?), `recommendations` (String?), `followUpRequired` (Boolean), `followUpDate` (DateTime?), `referral` (String?), `createdAt` (DateTime). |
| `Program` | `id` (String), `name` (String), `weeks` (Int), `sessionsPerWeek` (Int). |
| `ProgramSession` | `id` (String), `programId` (String), `week` (Int), `number` (Int), `minutes` (Int?). |
| `Exercise` | `id` (String), `component` (String), `name` (String), `description` (String?), `dosage` (String?), `zone` (String?), `mediaUrl` (String?), `archived` (Boolean), `createdAt` (DateTime). |
| `ExerciseAssignment` | `id` (String), `athleteId` (String), `exerciseId` (String), `assignedById` (String?), `dosage` (String?), `note` (String?), `createdAt` (DateTime). |
| `SessionExercise` | `sessionId` (String), `exerciseId` (String), `position` (Int). |
| `CompletedSession` | `id` (String), `athleteId` (String), `sessionId` (String), `doneAt` (DateTime), `notes` (String?). |
| `FunctionalTest` | `id` (String), `athleteId` (String), `testType` (String), `phase` (TestPhase), `result` (Json), `measuredAt` (DateTime). |
| `PasswordResetToken` | `id` (String), `userId` (String), `tokenHash` (String), `expiresAt` (DateTime), `usedAt` (DateTime?), `createdAt` (DateTime). |

## Estados y validaciones clave

| Operación | Contrato operativo |
| --- | --- |
| Alta de molestia | Zona de 2 a 60 caracteres, intensidad entera de 0 a 10 cuando se informa, días de ausencia entre 0 y 3.650 y fecha de ocurrencia sin futuro. Una clave de solicitud opcional permite reconocer reintentos. |
| Revisión | Versión esperada no negativa. La observación y actuación tienen 2 a 4.000 caracteres al registrar una revisión. Textos opcionales de hasta 4.000 caracteres. Fecha civil opcional asociada a seguimiento. |
| Comienzo y reapertura | Identificador de solicitud y versión esperada. Reabrir requiere el motivo en observaciones. |
| Inicio del plan | Fecha civil y fecha previamente consultada. La fecha nueva debe ser compatible con el registro histórico de sesiones. |
| Exportación | `report`, `privacy`, `athleteId`, `from`, `to` y `status` según el tipo. El servidor conserva compatibilidad con `anon=1` para seudonimización. |
| Recuperación | Token de un solo uso con hash persistido y caducidad. La respuesta de solicitud conserva un mensaje público uniforme. |

La semántica detallada de los reportes y permisos está en [Procesos operativos](16_REPORTES_Y_RECUPERACION.md).
