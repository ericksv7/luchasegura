# Autorización de la API

Las rutas siguientes se verifican sin credencial, con una sesión revocada y desde cada rol excluido. Las pruebas positivas y de pertenencia se ejecutan mediante los casos de negocio de la suite API y Brave. Una prueba de guard no demuestra por sí sola el alcance de cada respuesta.

| Método | Ruta | Función | Admin | Fisio | Deportista | Entrenador | Alcance | Positiva | Negativa y estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/users` | Gestión de cuenta o entrenador | Sí | — | — | — | Gestión administrativa; reglas de integridad por operación | API y Brave de administración | Guard verificado |
| POST | `/api/admin/users` | Gestión de cuenta o entrenador | Sí | — | — | — | Gestión administrativa; reglas de integridad por operación | API y Brave de administración | Guard verificado |
| PATCH | `/api/admin/users/:id` | Gestión de cuenta o entrenador | Sí | — | — | — | Gestión administrativa; reglas de integridad por operación | API y Brave de administración | Guard verificado |
| DELETE | `/api/admin/users/:id` | Gestión de cuenta o entrenador | Sí | — | — | — | Gestión administrativa; reglas de integridad por operación | API y Brave de administración | Guard verificado |
| PATCH | `/api/admin/athletes/:id/coach` | Gestión de cuenta o entrenador | Sí | — | — | — | Gestión administrativa; reglas de integridad por operación | API y Brave de administración | Guard verificado |
| GET | `/api/team/alerts` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| GET | `/api/team/alerts/counts` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| GET | `/api/team/alerts/:id` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| POST | `/api/team/alerts/:id/review` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| GET | `/api/team/athletes/:id/evaluations` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| PATCH | `/api/team/athletes/:id/program-start` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| GET | `/api/team/export` | Consulta o gestión del equipo | — | Sí | — | — | Ámbito profesional y validación del recurso | API y Brave del equipo | Guard verificado |
| POST | `/api/exercises` | Catálogo o asignaciones | — | Sí | — | — | Ámbito profesional y validación del recurso | Suite de catálogo y asignaciones | Guard verificado |
| PATCH | `/api/exercises/:id` | Catálogo o asignaciones | — | Sí | — | — | Ámbito profesional y validación del recurso | Suite de catálogo y asignaciones | Guard verificado |
| DELETE | `/api/exercises/:id` | Catálogo o asignaciones | — | Sí | — | — | Ámbito profesional y validación del recurso | Suite de catálogo y asignaciones | Guard verificado |
| POST | `/api/exercises/assignments` | Catálogo o asignaciones | — | Sí | — | — | Ámbito profesional y validación del recurso | Suite de catálogo y asignaciones | Guard verificado |
| DELETE | `/api/exercises/assignments/:id` | Catálogo o asignaciones | — | Sí | — | — | Ámbito profesional y validación del recurso | Suite de catálogo y asignaciones | Guard verificado |
| POST | `/api/rules` | Umbrales | — | Sí | — | — | Ámbito profesional y validación del recurso | Recorridos y alertas | Guard verificado |
| DELETE | `/api/rules/:id` | Umbrales | — | Sí | — | — | Ámbito profesional y validación del recurso | Recorridos y alertas | Guard verificado |
| GET | `/api/athletes/me` | Perfil y listado | — | — | Sí | — | Perfil propio; sesión del programa aplicable | Perfil sintético y equipo | Guard verificado |
| PUT | `/api/athletes/me` | Perfil y listado | — | — | Sí | — | Perfil propio; sesión del programa aplicable | Perfil sintético y equipo | Guard verificado |
| POST | `/api/injuries` | Molestias y antecedentes | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de antecedentes y molestias | Guard verificado |
| GET | `/api/injuries/mine` | Molestias y antecedentes | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de antecedentes y molestias | Guard verificado |
| PATCH | `/api/injuries/:id/history` | Molestias y antecedentes | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de antecedentes y molestias | Guard verificado |
| DELETE | `/api/injuries/:id` | Molestias y antecedentes | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de antecedentes y molestias | Guard verificado |
| GET | `/api/program/current` | Programa y cumplimiento | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de programa | Guard verificado |
| POST | `/api/program/sessions/:id/toggle` | Programa y cumplimiento | — | — | Sí | — | Perfil propio; sesión del programa aplicable | API y Brave de programa | Guard verificado |
| GET | `/api/exercises/mine` | Catálogo o asignaciones | — | — | Sí | — | Perfil propio; sesión del programa aplicable | Suite de catálogo y asignaciones | Guard verificado |
| GET | `/api/athletes` | Perfil y listado | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | Perfil sintético y equipo | Guard verificado |
| GET | `/api/team/overview` | Consulta o gestión del equipo | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | API y Brave del equipo | Guard verificado |
| GET | `/api/team/athletes/:id` | Consulta o gestión del equipo | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | API y Brave del equipo | Guard verificado |
| GET | `/api/exercises/athlete/:id` | Catálogo o asignaciones | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | Suite de catálogo y asignaciones | Guard verificado |
| GET | `/api/exercises` | Catálogo o asignaciones | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | Suite de catálogo y asignaciones | Guard verificado |
| GET | `/api/rules` | Umbrales | — | Sí | — | Sí | Entrenador solo asignados en recursos personales; biblioteca y umbrales compartidos | Recorridos y alertas | Guard verificado |
| GET | `/api/auth/me` | Cuenta autenticada | Sí | Sí | Sí | Sí | Cuenta y credencial actuales | Suite de seguridad y recuperación | Guard verificado |
| POST | `/api/auth/change-password` | Cuenta autenticada | Sí | Sí | Sí | Sí | Cuenta y credencial actuales | Suite de seguridad y recuperación | Guard verificado |
| POST | `/api/auth/logout` | Revocación individual | Sí | Sí | Sí | Sí | Solo el JWT presentado, incluso si ya estaba revocado | 204 y otra sesión activa | 401 sin firma válida o con token expirado |

El detalle de filtrado por entrenador, proyecciones clínicas y pruebas de relación se mantiene en [controles de seguridad](CONTROLES_DE_SEGURIDAD.md).
