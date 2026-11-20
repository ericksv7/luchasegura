import { assertIsolatedDatabase, assertIsolatedEnvironment } from './isolated-database';
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { once } from "node:events";
import { accessSync, constants, readFileSync } from "node:fs";
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
const frontendDist = resolve(process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, "../../frontend/dist/frontend/browser"));
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
    site.use(express.static(frontendDist));
    site.get("*", (_req, res) => res.sendFile(resolve(frontendDist, "index.html")));
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

test("Chromium completa la recuperación Angular mediante SMTP TLS", {
  skip: process.env.MAIL_BROWSER !== "1" && "Navegador no solicitado. Usa --mail-browser para exigirlo.",
}, async t => {
  assert.doesNotThrow(() => accessSync(resolve(frontendDist, "index.html"), constants.R_OK),
    "Recuperación en navegador: compila Angular o configura BROWSER_FRONTEND_DIST con el build de navegador.");
  const externalRequire = createRequire(__filename);
  assert.doesNotThrow(() => externalRequire.resolve(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core"),
    "Recuperación en navegador: instala playwright-core y configura PLAYWRIGHT_CORE_PATH.");
  const { chromium } = externalRequire(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");
  const executablePath = process.env.BROWSER_BIN ?? "/opt/brave-bin/brave";
  assert.doesNotThrow(() => accessSync(executablePath, constants.X_OK),
    "Recuperación en navegador: BROWSER_BIN debe apuntar a un ejecutable Chrome, Chromium o Brave.");
  const browser = await chromium.launch({
    executablePath,
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  let stage = "verificar disponibilidad de Angular, API y SMTP";
  const services = { angular: false, api: false, smtp: smtp.listening };
  const events: string[] = [];
  let viewState = async () => ({});
  const count = messages.length;
  try {
    const health = await fetch(base + "/health", { signal: AbortSignal.timeout(5000) });
    services.api = health.ok && (await health.json()).database === "ok";
    assert.ok(services.api && services.smtp);

    const email = "navegador-smtp@example.test";
    await prisma.user.create({ data: {
      email, fullName: "Cuenta sintética de navegador", role: "PHYSIO",
      passwordHash: await bcrypt.hash(oldPassword, 4),
    } });
    const page = await browser.newPage({ viewport: { width: 414, height: 896 }, hasTouch: true, isMobile: true });
    viewState = () => page.evaluate(() => {
      const view = document as Document & { activeViewTransition?: unknown };
      const form = document.querySelector("app-auth-shell form");
      return {
        transition: Boolean(view.activeViewTransition),
        fonts: document.fonts.status,
        form: !form ? "ausente" : form.classList.contains("ng-invalid") ? "inválido" : "presente",
        alert: Boolean(document.querySelector("app-auth-shell [role=alert]")),
        submit: Boolean(form?.querySelector("button.btn:not(:disabled)")),
      };
    });
    type Request = { url(): string; method(): string; failure(): { errorText: string } | null; resourceType(): string };
    type Response = { request(): Request; status(): number };
    const endpoints = ["/api/auth/forgot-password", "/api/auth/reset-password/check", "/api/auth/reset-password", "/api/auth/login"];
    function describeRequest(request: Request) {
      const { origin, pathname } = new URL(request.url());
      if (origin === frontendOrigin && endpoints.includes(pathname)) return pathname;
      return request.resourceType() === "font" ? "fuente web" : "otro recurso";
    }
    page.on("request", (request: Request) => {
      const path = describeRequest(request);
      if (endpoints.includes(path)) events.push(`solicitud ${request.method()} ${path}`);
    });
    page.on("response", (response: Response) => {
      const path = describeRequest(response.request());
      if (endpoints.includes(path)) events.push(`respuesta ${response.status()} ${path}`);
    });
    page.on("requestfailed", (request: Request) => {
      const reason = request.failure()?.errorText ?? "";
      events.push(`fallo ${describeRequest(request)} (${/^net::ERR_[A-Z_]+$/.test(reason) ? reason : "sin código"})`);
    });
    page.on("pageerror", () => events.push("excepción JavaScript sin capturar"));
    page.on("console", (message: { type(): string; text(): string }) => {
      if (message.type() === "error") {
        events.push(/blocked by CORS policy/i.test(message.text()) ? "consola: bloqueo CORS" : "consola: error");
      }
    });

    async function postDuring(path: string, action: () => Promise<unknown>, status: number) {
      const [response] = await Promise.all([
        page.waitForResponse((response: Response) =>
          response.request().method() === "POST" && response.request().url() === frontendOrigin + path),
        action(),
      ]);
      assert.equal(response.status(), status);
      return response;
    }
    // Angular puede mostrar el DOM nuevo mientras la transición aún intercepta el toque.
    const waitForInteractiveView = () => page.waitForFunction(() => {
      const view = document as Document & { activeViewTransition?: unknown };
      return !view.activeViewTransition && document.fonts.status === "loaded";
    });

    stage = "cargar Angular y mostrar «Iniciar sesión»";
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Iniciar sesión" }).waitFor();
    services.angular = true;
    await waitForInteractiveView();

    stage = "abrir «Recuperar contraseña» y esperar una vista interactiva";
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).tap();
    await page.waitForURL(frontendOrigin + "/olvide-contrasena");
    await page.getByRole("heading", { name: "Recuperar contraseña" }).waitFor();
    await waitForInteractiveView();
    stage = "escribir el correo y esperar la validación de Angular";
    await page.getByLabel("Correo", { exact: true }).fill(email);
    await page.locator("app-forgot form.ng-valid").waitFor();
    stage = "tocar «Enviar instrucciones» y recibir POST /api/auth/forgot-password (202)";
    await postDuring("/api/auth/forgot-password",
      () => page.getByRole("button", { name: "Enviar instrucciones" }).tap(), 202);
    stage = "mostrar el aviso de recuperación y recibir el correo por SMTP TLS";
    await page.getByRole("status").filter({ hasText: "Si la cuenta puede usar la recuperación" }).waitFor();
    await until(() => messages.length > count);
    assert.match(messages[count], /To: navegador-smtp@example.test/);
    const link = resetLink(messages[count]);

    async function openResetLink() {
      const check = await postDuring("/api/auth/reset-password/check",
        () => page.goto(link.href, { waitUntil: "domcontentloaded" }), 200);
      return check.json();
    }
    stage = "abrir el enlace y validar POST /api/auth/reset-password/check";
    assert.deepEqual(await openResetLink(), { valid: true });
    await page.getByLabel("Nueva contraseña", { exact: true }).waitFor();
    await waitForInteractiveView();
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(newPassword);
    const passwordSizes = await page.locator('input[type=password]').evaluateAll((elements: Element[]) =>
      elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
    assert.equal(passwordSizes.length, 2);
    assert.ok(passwordSizes.every(size => size >= 16));
    const resetAddress = new URL(page.url());
    assert.equal(resetAddress.search, "");
    assert.equal(resetAddress.hash, "");
    await page.getByLabel("Repite la contraseña", { exact: true }).fill(newPassword);
    stage = "tocar «Guardar contraseña» y recibir POST /api/auth/reset-password (200)";
    await postDuring("/api/auth/reset-password",
      () => page.getByRole("button", { name: "Guardar contraseña" }).tap(), 200);
    stage = "mostrar «Contraseña actualizada» y rechazar el enlace ya usado";
    await page.getByText("Contraseña actualizada", { exact: true }).waitFor();
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    assert.deepEqual(await openResetLink(), { valid: false });
    await page.getByText("Enlace no válido", { exact: true }).waitFor();

    stage = "rechazar la contraseña anterior y aceptar la nueva en POST /api/auth/login";
    await page.goto(frontendOrigin + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Iniciar sesión" }).waitFor();
    await waitForInteractiveView();
    await page.getByLabel("Correo", { exact: true }).fill(email);
    async function submitLogin(password: string, status: number) {
      await page.getByLabel("Contraseña", { exact: true }).fill(password);
      await postDuring("/api/auth/login", () => page.getByRole("button", { name: "Entrar" }).tap(), status);
    }
    await submitLogin(oldPassword, 401);
    await page.getByText("Correo o contraseña incorrectos", { exact: true }).waitFor();
    await submitLogin(newPassword, 200);
    stage = "navegar al área de equipo";
    await page.waitForURL("**/equipo");
  } catch (error) {
    const kind = error instanceof Error && error.name === "TimeoutError" ? "tiempo de espera agotado"
      : error instanceof assert.AssertionError ? "comprobación fallida" : "error de ejecución";
    t.diagnostic(`Disponibilidad: Angular=${services.angular}, API=${services.api}, SMTP escuchando=${services.smtp}; correos nuevos=${messages.length - count}.`);
    t.diagnostic(events.slice(-30).join("; ") || "No se observaron solicitudes de recuperación ni errores de navegador.");
    t.diagnostic(`Vista: ${JSON.stringify(await viewState().catch(() => "no disponible"))}.`);
    // Los errores de Playwright pueden incluir el fragmento del enlace o valores de los campos.
    assert.fail(`Recuperación en navegador: ${stage} (${kind}).`);
  } finally {
    await browser.close();
  }
});
