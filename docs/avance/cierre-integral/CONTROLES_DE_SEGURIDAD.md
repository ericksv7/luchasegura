# Controles de seguridad revisados

La referencia para este registro es [OWASP ASVS 5.0](https://asvs.owasp.org/downloads/). La matriz registra controles del producto y su alcance. No equivale a una certificación.

| Operación | Administrador | Fisioterapia | Deportista | Entrenador | Comprobación |
| --- | --- | --- | --- | --- | --- |
| Usuarios y relación entrenador–deportista | Gestiona cuentas y asignaciones | Denegado | Denegado | Denegado | Rutas admin con guard de rol y pruebas de cambios de cuenta |
| Ficha y resumen de equipo | Denegado | Alcance de equipo | Perfil propio por sus rutas | Solo asignados, sin antecedentes ni notas clínicas | Pruebas negativas horizontales y verticales de API |
| Molestias, antecedentes y cumplimiento | Denegado en las operaciones propias | Consulta según alcance profesional | Escritura de registros propios | Consulta limitada de asignados | Filtros de propietario y pruebas de reintento |
| Actuación clínica, resultados y Excel | Denegado | Exclusivo | Denegado | Denegado | Guard de rol, tests de alcance y comprobación de libro |
| Biblioteca y asignaciones | Denegado | Lee y gestiona | Lee asignaciones propias y plan | Lee biblioteca y asignaciones de sus deportistas | Pruebas de archivo, concurrencia y relaciones históricas |
| Recuperación y sesión | Cuenta activa | Cuenta activa | Cuenta activa | Cuenta activa | Caducidad, uso único, TLS SMTP sintético, suspensión y revocación |

## Transporte y sesiones

- La API utiliza bearer sin cookies de autenticación. Angular usa almacenamiento de sesión de la pestaña. La política CSP del alojamiento del frontend debe probarse con sus destinos de recursos reales. Express aplica Helmet, CORS explícito, límites de cuerpo y de solicitudes y respuestas privadas sin caché.
- El enlace nuevo de recuperación lleva el token en el fragmento. El frontend lo consume y limpia la barra de direcciones. La consulta de validez usa un cuerpo POST. Los enlaces anteriores con query siguen siendo legibles hasta caducar. Durante esa transición el proxy debe continuar redactando la query de la ruta anterior.
- Los cambios efectivos de correo, rol o activación de una cuenta revocan sesiones y enlaces previos. El campo de revocación administrativa se separa de la fecha de cambio de contraseña.
- El proceso de recuperación aplica un límite por IP y una ventana por cuenta validada en base de datos. Los límites en memoria y la concurrencia de Excel son por instancia. El dimensionamiento y el funcionamiento detrás de un proxy institucional deben probarse antes de escalar.
- Redistribuir logs del proxy o APM exige excluir cuerpos de credenciales, autorización, URLs antiguas de recuperación y datos de salud. Los logs actuales de la API registran método y estado en errores internos y una categoría de fallo del SMTP.

## Dependencias

Prisma 6.19.3 incluye una dependencia par del cliente hacia la CLI. Se ensayan reemplazos fijados únicamente dentro de `@prisma/config`. Se conservan cliente y motor. El resultado de la comprobación npm y de las regresiones se registra por separado.

Referencias técnicas usadas para contrastar el diseño. [Seguridad Angular](https://angular.dev/best-practices/security) · [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) · [Conexiones PostgreSQL](https://www.postgresql.org/docs/current/runtime-config-connection.html) · [Aviso Effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw) · [Aviso deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
