# Decisiones y riesgos

- Las pruebas de escritura usan clústeres sintéticos independientes. La base habitual queda fuera de los cambios. Preparar la autorización de migraciones por separado.
- Consentimiento, tratamiento de menores, finalidades, retención y responsables requieren revisión institucional. Las evaluaciones, el programa y los umbrales requieren revisión académica y de fisioterapia.
- La validación de SMTP real y cualquier despliegue externo requieren autorización. La batería automatizada solo usa SMTP en loopback.
- La fecha de un antecedente es un dato civil opcional. La marca histórica se conserva como dato de auditoría y orden, incluso si no se conoce una fecha civil. La migración conserva el día UTC que mostraba el editor anterior cuando la marca difiere de la de creación. Si ambas coinciden, registra fecha desconocida. Esa coincidencia fue el valor por defecto del sistema anterior y por sí sola no permite demostrar si hubo una fecha explícita.

## Ventana de migración habitual pendiente

Destino comprobado en lectura: PostgreSQL local, puerto 5432, base `luchasegura`. El lote incluiría las dos migraciones del catálogo (altas, archivo y ajustes de ejercicios) y `20261120120000_history_civil_date` (columna de fecha civil y conversión de registros anteriores). La migración de catálogo archiva también coincidencias exactas por nombre, por lo que se deben revisar recuentos agregados de referencias antes y después. La nueva columna exige que la aplicación actualizada se instale después de las migraciones. Detener escrituras durante el respaldo y la ventana evita perder operaciones al recuperar.

Con una ventana y destino autorizados, cargar las credenciales por el mecanismo de secretos, comprobar `current_database()` y puerto con la misma URL, inspeccionar `prisma migrate status`, guardar el volcado cifrado fuera del repositorio y verificarlo en una base vacía de recuperación. Comandos previstos desde `backend`. Usar un volumen cifrado para `BACKUP_FILE` y un servicio libpq `ls_restore_test` configurado con el destino aislado de recuperación:

```sh
PGDATABASE="$DATABASE_URL" psql -XAtc 'SELECT current_database(), inet_server_port()'
./node_modules/.bin/prisma migrate status
umask 077
PGDATABASE="$DATABASE_URL" pg_dump --format=custom --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE"
psql --dbname='service=ls_restore_test' -XAtc 'SELECT current_database(), inet_server_port()'
pg_restore --dbname='service=ls_restore_test' --exit-on-error --no-owner "$BACKUP_FILE"
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
```

Verificar luego salud, catálogo, asignaciones, sesiones, edición de antecedentes y recuentos comparables. Si falla la aceptación, retirar la aplicación nueva y evaluar la recuperación desde el respaldo verificado antes de reabrir escrituras. Restaurar sobre un destino habitual sería una operación distinta y requeriría otra autorización.

C añade `20261120123000_session_revocation`. Es una columna nullable, sin reescritura de marcas de cambio de contraseña. Las sesiones anteriores son compatibles mientras la cuenta no haya sido revocada. Este archivo pasa a formar parte del inventario pendiente de cualquier ventana habitual futura, que debe volver a inspeccionarse antes de pedir autorización.
