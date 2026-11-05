# Arquitectura

```
Angular (navegador / PWA)  ⇄  API REST Node + Express  ⇄  PostgreSQL
        :4200                       :3000                    :5432
```

## Backend

- **Express** con **TypeScript**. Una carpeta por responsabilidad: `routes/` (endpoints), `middleware/` (autenticación y roles), `config.ts` (variables de entorno), `db.ts` (cliente Prisma).
- **Validación** de entradas con Zod en cada endpoint.
- **Autenticación**: inicio de sesión devuelve un JWT. El middleware `requireAuth` lo verifica y `requireRole(...)` restringe por rol.
- **Seguridad básica**: `helmet`, CORS limitado al origen del frontend, contraseñas con bcrypt.

## Endpoints actuales

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | /api/health | público | Estado de la API y la base de datos |
| POST | /api/auth/register | público | Crea un deportista con consentimiento |
| POST | /api/auth/login | público | Devuelve el token |
| GET | /api/auth/me | autenticado | Datos del usuario |
| GET, PUT | /api/athletes/me | deportista | Ver y editar su perfil |
| GET | /api/athletes | entrenador, fisioterapeuta | Lista de deportistas (el entrenador solo ve los suyos) |
| POST | /api/injuries | deportista | Reportar molestia o antecedente (genera alerta si supera el umbral) |
| GET | /api/injuries/mine | deportista | Historial propio |

## Frontend

Angular 20 con componentes standalone. Los tokens de color (modo claro y oscuro) están en `src/styles.scss`. El servidor de desarrollo usa un proxy hacia la API.

Siguiente paso previsto: `ng add @angular/pwa` para que la aplicación sea instalable en el celular.

## Despliegue (por definir)

Frontend como sitio estático, API en un servicio de Node y PostgreSQL administrado, con plan gratuito o de bajo costo.
