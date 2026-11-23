import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import express from "express";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { consentEvidence } from "../src/services/consent";
import { calendarDay } from "../src/services/program";
import { assertIsolatedDatabase } from "./isolated-database";

const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");
const password = "Browser-synthetic-wellbeing1";
const endpoint = "/api/athletes/me/wellbeing";
const recent = (days: number) => new Date(Date.parse(calendarDay(new Date())) - days * 86_400_000).toISOString().slice(0, 10);

function luminance(color: string) {
  const scale = color.startsWith("color(srgb ") ? 1 : 255;
  return color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / scale)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}

function contrast([foreground, background]: [string, string]) {
  const colors = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (colors[0] + .05) / (colors[1] + .05);
}

async function main() {
  await assertIsolatedDatabase(prisma);
  const passwordHash = await bcrypt.hash(password, 4);
  const create = (email: string, role: "ATHLETE" | "PHYSIO" | "COACH") => prisma.user.create({
    data: { fullName: "Cuenta sintética", passwordHash, email: email + "@example.test", role },
  });
  const [owner, physio, coach] = await Promise.all([
    create("wellness-athlete", "ATHLETE"), create("wellness-physio", "PHYSIO"), create("wellness-coach", "COACH"),
  ]);
  const athlete = await prisma.athlete.create({ data: {
    userId: owner.id, coachId: coach.id, programStartedAt: new Date(recent(10)), birthDate: new Date("1999-01-01"),
  } });
  await prisma.program.create({ data: {
    id: "0000-browser-wellbeing", name: "Programa sintético de bienestar", weeks: 8, sessions: { create: { week: 1, number: 1 } },
  } });
  await prisma.consent.create({ data: { userId: owner.id, ...consentEvidence(false) } });
  await prisma.functionalTest.create({ data: {
    athleteId: athlete.id, testType: "T_TEST", phase: "INITIAL", result: {}, version: 1,
    revisions: { create: {
      operationId: randomUUID(), authorId: physio.id, authorName: "Fisioterapia sintética",
      version: 1, measuredOn: new Date(recent(10)), result: {}, fingerprint: "fixture",
    } },
  } });

  const site = express();
  site.use((req, res, next) => req.path.startsWith("/api/") ? app(req, res, next) : next());
  const dist = process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, "../../frontend/dist/frontend/browser");
  site.use(express.static(dist));
  site.get("*", (_req, res) => res.sendFile(resolve(dist, "index.html")));
  const server = site.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.BROWSER_BIN ?? "/opt/brave-bin/brave",
      headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const mobile = await browser.newContext({ viewport: { width: 414, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    const page = await mobile.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error: Error) => pageErrors.push(error.name));
    const login = async (target: typeof page, email: string, roleHome: string) => {
      await target.goto(base + "/login");
      await target.getByLabel("Correo", { exact: true }).fill(email);
      await target.getByLabel("Contraseña", { exact: true }).fill(password);
      await target.getByRole("button", { name: "Entrar", exact: true }).click();
      await target.waitForURL(base + roleHome);
    };
    await login(page, owner.email, "/deportista");
    await page.getByRole("link", { name: "Mi bienestar", exact: true }).press("Enter");
    await page.getByRole("heading", { name: "Mi bienestar", exact: true }).waitFor();
    await page.getByText("Todavía no tienes registros de bienestar.").waitFor();
    await page.getByRole("button", { name: "Registrar bienestar" }).press("Enter");
    const form = page.locator("app-wellbeing form");
    const save = form.getByRole("button", { name: "Guardar registro" });
    await page.waitForFunction(() => document.activeElement?.id === "wellbeing-form");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "wellbeing-day");
    await save.press("Enter");
    await form.getByRole("alert").filter({ hasText: "al menos una respuesta" }).waitFor();

    for (const [width, height] of [[320, 700], [360, 740], [390, 800], [414, 800], [768, 1024], [1024, 800], [1440, 900], [896, 414]]) {
      await page.setViewportSize({ width, height });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(async (value: string) => {
          document.documentElement.dataset.theme = value;
          await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
          await Promise.allSettled(document.getAnimations().map(animation => animation.finished));
        }, theme);
        const geometry = await form.evaluate((element: HTMLElement) => {
          const card = element.closest(".card")!;
          const controls = [...element.querySelectorAll("input, select, textarea")];
          const error = element.querySelector('[role="alert"]')!;
          const submit = element.querySelector('button[aria-busy]')!;
          const pairs = [...element.querySelectorAll("label, .hint, .meta")].map(node => [node, card])
            .concat(controls.map(node => [node, node]), [[error, error], [submit, submit]]);
          return {
            fonts: controls.map(node => parseFloat(getComputedStyle(node).fontSize)),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            colors: pairs.map(([text, surface]) => [getComputedStyle(text).color, getComputedStyle(surface).backgroundColor]),
            submitHeight: submit.getBoundingClientRect().height,
          };
        });
        assert.ok(!geometry.overflow && geometry.fonts.every((size: number) => size >= 16), `${width} ${theme}`);
        const ratios = geometry.colors.map(contrast);
        assert.ok(ratios.every((ratio: number) => ratio >= 4.5), `Contraste ${width} ${theme}: ${JSON.stringify({ ratios, colors: geometry.colors })}`);
        assert.ok(geometry.submitHeight >= 44);
        await save.scrollIntoViewIfNeeded();
        assert.ok(await save.evaluate((element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return hit === element || element.contains(hit);
        }));
      }
    }
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await save.scrollIntoViewIfNeeded();
    assert.ok(await save.evaluate((element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element;
    }));
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 414, height: 350 });
    await save.scrollIntoViewIfNeeded();
    await form.getByLabel("Horas de sueño").tap();
    const viewport = await page.evaluate(() => ({
      scale: visualViewport?.scale, viewport: document.querySelector('meta[name=viewport]')?.getAttribute("content"),
      focus: getComputedStyle(document.activeElement!).outlineStyle,
    }));
    assert.equal(viewport.scale, 1);
    assert.notEqual(viewport.focus, "none");
    assert.doesNotMatch(viewport.viewport, /user-scalable=no|maximum-scale/);
    await page.setViewportSize({ width: 414, height: 800 });
    await form.getByLabel("Horas de sueño").fill("7.5");
    await form.getByLabel("¿Cuánta fatiga sentiste?").selectOption("NONE");
    await form.getByLabel("Observaciones privadas", { exact: false }).fill("Nota privada sintética");
    await page.route(base + endpoint, route => route.request().method() === "POST" ? route.abort() : route.continue());
    await save.tap();
    await form.getByRole("alert").filter({ hasText: "conectar" }).waitFor();
    assert.equal(await form.getByLabel("Horas de sueño").inputValue(), "7.5");
    await page.unroute(base + endpoint);
    const [created] = await Promise.all([
      page.waitForResponse(response => response.url() === base + endpoint && response.request().method() === "POST"), save.tap(),
    ]);
    assert.equal(created.status(), 201);
    const { id } = await created.json();
    const notice = page.getByRole("status").filter({ hasText: "Registro guardado" });
    await notice.waitFor();
    assert.ok(contrast(await notice.evaluate((element: HTMLElement) => [
      getComputedStyle(element).color, getComputedStyle(element).backgroundColor,
    ])) >= 4.5);
    const original = page.locator(".wellbeing-record").filter({ has: page.locator(`time[datetime="${recent(0)}"]`) }).first();
    await original.locator("summary").first().press("Enter");
    await original.getByText("Nota privada sintética").waitFor();
    await original.getByRole("button", { name: "Corregir registro" }).press("Enter");
    await form.getByLabel("Horas de sueño").fill("6.5");

    const token = await page.evaluate(() => sessionStorage.getItem("ls_token"));
    const concurrent = await page.request.patch(base + endpoint + "/" + id, {
      headers: { authorization: "Bearer " + token },
      data: { operationId: randomUUID(), expectedVersion: 1, sleepHours: 8.5, fatigue: "HIGH" },
    });
    assert.equal(concurrent.status(), 200);
    await save.tap();
    await form.getByRole("alert").filter({ hasText: "registro cambió" }).waitFor();
    await form.getByRole("button", { name: "Consultar versión guardada" }).press("Enter");
    await form.getByText("8,5 h", { exact: true }).waitFor();
    assert.equal(await form.getByLabel("Horas de sueño").inputValue(), "6.5");
    await form.getByRole("button", { name: "Usar la versión guardada en el formulario" }).press("Enter");
    await form.getByLabel("Horas de sueño").fill("8");
    await save.tap();
    await page.getByRole("status").filter({ hasText: "Registro guardado" }).waitFor();
    if (!(await original.locator("details").first().evaluate((details: HTMLDetailsElement) => details.open))) {
      await original.locator("summary").first().press("Enter");
    }
    const history = original.getByRole("button", { name: "Ver historial de cambios" });
    assert.equal(await history.getAttribute("aria-expanded"), "false");
    await history.press("Space");
    assert.equal(await original.getByRole("button", { name: "Ocultar historial" }).getAttribute("aria-expanded"), "true");
    await original.getByText("Versión 1", { exact: false }).waitFor();

    await page.getByRole("button", { name: "Registrar bienestar" }).tap();
    await form.getByLabel("Fecha (obligatoria)").fill(recent(1));
    await form.getByLabel("Horas de sueño").fill("7");
    await form.getByLabel("¿Cómo percibes tu recuperación?").selectOption("GOOD");
    await save.tap();
    await page.locator(".wellbeing-chart li").last().waitFor();
    assert.equal(await page.locator(".wellbeing-chart li").count(), 2);
    assert.ok(contrast(await page.locator(".wellbeing-track").first().evaluate((track: HTMLElement) => [
      getComputedStyle(track.firstElementChild!).backgroundColor, getComputedStyle(track).backgroundColor,
    ])) >= 3);
    await page.getByText("Consultar datos por fecha").press("Enter");
    await page.locator('[aria-labelledby="wellbeing-evolution"]').getByText("Buena", { exact: true }).waitFor();
    if (process.env.WELLBEING_CAPTURE_DIR) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(process.env.WELLBEING_CAPTURE_DIR, "bienestar-movil-oscuro.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => document.documentElement.dataset.theme = "light");
      await page.screenshot({ path: resolve(process.env.WELLBEING_CAPTURE_DIR, "bienestar-escritorio-claro.png"), fullPage: true });
      await page.setViewportSize({ width: 414, height: 800 });
    }
    await page.reload();
    await page.locator(".wellbeing-chart li").last().waitFor();
    const loggedOut = await page.request.post(base + "/api/auth/logout", { headers: { authorization: "Bearer " + token } });
    assert.equal(loggedOut.status(), 204);
    await page.reload();
    await page.waitForURL(base + "/login");
    await login(page, owner.email, "/deportista");
    await page.getByRole("link", { name: "Mi bienestar", exact: true }).tap();
    await page.locator(".wellbeing-chart li").last().waitFor();

    const professional = await browser.newPage();
    await login(professional, physio.email, "/equipo");
    await professional.goto(base + `/equipo/deportistas/${athlete.id}?tab=wellbeing`);
    await professional.getByRole("heading", { name: "Registros de bienestar" }).waitFor();
    await professional.locator("app-wellbeing").getByText("8 h", { exact: true }).waitFor();
    const physioChart = professional.locator("app-sleep-card");
    await physioChart.getByText("Ver tabla de horas de sueño").press("Enter");
    await physioChart.getByRole("cell", { name: "8 h", exact: true }).waitFor();
    assert.equal(await professional.getByText("Nota privada sintética").count(), 0);
    assert.equal(await professional.getByRole("button", { name: "Corregir registro" }).count(), 0);
    const coachPage = await browser.newPage();
    await login(coachPage, coach.email, "/equipo");
    await coachPage.goto(base + `/equipo/deportistas/${athlete.id}?tab=wellbeing`);
    await coachPage.getByRole("heading", { name: "Cuenta sintética", exact: true }).waitFor();
    assert.equal(await coachPage.getByRole("link", { name: "Bienestar", exact: true }).count(), 0);
    const coachSleep = base + `/equipo/deportistas/${athlete.id}?tab=sleep`;
    await coachPage.goto(coachSleep);
    await coachPage.getByText("Las horas de sueño no están disponibles para esta consulta.").waitFor();

    const privacy = page.locator("app-sleep-sharing");
    await privacy.getByText("Compartir horas de sueño con mi entrenador").press("Enter");
    await privacy.getByRole("checkbox").check();
    const authorize = privacy.getByRole("button", { name: "Autorizar acceso al sueño" })
      .and(privacy.locator("button:enabled"));
    await authorize.waitFor();
    const [grant] = await Promise.all([
      page.waitForResponse(response => response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/athletes/me/sleep/sharing"),
      authorize.press("Enter"),
    ]);
    assert.equal(grant.status(), 204, "La autorización de sueño debe guardarse antes de consultar como entrenador.");
    await privacy.getByRole("button", { name: "Retirar acceso al sueño" }).waitFor();
    await coachPage.reload();
    const coachChart = coachPage.locator("app-sleep-card");
    await coachChart.getByText("Ver tabla de horas de sueño").press("Enter");
    await coachChart.getByRole("cell", { name: "7 h", exact: true }).waitFor();
    await coachChart.getByRole("cell", { name: "8 h", exact: true }).waitFor();
    assert.equal(await coachChart.locator("tbody tr").count(), 2);
    assert.equal(await coachPage.getByText("Nota privada sintética").count(), 0);
    assert.equal(await coachChart.getByText("Fatiga").count(), 0);

    await page.getByRole("link", { name: "Progreso", exact: true }).press("Enter");
    const athleteChart = page.locator("app-sleep-card");
    const table = athleteChart.getByText("Ver tabla de horas de sueño");
    await table.press("Enter");
    await athleteChart.getByRole("cell", { name: "8 h", exact: true }).waitFor();
    for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(async (value: string) => {
          document.documentElement.dataset.theme = value;
          await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
          await Promise.allSettled(document.getAnimations().map(animation => animation.finished));
        }, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Sueño ${width} ${theme}`);
        assert.ok(await athleteChart.locator("svg").evaluate((element: SVGElement) =>
          element.getBoundingClientRect().width <= element.closest("section")!.clientWidth));
        const colors = await athleteChart.locator("td").first().evaluate((element: HTMLElement) => [
          getComputedStyle(element).color, getComputedStyle(element.closest("section")!).backgroundColor,
        ]);
        const ratio = contrast(colors);
        assert.ok(ratio >= 4.5, `Contraste de sueño a ${width} px en ${theme}: ${ratio} (${colors.join(" / ")})`);
      }
    }
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await table.focus();
    assert.notEqual(await table.evaluate((element: HTMLElement) => getComputedStyle(element).outlineStyle), "none");
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.getByRole("link", { name: "Mi bienestar", exact: true }).press("Enter");
    await privacy.getByText("Compartir horas de sueño con mi entrenador").press("Enter");
    await privacy.getByRole("button", { name: "Retirar acceso al sueño" }).press("Enter");
    await privacy.getByText("El acceso del entrenador se retiró.").waitFor();
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await coachPage.getByText("Las horas de sueño no están disponibles para esta consulta.").waitFor();
    assert.equal(await coachChart.locator("table").count(), 0);
    console.log("Sueño: 14 combinaciones de ancho y tema, tabla y teclado, alcance profesional y revocación aplicados.");
    await coachPage.goto(base + "/deportista/bienestar");
    await coachPage.waitForURL(base + "/equipo");
    assert.deepEqual(pageErrors, []);
    console.log("Bienestar: Chromium pasó 16 combinaciones de ancho y tema, formulario táctil, foco, contraste, error de red, conflicto, historial, roles y persistencia.");
  } finally {
    await browser?.close();
    await new Promise<void>(done => server.close(() => done()));
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
