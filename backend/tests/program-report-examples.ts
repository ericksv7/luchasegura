import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { reportPassword, seedProgramReports } from "./program-report-fixture";

async function main() {
  const output = process.env.REPORT_EXAMPLE_DIR;
  if (!output) throw new Error("Define REPORT_EXAMPLE_DIR con el destino de los ejemplos.");
  const f = await seedProgramReports();
  await mkdir(output, { recursive: true });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const [user, route, name] of [
      [f.owner, "me", "individual-completo"],
      [f.partial, "me", "individual-parcial"],
      [f.physio, "group", "grupal-sintetico"],
    ] as const) {
      const login = await fetch(origin + "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: reportPassword }),
      });
      if (!login.ok) throw new Error(`Autenticación sintética: HTTP ${login.status}`);
      const { token } = await login.json();
      const response = await fetch(origin + "/api/program-reports/" + route + ".xlsx", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error(`Exportación ${name}: HTTP ${response.status}`);
      await writeFile(resolve(output, name + ".xlsx"), Buffer.from(await response.arrayBuffer()));
    }
  } finally {
    await new Promise<void>(done => server.close(() => done()));
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
