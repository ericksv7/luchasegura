# LuchaSegura · Auditoría Técnica y Diagnóstico de Evidencias

> **Propósito:** Detallar los hallazgos técnicos confirmados, descartados e identificados durante la auditoría basada en evidencias sobre el código fuente de **LuchaSegura**.  
> **Metodología:** Cada hallazgo se sustenta exclusivamente en inspecciones del código fuente, comprobaciones estáticas de tipado, análisis de base de datos relacional y ejecución no destructiva de herramientas de diagnóstico.

---

## 1. Resumen de Verificaciones Técnicas Reales Ejecutadas

Las siguientes comprobaciones estáticas y de entorno fueron ejecutadas durante la auditoría:

| Comando / Herramienta | Capa | Resultado Real Obtenido | Evidencia / Detalle Técnico |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` (`tsc --noEmit`) | Backend | **Exitoso (Código 0)** | Cero errores de tipado en TypeScript 5.9 con Express y Prisma. |
| `npx tsc -p tsconfig.app.json --noEmit` | Frontend | **Exitoso (Código 0)** | Cero errores en componentes standalone, signals y servicios Angular. |
| `npx tsc -p tsconfig.spec.json --noEmit` | Frontend | **Exitoso (Código 0)** | Tipado de pruebas unitarias válido. |
| `npx prisma migrate status` | Backend / DB | **Exitoso (Código 0)** | Base de datos sincronizada: 4 migraciones aplicadas correctamente. |
| `npx prisma validate` | Backend | **Válido con Advertencia** | El esquema es válido, pero reporta deprecación de `package.json#prisma`. |
| Pruebas automatizadas Backend | Backend | **Inexistentes (0%)** | No hay ningún archivo `.spec.ts` o `.test.ts` en `backend/src/`. |
| `ng test` | Frontend | **No ejecutable en CLI headless** | Configurado para Karma + Jasmine con dependencia de Chrome GUI local. |

---

## 2. Auditoría Detallada de los 16 Problemas Previamente Identificados

A continuación se audita cada uno de los dieciséis problemas reportados históricamente en el proyecto, contrastándolos rigurosamente contra el código fuente real:

---

### PROBLEMA 01. Ruta `/register` Duplicada en Autenticación
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:**
  - Definición 1 (Completa y con validación de edad): [backend/src/routes/auth.ts#L70-L93](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L70-L93)
  - Definición 2 (Incompleta y sin fecha de nacimiento): [backend/src/routes/auth.ts#L95-L114](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L95-L114)
- **Evidencia en el código:**
  ```typescript
  // Línea 70: Primera definición
  authRouter.post("/register", registerLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
    const { email, password, fullName, birthDate, consent } = parsed.data;
    if (ageOn(birthDate) < 18 && !consent.guardianName) {
      return res.status(400).json({ error: "Para menores de 18 años se requiere el nombre del acudiente" });
    }
    // Crea usuario y atleta con birthDate
    ...
  });

  // Línea 95: Segunda definición idéntica en path pero incompleta
  authRouter.post("/register", registerLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
    const { email, password, fullName, consent } = parsed.data; // <- Falta birthDate
    // Crea usuario con athlete: { create: {} }
    ...
  });
  ```
- **Impacto Real:** Express registra los manejadores en orden secuencial. Como la primera definición termina el ciclo de vida de la solicitud (`res.status(201)`), la segunda definición es código muerto inalcanzable. Representa riesgo de regresión en mantenimiento si se reordena o se introduce un middleware intermedio.
- **Solución Recomendada:** Eliminar por completo el bloque de líneas 95 a 114 de `backend/src/routes/auth.ts`.

---

### PROBLEMA 02. Errores de Prisma Manejados Incorrectamente (Fugas a 500)
- **Estado:** **CONFIRMADO (Severidad: CRÍTICA)**
- **Ubicación en código:** [backend/src/app.ts#L40-L46](file:///home/snuuzz/Proyectos/luchasegura/backend/src/app.ts#L40-L46)
- **Evidencia en el código:**
  ```typescript
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
      return res.status(err.status ?? 400).json({ error: "Solicitud inválida" });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  });
  ```
- **Impacto Real:** Prisma Client lanza excepciones especializadas (`Prisma.PrismaClientKnownRequestError`) con códigos de error como:
  - `P2002`: Conflicto de unicidad (`Unique constraint failed`).
  - `P2025`: Registro requerido no encontrado (`Record not found`).
  Al no existir captura de estas instancias, cualquier carrera de datos (ej. registros concurrentes del mismo correo) o consulta con `findUniqueOrThrow` sobre un recurso inexistente detona una respuesta `500 Internal Server Error` opaca en lugar de un `409 Conflict` o `404 Not Found` semántico.
- **Solución Recomendada:** Capturar `err instanceof Prisma.PrismaClientKnownRequestError` en el middleware de error global y mapear `P2002` a HTTP 409 y `P2025` a HTTP 404.

---

### PROBLEMA 03. Inconsistencias entre `AdminShell` y `ShellFrame`
- **Estado:** **CONFIRMADO (Severidad: MEDIA)**
- **Ubicación en código:**
  - `AdminShell`: [frontend/src/app/admin/admin-shell.ts#L1-L71](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts#L1-L71)
  - `ShellFrame`: [frontend/src/app/core/shell-frame.ts#L1-L76](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/shell-frame.ts#L1-L76)
- **Evidencia en el código:** Mientras que `AthleteShell` y `TeamShell` reutilizan el marco común `<app-shell-frame>`, `AdminShell` reimplementa su propio HTML de barra lateral, define SVGs inline en lugar de `<app-icon>`, carece de `<app-theme-toggle>` y duplica estilos.
- **Impacto Real:** Inconsistencia visual, violación del principio DRY y mayor esfuerzo de mantenimiento ante cambios globales de interfaz.
- **Solución Recomendada:** Refactorizar `AdminShell` para que envuelva sus rutas hijas mediante `<app-shell-frame>` pasando los `navItems` correspondientes a Administración (`Usuarios` y `Asignaciones`).

---

### PROBLEMA 04. Logo Antiguo en el Administrador
- **Estado:** **CONFIRMADO (Severidad: BAJA)**
- **Ubicación en código:** [frontend/src/app/admin/admin-shell.ts#L15-L19](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts#L15-L19) y [L46-L50](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts#L46-L50)
- **Evidencia en el código:**
  ```html
  <!-- admin-shell.ts líneas 15-18 -->
  <span class="mark">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
  </span>
  ```
  Mientras que `ShellFrame` usa `<app-logo [size]="34" />` con el nuevo diseño institucional de escudo y degradados de `index.html`, `AdminShell` dibuja un escudo genérico monocromático antiguo.
- **Solución Recomendada:** Reemplazar por `<app-logo [size]="34" />` o resolverlo automáticamente al migrar `AdminShell` a `ShellFrame`.

---

### PROBLEMA 05. Botón de Tema Duplicado
- **Estado:** **DESCARTADO COMO DUPLICACIÓN; CONFIRMADO COMO DEFECTO EN ADMIN (Severidad: MEDIA)**
- **Ubicación en código:**
  - Declaración global: [frontend/src/app/app.ts#L12](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/app.ts#L12)
  - Regla de ocultamiento CSS: [frontend/src/styles.scss#L528](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss#L528)
  - Botón incrustado en marco: [frontend/src/app/core/shell-frame.ts#L28](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/shell-frame.ts#L28) y [L59](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/shell-frame.ts#L59)
- **Evidencia y Análisis:**
  En `frontend/src/styles.scss`:
  ```scss
  /* ===== Marco compartido: el botón de tema vive dentro del menú ===== */
  body:has(.app-shell) app-root > app-theme-toggle { display: none; }
  ```
  La regla CSS **oculta deliberadamente** el botón global de `app.ts` en cualquier vista que contenga la clase `.app-shell`. Por tanto, en las pantallas de Deportista y Equipo (`ShellFrame`), el botón **nunca aparece duplicado** (se muestra en la barra lateral en computador y en la barra superior en celular).  
  **El fallo real:** Como `AdminShell` posee la clase `.app-shell` pero **no incluye** `<app-theme-toggle>` en su plantilla, la regla CSS oculta el botón global, dejando al administrador **sin ninguna opción para alternar entre modo claro y oscuro**.
- **Solución Recomendada:** Al unificar `AdminShell` con `ShellFrame`, el administrador heredará el conmutador de tema de manera coherente.

---

### PROBLEMA 06. Problemas con `/change-password` por Barra Final en URL
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:** [backend/src/middleware/auth.ts#L19-L50](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts#L19-L50)
- **Evidencia en el código:**
  ```typescript
  const ALLOWED_WHEN_MUST_CHANGE = ["/api/auth/change-password", "/api/auth/me"];
  ...
  if (user.mustChangePassword && !ALLOWED_WHEN_MUST_CHANGE.includes(req.originalUrl.split("?")[0])) {
    return res.status(403).json({
      error: "Debes cambiar tu contraseña antes de continuar",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }
  ```
- **Impacto Real:** Si la petición HTTP llega con una barra diagonal al final (`/api/auth/change-password/`) debido a un proxy inverso, cliente HTTP o navegador, `req.originalUrl.split("?")[0]` no coincide con el array estricto. El middleware bloquea la petición con `403 PASSWORD_CHANGE_REQUIRED`, provocando un bloqueo irreversible: el usuario está obligado a cambiar la contraseña, pero el sistema le impide consumir el endpoint para cambiarla.
- **Solución Recomendada:** Normalizar la ruta eliminando la barra final con `.replace(/\/$/, "")` antes de la comprobación.

---

### PROBLEMA 07. Reglas de Alerta Duplicables (Condición de Carrera)
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:**
  - Esquema: [backend/prisma/schema.prisma#L110-L116](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L110-L116)
  - Ruta de creación: [backend/src/routes/rules.ts#L24-L28](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/rules.ts#L24-L28)
- **Evidencia en el código:**
  ```prisma
  model AlertRule {
    id           String   @id @default(uuid())
    bodyZone     String?  // null = aplica a todas
    minIntensity Int
    createdById  String
    createdAt    DateTime @default(now())
  }
  ```
  En `rules.ts`:
  ```typescript
  const existing = await prisma.alertRule.findFirst({ where: { bodyZone } });
  const rule = existing
    ? await prisma.alertRule.update({ where: { id: existing.id }, data: { minIntensity, createdById: req.user!.sub } })
    : await prisma.alertRule.create({ data: { bodyZone, minIntensity, createdById: req.user!.sub } });
  ```
- **Impacto Real:** No existe una restricción de unicidad (`@unique`) a nivel de base de datos sobre `bodyZone`. En caso de solicitudes concurrentes, dos peticiones pueden superar el `findFirst` simultáneamente, creando múltiples reglas para la misma zona anatómica. Posteriormente, en [injuries.ts#L41](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts#L41), `find` toma arbitrariamente la primera regla encontrada.
- **Solución Recomendada:** Implementar un índice único sobre `bodyZone` (o índice parcial PostgreSQL para permitir un único valor `NULL`), y utilizar `prisma.alertRule.upsert`.

---

### PROBLEMA 08. Zonas Corporales Almacenadas como Texto Libre
- **Estado:** **CONFIRMADO (Severidad: MEDIA)**
- **Ubicación en código:**
  - Modelo `Injury`: [backend/prisma/schema.prisma#L94](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L94) (`bodyZone String`)
  - Esquema Zod: [backend/src/routes/injuries.ts#L13](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts#L13) (`z.string().trim().min(2).max(60)`)
- **Evidencia en el código:** Mientras que en el frontend las zonas están restringidas al array constante `ZONES` (`Cuello`, `Hombro`, `Codo`, `Muñeca o mano`, `Zona dorsal`, `Zona lumbar`, `Cadera`, `Rodilla`, `Tobillo o pie`, `Otra`), en el backend `bodyZone` es un `String` arbitrario.
- **Impacto Real:** Si un cliente envía variaciones en mayúsculas, tildes o términos libres (`rodilla`, `RODILLA`, `knee`), las comparaciones exactas de alertas en `injuries.ts#L41` (`r.bodyZone === injury.bodyZone`) fallan silenciosamente.
- **Solución Recomendada:** Crear un `enum BodyZone` en Prisma o normalizar y validar contra una lista canónica en el backend antes de persistir.

---

### PROBLEMA 09. Ausencia de Alertas cuando no Existen Umbrales
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:** [backend/src/routes/injuries.ts#L38-L45](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts#L38-L45)
- **Evidencia en el código:**
  ```typescript
  if (!injury.isHistory && injury.intensity != null) {
    const rules = await prisma.alertRule.findMany({
      where: { OR: [{ bodyZone: null }, { bodyZone: injury.bodyZone }] },
    });
    const rule = rules.find((r) => r.bodyZone === injury.bodyZone) ?? rules.find((r) => r.bodyZone === null);
    if (rule && injury.intensity >= rule.minIntensity) {
      await prisma.alert.create({ data: { injuryId: injury.id } });
    }
  }
  ```
- **Impacto Real:** Si la tabla `AlertRule` está vacía (por ejemplo, en un despliegue nuevo o si el fisioterapeuta no ha configurado reglas), `rule` es `undefined`. En consecuencia, **ningún reporte de molestia genera alerta médica**, incluso si el deportista reporta un dolor máximo de 10/10 o incapacidad total para entrenar.
- **Solución Recomendada:** Definir un umbral de contingencia por defecto a nivel de aplicación (ej. dolor >= 7 siempre genera alerta si no hay regla configurada) y sembrar una regla global por defecto (`bodyZone: null, minIntensity: 7`).

---

### PROBLEMA 10. Semana del Programa Calculada desde la Fecha de Registro
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:** [backend/src/routes/program.ts#L9-L12](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/program.ts#L9-L12) y [L40](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/program.ts#L40)
- **Evidencia en el código:**
  ```typescript
  export function currentWeek(since: Date, weeks: number) {
    const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
    return Math.min(weeks, Math.max(1, Math.floor(days / 7) + 1));
  }
  ...
  currentWeek: currentWeek(athlete.createdAt, program.weeks)
  ```
- **Impacto Real:** La semana de entrenamiento del atleta está estrictamente acoplada a la fecha en que se registró su cuenta de usuario. Si un deportista se registra 8 semanas antes de que comience formalmente la intervención de investigación del IDRD, su cuenta aparecerá fija en la semana 8 ("bloqueada"). No hay soporte para fecha de inicio por cohorte ni reinicio de programa.
- **Solución Recomendada:** Agregar un campo opcional `programStartedAt DateTime?` en `Athlete` o una entidad `Cohort` con fecha de inicio oficial.

---

### PROBLEMA 11. Modelo `FunctionalTest` sin Utilizar en API y UI
- **Estado:** **CONFIRMADO (Severidad: MEDIA)**
- **Ubicación en código:** [backend/prisma/schema.prisma#L207-L217](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L207-L217)
- **Evidencia en el código:**
  ```prisma
  model FunctionalTest {
    id         String    @id @default(uuid())
    athleteId  String
    athlete    Athlete   @relation(fields: [athleteId], references: [id], onDelete: Cascade)
    testType   String    // SEBT/YBT, FMS, T-test, goniometría
    phase      TestPhase
    result     Json
    measuredAt DateTime  @default(now())

    @@index([athleteId, phase])
  }
  ```
  La búsqueda en el repositorio demuestra que **no existe ningún endpoint en `backend/src/` ni ningún componente en `frontend/src/`** que consuma o administre esta entidad.
- **Impacto Real:** Deuda técnica y brecha funcional directa con el objetivo académico de evaluación inicial y final del proyecto de la Universidad del Rosario.
- **Solución Recomendada:** Implementar endpoints REST (`/api/tests`) e interfaz de captura para las pruebas especificadas en el proyecto académico (FMS, YBT, T-test, LESS).

---

### PROBLEMA 12. Problemas de Privacidad en Exportación a Excel
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:** [backend/src/routes/team.ts#L194-L318](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts#L194-L318)
- **Evidencia en el código:**
  - El endpoint `/api/team/export` está disponible para cualquier usuario con rol `COACH` o `PHYSIO`.
  - La anonimización depende de un parámetro de consulta voluntario (`?anon=1`). Por defecto (`anon=false`), exporta nombres, correos electrónicos, entrenadores y notas de deportistas menores de edad.
  - La función anonimizadora genera identificadores correlativos basados en el orden de consulta SQL (`who(i, name) = D-001, D-002...` ordenado por `createdAt ASC`). Si un observador compara un reporte anonimizado con la lista pública de deportistas, la reidentificación es inmediata.
- **Impacto Real:** Vulnerabilidad ante el régimen de protección de datos de menores en Colombia (Ley 1581 de 2012 / Decreto 1377 de 2013).
- **Solución Recomendada:** Restringir la exportación de PII exclusivamente al rol `PHYSIO`, anonimizar mediante hashes o UUIDs enmascarados, y registrar cada descarga.

---

### PROBLEMA 13. Falta de Auditoría de Accesos a Datos Médicos
- **Estado:** **CONFIRMADO (Severidad: ALTA)**
- **Ubicación en código:** [backend/prisma/schema.prisma](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma) y [backend/src/routes/team.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts)
- **Evidencia en el código:** No existe ningún modelo `AuditLog` en la base de datos ni middleware interceptor que registre quién consultó una ficha clínica, quién revisó un reporte lesional o quién descargó la base de datos en Excel.
- **Impacto Real:** Imposibilidad de sustentar trazabilidad legal ante incidentes de divulgación de datos médicos de deportistas menores de edad.
- **Solución Recomendada:** Crear el modelo `AuditLog` en Prisma y registrar eventos de lectura/exportación de historias clínicas.

---

### PROBLEMA 14. Uso de Fuentes Externas sin Descarga Local
- **Estado:** **CONFIRMADO (Severidad: MEDIA)**
- **Ubicación en código:** [frontend/src/index.html#L13-L14](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/index.html#L13-L14)
- **Evidencia en el código:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
  ```
- **Impacto Real:**
  1. Durante compilaciones en entornos cerrados, pipelines CI/CD sin salida web o sin resolución DNS de Google, el bundler de Angular falla al intentar integrar las fuentes en línea (`Inlining of fonts failed`).
  2. Dependencia externa en tiempo de ejecución en coliseos o zonas deportivas con conectividad intermitente o sin conexión a internet.
  3. Transferencia pasiva de direcciones IP a servidores de Google Fonts al solicitar la tipografía.
- **Solución Recomendada:** Alojar los archivos WOFF2 de Manrope localmente dentro de `frontend/public/fonts/` o declarar fallback tipográfico nativo en `@font-face`.

---

### PROBLEMA 15. Configuración Obsoleta de Prisma en `package.json`
- **Estado:** **CONFIRMADO (Severidad: BAJA)**
- **Ubicación en código:** [backend/package.json#L19-L21](file:///home/snuuzz/Proyectos/luchasegura/backend/package.json#L19-L21)
- **Evidencia en el código:**
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```
  Al ejecutar `npx prisma validate`, la herramienta emite la advertencia formal:
  ```
  warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
  ```
- **Impacto Real:** Bloqueo o advertencia durante futuras actualizaciones a Prisma 7 u 8.
- **Solución Recomendada:** Migrar la configuración de siembra a un archivo `backend/prisma.config.ts`.

---

### PROBLEMA 16. Ausencia de Pruebas Automatizadas en el Backend
- **Estado:** **CONFIRMADO (Severidad: MEDIA)**
- **Ubicación en código:** [backend/package.json](file:///home/snuuzz/Proyectos/luchasegura/backend/package.json) y directorio `backend/src/`
- **Evidencia en el código:** En `backend/package.json` no existe script `"test"`. No hay ninguna dependencia instalada para pruebas (Jest, Vitest o Supertest) ni archivos de prueba unitaria o de integración.
- **Impacto Real:** Falta de red de seguridad contra regresiones en endpoints críticos de autenticación, cálculo de semanas y filtrado de roles.
- **Solución Recomendada:** Configurar `node:test` nativo con TypeScript o Vitest y añadir pruebas para los flujos de autenticación y cálculo de adherencia.

---

## 3. Vulnerabilidades Adicionales Identificadas

### SEC-01. Restablecimiento de Contraseña Roto en Producción
- **Ubicación:** [backend/src/routes/auth.ts#L187-L191](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L187-L191)
- **Evidencia:**
  ```typescript
  const link = `${config.corsOrigin}/restablecer?token=${token}`;
  // TODO: enviar por correo (nodemailer). Por ahora, solo en desarrollo, se muestra en la consola.
  if (!config.isProd) {
    console.log(`[DEV] Enlace para restablecer la contraseña de ${user.email}:\n${link}`);
  }
  ```
- **Impacto:** En un entorno productivo (`NODE_ENV=production`), el enlace no se imprime en consola ni se despacha por correo electrónico. El usuario recibe un mensaje indicándole que revise su bandeja de entrada, pero el correo nunca llega, dejándolo permanentemente sin acceso a su cuenta si olvida la clave.

### SEC-02. Inexistencia de Documento de Identificación del Acudiente
- **Ubicación:** [backend/prisma/schema.prisma#L77-L86](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L77-L86)
- **Evidencia:** El modelo `Consent` solo almacena `guardianName String?`. No registra número de documento de identidad del acudiente (cédula de ciudadanía), parentesco ni teléfono de contacto.
- **Impacto:** Insuficiencia legal para acreditar formalmente la patria potestad del adulto que autoriza el tratamiento de datos sensibles del menor ante una auditoría del IDRD o requerimiento de la Superintendencia de Industria y Comercio (SIC).

### PERF-01. Consulta a Base de Datos en Cada Petición Autenticada
- **Ubicación:** [backend/src/middleware/auth.ts#L34-L44](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts#L34-L44)
- **Evidencia:** En cada llamada HTTP con Bearer token, el middleware ejecuta `prisma.user.findUnique({ where: { id: payload.sub } })` para verificar si la cuenta está activa o si cambió de contraseña.
- **Impacto:** En sesiones de entrenamiento con 30-50 deportistas reportando o interactuando simultáneamente, la base de datos recibe decenas de consultas por segundo para verificar los mismos datos inmutables en memoria.

### INFRA-01. Ausencia de Apagado Grácil (`Graceful Shutdown`)
- **Ubicación:** [backend/src/index.ts#L8-L10](file:///home/snuuzz/Proyectos/luchasegura/backend/src/index.ts#L8-L10)
- **Evidencia:** No se registran escuchadores para las señales del sistema operativo `SIGTERM` o `SIGINT`.
- **Impacto:** Cuando el proceso de Node.js se reinicia o detiene durante despliegues, se cortan abruptamente las peticiones en curso y no se ejecuta `prisma.$disconnect()`, dejando conexiones zombis en el servidor PostgreSQL.
