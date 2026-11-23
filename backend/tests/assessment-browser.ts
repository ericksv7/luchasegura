import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { prisma } from "../src/db";
import { reportPassword } from "./program-report-fixture";
import { startReportSite } from "./program-report-site";

const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_CORE_PATH ?? "playwright-core");

async function main() {
  const { server, fixtures, origin } = await startReportSite(0, true);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? "/usr/bin/brave", args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 390, height: 880 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/login");
    await page.getByLabel("Correo", { exact: true }).fill(fixtures.physio.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(reportPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(origin + "/equipo");
    const fullPath = origin + "/equipo/deportistas/" + fixtures.athlete.id;
    const activePath = origin + "/equipo/deportistas/" + fixtures.partialAthlete.id;
    const layout = async (label: string) => {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 880 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
          await page.evaluate(async () => { await document.fonts.ready; });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label} ${width} ${theme}`);
        }
      }
    };
    await page.goto(activePath + "?tab=evaluations");
    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("FMS");
    await page.getByRole("group", { name: "Sentadilla profunda" }).getByLabel("Puntuación").selectOption("0");
    await layout("FMS");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();
    const partialFms = page.locator("details.evaluation-result").filter({ hasText: /^FMS/ }).first();
    await partialFms.locator("summary").first().click();
    await partialFms.getByText("Requiere revisión profesional", { exact: true }).waitFor();
    await partialFms.getByRole("button", { name: "Corregir evaluación" }).click();
    assert.equal(await page.getByRole("group", { name: "Sentadilla profunda" }).getByLabel("Puntuación").inputValue(), "0");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("LESS");
    await page.getByText("Intento 1 · 0/17 ítems", { exact: true }).click();
    await page.getByRole("group", { name: "Puntuaciones del intento 1" }).getByRole("combobox").first().selectOption("1");
    await layout("LESS");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar evaluación" }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("BASELINE");
    await page.getByLabel("Fecha de evaluación", { exact: true }).fill(fixtures.partialStart);
    await page.getByLabel("Peso en kg", { exact: true }).fill("56.5");
    await layout("Semana 0");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();
    await page.getByText("Cobertura de la intervención vigente · Semana 0 incompleta", { exact: true }).waitFor();

    await page.goto(fullPath + "?tab=history");
    const record = page.locator("li").filter({ has: page.locator("strong").filter({ hasText: /^Hombro$/ }) });
    await record.getByRole("button", { name: "Caracterización profesional", exact: true }).click();
    await record.getByRole("button", { name: "Corregir caracterización" }).click();
    assert.equal(await record.getByLabel("Días de ausencia").inputValue(), "5");
    await record.getByLabel("Días de ausencia").fill("6");
    await record.getByLabel("Motivo de corrección").fill("Corrección sintética");
    await layout("Ficha de lesión");
    await record.getByRole("button", { name: "Guardar caracterización" }).click();
    await record.getByText("Versión vigente · 2", { exact: true }).waitFor();
    await page.goto(fullPath + "?tab=evaluations");
    await page.getByText("Cobertura de la intervención vigente · Semana 0 completa", { exact: true }).waitFor();
    await page.goto(fullPath + "/informe");
    await page.getByRole("region", { name: "Comparación de FMS" }).waitFor();
    await page.getByRole("region", { name: "Comparación de LESS" }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar Excel individual" }).click(),
    ]);
    assert.equal(await download.failure(), null);
    assert.deepEqual(errors, []);
    console.log("Fase 10 Brave: formularios, correcciones, cobertura, 390/768/1440 en ambos temas, comparaciones y Excel.");
  } finally {
    if (browser) await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
