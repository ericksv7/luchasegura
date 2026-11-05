import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Datos ficticios para desarrollo. NUNCA usar datos reales de deportistas aquí.
async function main() {
  const hash = await bcrypt.hash("Cambiar123!", 12);

  const physio = await prisma.user.upsert({
    where: { email: "fisio@demo.local" },
    update: {},
    create: { email: "fisio@demo.local", fullName: "Fisioterapeuta Demo", role: "PHYSIO", passwordHash: hash },
  });
  const coach = await prisma.user.upsert({
    where: { email: "entrenador@demo.local" },
    update: {},
    create: { email: "entrenador@demo.local", fullName: "Entrenador Demo", role: "COACH", passwordHash: hash },
  });
  await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: { email: "admin@demo.local", fullName: "Administrador Demo", role: "ADMIN", passwordHash: hash },
  });
  await prisma.user.upsert({
    where: { email: "deportista@demo.local" },
    update: {},
    create: {
      email: "deportista@demo.local",
      fullName: "Deportista Demo",
      role: "ATHLETE",
      passwordHash: hash,
      athlete: { create: { coachId: coach.id, category: "65 kg", style: "libre", yearsExperience: 4 } },
    },
  });

  // Umbral de ejemplo: lo debe definir el fisioterapeuta real
  const rules = await prisma.alertRule.count();
  if (rules === 0) {
    await prisma.alertRule.create({ data: { minIntensity: 5, createdById: physio.id } });
  }

  // Programa vacío de 8 semanas; los ejercicios los carga el equipo de fisioterapia
  const programs = await prisma.program.count();
  if (programs === 0) {
    await prisma.program.create({ data: { name: "Programa preventivo (borrador)", weeks: 8, sessionsPerWeek: 3 } });
  }
  console.log("Datos de ejemplo cargados");
}

main().finally(() => prisma.$disconnect());
