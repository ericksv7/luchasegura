# LuchaSegura · Resumen Ejecutivo del Estado del Proyecto

> **Fecha de la Auditoría:** Noviembre 2026  
> **Capa Tecnológica:** Angular 20 · Node.js 22 LTS · TypeScript · Prisma ORM · PostgreSQL 16  
> **Propósito:** Brindar una visión ejecutiva, clara y de alto nivel sobre la salud técnica, riesgos y prioridades inmediatas de la aplicación **LuchaSegura**.

---

## 1. Veredicto General

La aplicación **LuchaSegura** cuenta con un esqueleto técnico moderno, bien estructurado y con un diseño visual limpio y accesible. El frontend en **Angular 20 Standalone con Signals** es ligero y no depende de librerías CSS pesadas ni de bibliotecas de gráficos monolíticas, implementando sus propias gráficas vectoriales SVG. El backend en **Express + Prisma + PostgreSQL** posee una separación clara por responsabilidades (rutas, middlewares, esquemas).

Sin embargo, para que la aplicación esté lista para pruebas de campo con deportistas reales y sea apta para producción, requiere la intervención inmediata en **3 aspectos críticos**:
1. **Estabilidad básica del código:** Eliminar rutas duplicadas en autenticación y blindar el middleware de errores frente a excepciones de Prisma (concurrencia y registros no encontrados).
2. **Cumplimiento legal y privacidad:** El sistema maneja datos de salud de menores de edad (Ley 1581 de Colombia). Se debe reforzar el registro del acudiente y registrar pistas de auditoría cada vez que se descarguen datos médicos en Excel.
3. **Restablecimiento de contraseñas:** La funcionalidad de recuperación de cuenta por correo no está conectada en producción.

---

## 2. Fortalezas de la Implementación Actual

- **Arquitectura Frontend Moderna:** Componentes 100% standalone, reactividad mediante Angular Signals (`computed`, `signal`), transiciones de vista nativas (`withViewTransitions`) y tipado estricto sin errores.
- **Gráficas Personalizadas Ligeras:** Componentes nativos SVG (`ProgressRing`, `LineChart`, `BarChart`) que ahorran cientos de kilobytes en el bundle final frente a dependencias externas.
- **Control de Inactividad y Sesión:** El frontend cuenta con un `SessionWatcher` optimizado fuera de la zona de Angular (`runOutsideAngular`) que cierra sesiones tras 30 minutos de inactividad o expiración del token.
- **Diseño Visual Coherente:** Modo oscuro y modo claro nativos con tokens CSS bien pensados y botones accesibles.
- **Integridad Referencial en Base de Datos:** Migraciones con restricciones SQL nativas (`CHECK ("intensity" BETWEEN 0 AND 10)` y `CHECK ("daysAbsent" >= 0)`), eliminación en cascada y claves foráneas bien definidas.

---

## 3. Resumen de Problemas Críticos y Prioritarios

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SEMÁFORO DE SALUD DEL PROYECTO                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔴 CRÍTICO:   Ruta de registro duplicada en backend (auth.ts)              │
│  🔴 CRÍTICO:   Errores de Prisma P2002/P2025 terminan en 500 no controlado  │
│  🔴 CRÍTICO:   Recuperación de contraseña inoperativa en producción         │
│  🟠 ALTO:      Falta de auditoría al exportar Excel con datos de salud      │
│  🟠 ALTO:      Consulta a base de datos en cada petición HTTP con JWT       │
│  🟠 ALTO:      Falta de paginación en listados de atletas y usuarios        │
│  🟡 MEDIO:     ng build falla en entornos aislados por fuentes externas     │
│  🟡 MEDIO:     Doble botón de cambio de tema renderizado en pantalla        │
│  🟡 MEDIO:     0% cobertura de pruebas en el backend                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Próximos Pasos Recomendados (Hoja de Ruta Inmediata)

### Paso 1: Estabilización Inmediata (1 a 2 días de trabajo)
- [ ] Eliminar la segunda declaración de `POST /register` en [backend/src/routes/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/routes/auth.ts).
- [ ] Implementar captura de errores `PrismaClientKnownRequestError` en [backend/src/app.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/app.ts) para retornar `409 Conflict` (P2002) y `404 Not Found` (P2025).
- [ ] Normalizar la URL en [backend/src/middleware/auth.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/middleware/auth.ts) para evitar bloqueos con `/api/auth/change-password/`.
- [ ] Añadir escuchadores de `SIGTERM` y `SIGINT` en [backend/src/index.ts](file:///home/snuuzz/Proyectos/luchasegura/backend/src/index.ts) para desconexión limpia de Prisma.

### Paso 2: Seguridad y Recuperación de Claves (2 a 3 días)
- [ ] Configurar un transporte SMTP o API transaccional (ej. Resend / Nodemailer) para el envío de correos de recuperación de contraseña.
- [ ] Incorporar tabla `AuditLog` en Prisma para registrar quién descarga reportes clínicos en Excel.
- [ ] Requerir identificación y contacto del acudiente en el registro de menores de 18 años.

### Paso 3: Optimización y Experiencia de Usuario (3 a 5 días)
- [ ] Descargar localmente las fuentes Manrope a `frontend/public/fonts/` para habilitar compilación offline y mejorar la privacidad.
- [ ] Corregir la duplicación del botón `ThemeToggle` en la interfaz.
- [ ] Implementar paginación (`limit`, `offset`) en los endpoints de listado del cuerpo técnico.
- [ ] Incorporar pruebas de integración básicas para la API en el backend.

---

## 5. Conclusión

El proyecto tiene bases muy sólidas y la arquitectura elegida es adecuada para los objetivos de la Universidad del Rosario y el IDRD. Siguiendo el plan de trabajo detallado en `03_PLAN_DE_MEJORAS.md`, la aplicación alcanzará un estándar profesional, seguro y de alta disponibilidad listo para el despliegue institucional.
