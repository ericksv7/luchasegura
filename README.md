# LuchaSegura

Aplicación de apoyo al seguimiento de un programa preventivo para deportistas de lucha libre olímpica. El proyecto académico de Fisioterapia de la Universidad del Rosario y el IDRD propone una evaluación inicial, ocho semanas de trabajo con tres sesiones semanales y una evaluación final.

El deportista consulta su plan y progreso, registra sesiones, molestias y bienestar, y accede a sus evaluaciones e informe. Fisioterapia documenta evaluaciones, revisiones y seguimientos, gestiona ejercicios y consulta informes autorizados. Entrenamiento acompaña a sus deportistas asignados. Administración gestiona cuentas, roles y asignaciones. La versión integrada incluye encuestas preventivas de demostración e informes comparativos con exportaciones Excel individuales y grupales sintéticas.

## Ejecutar la demostración

Desde la raíz, con Node.js, npm y las herramientas nativas de PostgreSQL disponibles:

```bash
npm ci --prefix backend
npm ci --prefix frontend
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix frontend run build
TMPDIR=/tmp npm --prefix backend test -- --reports-demo
```

Abre `http://127.0.0.1:4288/login`. El ejecutor imprime las cuentas ficticias y las rutas de las fichas. Usa Ctrl+C para detener el sitio y su clúster temporal.

## Documentación

- [Paquete de entrega académica](docs/entrega-academica/README.md)
- [Instalación y pruebas](docs/entrega-academica/INSTALACION.md)
- [Manual y demostración](docs/entrega-academica/DEMOSTRACION.md)
- [Diseño visual](docs/diseno.md)
- [Plantillas y ejemplos profesionales de Excel](docs/avance/fase8-informes-comparativos/EXCEL.md)

El código se organiza en `frontend/` (Angular standalone), `backend/src/` (Node.js, Express y TypeScript), `backend/prisma/` (PostgreSQL, esquema y migraciones), `backend/tests/` (pruebas y demostración) y `.github/workflows/` (CI).

La entrega usa datos ficticios. El paso a un piloto requiere aval institucional, revisión ética y de privacidad, y validación profesional. Consulta las [limitaciones y las condiciones de uso con datos reales](docs/entrega-academica/CIERRE.md).
