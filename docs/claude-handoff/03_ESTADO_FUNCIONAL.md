# LuchaSegura · Estado Funcional e Inventario de Capacidades

> **Propósito:** Inventario exhaustivo y riguroso de cada funcionalidad del sistema, indicando los archivos responsables, endpoints, modelos de datos, evidencias de funcionamiento, problemas detectados y estado de implementación comprobado.  
> **Criterios de clasificación:**
> - `IMPLEMENTADO Y PROBADO`: El código existe completo y hay evidencia de prueba reportada por el usuario en el historial o verificación en ejecución.
> - `IMPLEMENTADO SIN PROBAR`: El código existe completo en frontend y backend, compila sin errores, pero no cuenta con reporte explícito de prueba de usuario en la última versión.
> - `PARCIAL`: La funcionalidad está construida a medias o le faltan piezas esenciales de frontend, backend o base de datos.
> - `NO IMPLEMENTADO`: No existe código en la aplicación (o solo existe el esqueleto en la base de datos).
> - `NO VERIFICABLE`: Requiere servicios externos (ej. servidor SMTP), credenciales de producción o condiciones no disponibles en el entorno local.

---

## 1. Matriz Consolidada de Funcionalidades

| # | Funcionalidad | Capas | Archivo Responsable | Endpoint / Ruta | Modelo Prisma | Estado de Implementación |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | **Inicio de sesión** | Fullstack | `login.page.ts`, `auth.ts` | `POST /api/auth/login` | `User` | **IMPLEMENTADO Y PROBADO** |
| 2 | **Registro de deportistas** | Fullstack | `register.page.ts`, `auth.ts` | `POST /api/auth/register` | `User`, `Athlete`, `Consent` | **IMPLEMENTADO Y PROBADO** |
| 3 | **Recuperación de contraseña** | Fullstack | `forgot.page.ts`, `reset.page.ts`, `auth.ts` | `/api/auth/forgot-password`, `/reset-password` | `PasswordResetToken` | **PARCIAL** (Link en consola DEV; sin SMTP) |
| 4 | **Roles y permisos** | Fullstack | `guards.ts`, `auth.ts` (middleware) | Todos los endpoints protegidos | Enum `Role` | **IMPLEMENTADO Y PROBADO** |
| 5 | **Seguridad de sesiones** | Fullstack | `session-watcher.ts`, `limits.ts` | Interceptores y Middlewares | `User.passwordChangedAt` | **IMPLEMENTADO Y PROBADO** |
| 6 | **Administración de usuarios** | Fullstack | `users.page.ts`, `assignments.page.ts`, `admin.ts` | `/api/admin/users`, `/athletes/:id/coach` | `User`, `Athlete` | **IMPLEMENTADO Y PROBADO** |
| 7 | **Perfil del deportista** | Fullstack | `profile.page.ts`, `athletes.ts` | `GET/PUT /api/athletes/me` | `Athlete` | **IMPLEMENTADO Y PROBADO** |
| 8 | **Reporte de molestias/lesiones** | Fullstack | `report.page.ts`, `injuries.ts` | `POST/GET/DELETE /api/injuries` | `Injury` | **IMPLEMENTADO Y PROBADO** |
| 9 | **Panel del fisioterapeuta/equipo** | Fullstack | `overview.page.ts`, `athletes.page.ts`, `athlete-detail.page.ts`, `team.ts` | `GET /api/team/overview`, `/athletes/:id` | `Athlete`, `Injury`, `Alert` | **IMPLEMENTADO Y PROBADO** |
| 10 | **Alertas y umbrales** | Fullstack | `alerts.page.ts`, `rules.page.ts`, `team.ts`, `rules.ts` | `POST /api/team/alerts/:id/review`, `/api/rules` | `Alert`, `AlertRule` | **IMPLEMENTADO Y PROBADO** |
| 11 | **Biblioteca de ejercicios** | Fullstack | `exercises.page.ts`, `exercises.ts` | `GET/POST/PATCH/DELETE /api/exercises` | `Exercise` | **IMPLEMENTADO SIN PROBAR** |
| 12 | **Asignación de ejercicios** | Fullstack | `athlete-detail.page.ts`, `plan.page.ts`, `exercises.ts` | `/api/exercises/assignments`, `/mine` | `ExerciseAssignment` | **IMPLEMENTADO SIN PROBAR** |
| 13 | **Reproducción de videos YouTube** | Frontend | `exercise-ui.ts`, `exercise-api.ts` | Sanitización de URL (`DomSanitizer`) | `Exercise.mediaUrl` | **IMPLEMENTADO SIN PROBAR** |
| 14 | **Exportaciones a Excel** | Fullstack | `overview.page.ts`, `team.ts` | `GET /api/team/export` | `Athlete`, `Injury`, `CompletedSession` | **IMPLEMENTADO Y PROBADO** |
| 15 | **Notificaciones (Toasts)** | Frontend | `toast.service.ts`, `toast-container.ts` | N/A (Reactividad Angular Signals) | N/A | **IMPLEMENTADO Y PROBADO** |
| 16 | **Gráficas (SVG nativo)** | Frontend | `charts.ts` (`LineChart`, `BarChart`, `ProgressRing`) | N/A (Renderizado SVG con ResizeObserver) | N/A | **IMPLEMENTADO Y PROBADO** |
| 17 | **Diseño responsivo** | Frontend | `styles.scss`, `shell-frame.ts` | Media queries CSS (`min-width: 768px`, etc.) | N/A | **IMPLEMENTADO Y PROBADO** |
| 18 | **Tema claro y oscuro** | Frontend | `theme.service.ts`, `theme-toggle.ts`, `styles.scss` | `localStorage` (`theme` = dark/light) | N/A | **IMPLEMENTADO Y PROBADO** |
| 19 | **Logo, favicon e iconografía** | Frontend | `logo.ts`, `icon.ts`, `index.html`, `public/` | SVG definitions (`#ls-g`, `#ls-s`, `#ls-l`, `#ls-c`) | N/A | **IMPLEMENTADO SIN PROBAR** |
| 20 | **Botones de eliminación** | Frontend | `del-btn.ts`, `confirm.ts`, `styles.scss` | Microinteracción CSS y SweetAlert2 | N/A | **IMPLEMENTADO SIN PROBAR** |
| 21 | **Programa preventivo (8 sem)** | Fullstack | `plan.page.ts`, `home.page.ts`, `program.ts` | `GET /api/program/current`, `/sessions/:id/toggle` | `Program`, `ProgramSession`, `CompletedSession` | **PARCIAL** (Semana fija a createdAt) |
| 22 | **Evaluaciones funcionales** | Backend | `schema.prisma` | N/A (Sin endpoints ni vistas) | `FunctionalTest` | **NO IMPLEMENTADO** |
| 23 | **Hábitos de fatiga y sueño** | Ninguna | N/A | N/A | N/A | **NO IMPLEMENTADO** |
| 24 | **Comparativa Inicial vs Final** | Ninguna | N/A | N/A | N/A | **NO IMPLEMENTADO** |

---

## 2. Detalle Exhaustivo por Funcionalidad

---

### 1. Inicio de Sesión
- **Archivos Responsables:** [frontend/src/app/pages/login.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/pages/login.page.ts) y [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts)
- **Endpoint:** `POST /api/auth/login`
- **Modelo Prisma:** `User`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Confirmado por el usuario en sesiones previas. Rate limiter operativo (5 intentos por 15 min), cuenta regresiva de bloqueo visual en frontend (`Lockout`), comparación con `bcrypt` en tiempo constante y emisión de JWT.
- **Problemas Detectados:** Ninguno en el flujo principal.
- **Dependencias:** `AuthService`, `loginLimiter`, `bcryptjs`.

---

### 2. Registro de Deportistas
- **Archivos Responsables:** [frontend/src/app/pages/register.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/pages/register.page.ts) y [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts)
- **Endpoint:** `POST /api/auth/register`
- **Modelos Prisma:** `User`, `Athlete`, `Consent`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Probado por el usuario. Bloquea menores de 18 años si no ingresan el nombre del acudiente. Despliega texto de consentimiento informado colapsable. Asigna automáticamente el rol `ATHLETE`.
- **Problemas Detectados:**
  - Código duplicado en [backend/src/routes/auth.ts#L95](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L95) (segunda definición inalcanzable).
  - En menores no se registra documento de identidad ni teléfono del acudiente (vacío legal en Habeas Data).
- **Dependencias:** `CONSENT_TEXT`, `registerLimiter`, `ageOn()`.

---

### 3. Recuperación de Contraseña
- **Archivos Responsables:** [frontend/src/app/pages/forgot.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/pages/forgot.page.ts), [reset.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/pages/reset.page.ts) y [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts)
- **Endpoints:** `POST /api/auth/forgot-password`, `GET /api/auth/reset-password/check`, `POST /api/auth/reset-password`
- **Modelo Prisma:** `PasswordResetToken`
- **Estado:** **PARCIAL**
- **Evidencia:** Probado en desarrollo. Los tokens se generan criptográficamente con `randomBytes(32)` y expiran a los 30 minutos. La pantalla `reset.page.ts` valida el token antes de mostrar el formulario.
- **Problemas Detectados:** En producción (`NODE_ENV=production`), el enlace no se envía por ningún canal (falta integración de Nodemailer / servicio SMTP transaccional).
- **Dependencias:** `PasswordResetToken`, `recoveryLimiter`.

---

### 4. Roles y Permisos (RBAC)
- **Archivos Responsables:** [frontend/src/app/core/guards.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/guards.ts) y [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts)
- **Endpoints:** Aplica a toda la API REST
- **Modelo Prisma:** Enum `Role` (`ATHLETE`, `COACH`, `PHYSIO`, `ADMIN`)
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** `roleGuard` en Angular redirige según el rol del token. El backend valida el rol con `requireRole()`. El entrenador solo tiene acceso a sus deportistas asignados mediante la cláusula `scopeOf()`.
- **Problemas Detectados:** Ninguno crítico.

---

### 5. Seguridad de Sesiones e Inactividad
- **Archivos Responsables:** [frontend/src/app/core/session-watcher.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/session-watcher.ts), [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts)
- **Endpoints:** `requireAuth`
- **Modelo Prisma:** `User.passwordChangedAt`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Sesión expira a los 15 minutos sin interacción; emite Toast informativo. Si la contraseña cambia, los tokens previos quedan revocados inmediatamente comparando el timestamp `iat` contra `passwordChangedAt`.
- **Problemas Detectados:** Almacenamiento de token en `sessionStorage` susceptible a robo en caso de vulnerabilidad XSS.

---

### 6. Administración de Usuarios y Asignaciones
- **Archivos Responsables:** [frontend/src/app/admin/users.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/users.page.ts), [assignments.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/assignments.page.ts) y [backend/src/routes/admin.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/admin.ts)
- **Endpoints:** `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `PATCH /api/admin/athletes/:id/coach`, `DELETE /api/admin/users/:id`
- **Modelos Prisma:** `User`, `Athlete`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Creación de usuarios con contraseña temporal obligando a cambio en primer inicio (`mustChangePassword: true`), activación/desactivación de cuentas, asignación de entrenador a atleta.
- **Problemas Detectados:**
  - `AdminShell` no reutiliza `ShellFrame`, no muestra el logo nuevo y carece de botón de cambio de tema.
- **Dependencias:** `AdminStore`, `DelBtn`.

---

### 7. Perfil del Deportista y Antecedentes
- **Archivos Responsables:** [frontend/src/app/athlete/profile.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/athlete/profile.page.ts) y [backend/src/routes/athletes.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/athletes.ts)
- **Endpoints:** `GET /api/athletes/me`, `PUT /api/athletes/me`
- **Modelo Prisma:** `Athlete`, `Injury` (`isHistory: true`)
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Edición de peso, categoría, estilo y experiencia. Registro y eliminación de antecedentes de lesiones pasadas.
- **Problemas Detectados:** Falta encuesta formal de prácticas preventivas actuales contemplada en los requisitos del proyecto académico.

---

### 8. Reporte de Molestias y Dolor (Escala VAS)
- **Archivos Responsables:** [frontend/src/app/athlete/report.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/athlete/report.page.ts) y [backend/src/routes/injuries.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts)
- **Endpoints:** `POST /api/injuries`, `GET /api/injuries/mine`, `DELETE /api/injuries/:id`
- **Modelo Prisma:** `Injury`, `Alert`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Selección de zona mediante chips, escala de dolor visual de 0 a 10 con colores semánticos (verde/amarillo/rojo), limitación de entrenamiento (None, Partial, Full). Eliminación restringida a las primeras 24 horas.
- **Problemas Detectados:** Zonas se persisten en base de datos como `String` libre, no hay enum estricto.

---

### 9. Panel del Fisioterapeuta y Entrenador
- **Archivos Responsables:** [frontend/src/app/team/overview.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/overview.page.ts), [athletes.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/athletes.page.ts), [athlete-detail.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/athlete-detail.page.ts) y [backend/src/routes/team.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts)
- **Endpoints:** `GET /api/team/overview`, `GET /api/team/athletes/:id`
- **Modelos Prisma:** `Athlete`, `Injury`, `Alert`, `ProgramSession`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Visualización de KPIs (total deportistas, adherencia promedio, alertas pendientes, casos de baja adherencia <60%), buscador y filtro de deportistas, ficha individual detallada con historial y gráficas.
- **Problemas Detectados:** Consultas sin paginación; agregaciones ejecutadas en memoria de Node.js.

---

### 10. Alertas Médicas y Umbrales de Dolor
- **Archivos Responsables:** [frontend/src/app/team/alerts.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/alerts.page.ts), [rules.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/rules.page.ts), [backend/src/routes/rules.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/rules.ts)
- **Endpoints:** `POST /api/team/alerts/:id/review`, `GET/POST/DELETE /api/rules`
- **Modelos Prisma:** `Alert`, `AlertRule`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Marcar alertas como revisadas; creación y borrado de umbrales por zona o generales por el fisioterapeuta.
- **Problemas Detectados:**
  - Sin `@unique` en `bodyZone` en `AlertRule`.
  - Si no hay umbrales configurados, las molestias graves no disparan alertas.

---

### 11. Biblioteca de Ejercicios Preventivos
- **Archivos Responsables:** [frontend/src/app/team/exercises.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/exercises.page.ts) y [backend/src/routes/exercises.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/exercises.ts)
- **Endpoints:** `GET /api/exercises`, `POST /api/exercises`, `PATCH /api/exercises/:id`, `DELETE /api/exercises/:id`
- **Modelo Prisma:** `Exercise`
- **Estado:** **IMPLEMENTADO SIN PROBAR**
- **Evidencia:** Código completado en la última entrega (commit `b98564f`). Filtrado por componente (Movilidad, Estabilidad, Fuerza, Técnica), formulario modal de alta/edición, borrado lógico (archivado si tiene asignaciones activas).
- **Problemas Detectados:** Falta validación de usuario final en el entorno local.

---

### 12. Asignación Individualizada de Ejercicios
- **Archivos Responsables:** [frontend/src/app/team/athlete-detail.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/athlete-detail.page.ts), [frontend/src/app/athlete/plan.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/athlete/plan.page.ts), [backend/src/routes/exercises.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/exercises.ts)
- **Endpoints:** `POST /api/exercises/assignments`, `DELETE /api/exercises/assignments/:id`, `GET /api/exercises/mine`
- **Modelo Prisma:** `ExerciseAssignment`
- **Estado:** **IMPLEMENTADO SIN PROBAR**
- **Evidencia:** Entregado en commit `b98564f`. El fisioterapeuta asigna ejercicios con dosificación y notas específicas en la ficha del atleta; el atleta los visualiza en su sección "Mi Plan".
- **Problemas Detectados:** Sin prueba reportada por el usuario en el entorno local.

---

### 13. Reproducción de Videos de YouTube / Vimeo
- **Archivos Responsables:** [frontend/src/app/core/exercise-ui.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/exercise-ui.ts), [exercise-api.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/exercise-api.ts)
- **Endpoints:** N/A (Frontend puro sobre `iframe` y `SafeResourceUrl`)
- **Modelo Prisma:** `Exercise.mediaUrl`
- **Estado:** **IMPLEMENTADO SIN PROBAR**
- **Evidencia:** Diálogo modal nativo `<dialog>`, parseo de identificadores de video de YouTube/Vimeo, uso de `youtube-nocookie.com/embed`, miniaturas automáticas con `img.youtube.com/vi/...` y badges de reproducción.
- **Problemas Detectados:** Pendiente de verificación visual con URLs reales en navegador.

---

### 14. Exportación de Datos a Excel
- **Archivos Responsables:** [backend/src/routes/team.ts#L194-L318](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts#L194-L318), [frontend/src/app/team/overview.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/team/overview.page.ts)
- **Endpoint:** `GET /api/team/export`
- **Modelos Prisma:** `Athlete`, `Injury`, `CompletedSession`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Descarga archivos `.xlsx` estructurados con tres hojas (Deportistas, Molestias, Sesiones), filtros automáticos y estilos de cabecera. Soporta modo anónimo mediante `?anon=1`.
- **Problemas Detectados:** Generación completa en memoria (buffer) susceptible a OOM; anonimización correlativa vulnerable a reidentificación; falta registro en `AuditLog`.

---

### 15. Sistema de Notificaciones (Toasts)
- **Archivos Responsables:** [frontend/src/app/core/toast.service.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/toast.service.ts), [toast-container.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/toast-container.ts)
- **Endpoints:** N/A
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Notificaciones compactas flotantes accesibles (`role="status"`, auto-cierre en 3.5s, niveles `info`, `success`, `error`).

---

### 16. Gráficas y Visualización de Datos (SVG Puro)
- **Archivos Responsables:** [frontend/src/app/core/charts.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/charts.ts)
- **Componentes:** `ProgressRing`, `LineChart`, `BarChart`
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Renderizado SVG responsivo con `ResizeObserver` sin dependencias de Chart.js o D3. Gráfica de evolución del dolor por zona y barras de sesiones por semana con línea de meta.

---

### 17. Diseño Responsivo y PWA
- **Archivos Responsables:** [frontend/src/styles.scss](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss), [shell-frame.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/shell-frame.ts), [manifest.webmanifest](file:///home/snuuzz/Proyectos/luchasegura/frontend/public/manifest.webmanifest)
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Adaptación fluida entre menú lateral (desktop) y barra inferior de navegación (celular). Manejo de áreas seguras en dispositivos móviles (`env(safe-area-inset)`). Manifiesto PWA e iconos listos.

---

### 18. Modo Claro y Modo Oscuro
- **Archivos Responsables:** [frontend/src/app/core/theme.service.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/theme.service.ts), [theme-toggle.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/theme-toggle.ts), [styles.scss](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss)
- **Estado:** **IMPLEMENTADO Y PROBADO**
- **Evidencia:** Alternancia de atributo `[data-theme='dark']` en la etiqueta `<html>`, persistencia en `localStorage`, variables CSS semánticas.

---

### 19. Identidad Visual: Logo, Favicon e Iconografía
- **Archivos Responsables:** [frontend/src/app/core/logo.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/logo.ts), [frontend/public/icons/](file:///home/snuuzz/Proyectos/luchasegura/frontend/public/icons/), [frontend/public/favicon.svg](file:///home/snuuzz/Proyectos/luchasegura/frontend/public/favicon.svg)
- **Estado:** **IMPLEMENTADO SIN PROBAR**
- **Evidencia:** Entregado en commit `2423ea2`. Escudo institucional vectorizado con degradados en `index.html`. Favicon SVG e iconos PNG generados.
- **Problemas Detectados:** El logo no se utiliza en `AdminShell`.

---

### 20. Botones de Eliminación Interactivos (`DelBtn`)
- **Archivos Responsables:** [frontend/src/app/core/del-btn.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/del-btn.ts), [frontend/src/styles.scss](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss)
- **Estado:** **IMPLEMENTADO SIN PROBAR (Cambio local en working tree)**
- **Evidencia:** Modificación local actual sin commit. Microinteracción donde el icono de papelera expande el texto "Eliminar" y cambia a color rojo al pasar el mouse. Integrado en 6 vistas del sistema.

---

### 21. Programa Preventivo de Ocho Semanas
- **Archivos Responsables:** [frontend/src/app/athlete/plan.page.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/athlete/plan.page.ts), [backend/src/routes/program.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/program.ts), [backend/prisma/seed-program.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/seed-program.ts)
- **Endpoints:** `GET /api/program/current`, `POST /api/program/sessions/:id/toggle`
- **Modelos Prisma:** `Program`, `ProgramSession`, `CompletedSession`
- **Estado:** **PARCIAL**
- **Evidencia:** La estructura de base de datos y la interfaz de marcado de sesiones funcionan. Sin embargo:
  - El contenido del programa en la base de datos es un borrador preliminar (`seed-program.ts`).
  - La semana actual depende irrevocablemente de la fecha de registro (`athlete.createdAt`), impidiendo inicios coordinados por cohorte.

---

### 22. Evaluaciones Funcionales (SEBT/YBT, FMS, LESS, T-Test)
- **Archivos Responsables:** [backend/prisma/schema.prisma#L207-L217](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L207-L217)
- **Endpoints:** Ninguno
- **Modelo Prisma:** `FunctionalTest`
- **Estado:** **NO IMPLEMENTADO**
- **Evidencia:** Existe la tabla en la base de datos PostgreSQL, pero no se ha programado ningún endpoint en Express ni ninguna interfaz en Angular para registrar ni consultar las pruebas.

---

### 23. Módulo de Hábitos, Fatiga y Sueño
- **Archivos Responsables:** Inexistentes
- **Estado:** **NO IMPLEMENTADO**
- **Evidencia:** Requisito formal del proyecto académico de la Universidad del Rosario (manejo de la fatiga, recuperación y calidad de sueño), sin representación en código ni base de datos.

---

### 24. Comparación de Resultados Pre vs Post Intervención
- **Archivos Responsables:** Inexistentes
- **Estado:** **NO IMPLEMENTADO**
- **Evidencia:** No existe cálculo estadístico ni pantalla comparativa entre la Fase 1 (Semana 0) y la Fase 3 (Semana 8).
