# LuchaSegura

Aplicación web para la **prevención de lesiones en lucha olímpica**. Proyecto de Fisioterapia (Universidad del Rosario) con la selección Bogotá (IDRD).

El deportista registra su perfil y sus molestias y sigue un programa preventivo de 8 semanas. El entrenador y el fisioterapeuta ven el cumplimiento y los reportes. La aplicación **orienta, no diagnostica**.

> Estado: esqueleto técnico listo. Los módulos se terminan de definir con el equipo de Fisioterapia (ver [docs/requisitos.md](docs/requisitos.md)).

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | Angular 20 (SCSS, rutas, HttpClient) |
| Backend | Node.js 22 + Express + TypeScript |
| Base de datos | PostgreSQL 16 con Prisma ORM |
| Autenticación | JWT con roles (deportista, entrenador, fisioterapeuta, administrador) |
| Entorno local | Docker Compose (solo para la base de datos) |

## Estructura

```
luchasegura/
├── backend/            API REST (Express + Prisma)
│   ├── prisma/         esquema, migraciones y datos de ejemplo
│   └── src/            rutas, middleware y configuración
├── frontend/           Aplicación Angular
├── docs/               documentación del proyecto
├── docker-compose.yml  PostgreSQL local
└── .github/workflows/  integración continua
```

## Requisitos previos

- Node.js 22.22.3 o superior (o 24 LTS)
- Docker Desktop (o un PostgreSQL 16 instalado)
- Git

## Puesta en marcha

### 1. Base de datos

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # en Windows: copy .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed             # usuarios y datos ficticios de prueba
npm run dev                 # http://localhost:3000/api/health
```

Usuarios de prueba (contraseña `Cambiar123!`): `deportista@demo.local`, `entrenador@demo.local`, `fisio@demo.local`, `admin@demo.local`.

### 3. Frontend

```bash
cd frontend
npm install
npm start                   # http://localhost:4200
```

La página inicial muestra si la API está conectada. El servidor de desarrollo redirige `/api` a `localhost:3000` (ver `frontend/proxy.conf.json`).

## Documentación

- [Requisitos y módulos](docs/requisitos.md)
- [Arquitectura](docs/arquitectura.md)
- [Modelo de datos](docs/modelo-de-datos.md)
- [Sistema visual](docs/diseno.md)
- [Decisiones técnicas](docs/decisiones.md)
- [Guía de trabajo (Git y commits)](docs/guia-de-trabajo.md)

## Privacidad

El proyecto maneja datos de salud de menores de edad. **No se suben datos reales al repositorio** y los datos de ejemplo son ficticios. Antes de recolectar datos reales se requiere el consentimiento informado y los avales de la universidad y el IDRD (Ley 1581 de 2012).
