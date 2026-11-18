import { z } from "zod";
import { createMailer, MailConfigError, MailFailure, readMailConfig } from "../services/mail";

const hints = {
  auth: "SMTP rechazó la autenticación. Revisa la cuenta y la contraseña de aplicación.",
  connection: "No se pudo conectar. Revisa el host, el puerto, el DNS y el cortafuegos.",
  timeout: "SMTP agotó el tiempo de espera.",
  tls: "No se pudo establecer una conexión TLS de confianza.",
  rejected: "SMTP rechazó el remitente, destinatario o contenido.",
  unknown: "SMTP no pudo aceptar el mensaje.",
};

async function main() {
  const [value, ...extra] = process.argv.slice(2);
  const recipient = z.string().trim().email().safeParse(value);
  if (!recipient.success || extra.length) throw new MailConfigError("Uso: npm run mail:test -- correo-de-prueba@example.test");
  const config = readMailConfig(process.env);
  if (!config) throw new MailConfigError("Activa MAIL_TRANSPORT=smtp en backend/.env");
  await createMailer(config).send({
    to: recipient.data,
    subject: "LuchaSegura | Prueba SMTP",
    text: "Correo de prueba de LuchaSegura. No corresponde a una solicitud de recuperación.",
    html: "<h1>LuchaSegura · Prueba SMTP</h1><p>Este correo comprueba el envío y no contiene un enlace de recuperación.</p>",
  });
  console.log("El servidor SMTP aceptó el mensaje de prueba. Comprueba la recepción en tu bandeja.");
}

main().catch(error => {
  console.error(error instanceof MailFailure ? hints[error.code] : error instanceof MailConfigError ? error.message : "Error en la prueba SMTP");
  process.exitCode = 1;
});
