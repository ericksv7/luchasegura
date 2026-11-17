# LuchaSegura · Documentación Técnica Completa del Proyecto

> **Propósito de este documento:** Proveer una descripción exhaustiva y fidedigna de la arquitectura, diseño, implementación, reglas de negocio y contratos de la aplicación **LuchaSegura**, orientada a la prevención de lesiones en lucha olímpica. Este documento sirve como transferencia de conocimiento técnica completa para ingenieros de software y modelos de lenguaje (Claude).

---

## 1. Objetivo y Alcance

### 1.1. Contexto y Propósito
**LuchaSegura** es una plataforma web médica y deportiva desarrollada para la prevención y monitoreo de lesiones musculoesqueléticas en atletas de **lucha olímpica** (estilos Libre, Grecorromana y Femenina). Es un proyecto colaborativo de la Escuela de Fisioterapia de la **Universidad del Rosario** en articulación con la selección Bogotá del **Instituto Distrital de Recreación y Deporte (IDRD)**.

El principio fundacional del sistema es: **orientar y alertar, no diagnosticar ni prescribir**. La plataforma permite:
1. A los **deportistas**: registrar su perfil físico, antecedentes traumáticos, reportar molestias agudas o crónicas en menos de un minuto, consultar su evolución de dolor y seguir un programa preventivo neuromuscular estructurado de 8 semanas.
2. A los **entrenadores** (`COACH`): supervisar la adherencia y el cumplimiento de las sesiones de entrenamiento de los luchadores asignados a su cargo, identificando a tiempo caídas de rendimiento o atletas con dolor.
3. A los **fisioterapeutas** (`PHYSIO`): visualizar a toda la cohorte deportiva, recibir alertas tempranas automáticas basadas en umbrales de dolor clínico, gestionar la biblioteca de ejercicios preventivos, prescribir tareas de movilidad/fuerza personalizadas y exportar datos tabulados para análisis bioestadístico (garantizando anonimización según la Ley 1581 de 2012 de Colombia).
4. A los **administradores** (`ADMIN`): gestionar altas y bajas de cuentas del cuerpo técnico, restablecer accesos temporales y asignar la relación deportista-entrenador.

### 1.2. Alcance Funcional
- **Dentro del alcance:**
  - Registro de deportistas con consentimiento informado (con requerimiento legal de acudiente para menores de 18 años).
  - Gestión de perfiles antropométricos y deportivos (peso en kg, categoría, años de experiencia, estilo).
  - Ficha de reporte rápido de dolor (escala analógica 0 a 10, zona anatómica, momento de aparición, grado de limitación funcional).
  - Motor de reglas de alerta por umbrales de dolor configurables por el fisioterapeuta.
  - Programa preventivo general de 8 semanas (3 sesiones semanales) con catálogo de ejercicios clasificados (Movilidad, Estabilidad, Fuerza, Técnica) y soporte multimedia (YouTube nocookie, Vimeo, imágenes HTTPS).
  - Asignación individualizada de ejercicios complementarios por parte de fisioterapia.
  - Paneles de control diferenciados por rol (Deportista, Equipo Técnico, Administrador).
  - Exportación de métricas y fichas clínicas a libros Microsoft Excel (`.xlsx`), con opción de anonimización (`D-001`, `D-002`).
  - Modo oscuro y modo claro accesibles con persistencia en `localStorage`.

- **Fuera del alcance explícito:**
  - Diagnóstico automatizado de patologías o lesiones ligamentarias/óseas.
  - Prescripción farmacológica.
  - Conexión con sensores biomecánicos, acelerómetros o wearables en tiempo real.
  - Aplicación móvil nativa en tiendas (se diseñó como SPA responsive con preparativos para PWA).

---

## 2. Estado de Funcionalidades: Implementadas vs. Pendientes

| Módulo | Código | Funcionalidad | Estado de Implementación | Observaciones Técnicas |
| :--- | :--- | :--- | :--- | :--- |
| **Módulo 1: Perfil** | RF-01 | Registro con consentimiento informado | **Completo** | Valida edad; exige acudiente en menores de 18 años. |
| | RF-02 | Perfil del atleta (peso, categoría, estilo, experiencia) | **Completo** | Almacenado en tabla `Athlete`, editable desde `/deportista/perfil`. |
| | RF-03 | Antecedentes de lesiones pasadas | **Completo** | Almacenado como `Injury` con bandera `isHistory: true`. |
| | RF-04 | Observaciones y notas de perfil | **Completo** | Campo de texto libre en `Athlete.notes`. |
| **Módulo 2: Riesgo** | RF-06 | Reporte de molestias activas | **Completo** | Almacenado como `Injury` (`isHistory: false`), límite de borrado: 24h. |
| | RF-07 | Alertas automáticas según umbral | **Completo** | Generación automática en tabla `Alert` al superar `minIntensity`. |
| | RF-08 | Historial de molestias por zona corporal | **Completo** | Visualizable en frontend con gráfica de líneas SVG interactiva. |
| | RF-09 | Pruebas funcionales (SEBT/YBT, FMS) | **Incompleto (Esqueleto)** | Modelo `FunctionalTest` existe en Prisma, pero sin API ni UI. |
| **Módulo 3: Prevención** | RF-11 | Programa preventivo de 8 semanas | **Completo** | Estructura `Program` $\rightarrow$ `ProgramSession` $\rightarrow$ `SessionExercise`. |
| | RF-12 | Catálogo y biblioteca de ejercicios | **Completo** | CRUD de ejercicios con medios validados (YouTube, Vimeo, IMG). |
| | RF-13 | Marcado y desmarcado de sesión completada | **Completo** | Endpoint de toggle en `CompletedSession` con actualización optimista. |
| | RF-14 | Asignación personalizada de ejercicios | **Completo** | Fisioterapeuta asigna ejercicios individuales con dosificación y nota. |
| **Módulo 4: Seguimiento** | RF-16 | Panel de métricas individuales del atleta | **Completo** | Anillos de cumplimiento y barras de progreso por semana. |
| | RF-17 | Panel de control para Entrenador / Fisio | **Completo** | Vista de resumen con KPIs, atletas en alerta y baja adherencia. |
| | RF-18 | Ficha detallada de cada atleta para el equipo | **Completo** | Historial de dolor, sesiones cumplidas y asignación directa de ejercicios. |
| | RF-20 | Exportación a Excel con anonimización | **Completo** | Genera `.xlsx` con hojas de Deportistas, Molestias y Sesiones. |
| **Administración** | RF-ADM | Gestión de cuentas de usuario y entrenadores | **Completo** | Creación de roles, desactivación de cuentas y reasignación de coach. |

---

## 3. Arquitectura General y Tecnologías Verificadas

### 3.1. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE (Navegador)                   │
│   Angular 20 Standalone · Signals · SCSS · SVG Charts       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (Bearer JWT)
                               │ (Dev Proxy: :4200 -> :3000)
┌──────────────────────────────▼──────────────────────────────┐
│                    API REST (Node.js 22 LTS)                 │
│   Express 4 · TypeScript · Helmet · Rate-Limit · Zod         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM 6.19
                               │ TCP / PostgreSQL Wire Protocol
┌──────────────────────────────▼──────────────────────────────┐
│                  BASE DE DATOS (PostgreSQL 16)               │
│   Docker Compose · Tablas Relacionales · Constraints SQL    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2. Versiones de Software Verificadas en el Entorno

| Componente | Tecnología | Versión Instalada / Configurada |
| :--- | :--- | :--- |
| **Runtime Backend** | Node.js | v22.x (Requisito: `>= 20`) |
| **Framework Web Backend** | Express | `4.21.2` con `express-async-errors 3.1.1` |
| **Tipado Backend** | TypeScript | `5.9.3` (`ES2022`, módulo `Node16`) |
| **ORM de Base de Datos** | Prisma Client & CLI | `6.19.0` |
| **Motor de Base de Datos** | PostgreSQL | `16` (en contenedor Docker `luchasegura-db`) |
| **Validación de Esquemas** | Zod | `3.24.1` |
| **Criptografía y JWT** | bcryptjs / jsonwebtoken | `bcryptjs 2.4.3` / `jsonwebtoken 9.0.2` |
| **Generación de Reportes** | ExcelJS | `4.4.0` |
| **Frontend Framework** | Angular | `20.3.0` (Componentes Standalone, Signals) |
| **Compilador / Bundler** | @angular/build | `20.3.42` (basado en esbuild y Vite dev-server) |
| **Estilos** | Sass / SCSS | Tokens CSS personalizados con soporte nativo de temas |
| **Diálogos de Confirmación** | SweetAlert2 | `11.26.25` |

---

## 4. Estructura de Directorios del Repositorio

```
luchasegura/
├── backend/                        # API REST en Node.js + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma           # Esquema central de datos de PostgreSQL
│   │   ├── seed.ts                 # Población inicial de usuarios y reglas demo
│   │   ├── seed-program.ts         # Creación del programa de 8 semanas y ejercicios
│   │   ├── seed-team.ts            # Generación de historial de atletas para pruebas
│   │   ├── create-admin.ts         # Script CLI para crear superusuario inicial
│   │   ├── clean-demo.ts           # Script para purgar cuentas @demo.local
│   │   └── migrations/             # Historial de migraciones SQL aplicadas
│   ├── src/
│   │   ├── app.ts                  # Configuración de Express, middlewares y rutas
│   │   ├── config.ts               # Validación de variables de entorno y JWT secret
│   │   ├── db.ts                   # Instancia Singleton de PrismaClient
│   │   ├── index.ts                # Punto de entrada y arranque del servidor HTTP
│   │   ├── middleware/
│   │   │   ├── auth.ts             # Middleware requireAuth y control de roles requireRole
│   │   │   └── limits.ts           # Limitadores de tasa (express-rate-limit)
│   │   └── routes/
│   │       ├── admin.ts            # Gestión de usuarios y asignación de entrenadores
│   │       ├── athletes.ts         # Perfil del deportista y lista general
│   │       ├── auth.ts             # Registro, login, cambio y reseteo de claves
│   │       ├── exercises.ts        # Catálogo y asignación individual de ejercicios
│   │       ├── health.ts           # Health check (/api/health con SELECT 1)
│   │       ├── injuries.ts         # Reportes de dolor y antecedentes
│   │       ├── program.ts          # Consulta de sesiones y toggle completado
│   │       ├── rules.ts            # Umbrales de alerta clínica
│   │       └── team.ts             # Panel del cuerpo técnico y exportación a Excel
│   ├── .env.example                # Plantilla de variables de entorno
│   ├── package.json
│   └── tsconfig.json
├── frontend/                       # Aplicación Web Angular 20 Standalone
│   ├── public/                     # Favicons, manifiesto PWA y logos vectoriales
│   ├── src/
│   │   ├── index.html              # HTML base con SVGs de marca
│   │   ├── main.ts                 # Bootstrap de la aplicación Angular
│   │   ├── styles.scss             # Tokens de color, modo claro/oscuro, utilidades
│   │   └── app/
│   │       ├── app.config.ts       # Proveedores: Router, HttpClient, Interceptor
│   │       ├── app.routes.ts       # Definición de rutas y guardianes de navegación
│   │       ├── app.ts / app.html   # Componente raíz
│   │       ├── admin/              # Vistas de administración (usuarios y asignaciones)
│   │       ├── athlete/            # Vistas del deportista (inicio, plan, reporte, progreso, perfil)
│   │       ├── team/               # Vistas de entrenadores/fisios (resumen, alertas, atletas, ejercicios)
│   │       ├── pages/              # Páginas de acceso (login, registro, recuperación de clave)
│   │       └── core/               # Stores reactivos (Signals), servicios, interceptores, UI común
│   ├── angular.json                # Configuración de compilación y dev-server con proxy
│   ├── package.json
│   ├── proxy.conf.json             # Proxy de desarrollo: redirige /api -> http://localhost:3000
│   └── tsconfig.json
├── docs/                           # Documentación técnica, requisitos y diseño
├── docker-compose.yml              # Contenedor de PostgreSQL 16 para desarrollo
└── .github/workflows/ci.yml        # Flujo de Integración Continua (GitHub Actions)
```

---

## 5. Modelo de Datos y PostgreSQL (Prisma ORM)

La base de datos relacional modela el ciclo de vida del atleta, su consentimiento, sus reportes clínicos y su evolución neuromuscular.

### 5.1. Diagrama Entidad-Relación

```mermaid
erDiagram
    User ||--o| Athlete : "AthleteProfile"
    User ||--o{ Athlete : "CoachAthletes (1 Coach -> N Atletas)"
    User ||--o{ Consent : "firma"
    User ||--o{ PasswordResetToken : "solicita"
    User ||--o{ ExerciseAssignment : "asigna (Fisio)"

    Athlete ||--o{ Injury : "registra"
    Athlete ||--o{ CompletedSession : "completa"
    Athlete ||--o{ FunctionalTest : "evaluado en"
    Athlete ||--o{ ExerciseAssignment : "recibe"

    Injury ||--o{ Alert : "dispara al superar umbral"

    Program ||--o{ ProgramSession : "contiene"
    ProgramSession ||--o{ SessionExercise : "incluye"
    ProgramSession ||--o{ CompletedSession : "cumplida por"

    Exercise ||--o{ SessionExercise : "utilizado en"
    Exercise ||--o{ ExerciseAssignment : "prescrito en"
```

### 5.2. Enumeraciones del Esquema

- **`Role`**: `ATHLETE`, `COACH`, `PHYSIO`, `ADMIN`.
- **`Limitation`**: `NONE` (no limita), `PARTIAL` (limita parcialmente), `FULL` (impide el entrenamiento).
- **`TestPhase`**: `INITIAL` (evaluación inicial), `FINAL` (evaluación al completar programa).
- **`AlertStatus`**: `NEW` (alerta nueva sin atender), `REVIEWED` (alerta atendida y revisada por el cuerpo técnico).

### 5.3. Descripción Detallada de Tablas

1. **`User`**:
   - `id`: UUID (PK).
   - `email`: Cadena única, normalizada en minúsculas.
   - `passwordHash`: Hash generado con `bcryptjs` (factor de costo 12).
   - `fullName`: Nombre completo.
   - `role`: Enum `Role`.
   - `active`: Booleano (soft-disable de cuenta).
   - `passwordChangedAt`: Timestamp para revocación de JWTs emitidos antes del cambio de contraseña.
   - `mustChangePassword`: Booleano para exigir cambio obligatorio en credenciales temporales.

2. **`Athlete`**:
   - `id`: UUID (PK).
   - `userId`: FK única a `User` (eliminación en cascada).
   - `coachId`: FK a `User` (rol `COACH`), eliminación en `SetNull`.
   - `birthDate`: Fecha de nacimiento (DateTime).
   - `weightKg`: Decimal `Decimal(5, 2)`.
   - `category`: Categoría de peso (ej. "65 kg").
   - `style`: Estilo de lucha ("Libre", "Grecorromana", "Femenina").
   - `yearsExperience`: Entero (años de práctica).
   - `notes`: Notas u observaciones adicionales.
   - Índice en: `coachId`.

3. **`Consent`**:
   - `id`: UUID (PK).
   - `userId`: FK a `User`.
   - `textVersion`: Versión del texto legal del consentimiento.
   - `guardianName`: Nombre del acudiente responsable (obligatorio si el deportista es menor de edad).
   - `acceptedAt`: Timestamp de aceptación.

4. **`Injury`**:
   - `id`: UUID (PK).
   - `athleteId`: FK a `Athlete`.
   - `isHistory`: Booleano (`true` = antecedente antiguo, `false` = molestia activa reciente).
   - `bodyZone`: Zona corporal (ej. "Hombro", "Rodilla", "Zona lumbar").
   - `injuryType`: Diagnóstico o tipo (ej. "Esguince", "Contractura").
   - `intensity`: Entero del 0 al 10 (con restricción SQL `CHECK (intensity BETWEEN 0 AND 10)`).
   - `whenOccurs`: Momento de aparición ("Entrenando", "Al agarrar", etc.).
   - `mechanism`: Mecanismo lesional.
   - `limitation`: Enum `Limitation`.
   - `daysAbsent`: Días sin entrenar (restricción SQL `CHECK (daysAbsent >= 0)`).
   - `recurrent`: Booleano de recurrencia.
   - `occurredAt`: Fecha del suceso.
   - Índice compuesto en: `[athleteId, occurredAt]`.

5. **`AlertRule`**:
   - `id`: UUID (PK).
   - `bodyZone`: Cadena opcional (`null` = aplica como regla global general).
   - `minIntensity`: Umbral de dolor (1 a 10) que dispara la alerta.
   - `createdById`: Identificador del fisioterapeuta que fijó la regla.

6. **`Alert`**:
   - `id`: UUID (PK).
   - `injuryId`: FK a `Injury` (eliminación en cascada).
   - `status`: Enum `AlertStatus` (`NEW`, `REVIEWED`).
   - Índices en: `[status, createdAt]` y `[injuryId]`.

7. **`Program`, `ProgramSession`, `Exercise`, `SessionExercise`**:
   - Estructura normalizada del plan neuromuscular.
   - `ProgramSession` tiene restricción única compuesta `[programId, week, number]`.
   - `SessionExercise` modela la relación N:M entre sesión y ejercicio, ordenado por `position`.

8. **`ExerciseAssignment`**:
   - Asignación personalizada de un fisioterapeuta a un deportista específico.
   - Restricción única en `[athleteId, exerciseId]`.

9. **`PasswordResetToken`**:
   - `tokenHash`: SHA-256 del token aleatorio entregado al usuario.
   - `expiresAt`: Ventana de validez de 30 minutos.
   - `usedAt`: Fecha de canje para evitar reuso.

---

## 6. Endpoints y Contratos de la API REST

Todos los endpoints (salvo los públicos) requieren el encabezado:  
`Authorization: Bearer <JWT>`

### 6.1. Módulo de Autenticación (`/api/auth`)

| Método | Ruta | Acceso | Body / Parámetros | Respuesta Exitosa | Códigos de Error |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Público | `{ email, password, fullName, birthDate, consent: { textVersion, guardianName? } }` | `201 Created`<br>`{ id, email }` | `400` (datos inválidos o menor sin acudiente)<br>`409` (correo duplicado)<br>`429` (tasa excedida) |
| `POST` | `/api/auth/login` | Público | `{ email, password }` | `200 OK`<br>`{ token, user: { id, fullName, role, mustChangePassword } }` | `400` (validación)<br>`401` (credenciales incorrectas)<br>`429` (tasa excedida) |
| `GET` | `/api/auth/me` | Autenticado | Ninguno | `200 OK`<br>`{ id, email, fullName, role, mustChangePassword }` | `401` (sesión inválida) |
| `POST` | `/api/auth/change-password` | Autenticado | `{ currentPassword, newPassword }` | `200 OK`<br>`{ token, user }` (renueva token) | `400` (clave actual errónea o idéntica a la nueva) |
| `POST` | `/api/auth/forgot-password` | Público | `{ email }` | `200 OK`<br>`{ message: "Si el correo está..." }` | `400` (email inválido)<br>`429` (tasa excedida) |
| `GET` | `/api/auth/reset-password/check` | Público | Query: `?token=<token>` | `200 OK`<br>`{ valid: boolean }` | `200` (incluso si token no existe o venció) |
| `POST` | `/api/auth/reset-password` | Público | `{ token, password }` | `200 OK`<br>`{ message: "Contraseña actualizada" }` | `400` (token expirado o inválido) |

### 6.2. Módulo de Atletas (`/api/athletes`)

| Método | Ruta | Roles Permitidos | Body / Query | Respuesta |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/athletes/me` | `ATHLETE` | Ninguno | `200 OK`: Ficha `Athlete` completa |
| `PUT` | `/api/athletes/me` | `ATHLETE` | `{ birthDate?, weightKg?, category?, style?, yearsExperience?, notes? }` | `200 OK`: Ficha actualizada |
| `GET` | `/api/athletes` | `COACH`, `PHYSIO` | Ninguno | `200 OK`: Lista de deportistas (filtrada por `coachId` si es entrenador) |

### 6.3. Módulo de Lesiones y Molestias (`/api/injuries`)

| Método | Ruta | Roles Permitidos | Body / Parámetros | Comportamiento |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/injuries` | `ATHLETE` | `{ isHistory, bodyZone, intensity?, whenOccurs?, limitation, daysAbsent?, recurrent?, notes? }` | Crea el registro. Si `intensity >= rule.minIntensity` (y no es antecedente), crea automáticamente una `Alert`. |
| `GET` | `/api/injuries/mine` | `ATHLETE` | Ninguno | Historial propio ordenado por `occurredAt desc`. |
| `DELETE` | `/api/injuries/:id` | `ATHLETE` | Parámetro `id` | Borra antecedente siempre; borra reporte activo **solo si tiene menos de 24 horas** de creado. |

### 6.4. Módulo de Programa y Sesiones (`/api/program`)

| Método | Ruta | Roles Permitidos | Funcionalidad |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/program/current` | `ATHLETE` | Devuelve el programa actual, cálculo de semana actual (`currentWeek`), sesiones y marcas `done`. |
| `POST` | `/api/program/sessions/:id/toggle` | `ATHLETE` | Invierte el estado de completado (`CompletedSession`). Rechaza si la sesión pertenece a semanas futuras. |

### 6.5. Módulo del Equipo Técnico (`/api/team`)

| Método | Ruta | Roles Permitidos | Funcionalidad |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/team/overview` | `COACH`, `PHYSIO` | KPIs globales (`athletes`, `avgCompliance`, `newAlerts`, `lowAdherence`), lista de deportistas y alertas activas. |
| `POST` | `/api/team/alerts/:id/review` | `COACH`, `PHYSIO` | Marca la alerta como revisada (`status: REVIEWED`). |
| `GET` | `/api/team/athletes/:id` | `COACH`, `PHYSIO` | Ficha detallada del deportista: historial de dolor, gráfico de barras de cumplimiento y lesiones. |
| `GET` | `/api/team/export` | `COACH`, `PHYSIO` | Query `?anon=1` para omitir PII. Genera archivo binario Excel (`.xlsx`) con tres pestañas. |

### 6.6. Módulo de Ejercicios y Reglas (`/api/exercises`, `/api/rules`, `/api/admin`)

- `/api/rules`: `GET` (Fisio y Coach), `POST` y `DELETE` (Solo `PHYSIO`).
- `/api/exercises`: `GET` (Fisio y Coach), `POST`, `PATCH`, `DELETE` (Solo `PHYSIO`).
- `/api/exercises/assignments`: Prescripción directa de fisioterapia para un deportista.
- `/api/admin/users`: CRUD administrativo de usuarios institucionales y asignación de entrenadores.

---

## 7. Frontend: Arquitectura Angular 20

### 7.1. Características Técnicas Centrales
- **Sin NgModules:** 100% componentes `standalone` cargados perezosamente vía `loadComponent: () => import(...)`.
- **Reactividad con Signals:** Manejo de estado local y global mediante `signal()`, `computed()` y `effect()`. Ausencia de suscripciones manuales innecesarias con RxJS.
- **Transiciones de Vistas Nativas:** Habilitado `withViewTransitions()` en el enrutador para animaciones fluidas.
- **Diseño sin librerías pesadas:** Toda la interfaz está desarrollada con CSS/SCSS nativo apoyado en variables CSS (Tokens de diseño) en [styles.scss](file:///home/snuuzz/Proyectos/luchasegura/frontend/src/styles.scss), con soporte completo para `light` y `dark mode`.

### 7.2. Árbol de Estado y Stores Reactivos

```
                  ┌──────────────────────┐
                  │     AuthService      │
                  │ (Token, User Signal) │
                  └──────────┬───────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ AthleteStore │      │  TeamStore   │      │  AdminStore  │
│  - profile   │      │  - data      │      │  - users     │
│  - injuries  │      │  - athletes  │      │  - coaches   │
│  - program   │      │  - alerts    │      │  - athletes  │
│  - weekBars  │      │  - stats     │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

1. **`AuthService`**: Almacena el token y los datos de usuario en `sessionStorage` (aislado por pestaña). Monitorea vencimiento de token JWT y caducidad por inactividad tras 30 minutos sin interacción.
2. **`AthleteStore`**: Agrupa en un `forkJoin` la carga del perfil, las lesiones y el programa preventivo. Mantiene estados computados como `plannedToDate`, `compliance`, `nextSession` y `weekBars`.
3. **`TeamStore`**: Mantiene los datos agregados del panel de entrenadores y fisioterapeutas. Implementa actualización optimista para atender alertas (`review`).
4. **`AdminStore`**: Administra la lista de usuarios, creación de cuentas y vinculación de entrenadores a deportistas.

### 7.3. Guardianes de Navegación (`guards.ts`)
- `guestGuard`: Redirige a usuarios ya autenticados a su respectivo panel según su rol, o a `/cambiar-contrasena` si `mustChangePassword` es verdadero.
- `authGuard`: Protege rutas que requieren cualquier sesión activa.
- `roleGuard(...roles)`: Valida que el rol del usuario coincida exactamente con los roles permitidos para la ruta solicitada.

---

## 8. Flujo de Datos y Casos de Uso Críticos

### 8.1. Flujo de Reporte de Dolor y Disparo de Alerta

```mermaid
sequenceDiagram
    autonumber
    actor Deportista
    participant UI as ReportPage (Angular)
    participant API as injuriesRouter (Express)
    participant DB as PostgreSQL (Prisma)
    actor Fisio as Fisioterapeuta

    Deportista->>UI: Selecciona zona (ej. "Hombro") e intensidad (ej. 7/10)
    UI->>API: POST /api/injuries { bodyZone: "Hombro", intensity: 7, limitation: "PARTIAL" }
    API->>DB: INSERT INTO Injury
    API->>DB: SELECT * FROM AlertRule WHERE bodyZone = 'Hombro' OR bodyZone IS NULL
    DB-->>API: AlertRule { minIntensity: 5 }
    Note over API: Intensidad reportada (7) >= Umbral (5)
    API->>DB: INSERT INTO Alert (injuryId, status='NEW')
    API-->>UI: 201 Created (Injury)
    UI->>Deportista: Muestra confirmación Toast
    Fisio->>API: GET /api/team/overview
    API-->>Fisio: Lista actualizada con Alerta NEW y badge destacado
```

### 8.2. Flujo de Control de Sesión e Inactividad

```mermaid
sequenceDiagram
    autonumber
    participant Usuario
    participant Watcher as SessionWatcher (NgZone Outside)
    participant Auth as AuthService
    participant Interceptor as authInterceptor

    Usuario->>Watcher: Evento interactivo (pointerdown / keydown)
    Watcher->>Auth: Actualiza timestamp de última actividad (ls_last)
    Note over Watcher: Cada 15 segundos verifica inactividad (> 30 min)
    alt Inactividad detectada
        Watcher->>Auth: logout()
        Auth->>Usuario: Redirige a /login y muestra Toast informativo
    end
    Usuario->>Interceptor: Petición HTTP /api/athletes/me
    alt Token vencido (401 devuelto por backend)
        Interceptor->>Auth: logout()
        Auth->>Usuario: Cierra sesión y solicita reingreso
    end
```

---

## 9. Dependencias y Comandos de Ejecución

### 9.1. Variables de Entorno del Backend (`.env`)
```bash
PORT=3000
DATABASE_URL="postgresql://luchasegura:luchasegura@localhost:5432/luchasegura?schema=public"
JWT_SECRET="super-secret-key-con-mas-de-32-caracteres-para-produccion"
JWT_EXPIRES_IN="2h"
CORS_ORIGIN="http://localhost:4200"
NODE_ENV="development"
```

### 9.2. Comandos Operativos

- **Iniciar base de datos (Docker):**
  ```bash
  docker compose up -d
  ```
- **Backend:**
  ```bash
  cd backend
  npm install
  npx prisma migrate dev       # Aplica migraciones
  npm run db:seed              # Crea usuarios demo y reglas base
  npm run dev                  # Servidor de desarrollo en http://localhost:3000
  npm run typecheck            # Verificación de tipos TypeScript (tsc --noEmit)
  ```
- **Usuarios de prueba preconfigurados:**  
  Todos con contraseña: `Cambiar123!`
  - Atleta: `deportista@demo.local`
  - Entrenador: `entrenador@demo.local`
  - Fisioterapeuta: `fisio@demo.local`
  - Administrador: `admin@demo.local`
- **Frontend:**
  ```bash
  cd frontend
  npm install
  npm start                    # Servidor Angular en http://localhost:4200
  npm run build                # Compilación para producción
  ```
