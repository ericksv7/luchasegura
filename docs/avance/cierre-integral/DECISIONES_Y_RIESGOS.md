# Decisiones y riesgos

- Las pruebas de escritura usan clústeres sintéticos independientes. La base habitual queda fuera de los cambios. Preparar la autorización de migraciones por separado.
- Consentimiento, tratamiento de menores, finalidades, retención y responsables requieren revisión institucional. Las evaluaciones, el programa y los umbrales requieren revisión académica y de fisioterapia.
- La validación de SMTP real y cualquier despliegue externo requieren autorización. La batería automatizada solo usa SMTP en loopback.
- La fecha de un antecedente es un dato civil opcional. La marca histórica se conserva como dato de auditoría y orden, incluso si no se conoce una fecha civil. La migración conserva el día UTC que mostraba el editor anterior cuando la marca difiere de la de creación. Si ambas coinciden, registra fecha desconocida. Esa coincidencia fue el valor por defecto del sistema anterior y por sí sola no permite demostrar si hubo una fecha explícita.

## Ventana de migración habitual pendiente

Destino comprobado en lectura: PostgreSQL local, puerto 5432, base `luchasegura`. Antes de solicitar cualquier aplicación, cotejar el inventario de la rama con el historial del destino. En este cierre el lote previsto contiene:

| Migración | Efecto |
| --- | --- |
| `20261119130000_basic_gym_band_exercises` | Incorpora ejercicios base de gimnasio y banda. |
| `20261119140000_focus_gym_catalog` | Archiva ejercicios seleccionados y ajusta el catálogo. Incluye coincidencias exactas por nombre. |
| `20261120120000_history_civil_date` | Añade fecha civil a antecedentes y conserva la marca temporal. |
| `20261120123000_session_revocation` | Añade la marca opcional de revocación administrativa. |
| `20261120130000_consent_evidence` | Añade evidencia opcional del aviso. Conserva intactos los consentimientos anteriores. |

El catálogo mantiene las referencias históricas. Revisar recuentos de sesiones y asignaciones antes y después. La API nueva exige que las columnas existan. El orden de la ventana es detener escrituras, respaldar, aplicar las migraciones autorizadas, instalar la versión compatible y verificar salud y flujos antes de reabrir.

Preparar `ls_habitual` como servicio libpq fuera del repositorio, con el mismo destino que `DATABASE_URL` de Prisma. Verificar la identidad de ambos destinos. Establecer `BACKUP_FILE` en almacenamiento cifrado y restringido. Comandos previstos desde `backend`, sujetos a aprobación:

```sh
psql --dbname='service=ls_habitual' -XAtc 'SELECT current_database(), inet_server_port()'
./node_modules/.bin/prisma migrate status
umask 077
pg_dump --dbname='service=ls_habitual' --format=custom --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE"
sha256sum "$BACKUP_FILE"
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
```

Después verificar salud, catálogo, asignaciones, sesiones, edición de antecedentes y recuentos antes de reactivar escrituras. Si falla la aceptación, preservar los registros de la ventana y evaluar la recuperación. La restauración de un respaldo habitual requiere otra autorización y un destino institucional de recuperación con los mismos controles de datos. El comando previsto es `pg_restore --dbname='service=ls_recovery_approved' --exit-on-error --no-owner "$BACKUP_FILE"` sobre una base vacía de recuperación autorizada. El entorno de pruebas recibe exclusivamente respaldos sintéticos.

C añade `20261120123000_session_revocation`. Es una columna nullable, sin reescritura de marcas de cambio de contraseña. Las sesiones anteriores son compatibles mientras la cuenta no haya sido revocada. Este archivo pasa a formar parte del inventario pendiente de cualquier ventana habitual futura, que debe volver a inspeccionarse antes de pedir autorización.

## Consentimiento e información legal

El aviso `v0.2-borrador` se entrega desde la API. La aceptación de demostración conserva versión, copia exacta, huella, fecha y modalidad declarada. La migración `20261120130000_consent_evidence` añade campos opcionales. Los registros anteriores se conservan con su evidencia original. El nombre del acudiente es una declaración de la persona que completa el registro.

El registro público de producción queda bloqueado mientras el aviso siga en borrador. Los cambios de fecha de nacimiento que involucran a un menor requieren revisión. No se diseñó un trámite de autorización del acudiente sin aprobación institucional. Hace falta confirmar responsable del tratamiento, canal de derechos, finalidades, conservación, procedimiento para menores y titularidad de recursos antes de publicar los textos como definitivos.

Referencias para revisión profesional. [Ley 1581 de 2012](https://normograma.dian.gov.co/dian/compilacion/docs/ley_1581_2012.htm) · [Concepto del Ministerio de Salud sobre el Decreto 1074 de 2015 y los datos de menores](https://www.minsalud.gov.co/Normatividad_Nuevo/Concepto%20Jur%C3%ADdico%202024423000898442.pdf)
