import "dotenv/config";
import nodemailer from "nodemailer";
import { z } from "zod";

const address = z.string().trim().email();
const smtpSchema = z.object({
  SMTP_HOST: z.string().trim().regex(/^[a-z0-9.-]+$/i),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]),
  SMTP_USER: z.string().trim().min(1).regex(/^[^\r\n]+$/),
  SMTP_PASS: z.string().min(1).regex(/^[^\r\n]+$/),
  MAIL_FROM: address,
});

export type MailMessage = { to: string; subject: string; text: string; html: string };
type MailFailureCode = "auth" | "connection" | "timeout" | "tls" | "rejected" | "unknown";
export class MailConfigError extends Error {}

export class MailFailure extends Error {
  constructor(readonly code: MailFailureCode) { super("No se pudo enviar el mensaje SMTP"); }
}

export function readMailConfig(env: NodeJS.ProcessEnv) {
  if (!env.MAIL_TRANSPORT || env.MAIL_TRANSPORT === "disabled") return null;
  if (env.MAIL_TRANSPORT !== "smtp") throw new MailConfigError("MAIL_TRANSPORT debe ser disabled o smtp");
  const result = smtpSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map(issue => issue.path[0]).join(", ");
    throw new MailConfigError("Configuración SMTP inválida. Revisa: " + fields);
  }
  return result.data;
}

export type MailConfig = NonNullable<ReturnType<typeof readMailConfig>>;

function classifyError(error: unknown): MailFailureCode {
  const smtp = error as { code?: string; responseCode?: number; cause?: { code?: string } } | null;
  if (smtp?.code === "EAUTH" || smtp?.responseCode === 535) return "auth";
  if (smtp?.code === "ETIMEDOUT") return "timeout";
  const tlsCode = /^(?:CERT_|ERR_TLS|UNABLE_|DEPTH_|SELF_)/;
  if (smtp?.code === "ETLS" || tlsCode.test(smtp?.code ?? "") || tlsCode.test(smtp?.cause?.code ?? "")) return "tls";
  if (["ECONNECTION", "ECONNREFUSED", "EDNS", "ESOCKET"].includes(smtp?.code ?? "")) return "connection";
  if (["EENVELOPE", "EMESSAGE"].includes(smtp?.code ?? "") || smtp?.responseCode) return "rejected";
  return "unknown";
}

export function createMailer(config: MailConfig) {
  const secure = config.SMTP_SECURE === "true";
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure,
    requireTLS: !secure,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(message: MailMessage): Promise<void> {
      try {
        const result = await transport.sendMail({
          ...message,
          to: address.parse(message.to),
          from: { name: "LuchaSegura", address: config.MAIL_FROM },
        });
        if (result.accepted.length !== 1 || result.rejected.length > 0) throw new MailFailure("rejected");
      } catch (error) {
        throw error instanceof MailFailure ? error : new MailFailure(classifyError(error));
      }
    },
  };
}
