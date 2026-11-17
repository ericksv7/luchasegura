# LuchaSegura · Guía Maestra de Continuidad para Claude

> **Para Claude:** Lee este documento detenidamente antes de sugerir o modificar una sola línea de código. Este archivo sintetiza la realidad técnica comprobada del repositorio **LuchaSegura**, eliminando las contradicciones entre planes previos, afirmaciones pasadas y el estado real del software.

---

## 1. Resumen Ejecutivo y Contexto del Proyecto

**LuchaSegura** es una plataforma web para la **prevención de lesiones músculo-esqueléticas en luchadores olímpicos** de la Selección Bogotá (IDRD), desarrollada como proyecto de investigación formativa de la carrera de Fisioterapia de la **Universidad del Rosario** (estudiantes: Nicolás Cruz, Naishla Martínez y Andrés López).

### Parámetros Esenciales
- **Protocolo Académico:** Intervención preventiva de **8 semanas**, **3 sesiones semanales**, de **20 a 30 minutos** por sesión (referencias: *Wrestling+* de Bayati et al., 2025; *FIFA 11+ modificado* de Eskandari et al., 2025; *SMR y movilidad torácica* de Kim, 2026).
- **Población:** Luchadores de género mixto, entre **13 y 25 años**. Dado que hay menores de edad (13 a 17 años), la protección de datos médicos está sujeta al régimen de datos sensibles de la **Ley Estatutaria 1581 de 2012 de Colombia**.
- **Roles del Sistema:**
  - `ATHLETE`: Reporta molestias, consulta su plan, completa sesiones y revisa su evolución.
  - `COACH`: Supervisa únicamente a los deportistas asignados a su cargo.
  - `PHYSIO`: Supervisa a todos los atletas, gestiona umbrales de alerta, administra la biblioteca de ejercicios, asigna ejercicios específicos y exporta a Excel.
  - `ADMIN`: Gestiona cuentas de usuarios institucionales y asigna entrenadores.

---

## 2. Estado Real del Repositorio y Git

- **Rama de Trabajo:** `develop`. Todas las funcionalidades implementadas hasta la fecha residen en esta rama (10 commits de desarrollo).
- **Rama `main`:** Permanece en el commit inicial del esqueleto del proyecto (`e725247`). No intentes mezclar ni hacer rebase sobre `main` sin indicación explícita del usuario.
- **Estado de Compilación:**
  - Backend: `npm run typecheck` (`tsc --noEmit`) pasa con **0 errores**.
  - Frontend: `npx tsc -p tsconfig.app.json --noEmit` pasa con **0 errores**.
  - Base de Datos: 4 migraciones aplicadas en PostgreSQL; `npx prisma migrate status` reporta sincronización total.
- **Pruebas Automatizadas:** No existen pruebas unitarias en el backend (0%).

---

## 3. Arquitectura y Decisiones Técnicas que DEBES Conservar

Cualquier cambio que propongas debe respetar estrictamente estas directrices arquitectónicas:

1. **Angular 20 Standalone Puro con Signals:**
   - No introduzcas módulos `NgModule`.
   - Utiliza componentes standalone con reactividad basada en Signals (`signal`, `computed`, `input`, `output`).
   - Usa `inject()` funcional para inyección de dependencias.
   - Usa el nuevo control flow nativo de Angular (`@if`, `@for`, `@switch`).
2. **Gráficos en SVG Puro sin Librerías Externas:**
   - La visualización de datos (`ProgressRing`, `LineChart`, `BarChart` en [frontend/src/app/core/charts.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/charts.ts)) está construida con elementos SVG reactivos y `ResizeObserver`. **Bajo ninguna circunstancia intentes instalar Chart.js, D3 o ngx-charts**.
3. **Sistema de Diseño y Temas en SCSS:**
   - No instales Tailwind, Bootstrap ni Angular Material. El proyecto utiliza SCSS nativo con variables semánticas (`--surf`, `--pri`, `--ink`, `--line`) y modo claro/oscuro con el atributo `[data-theme='dark']`.
4. **Validación Dual Estricta:**
   - Formularios en frontend con `ReactiveFormsModule` y validadores síncronos.
   - Endpoints en backend con esquemas de validación estricta **Zod**.
5. **Microinteracciones y Diálogos:**
   - Utiliza el componente [frontend/src/app/core/del-btn.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/del-btn.ts) para acciones de eliminación.
   - Para confirmaciones modales destructivas, utiliza la función [frontend/src/app/core/confirm.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/confirm.ts) basada en SweetAlert2 personalizado (`confirmDialog`).

---

## 4. Tabla Definitiva de Problemas: Confirmados vs Descartados

No asumas los problemas de análisis previos sin revisar esta tabla, que representa la verificación basada en código real:

| # | Problema Analizado | Estado Real | Evidencia en Código | Acción Requerida |
| :---: | :--- | :---: | :--- | :--- |
| **01** | Ruta `/register` duplicada | **CONFIRMADO** | [backend/src/routes/auth.ts#L70](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L70) y [#L95](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts#L95) | Eliminar la segunda definición (líneas 95-114). |
| **02** | Excepciones de Prisma fugadas a 500 | **CONFIRMADO** | [backend/src/app.ts#L40-L46](file:///home/snuuzz/Proyectos/luchasegura/backend/src/app.ts#L40-L46) | Capturar `PrismaClientKnownRequestError` (`P2002` a 409, `P2025` a 404). |
| **03** | Inconsistencias en `AdminShell` | **CONFIRMADO** | [frontend/src/app/admin/admin-shell.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts) | Refactorizar para usar `<app-shell-frame>`. |
| **04** | Logo antiguo en Administrador | **CONFIRMADO** | [frontend/src/app/admin/admin-shell.ts#L16](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts#L16) | Se resuelve al unificar con `ShellFrame` (usa `Logo`). |
| **05** | Botón de tema duplicado | **DESCARTADO COMO DUPLICADO / DEFECTO EN ADMIN** | [frontend/src/styles.scss#L528](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss#L528) | La regla CSS oculta el botón global cuando hay `.app-shell`. Nunca estuvo duplicado. En Admin falta el botón y se soluciona usando `ShellFrame`. |
| **06** | Bloqueo en `/change-password` por barra final | **CONFIRMADO** | [backend/src/middleware/auth.ts#L45](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts#L45) | Normalizar la ruta eliminando la barra final con `.replace(/\/$/, "")`. |
| **07** | Reglas de alerta duplicables | **CONFIRMADO** | [backend/prisma/schema.prisma#L110](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L110) | Añadir restricción `@unique` en `bodyZone` y usar `upsert`. |
| **08** | Zonas corporales en texto libre | **CONFIRMADO** | [backend/prisma/schema.prisma#L94](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L94) | Crear enum en Prisma o validar lista canónica en Zod. |
| **09** | Sin alertas cuando no hay umbrales | **CONFIRMADO** | [backend/src/routes/injuries.ts#L38](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts#L38) | Implementar umbral de contingencia por defecto (`threshold = 7`). |
| **10** | Semana calculada desde `createdAt` | **CONFIRMADO** | [backend/src/routes/program.ts#L9-L12](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/program.ts#L9-L12) | Añadir `programStartedAt` en `Athlete` o desacoplar por cohorte. |
| **11** | Modelo `FunctionalTest` sin utilizar | **CONFIRMADO** | [backend/prisma/schema.prisma#L207](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma#L207) | Construir endpoints REST y vistas para FMS, YBT y T-Test. |
| **12** | Problemas de privacidad en Excel | **CONFIRMADO** | [backend/src/routes/team.ts#L194-L318](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts#L194-L318) | Restringir PII a `PHYSIO` y usar identificadores enmascarados no secuenciales. |
| **13** | Falta de auditoría de accesos | **CONFIRMADO** | Ausente en `schema.prisma` | Crear modelo `AuditLog` para descargas y revisiones clínicas. |
| **14** | Dependencia de Google Fonts externa | **CONFIRMADO** | [frontend/src/index.html#L13-L14](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/index.html#L13-L14) | Alojar Manrope WOFF2 en `frontend/public/fonts/`. |
| **15** | Configuración obsoleta de Prisma | **CONFIRMADO** | [backend/package.json#L19-L21](file:///home/snuuzz/Proyectos/luchasegura/backend/package.json#L19-L21) | Migrar `"prisma": { "seed": ... }` a `prisma.config.ts`. |
| **16** | Ausencia de pruebas en backend | **CONFIRMADO** | Ausente en `backend/src/` | Configurar pruebas de integración para auth y cálculos de adherencia. |

---

## 5. Cambios Locales Sin Confirmar (Working Tree Actual)

El usuario tiene cambios pendientes en su entorno local que **NO DEBES REVERTIR NI SOBRESCRIBIR ACCIDENTALMENTE**:

1. **Archivos Modificados (Unstaged):**
   - `frontend/src/app/admin/users.page.ts`: Reemplazó el botón HTML plano por `<button appDel>`.
   - `frontend/src/app/athlete/profile.page.ts`: Reemplazó el icono SVG plano de basura por `<button appDel>`.
   - `frontend/src/app/athlete/report.page.ts`: Reemplazó el botón de borrado por `<button appDel>`.
   - `frontend/src/app/core/icon.ts`: Mejoró el trazado vectorial del icono `trash`.
   - `frontend/src/app/team/athlete-detail.page.ts`: Integró `<button appDel>` para desasignar ejercicios.
   - `frontend/src/app/team/exercises.page.ts`: Integró `<button appDel>` para eliminar ejercicios.
   - `frontend/src/app/team/rules.page.ts`: Integró `<button appDel>` para eliminar umbrales.
   - `frontend/src/index.html`: Cambió el favicon de 32x32 ICO a PNG 192x192.
   - `frontend/src/styles.scss`: Añadió estilos de microinteracción para `.del`, `.del-t` y alineación de `.urow .acts`.
2. **Archivos Sin Seguimiento (Untracked):**
   - `frontend/src/app/core/del-btn.ts`: Directiva/componente standalone del botón interactivo de eliminación.
   - `frontend/public/icons/`: Iconos generados para PWA (192, 512, apple-touch).
   - `frontend/public/favicon.svg` y `logo-mark.svg`.
   - `docs/claude-handoff/`: Documentación técnica de entrega.

---

## 6. Archivos que Debes Inspeccionar Primero

Antes de implementar cualquier tarea, consulta estos archivos clave:

1. **Contrato de Base de Datos:** [backend/prisma/schema.prisma](file:///home/snuuzz/Proyectos/luchasegura/backend/prisma/schema.prisma).
2. **Manejo de Errores y Rutas Principales:** [backend/src/app.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/app.ts).
3. **Autenticación y Middlewares:** [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts) y [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts).
4. **Marco Compartido de Navegación:** [frontend/src/app/core/shell-frame.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/shell-frame.ts).
5. **Lógica de Ejercicios y Diálogo Modal:** [frontend/src/app/core/exercise-ui.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/exercise-ui.ts) y [backend/src/routes/exercises.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/exercises.ts).
6. **Gráficos SVG:** [frontend/src/app/core/charts.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/core/charts.ts).

---

## 7. Incertidumbres Restantes (Requieren Decisión del Usuario / Fisioterapeuta)

Estas decisiones están fuera del alcance del código y dependen de la coordinación con la Universidad del Rosario:

1. **Protocolo Clínico Final de Ejercicios:** El archivo `backend/prisma/seed-program.ts` tiene ejercicios de ejemplo provisionales. El listado final de ejercicios (FIFA 11+ / Wrestling+), series y repeticiones debe ser suministrado formalmente por el equipo de Fisioterapia.
2. **Umbrales Oficiales de Dolor:** Se debe definir el valor mínimo oficial de corte (ej. dolor `>= 7` o `>= 5`) que deba detonar una alarma médica en caso de no existir reglas personalizadas.
3. **Fecha Oficial de Inicio de la Cohorte:** Para activar el cálculo de las 8 semanas de intervención con los deportistas del IDRD.
4. **Aprobación del Texto del Consentimiento Informado:** El texto en `frontend/src/app/core/consent.ts` está marcado como borrador sujeto al aval del comité ético de la Universidad del Rosario y del IDRD.

---

## 8. Próxima Fase Recomendada e Instrucciones Paso a Paso

### Tu Próxima Tarea: Implementar la **Fase 0 (Estabilización Inmediata)**

Procede en el siguiente orden exacto:

1. **Paso 1:** Edita [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts) y elimina la segunda definición duplicada de `POST /register` (líneas 95 a 114).
2. **Paso 2:** Edita [backend/src/app.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/app.ts) e implementa el manejador para `PrismaClientKnownRequestError` (`P2002` -> 409, `P2025` -> 404).
3. **Paso 3:** Edita [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts) para limpiar la barra final (`.replace(/\/$/, "")`) en la verificación de `ALLOWED_WHEN_MUST_CHANGE`.
4. **Paso 4:** Edita [backend/src/routes/injuries.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/injuries.ts) para aplicar un umbral de contingencia por defecto (`intensity >= 7`) cuando no existan reglas configuradas en `AlertRule`.
5. **Paso 5:** Refactoriza [frontend/src/app/admin/admin-shell.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts) para reutilizar `<app-shell-frame>`.
6. **Paso 6:** Ejecuta las verificaciones estáticas de tipado:
   ```bash
   cd backend && npm run typecheck
   cd ../frontend && npx tsc -p tsconfig.app.json --noEmit
   ```
   **Ambos comandos deben finalizar con 0 errores antes de dar por terminada la fase.**
