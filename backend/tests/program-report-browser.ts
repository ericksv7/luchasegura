import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../src/db";
import { reportPassword } from "./program-report-fixture";
import { startReportSite } from "./program-report-site";

const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");

async function main() {
  const { server, fixtures, origin } = await startReportSite();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? "/usr/bin/brave", args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const login = async (target: typeof page, email: string, destination: string) => {
      await target.goto(origin + "/login");
      await target.getByLabel("Correo", { exact: true }).fill(email);
      await target.getByLabel("Contraseña", { exact: true }).fill(reportPassword);
      await target.getByRole("button", { name: "Entrar", exact: true }).click();
      await target.waitForURL(origin + destination);
    };
    const mine = "/deportista/progreso/informe";
    await login(page, fixtures.owner.email, "/deportista");
    const shell = await page.locator(".nav").elementHandle();
    await page.locator('.nav a[href="/deportista/progreso"]').click();
    await page.getByRole("link", { name: "Ver informe del programa" }).click();
    await page.waitForURL(origin + mine);
    await page.getByRole("heading", { name: "Evaluaciones iniciales y finales" }).waitFor();
    assert.equal(await page.locator(".nav").evaluate((node: Element, previous: Element) =>
      node === previous && getComputedStyle(node).visibility === "visible" &&
      !document.documentElement.matches(":active-view-transition"), shell), true);
    await page.getByRole("region", { name: "Comparación de Agility T-test" }).getByRole("cell", { name: "-1", exact: true }).waitFor();
    await page.getByRole("img", { name: "Sesiones completadas por semana" }).waitFor();
    const selector = page.getByLabel("Intervención", { exact: true });
    await selector.focus();
    assert.equal(await selector.evaluate(element => document.activeElement === element), true);
    await selector.press("ArrowDown");
    await page.waitForURL(url => url.searchParams.get("start") === fixtures.past);
    await page.getByText("El historial de sesiones no permite calcular la participación para este ciclo.").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "report-intervention");
    await page.reload();
    await page.getByText("El historial de sesiones no permite calcular la participación para este ciclo.").waitFor();
    await page.goBack();
    await page.getByRole("region", { name: "Comparación de Agility T-test" }).waitFor();

    const captures = process.env.REPORT_CAPTURE_DIR;
    if (captures) await mkdir(captures, { recursive: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        await page.evaluate(async () => { await document.fonts.ready; });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width} ${theme}`);
        const chart = await page.getByRole("img", { name: "Sesiones completadas por semana" }).boundingBox();
        assert.ok(chart && chart.x >= 0 && chart.x + chart.width <= width + 1, `${width} ${theme}`);
        if (captures && (width === 390 || width === 1440)) {
          await page.screenshot({ path: resolve(captures, `individual-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
        }
      }
    }
    const [download] = await Promise.all([
      page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Excel individual" }).click(),
    ]);
    assert.match(download.suggestedFilename(), /^luchasegura_informe_individual_/);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile((await download.path())!);
    assert.equal(book.getWorksheet("Comparaciones")?.getCell("C4").value, 12);

    await page.route("**/api/program-reports/me", route => route.abort("failed"));
    await page.reload();
    await page.getByRole("heading", { name: "No pudimos cargar el informe" }).waitFor();
    await page.unroute("**/api/program-reports/me");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await page.getByRole("heading", { name: "Evaluaciones iniciales y finales" }).waitFor();

    const clinician = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await login(clinician, fixtures.physio.email, "/equipo");
    await clinician.getByRole("link", { name: "Ver informe grupal del programa" }).click();
    await clinician.getByText("Pares por instrumento", { exact: true }).waitFor();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await clinician.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await clinician.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        await clinician.evaluate(async () => { await document.fonts.ready; });
        assert.equal(await clinician.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Grupo ${width} ${theme}`);
        if (captures && ((width === 390 && theme === "dark") || (width === 1440 && theme === "light"))) {
          await clinician.screenshot({ path: resolve(captures, `grupal-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
        }
      }
    }
    const [groupDownload] = await Promise.all([
      clinician.waitForEvent("download"), clinician.getByRole("button", { name: "Descargar Excel grupal" }).click(),
    ]);
    assert.match(groupDownload.suggestedFilename(), /^luchasegura_informe_grupal_/);
    const teamPath = "/equipo/deportistas/" + fixtures.athlete.id + "/informe";
    await clinician.goto(origin + teamPath);
    await clinician.getByRole("region", { name: "Respuestas comparables de las encuestas" }).waitFor();
    await prisma.preventiveSurveyConsent.update({ where: { athleteId: fixtures.athlete.id }, data: { revokedAt: new Date() } });
    await clinician.evaluate(() => window.dispatchEvent(new Event("focus")));
    await clinician.getByText("La consulta requiere encuestas habilitadas y autorización vigente.").waitFor();
    assert.equal(await clinician.getByRole("region", { name: "Respuestas comparables de las encuestas" }).count(), 0);

    const outsider = await browser.newPage();
    await login(outsider, fixtures.outsider.email, "/equipo");
    await outsider.goto(origin + teamPath);
    await outsider.getByRole("heading", { name: "Informe no disponible" }).waitFor();
    const coach = await browser.newPage();
    await login(coach, fixtures.coach.email, "/equipo");
    await coach.goto(origin + teamPath);
    await coach.waitForURL(origin + "/equipo");
    assert.equal(await coach.getByRole("heading", { name: "Informe del programa" }).count(), 0);
    const empty = await browser.newPage();
    await login(empty, fixtures.empty.email, "/deportista");
    await empty.goto(origin + mine);
    await empty.getByRole("heading", { name: "Sin intervención registrada" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("Fase 8 en Brave: navegación, teclado, 20 combinaciones de tema/ancho, Excel, reintento, revocación, alcance y estado vacío aprobados.");
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
