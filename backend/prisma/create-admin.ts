import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

// Uso: npm run db:create-admin -- correo@dominio.com "Nombre Apellido"
async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(" ").trim();
  if (!rawEmail || !fullName) {
    console.log('Uso: npm run db:create-admin -- correo@dominio.com "Nombre Apellido"');
    return;
  }
  const email = rawEmail.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`Ya existe un usuario con el correo ${email}`);
    return;
  }

  const tempPassword = randomBytes(9).toString("base64url");
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

main().finally(() => prisma.$disconnect());