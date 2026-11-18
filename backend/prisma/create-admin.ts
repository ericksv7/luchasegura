import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const prisma = new PrismaClient();

// Uso: npm run db:create-admin -- correo@dominio.com "Nombre Apellido"
async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(" ").trim();
  if (!rawEmail || !fullName) {
    console.log('Uso: npm run db:create-admin -- correo@dominio.com "Nombre Apellido"');
    return;
  }
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(rawEmail);
  if (!parsed.success || fullName.length < 2 || fullName.length > 120) {
    throw new Error("Indica un correo válido y un nombre de 2 a 120 caracteres.");
  }
  const email = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`Ya existe un usuario con el correo ${email}`);
    return;
  }

  const tempPassword = "Ls1-" + randomBytes(16).toString("base64url");
  await prisma.user.create({
    data: {
      email,
      fullName,
      role: "ADMIN",
      mustChangePassword: true,
      passwordHash: await bcrypt.hash(tempPassword, 12),
    },
  });
  console.log(`Administrador creado: ${email}`);
  console.log(`Contraseña temporal (se muestra una sola vez): ${tempPassword}`);
  console.log("Al iniciar sesión te pedirá cambiarla.");
}

main().catch(() => {
  console.error("No se pudo crear el administrador. Revisa la configuración y los argumentos.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());