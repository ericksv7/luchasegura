import { prisma } from "../src/db";
import { reportPassword } from "./program-report-fixture";
import { startReportSite } from "./program-report-site";

async function main() {
  const { server, fixtures, origin } = await startReportSite(Number(process.env.PROGRAM_REPORT_DEMO_PORT ?? "4288"));
  console.log("Demostración sintética:", origin + "/login");
  console.log("Contraseña de demostración:", reportPassword);
  for (const user of [fixtures.owner, fixtures.partial, fixtures.empty, fixtures.physio, fixtures.outsider, fixtures.coach, fixtures.admin]) {
    console.log(user.email + " · " + user.role);
  }
  console.log("Informe propio:", origin + "/deportista/progreso/informe");
  console.log("Ficha autorizada:", origin + "/equipo/deportistas/" + fixtures.athlete.id + "/informe");
  console.log("Informe grupal:", origin + "/equipo/informes-programa");
  const stop = () => server.close(() => void prisma.$disconnect());
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch(async error => {
  console.error(error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
