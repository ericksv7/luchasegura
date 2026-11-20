import { assertIsolatedDatabase, assertIsolatedEnvironment } from './isolated-database';
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:tls";
import { createServer as createTcpServer } from "node:net";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import express from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db";
import { createMailer, readMailConfig } from "../src/services/mail";
import { resetFrontendUrl } from "../src/services/password-recovery";

assertIsolatedEnvironment();

const messages: string[] = [];
let rejectData = false;
let rejected = 0;
const sender = "smtp@example.test";
const secret = "smtp-fixture-only";
const smtp = createServer({
  key: readFileSync(process.env.SMTP_FIXTURE_KEY!),
  cert: readFileSync(process.env.NODE_EXTRA_CA_CERTS!),
}, socket => {
  let buffer = "";
  let content: string[] | null = null;
  socket.setEncoding("utf8");
  socket.write("220 SMTP fixture\r\n");
  socket.on("error", () => {});
  socket.on("data", chunk => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\r\n")) !== -1) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (content) {
        if (line !== ".") { content.push(line); continue; }
        if (rejectData) { rejected++; socket.write("550 rejected by fixture\r\n"); }
        else { messages.push(content.join("\r\n")); socket.write("250 accepted by fixture\r\n"); }
        content = null;
      } else if (line.startsWith("EHLO ")) socket.write("250-fixture\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH PLAIN ")) {
        const supplied = Buffer.from(line.split(" ")[2], "base64").toString();
        socket.write(supplied === `\0${sender}\0${secret}` ? "235 authenticated\r\n" : "535 denied\r\n");
      } else if (line === "DATA") { content = []; socket.write("354 input\r\n"); }
      else if (line === "QUIT") socket.end("221 bye\r\n");
      else socket.write("250 ok\r\n");
    }
  });
});

let api: Server;
let base: string;
let frontendOrigin: string;
const oldPassword = "Synthetic-old1";
const newPassword = "Synthetic-new2";

before(async () => {
  await assertIsolatedDatabase(prisma);
  smtp.listen(0, "127.0.0.1");
  await once(smtp, "listening");
  const site = express();
  api = site.listen(0, "127.0.0.1");
  await once(api, "listening");
  frontendOrigin = `http://127.0.0.1:${(api.address() as { port: number }).port}`;
  base = frontendOrigin + "/api";
  Object.assign(process.env, {
    MAIL_TRANSPORT: "smtp",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String((smtp.address() as { port: number }).port),
    SMTP_SECURE: "true",
    SMTP_USER: sender,
    SMTP_PASS: secret,
    MAIL_FROM: sender,
    FRONTEND_PUBLIC_URL: frontendOrigin,
  });
  const { app } = await import("../src/app.js");
  app.set("trust proxy", "loopback");
  site.use((req, res, next) => req.path.startsWith("/api/") ? app(req, res, next) : next());
  if (process.env.MAIL_BROWSER === "1") {
    const dist = process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, "../../frontend/dist/frontend/browser");
    site.use(express.static(dist));
    site.get("*", (_req, res) => res.sendFile(resolve(dist, "index.html")));
  }
});

after(async () => {
  if (api) await new Promise<void>(done => api.close(() => done()));
  await new Promise<void>(done => smtp.close(() => done()));
  await prisma.$disconnect();
});

function call(path: string, body?: unknown, ip = "192.0.2.8", authorization?: string, method = body ? "POST" : "GET") {
  return fetch(base + path, {
    method,
    headers: { "X-Forwarded-For": ip, "Content-Type": "application/json", ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const login = (email: string, password: string, ip?: string) => call("/auth/login", { email, password }, ip);

async function until(predicate: () => Promise<boolean> | boolean) {
  for (let i = 0; i < 100; i++) {
    if (await predicate()) return;
    await delay(30);
  }
  assert.fail("No terminó la operación SMTP esperada");
}

function resetLink(message: string) {
  const decoded = message.replace(/=\r\n/g, "").replace(/=3D/g, "=");
  const link = decoded.match(/http:\/\/127\.0\.0\.1:\d+\/restablecer#token=[\w-]+/);
  if (!link) assert.fail("El correo no contiene un enlace de recuperación");
  const url = new URL(link[0]);
  assert.equal(url.origin, frontendOrigin);
  return url;
}

test("Configuración segura, URL Angular y selección de TLS", () => {
  assert.equal(readMailConfig({ MAIL_TRANSPORT: "disabled" }), null);
  assert.throws(() => readMailConfig({ MAIL_TRANSPORT: "smtp", SMTP_USER: "fixture-value" }), error =>
    error instanceof Error && error.message.includes("SMTP_HOST") && !error.message.includes("fixture-value"));
  assert.throws(() => resetFrontendUrl("http://localhost:4200", true));
  assert.throws(() => resetFrontendUrl("https://example.test/?destination=elsewhere", true));
  assert.equal(resetFrontendUrl("https://example.test", true).pathname, "/restablecer");
});

test("El SMTP TLS y CLI aceptan un mensaje de prueba y clasifican fallos sin exponer datos", async () => {
  const count = messages.length;
  const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/cli/mail-test.ts", "prueba@example.test"], {
    env: process.env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  assert.deepEqual(await once(child, "close"), [0, null]);
  assert.match(output, /SMTP aceptó/);
  assert.equal(output.includes(secret), false);
  assert.equal(messages.length, count + 1);
  assert.match(messages.at(-1)!, /To: prueba@example.test/);
  assert.doesNotMatch(messages.at(-1)!, /token=/);
  const config = readMailConfig(process.env)!;
  const sample = { to: "prueba@example.test", subject: "Prueba", text: "Texto", html: "<p>HTML</p>" };
  await assert.rejects(createMailer({ ...config, SMTP_PASS: "incorrecta" }).send(sample), { code: "auth" });
  const closed = createTcpServer().listen(0, "127.0.0.1");
  await once(closed, "listening");
  const port = (closed.address() as { port: number }).port;
  await new Promise<void>(done => closed.close(() => done()));
  await assert.rejects(createMailer({ ...config, SMTP_PORT: port }).send(sample), { code: "connection" });
});

test("Recuperación SMTP real en loopback, respuesta uniforme, hash, concurrencia, caducidad y revocación", async () => {
  const hash = await bcrypt.hash(oldPassword, 4);
  const user = await prisma.user.create({ data: { fullName: "Cuenta sintética SMTP", email: "recuperacion@example.test", role: "PHYSIO", passwordHash: hash } });
  const inactive = await prisma.user.create({ data: { fullName: "Cuenta desactivada", email: "inactiva@example.test", role: "PHYSIO", passwordHash: hash, active: false } });
  const session = await (await login(user.email, oldPassword)).json() as { token: string };
  const count = messages.length;
  const responses = await Promise.all([
    call("/auth/forgot-password", { email: user.email.toUpperCase(), to: "distinto@example.test" }),
    call("/auth/forgot-password", { email: user.email }),
    call("/auth/forgot-password", { email: "inexistente@example.test" }),
    call("/auth/forgot-password", { email: inactive.email }),
  ]);
  assert.deepEqual(responses.map(result => result.status), [202, 202, 202, 202]);
  const bodies = await Promise.all(responses.map(res => res.json()));
  assert.ok(bodies.every(body => JSON.stringify(body) === JSON.stringify(bodies[0])));
  await until(() => messages.length > count);
  const message = messages[count].replace(/=\r\n/g, "").replace(/=3D/g, "=");
  assert.match(message, /To: recuperacion@example.test/);
  assert.doesNotMatch(message, /distinto@example.test/);
  assert.match(message, /multipart\/alternative/);
  assert.match(message, /30 minutos/);
  const link = resetLink(message);
  assert.equal(link.search, "");
  const token = new URLSearchParams(link.hash.slice(1)).get("token")!;
  const stored = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.ok(stored[0].expiresAt.getTime() - Date.now() > 29 * 60_000);
  assert.deepEqual(await (await call("/auth/reset-password/check", { token: token })).json(), { valid: true });
  assert.equal((await call("/auth/reset-password", { token, password: "short" }, "192.0.2.9")).status, 400);
  assert.equal((await call("/auth/reset-password", { token, password: newPassword }, "192.0.2.9")).status, 200);
  assert.equal((await call("/auth/reset-password", { token, password: "Another-synthetic3" }, "192.0.2.9")).status, 400);
  assert.equal((await login(user.email, oldPassword)).status, 401);
  assert.equal((await login(user.email, newPassword)).status, 200);
  assert.equal((await call("/auth/me", undefined, undefined, session.token)).status, 401);
  const expired = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(expired).digest("hex"), expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call("/auth/reset-password", { token: expired, password: "Another-synthetic3" }, "192.0.2.9")).status, 400);
  assert.equal(messages.length, count + 1);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: inactive.id } }), 0);

  const admin = await prisma.user.create({ data: { fullName: "Admin sintético SMTP", email: "admin-smtp@example.test", role: "ADMIN", passwordHash: hash } });
  const adminSession = await (await login(admin.email, oldPassword)).json() as { token: string };
  const pending = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(pending).digest("hex"), expiresAt: new Date(Date.now() + 60_000) } });
  const amended = await call("/admin/users/" + user.id, { email: "nuevo@example.test" }, undefined, adminSession.token, "PATCH");
  assert.equal(amended.status, 200);
  assert.deepEqual(await (await call("/auth/reset-password/check", { token: pending })).json(), { valid: false });
});

test("Un rechazo del proveedor conserva la respuesta pública y revoca el enlace fallido", async t => {
  const warning = t.mock.method(console, "warn", () => {});
  const user = await prisma.user.create({ data: { fullName: "Cuenta rechazo SMTP", email: "rechazo@example.test", role: "PHYSIO", passwordHash: await bcrypt.hash(oldPassword, 4) } });
  const count = messages.length;
  const prior = rejected;
  rejectData = true;
  try {
    const publicResponse = await call("/auth/forgot-password", { email: user.email }, "192.0.2.10");
    assert.equal(publicResponse.status, 202);
    await until(async () => rejected > prior && !await prisma.passwordResetToken.count({ where: { userId: user.id } }));
    assert.equal(messages.length, count);
    assert.deepEqual(warning.mock.calls.map(call => call.arguments), [["Recuperación: fallo SMTP", "rejected"]]);
  } finally {
    rejectData = false;
  }
});


test("La recuperación limita solicitudes repetidas incluso para correos inexistentes", async () => {
  const request = () => call("/auth/forgot-password", { email: "limite@example.test" }, "192.0.2.11");
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await request()).status, 202);
  const blocked = await request();
  assert.equal(blocked.status, 429);
  const response = await blocked.json() as { retryAfter: number };
  assert.ok(response.retryAfter > 0);
});

test("Brave completa el flujo Angular usando el enlace recibido por SMTP", { skip: process.env.MAIL_BROWSER !== "1" }, async () => {
  const externalRequire = createRequire(__filename);
  const { chromium } = externalRequire(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_BIN ?? "/opt/brave-bin/brave",
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const email = "navegador-smtp@example.test";
    await prisma.user.create({ data: {
      email, fullName: "Cuenta sintética de navegador", role: "PHYSIO",
      passwordHash: await bcrypt.hash(oldPassword, 4),
    } });
    const page = await browser.newPage({ viewport: { width: 414, height: 896 }, hasTouch: true, isMobile: true });
    const count = messages.length;
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).tap();
    await page.getByLabel("Correo", { exact: true }).fill(email);
    const [request] = await Promise.all([
      page.waitForResponse((response: { url(): string }) => response.url().endsWith("/api/auth/forgot-password")),
      page.getByRole("button", { name: "Enviar instrucciones" }).tap(),
    ]);
    assert.equal(request.status(), 202);
    await page.getByRole("status").filter({ hasText: "Si la cuenta puede usar la recuperación" }).waitFor();
    await until(() => messages.length > count);
    const link = resetLink(messages[count]);
    await page.goto(link.href, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(newPassword);
    const passwordSizes = await page.locator('input[type=password]').evaluateAll((elements: Element[]) =>
      elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
    assert.equal(passwordSizes.length, 2);
    assert.ok(passwordSizes.every(size => size >= 16));
    const resetAddress = new URL(page.url());
    assert.equal(resetAddress.search, "");
    assert.equal(resetAddress.hash, "");
    await page.getByLabel("Repite la contraseña", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).tap();
    await page.getByText("Contraseña actualizada", { exact: true }).waitFor();
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    await page.goto(link.href, { waitUntil: "domcontentloaded" });
    await page.getByText("Enlace no válido", { exact: true }).waitFor();
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Entrar" }).tap();
    await page.getByText("Correo o contraseña incorrectos", { exact: true }).waitFor();
    await page.getByLabel("Contraseña", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Entrar" }).tap();
    await page.waitForURL("**/equipo");
  } finally {
    await browser.close();
  }
});
