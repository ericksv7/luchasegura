import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { fixturePassword, seedSurveys } from "./preventive-survey-fixture";

const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");

function contrast(first: string, second: string) {
  const luma = (color: string) => {
    const scale = color.startsWith("color(srgb ") ? 1 : 255;
    return color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => channel / scale)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  };
  const values = [luma(first), luma(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

async function main() {
  const f = await seedSurveys();
  const site = express();
  const dist = process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, "../../frontend/dist/frontend/browser");
  site.use((req, res, next) => req.path.startsWith("/api/") ? app(req, res, next) : next());
  site.use(express.static(dist));
  site.get("*", (_req, res) => res.sendFile(resolve(dist, "index.html")));
  const server = site.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? "/usr/bin/brave", headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 414, height: 800 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.name));
    const own = base + "/deportista/encuestas";
    const team = base + `/equipo/deportistas/${f.athlete.id}/encuestas`;
    const api = base + "/api/preventive-surveys/me";
    const choice = (target: typeof page, id: string, value: string) => target.locator("#survey-" + id).selectOption(value);
    const visible = (target: typeof page, name: string) => target.getByText(name, { exact: true }).waitFor();
    const next = (target = page) => target.getByRole("button", { name: "Continuar", exact: true }).click();
    const save = () => page.getByRole("button", { name: "Guardar borrador" }).click();
    const submit = async (target: typeof page) => {
      await target.getByRole("checkbox", { name: "Confirmo que quiero presentar estas respuestas." }).check();
      await target.getByRole("button", { name: "Presentar encuesta" }).click();
      await visible(target, "Encuesta presentada.");
    };
    async function login(target: typeof page, email: string, home: string) {
      await target.goto(base + "/login");
      await target.getByLabel("Correo", { exact: true }).fill(email);
      await target.getByLabel("Contraseña", { exact: true }).fill(fixturePassword);
      await target.getByRole("button", { name: "Entrar", exact: true }).click();
      await target.waitForURL(base + home);
    }
    async function allow(target: typeof page) {
      await target.getByRole("checkbox").check();
      await target.getByRole("button", { name: "Autorizar demostración" }).click();
      await visible(target, "Autorización de demostración guardada.");
    }
    async function capture(target: typeof page, label: string) {
      if (!process.env.SURVEY_CAPTURE_DIR) return;
      await target.evaluate(() => window.scrollTo(0, 0));
      await target.screenshot({ path: resolve(process.env.SURVEY_CAPTURE_DIR, label + ".png"), fullPage: true });
    }

    await login(page, f.owner.email, "/deportista");
    await page.getByRole("link", { name: "Mi plan", exact: true }).click();
    await page.getByRole("link", { name: "Encuestas preventivas" }).press("Enter");
    await page.waitForURL(own);
    await allow(page);
    await page.getByText(/Disponible desde/).waitFor();
    await page.getByRole("button", { name: "Comenzar encuesta" }).press("Enter");
    await page.waitForFunction(() => document.activeElement?.id === "survey-step");
    await choice(page, "history", "yes");
    await next();
    await choice(page, "injury", "yes");
    await page.locator("#survey-episodes").fill("2");
    await page.route(api, route => route.request().method() === "PUT" ? route.abort() : route.continue());
    await save();
    await page.getByRole("alert").getByText(/conectar/).waitFor();
    assert.equal(await page.locator("#survey-episodes").inputValue(), "2");
    await page.unroute(api);
    await save();
    await visible(page, "Borrador guardado.");
    await page.reload();
    await page.getByRole("button", { name: "Continuar borrador" }).click();
    assert.equal(await page.locator("#survey-history").inputValue(), "yes");
    await next();
    assert.equal(await page.locator("#survey-episodes").inputValue(), "2");
    const headers = { Authorization: "Bearer " + await page.evaluate(() => sessionStorage.getItem("ls_token")) };
    const { slots } = await (await page.request.get(api, { headers })).json();
    const slot = slots[0];
    assert.equal((await page.request.put(api, { headers, data: {
      kind: slot.kind, programId: slot.programId, startedOn: slot.startedOn, expectedVersion: 1,
      catalogueVersion: slot.catalogue.version, referenceFrom: slot.catalogue.reference.from,
      operationId: randomUUID(), submit: false, answers: { injury: "yes", episodes: 4 },
    } })).status(), 200);
    await page.locator("#survey-episodes").fill("3");
    await save();
    await page.getByRole("button", { name: "Consultar versión vigente" }).click();
    await visible(page, "Versión guardada 2");
    await page.getByRole("button", { name: "Conservar mi borrador local" }).click();
    assert.equal(await page.locator("#survey-episodes").inputValue(), "3");

    const question = page.locator("#survey-injury");
    await question.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.ok(await question.evaluate((element: HTMLElement) =>
      document.activeElement === element && getComputedStyle(element).outlineStyle !== "none"));
    for (const width of [320, 360, 375, 390, 414, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(async (mode: string) => {
          document.documentElement.dataset.theme = mode;
          await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
          await Promise.allSettled(document.getAnimations().map(animation => animation.finished));
        }, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const geometry = await question.evaluate((element: HTMLElement) => {
          const field = getComputedStyle(element);
          const surface = getComputedStyle(element.closest(".surface")!);
          const label = getComputedStyle(element.previousElementSibling!);
          return {
            touch: parseFloat(field.fontSize) >= 16 && element.getBoundingClientRect().height >= 44,
            label: label.color, surface: surface.backgroundColor, text: field.color, field: field.backgroundColor,
            border: field.borderTopColor,
          };
        });
        assert.ok(geometry.touch);
        assert.ok(contrast(geometry.label, geometry.surface) >= 4.5);
        assert.ok(contrast(geometry.text, geometry.field) >= 4.5);
        assert.ok(contrast(geometry.border, geometry.surface) >= 3);
        if ([414, 1440].includes(width)) await capture(page, `lesiones-${width}-${theme}`);
      }
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await next();
    await page.getByRole("heading", { name: "Contexto de aparición" }).waitFor();
    await next();
    await page.getByRole("heading", { name: "Consecuencias de la lesión" }).waitFor();
    await next();
    await choice(page, "warmup", "often");
    await next();
    await visible(page, "Revisión y envío");
    await capture(page, "revision-movil");
    await submit(page);
    await page.getByRole("button", { name: "Ver historial guardado" }).click();
    await page.getByText(/Versión 1 ·/).waitFor();

    const physio = await browser.newPage({ reducedMotion: "reduce" });
    physio.on("pageerror", (error: Error) => errors.push(error.name));
    physio.on("console", (message: { type(): string; text(): string }) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text());
    });
    await login(physio, f.physio.email, "/equipo");
    const physioRequests: string[] = [];
    physio.on("request", (request: { url(): string }) => {
      if (request.url().includes("/api/preventive-surveys/")) physioRequests.push(request.url());
    });
    await physio.goto(team.replace(/\/encuestas$/, ""));
    const overviewResponse = physio.waitForResponse(base + `/api/preventive-surveys/team/${f.athlete.id}`);
    await physio.getByRole("link", { name: "Encuestas preventivas", exact: true }).click();
    const overview = await overviewResponse;
    assert.equal(overview.status(), 200);
    const professional = await overview.json();
    assert.equal(professional.enabled, true);
    assert.equal(professional.eligible, false);
    assert.equal(professional.consent, true);
    assert.equal(professional.records[0].kind, "INITIAL");
    assert.ok(professional.records[0].submittedAt);
    await physio.getByRole("button", { name: "Consultar respuestas" }).press("Enter");
    await visible(physio, "En más de la mitad");
    await physio.waitForFunction(() => document.activeElement?.id === "survey-reading");
    await visible(physio, f.owner.fullName);
    assert.equal(physioRequests.length, 1);
    await physio.reload();
    await physio.getByRole("button", { name: "Consultar respuestas" }).click();
    await visible(physio, "En más de la mitad");
    assert.equal(await physio.getByRole("button", { name: "Presentar encuesta" }).count(), 0);
    for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
      await physio.setViewportSize({ width, height: 820 });
      for (const theme of ["light", "dark"]) {
        await physio.evaluate((mode: string) => { document.documentElement.dataset.theme = mode; }, theme);
        const review = physio.locator("#survey-reading");
        const colors = await review.evaluate((heading: HTMLElement) => {
          const surface = heading.closest(".surface")!;
          return [getComputedStyle(surface.querySelector("dd")!).color, getComputedStyle(surface).backgroundColor];
        });
        assert.ok(contrast(colors[0], colors[1]) >= 4.5);
        assert.ok(await physio.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if ([320, 1440].includes(width)) await capture(physio, `consulta-fisioterapia-${width}-${theme}`);
      }
    }
    await physio.setViewportSize({ width: 320, height: 820 });
    await physio.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await physio.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await physio.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await physio.getByRole("link", { name: "Volver a la ficha" }).click();
    await physio.waitForURL(team.replace(/\/encuestas$/, ""));
    await physio.getByRole("link", { name: "Encuestas preventivas", exact: true }).click();
    await physio.getByRole("button", { name: "Consultar respuestas" }).click();
    const secondTeam = base + `/equipo/deportistas/${f.prior.id}/encuestas`;
    const switchAthlete = (url: string) => physio.evaluate((destination: string) => {
      history.pushState(null, "", destination);
      dispatchEvent(new PopStateEvent("popstate"));
    }, url);
    const documentedTest = await prisma.functionalTest.findFirstOrThrow({
      where: { athleteId: f.athlete.id }, include: { revisions: true },
    });
    const revision = documentedTest.revisions[0];
    await prisma.functionalTest.create({ data: {
      athleteId: f.prior.id, testType: documentedTest.testType, phase: documentedTest.phase,
      result: {}, version: 1, revisions: { create: {
        authorId: f.physio.id, authorName: revision.authorName, measuredOn: revision.measuredOn,
        operationId: randomUUID(), version: 1, result: {}, fingerprint: "fixture",
      } },
    } });
    const finished = await browser.newPage();
    await login(finished, f.other.email, "/deportista");
    await finished.goto(own);
    await allow(finished);
    await switchAthlete(secondTeam);
    await visible(physio, f.other.fullName);
    await visible(physio, "Aún no hay encuestas registradas para consultar.");
    assert.equal(await physio.getByText("En más de la mitad", { exact: true }).count(), 0);
    await switchAthlete(team);
    await physio.getByRole("button", { name: "Consultar respuestas" }).waitFor();
    await switchAthlete(base + `/equipo/deportistas/${f.minorAthlete.id}/encuestas`);
    await visible(physio, "No se encontró el recurso o tu cuenta no tiene acceso.");
    assert.equal(await physio.getByRole("button", { name: "Consultar respuestas" }).count(), 0);

    const coach = await browser.newPage();
    await login(coach, f.coach.email, "/equipo");
    await coach.goto(team);
    await coach.getByRole("button", { name: "Comenzar encuesta" }).click();
    assert.equal(await coach.locator("#survey-injury").count(), 0);
    await choice(coach, "warmup", "always");
    await next(coach); await next(coach);
    await submit(coach);
    await capture(coach, "entrenador-presentada");

    const outside = await browser.newPage();
    await login(outside, f.unrelated.email, "/equipo");
    await outside.goto(team);
    await visible(outside, "No se encontró el recurso o tu cuenta no tiene acceso.");

    await visible(finished, "Fuera de semana 0 · inicial pendiente");
    await finished.getByRole("button", { name: "Comenzar encuesta" }).click();
    await choice(finished, "injury", "no");
    assert.equal(await finished.locator("#survey-episodes").count(), 0);
    await next(finished); await next(finished); await submit(finished);
    await capture(finished, "final-presentada");
    await switchAthlete(secondTeam);
    await physio.getByRole("button", { name: "Consultar respuestas" }).click();
    await physio.getByRole("heading", { name: "Encuesta final" }).waitFor();
    await switchAthlete(team);
    await physio.getByRole("button", { name: "Consultar respuestas" }).waitFor();
    await page.getByRole("button", { name: "Volver a encuestas" }).click();
    await page.getByRole("button", { name: "Retirar autorización" }).click();
    await page.getByRole("button", { name: "Confirmar retiro" }).click();
    await visible(page, "Autorización retirada.");
    await physio.reload();
    await visible(physio, "Sin autorización vigente");
    assert.equal(await physio.getByRole("button", { name: "Consultar respuestas" }).count(), 0);
    const token = await physio.evaluate(() => sessionStorage.getItem("ls_token"));
    assert.equal((await physio.request.post(base + "/api/auth/logout", {
      headers: { Authorization: "Bearer " + token },
    })).status(), 204);
    const unauthorized = physio.waitForResponse((response: { url(): string; status(): number }) =>
      response.url().includes("/api/preventive-surveys/") && response.status() === 401);
    await physio.reload();
    await unauthorized;
    await physio.waitForURL(base + "/login");
    assert.equal(await physio.evaluate(() => sessionStorage.getItem("ls_token")), null);
    await login(physio, f.physio.email, "/equipo");
    const expired = jwt.sign({ sub: f.physio.id, role: f.physio.role }, config.jwtSecret, { expiresIn: -1 });
    await physio.evaluate((credential: string) => sessionStorage.setItem("ls_token", credential), expired);
    const beforeExpiry = physioRequests.length;
    await physio.goto(team);
    await physio.waitForURL(base + "/login");
    assert.equal(physioRequests.length, beforeExpiry);
    assert.deepEqual(errors, []);
    console.log("Encuestas: Brave verificó borradores, conflicto, envíos, consulta desde ficha, cambio de deportista, recarga, revocación, sesión y reflow en ambos temas.");
  } finally {
    await browser?.close();
    await new Promise<void>(done => server.close(() => done()));
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
