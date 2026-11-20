# Preparación para despliegue

La referencia comprobada es una ejecución local con PostgreSQL aislado y una compilación de producción. El alojamiento, dominio, responsables y objetivos de disponibilidad siguen pendientes.

| Área | Capacidad actual | Decisión o verificación previa |
| --- | --- | --- |
| Frontend | Compilación Angular estática y rutas de aplicación | Alojamiento, caché de estáticos y retorno a `index.html` para rutas Angular. |
| API | Express y rutas relativas `/api` | Definir proceso, supervisión y enrutamiento. Validar el origen si hay solicitudes cruzadas. |
| Red | Helmet y configuración de proxy | Aprobar dominio, DNS y certificado HTTPS. Configurar únicamente saltos confiables y probar cabeceras. |
| Secretos | Variables de entorno y parámetros documentados | Usar gestión de secretos, restringir acceso y definir rotación. |
| PostgreSQL | Prisma y migraciones incrementales | Aprobar versión, acceso privado, usuario, respaldo y restauración en entorno segregado. |
| Monitoreo | Endpoint `/api/health` y errores públicos controlados | Alertas, disponibilidad, registros con acceso restringido y reglas de retención sin datos sensibles. |
| Escalado | Límites de solicitudes en la aplicación | Validar su eficacia con la topología real, especialmente con varias instancias. |
| Privacidad | Permisos por rol y reportes seudonimizados | Aprobación institucional, responsables, tratamiento de menores, retención, trazabilidad y revisión de permisos. |

## Procedimiento para una futura publicación autorizada

1. Resolver los pendientes de privacidad, recuperación y dependencias aplicables. Documentar responsables y decisión sobre el uso previsto.
2. Preparar un entorno de validación con HTTPS, PostgreSQL y datos sintéticos. Probar copia de seguridad y restauración, con objetivos de tiempo y pérdida definidos por el responsable.
3. Compilar ambos proyectos y verificar configuración sin publicar secretos. Revisar el estado de migraciones y tomar un respaldo antes de aplicar migraciones autorizadas.
4. Iniciar API con configuración de producción, publicar estáticos y enrutar `/api`. Inicializar el primer administrador por el procedimiento seguro cuando corresponda.
5. Verificar salud, acceso y salida, roles, redirecciones, descarga autorizada y observabilidad. Documentar cómo volver a una versión compatible y cómo restaurar ante incidentes.

[Comandos](08_INSTALACION_Y_EJECUCION.md) · [Limitaciones](10_LIMITACIONES_Y_PENDIENTES.md)

## Respaldo y restauración de PostgreSQL

Define frecuencia y retención con la institución. Realiza el respaldo con una identidad de acceso controlado y conserva el archivo cifrado con permisos restringidos. Practica la restauración en una base vacía aislada, con credenciales independientes.

```sh
pg_dump --format=custom --file=luchasegura.dump "$DATABASE_URL"
pg_restore --list luchasegura.dump
pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE_URL" luchasegura.dump
```

Configura ambas URL en su entorno correspondiente mediante el mecanismo de secretos. Protege el historial de consola y la salida del listado. Después de restaurar, comprueba el estado de migraciones, `/api/health`, recuentos representativos, acceso por rol y un flujo con datos autorizados. Registra duración y resultados del ensayo. La restauración de una instalación institucional queda pendiente de validación. Los respaldos con datos personales se recuperan únicamente en destinos autorizados con controles equivalentes. Los entornos de pruebas usan copias sintéticas. [Procedimiento de estabilización](../avance/cierre-integral/DECISIONES_Y_RIESGOS.md)

## Mantenimiento

Revisa salud de la API, expiración de credenciales SMTP y comportamiento de descargas. Controla el acceso a copias de seguridad y registros. Programa actualizaciones con un respaldo reciente y valida migraciones en una réplica de prueba antes del cambio. Evita registrar tokens de recuperación, cuerpos de solicitud o identificadores de salud en el proxy. Ante una incidencia documenta el momento, módulo, código de respuesta y categoría técnica sin datos sensibles.
