import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createMailer, MailFailure, readMailConfig } from "./mail";

const minutes = 30;
const cooldownMs = 60_000;
const maxConcurrent = 8;

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function resetFrontendUrl(value: string | undefined, production: boolean) {
  let url: URL;
  try { url = new URL(value ?? ""); }
  catch { throw new Error("FRONTEND_PUBLIC_URL debe ser una URL absoluta"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const safeProtocol = url.protocol === "https:" || (!production && local && url.protocol === "http:");
  if (!safeProtocol || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("FRONTEND_PUBLIC_URL debe ser el origen del frontend. Usa HTTPS en producción.");
  }
  return new URL("/restablecer", url);
}

function resetMessage(to: string, url: URL) {
  // El origen validado y el token en base64url producen una URL segura para texto y atributo HTML.
  const link = url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const validity = `El enlace es válido durante ${minutes} minutos y se puede usar una sola vez.`;
  const ignore = "Si no solicitaste este cambio, puedes ignorar este mensaje.";
  return {
    to,
    subject: "LuchaSegura | Recuperación de contraseña",
    text: `LuchaSegura\n\nUsa este enlace para restablecer tu contraseña:\n${url.href}\n\n${validity}\n${ignore}`,
    html: `<div lang="es" style="background:#f4f6f8;padding:24px;font:16px Arial,sans-serif;color:#0d1b24">
      <table role="presentation" style="width:100%;max-width:560px;margin:auto;background:#fff;border:1px solid #d8e0e7;border-radius:12px">
        <tr><td style="padding:24px"><p style="color:#0b6e5c;font-weight:bold">LuchaSegura</p>
          <h1 style="font-size:24px">Recuperación de contraseña</h1>
          <p>Abre el enlace para elegir una nueva contraseña.</p>
          <p><a href="${link}" style="background:#0b6e5c;color:#fff;padding:12px 16px;border-radius:8px;display:inline-block">Restablecer contraseña</a></p>
          <p>${validity}</p><p>${ignore}</p>
          <p>Si el botón no funciona, copia este enlace en tu navegador:<br>
          <a href="${link}" style="color:#0b6e5c;overflow-wrap:anywhere">${link}</a></p>
        </td></tr>
      </table></div>`,
  };
}

export function createPasswordRecovery(env: NodeJS.ProcessEnv) {
  const config = readMailConfig(env);
  if (!config) return null;
  const mailer = createMailer(config);
  const resetUrl = resetFrontendUrl(env.FRONTEND_PUBLIC_URL, env.NODE_ENV === "production");
  let inFlight = 0;

  async function deliver(email: string) {
    const token = randomBytes(32).toString("base64url");
    const record = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, active: true } });
      if (!user?.active) return null;
      const now = Date.now();
      const recent = await tx.passwordResetToken.findFirst({
        where: { userId: user.id, createdAt: { gt: new Date(now - cooldownMs) } },
        select: { id: true },
      });
      if (recent) return null;
      const saved = await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now + minutes * 60_000) },
        select: { id: true },
      });
      return { id: saved.id, to: user.email };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!record) return;

    const link = new URL(resetUrl);
    link.hash = new URLSearchParams({ token }).toString();
    try {
      await mailer.send(resetMessage(record.to, link));
    } catch (error) {
      console.warn("Recuperación: fallo SMTP", error instanceof MailFailure ? error.code : "unknown");
      await prisma.passwordResetToken.deleteMany({ where: { id: record.id, usedAt: null } });
    }
  }

  return {
    request(email: string) {
      if (inFlight >= maxConcurrent) return;
      inFlight++;
      void deliver(email).catch(error => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return;
        console.warn("Recuperación: no se pudo procesar la solicitud");
      }).finally(() => { inFlight--; });
    },
  };
}
