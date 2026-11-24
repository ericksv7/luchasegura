import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { prisma } from "../../src/db";
import { reportPassword } from "../program-report-fixture";
import { startReportSite } from "../program-report-site";
import { inspectLayout } from "./layout";
import { visualRoutes, type VisualRole } from "./routes";

const cwd = resolve(__dirname, "../../..");
const playwright = process.env.PLAYWRIGHT_CORE_PATH ?? resolve(cwd, ".angular/visual-tools/node_modules/playwright-core");
const { chromium } = createRequire(__filename)(playwright);
const selected = new Set([
  "GUEST:/registro", "GUEST:/olvide-contrasena", "ATHLETE:/deportista/bienestar",
  "PHYSIO:/equipo", "PHYSIO:/equipo/alertas/:id", "PHYSIO:/equipo/deportistas/:id", "PHYSIO:/equipo/informes-programa",
  "COACH:/equipo/deportistas/:id", "ADMIN:/admin",
]);

// tsx preserves names with an esbuild helper. Evaluations run in the browser realm.
const layoutScript = `(() => { const __name = fn => fn; return (${inspectLayout})(); })()`;

async function run() {
  const output = resolve(process.env.VISUAL_OUTPUT ?? resolve(cwd, ".angular/qa-visual"));
  const mode = process.env.VISUAL_MODE ?? "smoke";
  assert.ok(["smoke", "full", "reference"].includes(mode), "VISUAL_MODE inválido.");
  const baselineDirectory = process.env.VISUAL_BASELINE_DIR ? resolve(process.env.VISUAL_BASELINE_DIR) : null;
  assert.notEqual(output, baselineDirectory, "La salida debe ser distinta de la referencia.");
  await mkdir(output, { recursive: true });
  const { server, fixtures, origin } = await startReportSite(0, true);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const errors: string[] = [];
  const matrix: object[] = [];
  const captures: object[] = [];
  const comparisons: { name: string; distance: number; maximum: number }[] = [];
  const entries: object[] = [];
  let sidebarTransitions = 0;
  const interactions: string[] = [];
  try {
    const alert = await prisma.alert.findFirstOrThrow({ where: { injury: { athleteId: fixtures.athlete.id } }, select: { id: true } });
    const accounts = { GUEST: null, ATHLETE: fixtures.owner, PHYSIO: fixtures.physio, COACH: fixtures.coach, ADMIN: fixtures.admin };
    browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? "/usr/bin/brave", args: ["--no-sandbox"] });
    for (const role of Object.keys(accounts) as VisualRole[]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      let label = role + ":login";
      page.on("pageerror", error => errors.push(label + ": " + error.message));
      // The HTML build provides the font CSS. External image and video requests are irrelevant to the fixture.
      await context.route(url => url.origin !== origin && url.hostname !== "fonts.gstatic.com", route => route.abort());
      const account = accounts[role];
      if (account) {
        await page.goto(origin + "/login");
        await page.getByLabel("Correo", { exact: true }).fill(account.email);
        await page.getByLabel("Contraseña", { exact: true }).fill(reportPassword);
        await page.getByRole("button", { name: "Entrar", exact: true }).click();
        await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
      }
      for (const route of visualRoutes.filter(item => item.roles.includes(role))) {
        label = role + ":" + route.path;
        if (mode === "reference" && !selected.has(label)) continue;
        const path = route.path.replace(":id", route.path.includes("/alertas/") ? alert.id : fixtures.athlete.id);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + path, { waitUntil: "networkidle" });
        const actual = new URL(page.url()).pathname;
        if (actual !== path) {
          errors.push(label + ": redirigió a " + actual);
          continue;
        }
        await page.locator("h1").first().waitFor({ timeout: 6000 }).catch(() => {});
        const content = await page.evaluate(() => ({
          headings: Array.from(document.querySelectorAll("h1, h2")).filter(element => element.getClientRects().length)
            .slice(0, 6).map(element => element.textContent?.trim()),
          forms: Array.from(document.querySelectorAll("form")).filter(element => element.getClientRects().length).length,
          actions: Array.from(document.querySelectorAll("main button, main a.btn")).filter(element => element.getClientRects().length)
            .slice(0, 7).map(element => element.textContent?.trim()).filter(Boolean),
          state: document.querySelector(".state h2")?.textContent?.trim() ?? null,
        }));
        if (!content.headings.length) errors.push(label + ": vista sin encabezado visible");
        entries.push({ role, ...route, ...content });
        const widths = mode === "full" ? [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920] : [390, 1440];
        for (const width of widths) for (const theme of ["light", "dark"]) {
          if (mode === "reference" && ((!process.env.VISUAL_BASELINE_DIR && theme !== "light") || width !== 390)) continue;
          const height = width === 430 ? 390 : width === 1024 ? 560 : 844;
          await page.setViewportSize({ width, height });
          await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
          await page.evaluate(async () => { await document.fonts.ready; });
          const result = await page.evaluate(layoutScript) as ReturnType<typeof inspectLayout>;
          matrix.push({ role, path: route.path, width, height, theme, ...result });
          for (const error of result.problems) errors.push(`${label} ${width}×${height} ${theme}: ${error}`);
          if (selected.has(label) && ((width === 390 && theme === "light") || (width === 1440 && theme === "dark"))) {
            const name = [role.toLowerCase(), route.path.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), width, theme].join("_") + ".png";
            const file = resolve(output, name);
            if (route.path === "/equipo/alertas/:id") {
              await page.locator("#rv-followup-action").evaluate(node => node.scrollIntoView({ block: "center" }));
            }
            await page.screenshot({ path: file, animations: "disabled" });
            captures.push({ name, role, path: route.path, width, height, theme, state: content.state ?? "Vista inicial" });
            if (process.env.VISUAL_BASELINE_DIR) {
              const baseline = resolve(baselineDirectory!, name);
              const comparison = spawnSync("magick", ["compare", "-metric", "RMSE", baseline, file, "null:"], { encoding: "utf8" });
              const distance = Number(comparison.stderr?.match(/\(([\d.e+-]+)\)/)?.[1] ?? NaN);
              comparisons.push({ name, distance, maximum: .025 });
              if (!Number.isFinite(distance) || distance > .025) errors.push(`diferencia visual ${name}: ${comparison.stderr || comparison.error}`);
            }
          }
        }
      }
      if (account && mode === "full") {
        const navigation = page.getByRole("navigation", { name: "Navegación principal" });
        if (await navigation.count()) {
          await page.setViewportSize({ width: 1440, height: 844 });
          const initial = await navigation.elementHandle();
          const width = await initial!.evaluate(node => node.getBoundingClientRect().width);
          const main = page.locator("#contenido");
          const contentLeft = await main.evaluate(node => node.getBoundingClientRect().left);
          await page.evaluate(`(() => {
            const nav = document.querySelector(".nav");
            const state = { stopped: false, frames: 0, lost: 0 };
            Object.assign(window, { visualSidebarFrames: state });
            function frame() {
              if (state.stopped) return;
              state.frames++;
              if (!nav?.isConnected || !nav.getBoundingClientRect().width || getComputedStyle(nav).visibility !== "visible") state.lost++;
              requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          })()`);
          const links = await navigation.getByRole("link").all();
          for (const link of links.slice(0, 6)) {
            const href = await link.getAttribute("href");
            if (!href || href === new URL(page.url()).pathname) continue;
            await link.click();
            await page.waitForURL(origin + href, { timeout: 6000 });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const stable = await navigation.evaluate((node, args) => node === args.initial &&
              node.getBoundingClientRect().width === args.width && !document.documentElement.matches(":active-view-transition"),
            { initial, width });
            const currentLeft = await main.evaluate(node => node.getBoundingClientRect().left);
            if (Math.abs(currentLeft - contentLeft) > 1) errors.push(role + ": desplazamiento lateral del contenido en " + href);
            if (await link.getAttribute("aria-current") !== "page") errors.push(role + ": enlace activo incorrecto en " + href);
            if (!stable) errors.push(role + ": sidebar cambió durante " + href);
            sidebarTransitions++;
          }
          const frames = await page.evaluate(() => {
            const state = (window as unknown as { visualSidebarFrames: { stopped: boolean; frames: number; lost: number } }).visualSidebarFrames;
            state.stopped = true;
            return state;
          });
          if (!frames.frames || frames.lost) errors.push(`${role}: sidebar invisible en ${frames.lost}/${frames.frames} cuadros`);
        }
      }
      if (mode === "full" && process.env.VISUAL_OBSERVE !== "1") try {
        if (role === "PHYSIO" || role === "COACH") {
          await page.goto(origin + "/equipo/deportistas/" + fixtures.athlete.id, { waitUntil: "networkidle" });
          const sections = page.getByRole("navigation", { name: "Secciones de la ficha" }).getByRole("link");
          for (const link of await sections.all()) {
            const href = await link.getAttribute("href");
            const name = (await link.textContent())?.trim() ?? "";
            for (const [width, height, theme] of [[390, 700, "dark"], [1440, 844, "light"]] as const) {
              await page.setViewportSize({ width, height });
              await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
              await link.click();
              await page.waitForURL(origin + href);
              assert.equal(await link.getAttribute("aria-current"), "page");
              const result = await page.evaluate(layoutScript) as ReturnType<typeof inspectLayout>;
              matrix.push({ role, path: "/equipo/deportistas/:id · " + name, width, height, theme, ...result });
              errors.push(...result.problems.map(problem => role + " ficha " + name + ": " + problem));
            }
          }
          interactions.push(role + ": secciones visibles y navegación de ficha");
        }
        if (role === "ADMIN") {
          await page.setViewportSize({ width: 390, height: 700 });
          await page.goto(origin + "/admin", { waitUntil: "networkidle" });
          await page.getByRole("button", { name: "Nuevo usuario" }).click();
          const form = page.getByRole("form", { name: "Nuevo usuario" });
          const cancel = form.getByRole("button", { name: "Cancelar" });
          assert.ok((await cancel.getAttribute("class"))?.includes("tertiary"));
          const primary = form.getByRole("button", { name: "Crear usuario" });
          await form.getByLabel("Nombre completo").fill("Nombre sintético con varias palabras para probar la edición en móvil");
          await form.getByLabel("Correo").fill("correo-sin-formato");
          await primary.click();
          await form.getByText("Escribe un correo válido").waitFor();
          await cancel.click();
          await form.waitFor({ state: "hidden" });
          interactions.push("ADMIN: edición local, validación y cancelación del alta");
        }
        if (account) {
          await page.setViewportSize({ width: 430, height: 390 });
          const toggle = page.locator(".topbar .theme-btn");
          const current = await toggle.getAttribute("aria-label");
          await toggle.click();
          const next = current === "Cambiar a modo oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
          await page.locator(".topbar").getByRole("button", { name: next }).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), next.endsWith("claro") ? "dark" : "light");
          const logout = page.locator(".topbar").getByRole("button", { name: "Cerrar sesión" });
          await logout.click();
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          const bounds = await dialog.boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 430 && bounds.y + bounds.height <= 390);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Cerrar sesión");
          await logout.click();
          await dialog.getByRole("button", { name: "Cerrar sesión" }).click();
          await page.waitForURL(origin + "/login");
          interactions.push(role + ": tema, confirmación, Escape, foco restaurado y cierre real");
        } else {
          await page.goto(origin + "/login");
          await page.getByRole("button", { name: "Entrar", exact: true }).click();
          await page.getByText("Este campo es obligatorio").first().waitFor();
          await page.getByRole("button", { name: "Mostrar contraseña" }).click();
          await page.locator(".password-field input[type=text]").waitFor();
          interactions.push("GUEST: validación y visibilidad de contraseña");
        }
      } catch (error) {
        errors.push(role + ": interacción: " + String(error));
      }
      await context.close();
    }
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
    await writeFile(resolve(output, "resultados.json"), JSON.stringify({
      mode, routes: visualRoutes, entries, matrix, captures, comparisons, sidebarTransitions, interactions, errors,
    }, null, 2) + "\n");
  }
  console.log(`${visualRoutes.length} rutas, ${entries.length} vistas por rol, ${matrix.length} comprobaciones y ${sidebarTransitions} transiciones; ${errors.length} incidencias.`);
  for (const problem of [...new Set(errors)].slice(0, 60)) console.error(problem);
  if (errors.length && process.env.VISUAL_OBSERVE !== "1") process.exitCode = 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
