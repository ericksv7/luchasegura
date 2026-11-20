import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

export function assertIsolatedEnvironment() {
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("No se configuró la conexión del clúster de pruebas.");
  }
  assert.equal(process.env.ALERT_REVIEW_TESTS, "1", "Ejecuta las pruebas con el clúster temporal del proyecto.");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.username, "ls_test");
  assert.equal(url.pathname, "/luchasegura_alert_test");
  assert.equal(url.search, "");
  assert.ok(Number(url.port) >= 1024 && Number(url.port) !== 5432);
  return Number(url.port);
}

export async function assertIsolatedDatabase(prisma: Pick<PrismaClient, "$queryRaw">) {
  const port = assertIsolatedEnvironment();
  const [target] = await prisma.$queryRaw<{ db: string; port: number; directory: string }[]>`
    SELECT current_database() AS db, inet_server_port() AS port,
           current_setting('data_directory') AS directory
  `;
  assert.equal(target.db, "luchasegura_alert_test");
  assert.equal(target.port, port);
  assert.match(target.directory, /[/\\]luchasegura-alert-tests-[^/\\]+[/\\]data$/);
}
