# LuchaSegura · Plan de Mejoras Priorizado y Hoja de Ruta

> **Propósito de este documento:** Presentar un plan de ingeniería de software estructurado y accionable para corregir, optimizar, blindar y profesionalizar la aplicación **LuchaSegura**. Cada tarea está diseñada como una unidad de trabajo independiente y trazable para que un desarrollador o un modelo de lenguaje (Claude) la ejecute de manera segura y sin regresiones.

---

## 1. Matriz de Priorización y Dependencias

```
Fase 1: Estabilización Crítica (P0)
   ├── TASK-CRIT-01 (Eliminación de ruta duplicada en auth.ts)
   ├── TASK-CRIT-02 (Filtro global de excepciones Prisma P2002/P2025)
   ├── TASK-CRIT-03 (Normalización de URLs en cambio de contraseña)
   └── TASK-CRIT-04 (Implementación de Graceful Shutdown en backend)
         │
         ▼
Fase 2: Privacidad y Cumplimiento Normativo (P1)
   ├── TASK-SEC-01 (Ampliación de datos de acudiente y consentimiento)
   ├── TASK-SEC-02 (Tabla de auditoría para descargas de salud en Excel)
   └── TASK-SEC-03 (Servicio de correo para restablecimiento de claves)
         │
         ▼
Fase 3: Rendimiento y Optimización (P2)
   ├── TASK-PERF-01 (Paginación de atletas y usuarios)
   ├── TASK-PERF-02 (Caché en memoria para validación de tokens en auth.ts)
   ├── TASK-PERF-03 (Streaming de libros Excel con WorkbookWriter)
   └── TASK-PERF-04 (Auto-hospedaje de tipografía Manrope en frontend)
         │
         ▼
Fase 4: Refactorización y Experiencia de Usuario (P3)
   ├── TASK-UX-01 (Corrección del doble botón de cambio de tema)
   ├── TASK-UX-02 (Unificación de AdminShell con ShellFrame)
   ├── TASK-ARQ-01 (Restricción de unicidad en AlertRule)
   └── TASK-ARQ-02 (Desacoplar semanas del programa de athlete.createdAt)
         │
         ▼
Fase 5: Calidad y Pruebas Automatizadas (P4)
   ├── TASK-TEST-01 (Suite de pruebas de integración para API REST)
   └── TASK-TEST-02 (Migración de ejecutor de pruebas frontend a Vitest)
```

---

## 2. Fase 1: Estabilización Crítica (P0 - Inmediato)

### [TASK-CRIT-01] Eliminación de Ruta Duplicada en `auth.ts`
- **Problema:** En [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts), la ruta `POST /register` está definida dos veces consecutivas (líneas 70 y 95). La segunda versión es código muerto que omite `birthDate`.
- **Archivos involucrados:** `backend/src/routes/auth.ts`.
- **Solución técnica recomendada:** Eliminar por completo el segundo bloque de código redundante (líneas 95 a 114) preservando el primer bloque que contiene la validación de edad y nombre de acudiente.
- **Cambios necesarios:**
  - Remover líneas 95 a 114 en `backend/src/routes/auth.ts`.
- **Riesgos y posibles regresiones:** Ninguno. La segunda función nunca llegaba a ejecutarse.
- **Criterios de aceptación:**
  - Solo existe una declaración de `authRouter.post("/register", ...)` en el archivo.
  - `npm run typecheck` en `backend/` finaliza con código 0.
- **Procedimiento de verificación:**
  1. Ejecutar: `cd backend && npm run typecheck`.
  2. Verificar con grep: `grep -n 'authRouter.post("/register"' backend/src/routes/auth.ts` (debe retornar exactamente 1 coincidencia).

---

### [TASK-CRIT-02] Manejo Global de Errores de Base de Datos (Prisma P2002 / P2025)
- **Problema:** Errores de concurrencia (como intentar registrar un correo duplicado de forma simultánea) o llamadas a registros inexistentes con `findUniqueOrThrow` provocan que Prisma lance excepciones no atrapadas que el middleware de Express convierte en `500 Internal Server Error`.
- **Archivos involucrados:**
  - `backend/src/app.ts`
- **Solución técnica recomendada:** Importar `Prisma` desde `@prisma/client` e incorporar en el middleware de manejo de errores una detección de instancias de `Prisma.PrismaClientKnownRequestError`.
- **Cambios necesarios:**
  En `backend/src/app.ts`:
  ```typescript
  import { Prisma } from "@prisma/client";

  // En el middleware de error (línea 40):
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Ya existe un registro con esos datos únicos" });
      }
      if (err.code === "P2025") {
        return res.status(404).json({ error: "El recurso solicitado no fue encontrado" });
      }
    }
    // ... mantener control de parseo JSON y log de error 500
  });
  ```
- **Riesgos y posibles regresiones:** Bajo. Mejora la estabilidad y evita fugas de detalles internos de base de datos en respuestas de la API.
- **Criterios de aceptación:**
  - Violaciones de unicidad en base de datos devuelven código HTTP `409` con JSON estructurado.
  - Registros no encontrados devuelven código HTTP `404`.
- **Procedimiento de verificación:**
  - Lanzar peticiones concurrentes o registrar un correo idéntico dos veces y comprobar que responde 409 y nunca 500.

---

### [TASK-CRIT-03] Normalización de URLs en Middleware de Cambio de Contraseña
- **Problema:** En [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts#L45), si el endpoint se invoca con una barra al final (`/api/auth/change-password/`), el usuario con `mustChangePassword: true` es bloqueado con error 403 y no puede actualizar su credencial.
- **Archivos involucrados:** `backend/src/middleware/auth.ts`.
- **Solución técnica recomendada:** Normalizar la ruta de la petición eliminando la barra final antes de compararla contra la lista blanca permitida.
- **Cambios necesarios:**
  ```typescript
  const cleanPath = req.originalUrl.split("?")[0].replace(/\/+$/, "");
  if (user.mustChangePassword && !ALLOWED_WHEN_MUST_CHANGE.includes(cleanPath)) {
    return res.status(403).json({
      error: "Debes cambiar tu contraseña antes de continuar",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }
  ```
- **Riesgos y posibles regresiones:** Nulo.
- **Criterios de aceptación:** Peticiones tanto a `/api/auth/change-password` como a `/api/auth/change-password/` son aceptadas para usuarios con contraseña provisional.
- **Procedimiento de verificación:** Realizar `POST /api/auth/change-password/` con un token temporal y verificar que no responde 403.

---

### [TASK-CRIT-04] Implementación de Apagado Grácil (`Graceful Shutdown`)
- **Problema:** [backend/src/index.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/index.ts) no gestiona el cierre ordenado de conexiones, provocando abortos abruptos durante despliegues y reinicios.
- **Archivos involucrados:** `backend/src/index.ts`, `backend/src/db.ts`.
- **Solución técnica recomendada:** Capturar `SIGTERM` y `SIGINT`, cerrar el servidor HTTP rechazando nuevas conexiones y esperar la finalización de las activas antes de ejecutar `prisma.$disconnect()`.
- **Cambios necesarios:**
  En `backend/src/index.ts`:
  ```typescript
  import { app } from "./app";
  import { config } from "./config";
  import { prisma } from "./db";

  const server = app.listen(config.port, () => {
    console.log(`API de LuchaSegura escuchando en http://localhost:${config.port}`);
  });

  async function shutdown(signal: string) {
    console.log(`Recibida señal ${signal}. Cerrando servidor grácilmente...`);
    server.close(async () => {
      console.log("Servidor HTTP cerrado. Desconectando base de datos...");
      await prisma.$disconnect();
      console.log("Conexión con PostgreSQL cerrada. Proceso finalizado.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Cierre forzado por tiempo límite excedido.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  ```
- **Criterios de aceptación:** Al presionar `Ctrl+C` o enviar señal de término en Docker, el proceso informa el cierre ordenado y se desconecta limpiamente de PostgreSQL.

---

## 3. Fase 2: Privacidad y Cumplimiento Normativo (P1)

### [TASK-SEC-01] Fortalecimiento Legal del Consentimiento Informado (Menores de Edad)
- **Problema:** El modelo `Consent` solo almacena el nombre del acudiente en texto plano. La Ley 1581 de 2012 exige trazabilidad inequívoca del otorgamiento del consentimiento para menores de edad.
- **Archivos involucrados:**
  - `backend/prisma/schema.prisma`
  - `backend/src/routes/auth.ts`
  - `frontend/src/app/core/auth.service.ts`
  - `frontend/src/app/pages/register.page.ts`
- **Solución técnica recomendada:**
  1. Extender el modelo `Consent` con:
     - `guardianDocumentType` (TI, CC, CE, Pasaporte)
     - `guardianDocumentNumber` (cadena)
     - `guardianPhone` (cadena)
     - `guardianRelationship` (Madre, Padre, Tutor legal)
     - `ipAddress` (cadena)
  2. Ajustar `registerSchema` en el backend para validar estos campos si el deportista tiene menos de 18 años.
  3. Actualizar el formulario reactivo de registro en el frontend para solicitar estos datos.
- **Riesgos:** Requiere una migración de esquema en Prisma (`npx prisma migrate dev`).
- **Criterios de aceptación:** Ningún menor de 18 años puede registrarse sin documento y datos de contacto de su acudiente.

---

### [TASK-SEC-02] Pistas de Auditoría (`AuditLog`) para Exportación de Fichas Médicas
- **Problema:** En [backend/src/routes/team.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/team.ts#L194), fisioterapeutas y entrenadores descargan hojas de cálculo con datos de dolor y nombres sin dejar ningún registro histórico de la extracción.
- **Archivos involucrados:**
  - `backend/prisma/schema.prisma`
  - `backend/src/routes/team.ts`
- **Solución técnica recomendada:**
  1. Crear el modelo `AuditLog` en `schema.prisma`:
     ```prisma
     model AuditLog {
       id         String   @id @default(uuid())
       userId     String
       action     String   // "EXPORT_EXCEL_ANON" | "EXPORT_EXCEL_FULL"
       resource   String   // "AthleteInjuries"
       ipAddress  String?
       createdAt  DateTime @default(now())
       user       User     @relation(fields: [userId], references: [id])
     }
     ```
  2. Insertar un registro en `AuditLog` dentro de `teamRouter.get("/export")` antes de entregar el archivo.
- **Criterios de aceptación:** Cada descarga de archivo `.xlsx` queda grabada de forma inmutable en PostgreSQL.

---

### [TASK-SEC-03] Proveedor de Correo para Restablecimiento de Contraseñas
- **Problema:** `POST /api/auth/forgot-password` imprime el enlace únicamente en consola de desarrollo. En producción el flujo está completamente desconectado.
- **Archivos involucrados:**
  - `backend/src/config.ts`
  - `backend/src/routes/auth.ts`
  - `backend/src/services/mailer.ts` (nuevo servicio)
- **Solución técnica recomendada:** Implementar un servicio de correo electrónico (vía `nodemailer` o API transaccional como Resend / SendGrid) configurado mediante variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). En desarrollo, si no hay credenciales SMTP, se mantiene el log en consola.
- **Criterios de aceptación:** Al solicitar restablecimiento en cualquier entorno configurado, el usuario recibe un correo HTML/texto con el enlace de expiración a 30 minutos.

---

## 4. Fase 3: Rendimiento y Optimización (P2)

### [TASK-PERF-01] Paginación de Endpoints de Alto Volumen
- **Problema:** Rutas como `/api/athletes`, `/api/team/overview` y `/api/admin/users` traen todos los registros sin control de tamaño.
- **Archivos involucrados:**
  - `backend/src/routes/athletes.ts`
  - `backend/src/routes/team.ts`
  - `backend/src/routes/admin.ts`
- **Solución técnica recomendada:** Aceptar parámetros de consulta `page` y `pageSize` (por defecto `page=1`, `pageSize=20`, con máximo 100), retornando metadatos `{ data: [...], pagination: { page, pageSize, total, totalPages } }`.
- **Riesgos y mitigación:** Modifica el contrato del payload de respuesta. Los stores del frontend (`AthleteStore`, `TeamStore`, `AdminStore`) deben actualizarse simultáneamente para leer `response.data`.

---

### [TASK-PERF-02] Caché de Corta Duración en Memoria para Autenticación
- **Problema:** `requireAuth` consulta PostgreSQL en cada petición HTTP individual.
- **Archivos involucrados:**
  - `backend/src/middleware/auth.ts`
- **Solución técnica recomendada:** Crear un almacén local en memoria (Map con timestamps o LRU Cache) con expiración de 60 segundos por `userId`. Si el usuario fue verificado hace menos de 60 segundos y su timestamp de `passwordChangedAt` no ha cambiado, evitar la consulta a la base de datos.
- **Criterios de aceptación:** La latencia de peticiones concurrentes se reduce en al menos un 50% bajo pruebas de carga.

---

### [TASK-PERF-03] Generación Transmitida (Streaming) de Reportes Excel
- **Problema:** `new ExcelJS.Workbook()` almacena todo el libro en la RAM antes de enviarlo, con riesgo de agotar la memoria del servidor.
- **Archivos involucrados:**
  - `backend/src/routes/team.ts`
- **Solución técnica recomendada:** Migrar a `ExcelJS.stream.xlsx.WorkbookWriter({ stream: res })`. Escribir las filas progresivamente a medida que se iteran los cursores de base de datos (`prisma.athlete.findMany({ ... })`).
- **Criterios de aceptación:** La exportación de cientos de deportistas y miles de reportes mantiene el consumo de memoria del proceso Node.js constante y por debajo de 50 MB adicionales.

---

### [TASK-PERF-04] Auto-Hospedaje de la Tipografía Manrope en el Frontend
- **Problema:** `ng build` falla en entornos sin conexión a internet al intentar embeber Google Fonts.
- **Archivos involucrados:**
  - `frontend/src/index.html`
  - `frontend/src/styles.scss`
  - `frontend/public/fonts/` (nuevo directorio)
- **Solución técnica recomendada:**
  1. Descargar los archivos tipográficos `.woff2` de Manrope (pesos 400, 500, 600, 700, 800) y colocarlos en `frontend/public/fonts/`.
  2. Declarar las fuentes con `@font-face` en `frontend/src/styles.scss`.
  3. Remover las etiquetas `<link rel="preconnect">` y `<link rel="stylesheet">` de Google Fonts en `index.html`.
- **Criterios de aceptación:** `npm run build` en `frontend/` finaliza con éxito en entornos 100% desconectados de internet.

---

## 5. Fase 4: Refactorización y Experiencia de Usuario (P3)

### [TASK-UX-01] Corrección de Duplicidad del Componente `ThemeToggle`
- **Problema:** Se visualizan dos botones de cambio de tema simultáneamente en las pantallas protegidas (uno en `App` y otro dentro de `ShellFrame`).
- **Archivos involucrados:**
  - `frontend/src/app/app.ts`
- **Solución técnica recomendada:** Retirar `<app-theme-toggle />` de la plantilla de `App` ([app.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/app.ts#L12)), o colocarlo únicamente dentro de `AuthShell` (para pantallas públicas como login y registro) y dentro de `ShellFrame` (para pantallas autenticadas).
- **Criterios de aceptación:** En ninguna pantalla de la aplicación existe más de un botón para alternar el modo oscuro.

---

### [TASK-UX-02] Unificación de `AdminShell` con `ShellFrame`
- **Problema:** [frontend/src/app/admin/admin-shell.ts](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/app/admin/admin-shell.ts) no utiliza el componente compartido `<app-shell-frame>`.
- **Archivos involucrados:**
  - `frontend/src/app/admin/admin-shell.ts`
- **Solución técnica recomendada:** Refactorizar `AdminShell` para consumir `<app-shell-frame>`, pasando los `items` correspondientes (`Usuarios`, `Asignaciones`) y el rol `"Administrador"`.
- **Criterios de aceptación:** `AdminShell` tiene la misma consistencia visual, logotipo SVG unificado y soporte para cambio de tema que las demás pantallas.

---

### [TASK-ARQ-01] Restricción Única en `AlertRule.bodyZone`
- **Problema:** No hay unicidad en las reglas de alerta, permitiendo reglas duplicadas y evaluación no determinista.
- **Archivos involucrados:**
  - `backend/prisma/schema.prisma`
  - `backend/src/routes/rules.ts`
- **Solución técnica recomendada:** Agregar `@unique` en `bodyZone` en el modelo `AlertRule` y crear la migración correspondiente. En `rules.ts`, utilizar `prisma.alertRule.upsert`.
- **Criterios de aceptación:** Es imposible registrar dos umbrales distintos para la misma articulación o zona anatómica.

---

### [TASK-ARQ-02] Desacoplar Semana del Programa de `athlete.createdAt`
- **Problema:** La semana del programa se calcula rígidamente desde que el atleta se registró en la plataforma.
- **Archivos involucrados:**
  - `backend/prisma/schema.prisma`
  - `backend/src/routes/program.ts`
- **Solución técnica recomendada:** Añadir un campo opcional `programStartedAt DateTime?` en el modelo `Athlete`. Si está establecido, calcular la semana actual a partir de esa fecha; si no, calcularla desde la asignación del programa por parte del cuerpo técnico.
- **Criterios de aceptación:** El equipo técnico puede reiniciar o programar el inicio del macrociclo de 8 semanas para el equipo sin importar la antigüedad de las cuentas de usuario.

---

## 6. Fase 5: Calidad y Pruebas Automatizadas (P4)

### [TASK-TEST-01] Creación de Suite de Pruebas de Integración en Backend
- **Problema:** 0% de cobertura de pruebas en el backend.
- **Archivos involucrados:**
  - `backend/package.json`
  - `backend/tests/` (nuevo directorio con pruebas de endpoints críticos)
- **Solución técnica recomendada:** Configurar un entorno de pruebas con base de datos en memoria o esquema aislado usando Vitest o Jest + Supertest. Implementar pruebas para:
  1. Registro de menor con y sin acudiente.
  2. Autenticación exitosa y rechazo por contraseña inválida.
  3. Reporte de molestia con intensidad superior al umbral y verificación de la creación de la alerta.
  4. Restricción de borrado de molestias después de 24 horas.
- **Criterios de aceptación:** `npm test` en `backend/` ejecuta las pruebas y reporta resultados claros en la consola y en el CI de GitHub Actions.

---

### [TASK-TEST-02] Modernización del Ejecutor de Pruebas Frontend a Vitest
- **Problema:** Karma está en desuso y falla en entornos sin Chrome instalado.
- **Archivos involucrados:**
  - `frontend/package.json`
  - `frontend/angular.json`
- **Solución técnica recomendada:** Migrar de `karma` a `vitest` y `jsdom` (o `@angular/build:application` con soporte nativo de pruebas).
- **Criterios de aceptación:** Las pruebas de componentes Angular se ejecutan en modo headless puro, sin requerir navegadores instalados en el sistema operativo, integrándose limpiamente en el flujo de CI.
