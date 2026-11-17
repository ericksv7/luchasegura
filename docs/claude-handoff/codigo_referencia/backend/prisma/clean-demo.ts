import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Borra las cuentas de ejemplo (@demo.local) y todo lo que tienen asociado.
// Sin --yes solo muestra qué borraría.
async function main() {
  const demo = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.local" } },
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });
  if (demo.length === 0) {
    console.log("No hay cuentas de ejemplo.");
    return;
  }
  console.log(`Cuentas de ejemplo encontradas (${demo.length}):`);
  demo.forEach((u) => console.log(` - ${u.email} (${u.role})`));

  if (!process.argv.includes("--yes")) {
    console.log("\nNo se borró nada. Para borrarlas: npm run db:clean-demo -- --yes");
    return;
  }
  const r = await prisma.user.deleteMany({ where: { email: { endsWith: "@demo.local" } } });
  console.log(`\nEliminadas ${r.count} cuentas y sus datos.`);
}

main().finally(() => prisma.$disconnect());