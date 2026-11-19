# Arquitectura técnica

## Aplicación y persistencia

```mermaid
flowchart LR
  U["Navegador · Angular 20"] <-->|"HTTP y JSON, XLSX"| A["Node.js · Express"]
  A --> S["Servicios de dominio y ExcelJS"]
  A --> P["Prisma Client"]
  S --> P
  P <--> D[("PostgreSQL")]
```

## Componentes y capas

```mermaid
flowchart TD
  R["Router y guards"] --> V["Shells y páginas standalone"]
  V --> S["Stores con Signals y servicios HTTP"]
  S --> I["Interceptor de autenticación"]
  I --> M["Express · middleware"]
  M --> E["Rutas de dominio"]
  E --> P["Prisma y servicios de consulta"]
```

Angular usa TypeScript, formularios reactivos, Angular Router y SCSS. Las vistas se cargan bajo demanda por rol. `AthleteStore` y `TeamStore` coordinan consultas y actualizaciones. La vista de equipo se comparte entre entrenador y fisioterapeuta, con diferencias de navegación y datos. La API recibe solicitudes relativas a `/api`. El proxy de desarrollo apunta a Express en el puerto 3000.

| Carpeta | Contenido |
| --- | --- |
| `frontend/src/app/core` | Sesión, guards, interceptores, tema y componentes reutilizables. |
| `frontend/src/app/admin`, `athlete`, `team`, `pages` | Espacios de rol y acceso común. |
| `backend/src/routes` | API REST y validación de operaciones. |
| `backend/src/middleware`, `services` | Autenticación, límites, errores y lógica compartida de programa, alertas y reportes. |
| `backend/prisma`, `backend/tests` | Esquema, migraciones, inicialización y pruebas. |

## Solicitud HTTP

```mermaid
sequenceDiagram
  actor U as Usuario
  participant A as Angular
  participant E as Express
  participant P as PostgreSQL vía Prisma
  U->>A: Solicita una ficha o registra una operación
  A->>E: HTTP con JWT
  E->>P: Verifica cuenta y consulta dentro del alcance
  alt Solicitud válida
    P-->>E: Datos o confirmación
    E-->>A: Resultado
  else Acceso denegado o error
    E-->>A: Estado HTTP y mensaje público
  end
  A-->>U: Actualiza vista o muestra el error
```

## Rutas y decisiones técnicas

| Prefijo o ruta | Función |
| --- | --- |
| `/api/health`, `/api/auth` | Conexión y gestión de sesión. |
| `/api/admin`, `/api/athletes` | Cuentas, asignaciones y perfil. |
| `/api/injuries`, `/api/team`, `/api/team/alerts` | Registro, fichas e historial profesional. |
| `/api/program`, `/api/exercises`, `/api/rules` | Sesiones, biblioteca, asignaciones y umbrales. |
| `GET /api/team/export` | Archivo Excel para fisioterapia. |

La sesión se guarda por pestaña en `sessionStorage`. Angular aplica caducidad por 30 minutos de inactividad y el servidor verifica expiración del JWT, rol efectivo, estado activo y versión de contraseña. Las contraseñas se almacenan con bcrypt. Express utiliza Helmet, CORS, límites de solicitudes y respuestas sin caché para API. Zod valida entradas. Los errores públicos usan mensajes controlados y los fallos de datos disponen de respuesta 503.

El servidor reutiliza el cálculo de avance del programa. Las actuaciones usan versión y solicitud idempotente, y los cambios concurrentes que afectan sesiones usan transacciones. ExcelJS genera el libro con datos de PostgreSQL y texto literal para entradas de usuario. El alcance de fisioterapia comprende las fichas del equipo en la instalación actual. El entrenador se filtra por `coachId`. [Permisos y pruebas](07_PRUEBAS_Y_RESULTADOS.md)

## Configuración

| Variable de backend | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión requerida por Prisma. |
| `JWT_SECRET` | Secreto requerido, aleatorio y de al menos 32 caracteres. |
| `JWT_EXPIRES_IN` | Duración con unidad, por defecto `2h`. |
| `PORT` | Puerto HTTP, por defecto `3000`. |
| `CORS_ORIGIN` | Origen permitido, por defecto `http://localhost:4200`. |
| `TRUST_PROXY_HOPS` | Saltos de proxies confiables, por defecto cero. |
| `NODE_ENV` | Activa reglas de producción al configurarse como `production`. |

[Montaje local](08_INSTALACION_Y_EJECUCION.md) · [Registro de rutas](../../backend/src/app.ts) · [Esquema Prisma](../../backend/prisma/schema.prisma)
