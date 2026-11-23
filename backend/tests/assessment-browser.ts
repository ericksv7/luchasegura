import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
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
    const captures = process.env.ASSESSMENT_CAPTURE_DIR;
    async function capture(name: string, anchor: ReturnType<typeof page.locator>, width = 390, theme = "light") {
      if (!captures) return;
      await mkdir(captures, { recursive: true });
      await page.setViewportSize({ width, height: 880 });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await anchor.evaluate(node => node.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: join(captures, name + ".png"), animations: "disabled" });
    }
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
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 880 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
          await page.evaluate(async () => { await document.fonts.ready; });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label} ${width} ${theme}`);
          if (width === 390) {
            const form = page.locator("form:visible").last();
            const metrics = await form.evaluate(node => {
              const field = node.querySelector("select, input:not([type=checkbox])");
              const root = document.documentElement;
              const previous = root.style.fontSize;
              const target = field?.getBoundingClientRect().height ?? 0;
              root.style.fontSize = "200%";
              try {
                return { target, overflow: node.scrollWidth > node.clientWidth + 1 };
              } finally {
                root.style.fontSize = previous;
              }
            });
            assert.ok(metrics.target >= 44, `${label}: control táctil ${theme}`);
            assert.equal(metrics.overflow, false, `${label}: texto al 200 % en ${theme}`);
          }
        }
      }
    };
    await page.goto(activePath + "?tab=evaluations");
    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("FMS");
    const squat = page.getByRole("group", { name: "Sentadilla profunda" }).getByLabel("Puntuación");
    await page.getByLabel("Fecha de evaluación", { exact: true }).fill("");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Revisa la fecha" }).waitFor();
    await page.getByLabel("Fecha de evaluación", { exact: true }).fill(fixtures.today);
    assert.equal(await page.getByRole("alert").filter({ hasText: "Revisa la fecha" }).count(), 0);
    await page.keyboard.press("Tab");
    await squat.focus();
    await page.keyboard.press("0");
    await squat.selectOption("0");
    assert.ok(await squat.evaluate(element => element.matches(":focus-visible")));
    await capture("fms", page.getByRole("group", { name: "Sentadilla profunda" }), 1440);
    await layout("FMS");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();
    const partialFms = page.locator("details.evaluation-result").filter({ hasText: /^FMS/ }).first();
    await partialFms.locator("summary").first().click();
    await partialFms.getByText("Requiere revisión profesional", { exact: true }).waitFor();
    await partialFms.getByRole("button", { name: "Ver historial de cambios" }).click();
    await partialFms.getByText(/^Versión 1/).waitFor();
    await partialFms.getByRole("button", { name: "Corregir evaluación" }).click();
    assert.equal(await page.getByRole("group", { name: "Sentadilla profunda" }).getByLabel("Puntuación").inputValue(), "0");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("LESS");
    await page.getByText("Intento 1 · 0/17 ítems", { exact: true }).click();
    await page.getByRole("group", { name: "Puntuaciones del intento 1" }).getByRole("combobox").first().selectOption("1");
    await capture("less", page.getByRole("group", { name: "Puntuaciones del intento 1" }), 390, "dark");
    await layout("LESS");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar evaluación" }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Registrar evaluación", exact: true }).click();
    await page.getByLabel("Instrumento", { exact: true }).selectOption("BASELINE");
    await page.getByLabel("Fecha de evaluación", { exact: true }).fill(fixtures.partialStart);
    await page.getByLabel("Peso en kg", { exact: true }).fill("56.5");
    await capture("semana-0", page.getByRole("group", { name: "Datos de referencia de semana 0" }), 1440, "dark");
    await layout("Semana 0");
    await page.getByRole("button", { name: "Guardar evaluación", exact: true }).click();
    await page.getByText("Evaluación guardada.", { exact: true }).waitFor();
    await page.getByText("Cobertura de la intervención vigente · Semana 0 incompleta", { exact: true }).waitFor();

    await page.goto(activePath + "?tab=history");
    await page.getByRole("heading", { name: "Sin historial" }).waitFor();
    await page.goto(fullPath + "?tab=history");
    const record = page.locator("li").filter({ has: page.locator("strong").filter({ hasText: /^Hombro$/ }) });
    await record.getByRole("button", { name: "Caracterización profesional", exact: true }).click();
    await record.getByRole("button", { name: "Corregir caracterización" }).click();
    assert.equal(await record.getByLabel("Días de ausencia").inputValue(), "5");
    await record.getByLabel("Días de ausencia").fill("6");
    await record.getByLabel("Motivo de corrección").fill("Corrección sintética");
    await capture("lesion", record.getByRole("group", { name: "Caracterización profesional", exact: true }), 390);
    await layout("Ficha de lesión");
    await record.getByRole("button", { name: "Guardar caracterización" }).click();
    await record.getByText("Versión vigente · 2", { exact: true }).waitFor();
    await page.goto(fullPath + "?tab=evaluations");
    await page.getByText("Cobertura de la intervención vigente · Semana 0 completa", { exact: true }).waitFor();
    for (const instrument of ["FMS", "LESS"]) {
      const evaluation = page.locator("details.evaluation-result").filter({ hasText: new RegExp("^" + instrument) }).first();
      await evaluation.locator("summary").first().click();
      await evaluation.getByText("Completa", { exact: true }).waitFor();
    }
    await page.goto(fullPath + "/informe");
    await page.getByRole("region", { name: "Comparación de FMS" }).waitFor();
    await page.getByRole("region", { name: "Comparación de LESS" }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar Excel individual" }).click(),
    ]);
    assert.equal(await download.failure(), null);
    const outsider = await browser.newPage({ viewport: { width: 390, height: 880 } });
    await outsider.goto(origin + "/login");
    await outsider.getByLabel("Correo", { exact: true }).fill(fixtures.outsider.email);
    await outsider.getByLabel("Contraseña", { exact: true }).fill(reportPassword);
    await outsider.getByRole("button", { name: "Entrar", exact: true }).click();
    await outsider.waitForURL(origin + "/equipo");
    for (const id of [fixtures.athlete.id, "00000000-0000-4000-8000-000000000002"]) {
      const response = outsider.waitForResponse(res => res.url().endsWith("/api/program-reports/athletes/" + id));
      await outsider.goto(origin + "/equipo/deportistas/" + id + "/informe");
      assert.equal((await response).status(), 404);
      await outsider.getByRole("heading", { name: "Informe no disponible" }).waitFor();
      assert.equal(await outsider.getByRole("button", { name: "Reintentar" }).count(), 0);
      assert.equal(await outsider.getByRole("link", { name: "Volver a Deportistas" }).getAttribute("href"), "/equipo/deportistas");
    }
    if (captures) await outsider.screenshot({ path: join(captures, "informe.png"), animations: "disabled" });
    console.log(fixtures.outsider.email + ": HTTP 404 para el deportista sintético fuera de alcance y la ruta de la captura.");
    await outsider.goto(fullPath + "?tab=history");
    const outsideRecord = outsider.locator("li").filter({ has: outsider.locator("strong").filter({ hasText: /^Hombro$/ }) });
    await outsideRecord.getByRole("button", { name: "Caracterización profesional", exact: true }).click();
    await outsideRecord.getByRole("heading", { name: "Caracterización no disponible" }).waitFor();
    assert.equal(await outsideRecord.getByRole("button", { name: "Reintentar" }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("Fase 10 Brave: formularios, correcciones, cobertura, 320/390/768/1024/1440 en ambos temas, comparaciones y Excel.");
  } finally {
    if (browser) await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
