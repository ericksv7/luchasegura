# Decisiones técnicas

Registro breve de las decisiones tomadas y su motivo.

| # | Decisión | Motivo |
| --- | --- | --- |
| 1 | Frontend en Angular | Es el framework que ya maneja el equipo. |
| 2 | Backend en Node.js con Express y TypeScript | Ligero, un solo lenguaje en todo el proyecto y suficiente para el tamaño del grupo. (Se evaluó .NET Core al inicio y se descartó por peso y por preferencia del desarrollador.) |
| 3 | PostgreSQL | Datos relacionales (usuarios, lesiones, sesiones), gratuita y con buen soporte de hosting. |
| 4 | Prisma como ORM | Esquema declarativo, migraciones versionadas y tipos generados para TypeScript. |
| 5 | JWT con roles | Controla qué ve cada rol. Los datos de un deportista solo los ven él, su entrenador y el fisioterapeuta. |
| 6 | Docker Compose solo para la base de datos | Evita instalar PostgreSQL a mano y deja a todos con la misma versión. |
| 7 | Datos de ejemplo ficticios | Hay datos de salud de menores: nunca se suben datos reales al repositorio. |
