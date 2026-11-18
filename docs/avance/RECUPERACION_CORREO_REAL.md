# Recuperación de contraseña por correo

Nodemailer envía un mensaje en HTML y texto plano al correo registrado de una cuenta activa. La API devuelve una respuesta uniforme antes de la entrega. El enlace dura 30 minutos, se guarda como hash y se consume de forma atómica una sola vez. Cambiar la contraseña revoca las sesiones previas y los demás enlaces. Cambiar el correo desde administración también revoca los enlaces pendientes. Se conservan los límites de solicitudes y se espera un minuto entre emisiones de la misma cuenta. Un fallo SMTP invalida el enlace de ese intento. Los registros técnicos contienen categorías de error, sin destinatarios, contraseñas ni enlaces.

## Habilitar Gmail

Activa la verificación en dos pasos en la cuenta remitente y genera una contraseña en **Seguridad → Contraseñas de aplicaciones** de Google. Algunas cuentas administradas no permiten generarla. Completa estos campos exclusivamente en `backend/.env`, que Git ignora. Conserva las variables existentes de base de datos y JWT. Reinicia el backend.

| Variable | Valor |
| --- | --- |
| `MAIL_TRANSPORT` | `smtp`. El valor `disabled` apaga el envío y la API devuelve 503. |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` para TLS implícito. Para otro proveedor con STARTTLS, usa `false` y su puerto. |
| `SMTP_USER` | Dirección completa del remitente. |
| `SMTP_PASS` | Contraseña de aplicación de Google, sin espacios de agrupación. |
| `MAIL_FROM` | La misma dirección de Gmail o un remitente autorizado por el proveedor. |
| `FRONTEND_PUBLIC_URL` | `http://localhost:4200` con el puerto predeterminado de Angular CLI. Si Angular muestra otro puerto al iniciar, usa ese. |

## Verificar el envío y el enlace

Desde `backend/`, sustituye la dirección de ejemplo por una cuenta personal que controles:

```sh
npm run mail:test -- correo-de-prueba@example.test
```

El comando envía un único mensaje **LuchaSegura | Prueba SMTP** sin enlace. Si SMTP lo acepta, comprueba Recibidos y Correo no deseado. Una aceptación SMTP no acredita recepción.

1. Con Angular y el backend en ejecución, usa una **cuenta de prueba** registrada con un correo que controles.
2. En **Iniciar sesión → ¿Olvidaste tu contraseña?**, introduce el correo y pulsa **Enviar instrucciones**.
3. Abre **LuchaSegura | Recuperación de contraseña** en tu bandeja. Usa **Restablecer contraseña** en el mismo equipo que ejecuta Angular si el enlace apunta a localhost.
4. Introduce y confirma la nueva contraseña. Comprueba que puedes entrar con ella y que la anterior falla. Si conservas una sesión previa en otra pestaña, intenta una consulta protegida para comprobar la revocación.
5. Abre el enlace utilizado y comprueba que se rechaza. Para probar caducidad, solicita otro enlace y déjalo sin usar más de 30 minutos.

Si falla la autenticación, revisa la cuenta y la contraseña de aplicación. Si falla la conexión, revisa DNS, salida TCP al puerto 465 y certificados de confianza. Si el enlace no carga, comprueba el origen y el puerto de Angular. Ante HTTP 429, respeta la espera indicada.

## Producción

Configura un origen HTTPS y un remitente verificado. Gestiona los secretos fuera de Git. Redacta las cadenas de consulta de `/restablecer` y de la validación del token en los registros del proxy, y excluye los cuerpos de recuperación. El transporte limita el trabajo simultáneo en memoria. Una solicitud aceptada puede requerir reintento si el proceso se reinicia o el proveedor falla. Verifica la entrega externa con el proveedor elegido antes de publicar.

## Estado de verificación

| Comprobación | Resultado |
| --- | --- |
| Envío SMTP de Gmail | Confirmado por el usuario al ejecutar `npm run mail:test`. El backend también leyó y validó la configuración local sin abrir otra conexión SMTP ni imprimir sus valores. |
| Recepción en una bandeja real | Confirmada personalmente por el usuario para el mensaje **LuchaSegura \| Prueba SMTP**. Este mensaje carece de enlace. |
| Recuperación integral en entorno aislado | Verificada en Brave, Angular, API, PostgreSQL temporal y Nodemailer con SMTP TLS local. El navegador solicitó la recuperación, abrió el enlace de ese mensaje, cambió la contraseña, rechazó el enlace usado y entró con la contraseña nueva. |
| Recuperación con un enlace recibido vía Gmail | Pendiente. Requiere que el usuario solicite el correo de recuperación para una cuenta de prueba cuyo correo registrado controle y complete los pasos anteriores. |

Pasaron los seis casos de recuperación y las compilaciones de frontend y backend. Las 24 pruebas Angular aprobadas corresponden a la verificación anterior del mismo código de aplicación. Las comprobaciones de API cubren el rechazo de la contraseña anterior y de las sesiones previas, la caducidad, el uso único, la concurrencia, el rechazo de un destino alternativo, la respuesta uniforme, los límites y los fallos SMTP. Se verificó que el fallo controlado solo registra una categoría. El archivo local de configuración está ignorado y sin seguimiento en Git. Las pruebas automatizadas no enviaron mensajes externos.

## Commit propuesto

Ejecutar desde la raíz cuando se autorice el commit. La selección deja fuera los cambios de desplegables, la documentación de entrega previa, `.env`, logs, respaldos y archivos temporales.

```sh
git add -- backend/.env.example backend/package.json backend/package-lock.json \
  backend/src/cli/mail-test.ts backend/src/services/mail.ts \
  backend/src/services/password-recovery.ts backend/src/routes/auth.ts \
  backend/src/routes/admin.ts backend/tests/mail-recovery.test.ts \
  backend/tests/run-alert-reviews.cjs frontend/src/index.html \
  frontend/src/app/core/auth.service.ts frontend/src/app/pages/forgot.page.ts \
  frontend/src/app/pages/forgot.page.spec.ts docs/avance/RECUPERACION_CORREO_REAL.md
git diff --cached --check
git diff --cached --name-only
git diff --cached
git commit -m "feat(auth): habilitar recuperación de contraseña por correo"
```
