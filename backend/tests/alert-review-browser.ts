// Prueba opcional sobre API y PostgreSQL temporales reales. Playwright se carga externamente.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/db';
const externalRequire = createRequire(__filename);
const { chromium } = externalRequire(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');
if (process.env.ALERT_REVIEW_TESTS !== '1' || !process.env.DATABASE_URL?.includes('/luchasegura_alert_test')) throw new Error('Solo se permite la base temporal de pruebas');

async function main() {
  const user = await prisma.user.create({ data: { email: `browser-${Date.now()}@example.test`, fullName: 'Profesional de prueba', passwordHash: await bcrypt.hash('Browser-test-password-123', 4), role: 'PHYSIO' } });
  const patient = await prisma.user.create({ data: { email: `patient-${Date.now()}@example.test`, fullName: 'Deportista con nombre extenso para comprobación de interfaz', passwordHash: 'test-only', role: 'ATHLETE' } });
  const athlete = await prisma.athlete.create({ data: { userId: patient.id } });
  await prisma.injury.create({ data: { athleteId: athlete.id, isHistory: true, bodyZone: 'Rodilla', recurrent: true, injuryType: 'Antecedente registrado para la prueba' } });
  const injury = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: 'Rodilla', intensity: 7, whenOccurs: 'Entrenando', mechanism: 'Texto de mecanismo registrado para prueba', limitation: 'PARTIAL', notes: 'Notas almacenadas del reporte de prueba' } });
  const alert = await prisma.alert.create({ data: { injuryId: injury.id } });
  const directInjury = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: 'Hombro', intensity: 6 } });
  const directAlert = await prisma.alert.create({ data: { injuryId: directInjury.id } });
  const initialPending = await prisma.alert.count({ where: { status: { in: ['NEW', 'IN_REVIEW'] } } });
  const initialFollowUps = await prisma.alert.count({ where: { status: 'FOLLOW_UP_PENDING' } });
  const site = express();
  site.use((req, res, next) => req.path.startsWith('/api/') ? app(req, res, next) : next());
  const dist = resolve(__dirname, '../../frontend/dist/frontend/browser');
  site.use(express.static(dist)); site.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  const server = site.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? '/opt/brave-bin/brave', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    await page.goto(base + '/login');
    assert.ok((await page.locator('.alt a').evaluate((el: Element) => getComputedStyle(el).textDecorationLine)).includes('underline'));
    async function login() {
      await page.getByLabel('Correo', { exact: true }).fill(user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-password-123');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL('**/equipo');
    }
    async function badge(expected: number) {
      await page.waitForFunction((n: number) => {
        const badge = document.querySelector('.nav a[href="/equipo/alertas"] .nav-badge');
        return n ? badge?.textContent?.trim() === String(n) : !badge;
      }, expected);
    }
    await login(); await badge(initialPending);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      (window as any).alertEntries = 0; (window as any).alertSkips = 0;
      document.addEventListener('animationstart', (e) => { if ((e.target as Element).matches('.alerts-entry > header') && e.animationName === 'rise') (window as any).alertEntries++; });
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: any[]) => {
        const transition = start(args[0]); const skip = transition.skipTransition.bind(transition);
        transition.skipTransition = () => { (window as any).alertSkips++; skip(); };
        return transition;
      };
    });
    await page.locator('.nav a[href="/equipo/alertas"]').click();
    await page.waitForFunction(() => (window as any).alertEntries === 1 && (window as any).alertSkips >= 1);
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).waitFor();
    assert.equal(await page.locator('.alerts-entry > header').evaluate((el: Element) => getComputedStyle(el).animationDuration), '0.32s');
    assert.equal(await page.locator('.alerts-entry > .review-stack > li').nth(1).evaluate((el: Element) => getComputedStyle(el).animationDelay), '0.04s');
    const actionButton = page.locator(`a[href="/equipo/alertas/${alert.id}"]`);
    assert.equal(await actionButton.innerText(), 'Abrir revisión');
    assert.equal(await actionButton.evaluate((el: Element) => getComputedStyle(el).textDecorationLine), 'none');
    await actionButton.hover(); assert.equal(await actionButton.evaluate((el: Element) => getComputedStyle(el).textDecorationLine), 'none');
    await page.locator('.nav a[href="/equipo/deportistas"]').click();
    await page.locator('.nav a[href="/equipo/alertas"]').click();
    await page.waitForFunction(() => (window as any).alertEntries === 2);
    await page.locator('#alert-status').selectOption('ALL');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => (window as any).alertEntries), 2, 'Cambiar filtros no repite la entrada de toda la pantalla');
    await page.locator('#alert-status').selectOption('PENDING');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => release = resolve);
    await page.route(`**/api/team/alerts/${alert.id}`, async (route: any) => { await gate; await route.continue(); });
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).click();
    await page.locator('.review-skeleton[aria-busy="true"]').waitFor();
    assert.equal(await page.locator('.review-skeleton .card').count(), 4);
    assert.equal(await page.locator('.review-skeleton .sk-textarea').count(), 5);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t: string) => document.documentElement.dataset['theme'] = t, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('.review-skeleton .sk').first().evaluate((el: Element) => getComputedStyle(el).animationName), 'shimmer');
    await page.screenshot({ path: '/tmp/luchasegura-alert-skeleton.png', fullPage: true });
    release();
    await page.waitForSelector('#rv-observations');
    await page.unroute(`**/api/team/alerts/${alert.id}`);
    assert.equal(await page.locator('.review-stack > section').first().evaluate((el: Element) => getComputedStyle(el).animationName), 'rise');
    assert.equal(await page.locator('.review-stack > section').first().evaluate((el: Element) => getComputedStyle(el).animationDuration), '0.32s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.locator('.review-stack > section').first().evaluate((el: Element) => parseFloat(getComputedStyle(el).animationDuration) <= 0.001));
    await page.locator('#rv-observations').focus(); await page.keyboard.press('Tab');
    assert.ok(await page.locator('#rv-findings').evaluate((el: Element) => document.activeElement === el && getComputedStyle(el).boxShadow !== 'none'));
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.getByText('Texto de mecanismo registrado para prueba', { exact: true }).count(), 1);
    await page.locator('#rv-observations').fill('Borrador conservado al iniciar la revisión');
    await page.getByRole('button', { name: 'Iniciar revisión', exact: true }).click();
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.locator('#rv-observations').inputValue(), 'Borrador conservado al iniciar la revisión');
    const liveReport = await page.locator('#review-report').elementHandle();
    await page.locator('#rv-action').fill('Actuación documentada por el profesional de prueba');
    await page.locator('#rv-findings').fill('Hallazgos introducidos para la prueba');
    await page.locator('#rv-recommendations').fill('Indicaciones introducidas por el profesional para la prueba');
    await page.getByLabel('Necesita seguimiento', { exact: true }).check();
    await page.locator('#rv-date').fill('2027-01-15');
    await page.locator('#rv-referral').fill('Remisión registrada para la prueba');
    let geometry = 0;
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t: string) => document.documentElement.dataset['theme'] = t, theme);
        const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(size.scroll <= size.viewport + 1, JSON.stringify(size)); geometry++;
      }
    }
    await page.route('**/api/team/overview', (route: any) => route.abort('failed'));
    const save = page.getByRole('button', { name: /^Guardar (revisión|seguimiento)$/ });
    await save.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
    await page.locator('header .badge').filter({ hasText: 'Seguimiento pendiente' }).waitFor();
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id } }), 2);
    assert.ok(await page.locator('#review-report').evaluate((el: Element, before: Element) => el === before, liveReport));
    await badge(initialPending - 1);
    await page.locator('.nav a[href="/equipo"]').click();
    await page.locator('.kpi').first().waitFor();
    assert.equal(await page.locator('.kpi').filter({ hasText: 'Alertas por revisar' }).locator('strong').innerText(), String(initialPending - 1));
    await page.getByRole('link', { name: `Seguimientos pendientes: ${initialFollowUps + 1}`, exact: true }).click();
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).waitFor();
    assert.equal(await page.locator('#alert-status').inputValue(), 'FOLLOW_UP_PENDING');
    assert.equal(await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).innerText(), 'Registrar seguimiento');
    await page.getByRole('link', { name: 'Por revisar', exact: true }).click();
    await page.locator('#alert-status').waitFor(); await page.waitForTimeout(150);
    assert.equal(await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).count(), 0);
    await page.unroute('**/api/team/overview');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
    await page.locator('.swal2-confirm').click(); await page.waitForURL('**/login');
    await login(); await badge(initialPending - 1);
    await page.getByRole('link', { name: `Seguimientos pendientes: ${initialFollowUps + 1}`, exact: true }).click();
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).click();
    await page.waitForURL(`**/equipo/alertas/${alert.id}`);
    await page.waitForSelector('#rv-action');
    await page.reload(); await page.waitForSelector('#rv-action');
    assert.equal(await page.getByText('Actuación documentada por el profesional de prueba', { exact: false }).count(), 1);
    await page.getByRole('button', { name: 'Iniciar seguimiento', exact: true }).click();
    await page.waitForSelector('#rv-action'); await badge(initialPending - 1);
    await page.locator('#rv-observations').fill('Observaciones del seguimiento de prueba');
    await page.locator('#rv-action').fill('Actuación del seguimiento de prueba');
    await page.getByRole('button', { name: 'Guardar seguimiento', exact: true }).click();
    await page.locator('header .badge').filter({ hasText: 'Seguimiento pendiente' }).waitFor();
    await page.waitForFunction(() => document.querySelector('#rv-observations') && !(document.querySelector('#rv-observations') as HTMLTextAreaElement).value);
    await badge(initialPending - 1);
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id, kind: 'REVIEW' } }), 2);
    await page.locator('#rv-followup-action').selectOption({ label: 'Finalizar seguimiento' });
    await page.getByRole('button', { name: 'Finalizar seguimiento', exact: true }).click();
    await page.getByRole('alert').first().waitFor();
    await page.locator('#rv-observations').fill('Observaciones ficticias para finalizar el seguimiento');
    await page.locator('#rv-action').fill('Actuación ficticia que documenta la finalización');
    const countBeforeFinish = await prisma.alertEntry.count({ where: { alertId: alert.id } });
    const finishButton = page.getByRole('button', { name: 'Finalizar seguimiento', exact: true });
    await finishButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await page.locator('header .badge').filter({ hasText: 'Revisión registrada' }).waitFor();
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id } }), countBeforeFinish + 1);
    await page.getByText('Seguimiento finalizado', { exact: true }).first().waitFor();
    const expected = await prisma.alert.count({ where: { status: { in: ['NEW', 'IN_REVIEW'] } } });
    await page.locator('.nav a').filter({ hasText: 'Resumen' }).click();
    await page.locator('.kpi').first().waitFor();
    assert.equal(await page.locator('.kpi').filter({ hasText: 'Alertas por revisar' }).locator('strong').innerText(), String(expected));
    await badge(initialPending - 1);
    await page.locator('.nav a[href="/equipo/alertas"]').click();
    await page.locator(`a[href="/equipo/alertas/${directAlert.id}"]`).click();
    await page.locator('#rv-observations').fill('Revisión directa de prueba sin seguimiento');
    await page.locator('#rv-action').fill('Actuación de prueba sin seguimiento');
    await page.getByRole('button', { name: /^Guardar (revisión|seguimiento)$/ }).click();
    await page.locator('header .badge').filter({ hasText: 'Revisión registrada' }).waitFor();
    await badge(initialPending - 2);
    await page.getByRole('link', { name: 'Volver a alertas', exact: true }).click();
    await page.locator('#alert-status').waitFor(); await page.waitForTimeout(150);
    assert.equal(await page.locator(`a[href="/equipo/alertas/${directAlert.id}"]`).count(), 0);
    await page.locator('#alert-status').selectOption('REVIEWED');
    await page.locator(`a[href="/equipo/alertas/${directAlert.id}"]`).waitFor();
    assert.equal(await page.locator(`a[href="/equipo/alertas/${directAlert.id}"]`).innerText(), 'Consultar revisión');
    await page.reload(); await page.locator(`a[href="/equipo/alertas/${directAlert.id}"]`).waitFor();
    assert.equal(await page.locator('#alert-status').inputValue(), 'REVIEWED');
    await page.goto(base + `/equipo/deportistas/${athlete.id}`);
    await page.getByRole('link', { name: 'Alertas y revisiones', exact: true }).click();
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).click();
    await page.waitForURL(`**/equipo/alertas/${alert.id}`);
    await page.locator('#review-form-title').waitFor();
    assert.equal(await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).count(), 0);
    await page.locator('summary').filter({ hasText: 'Reabrir alerta' }).click();
    await page.locator('#reopen-reason').fill('Motivo de reapertura registrado para la prueba');
    await page.getByRole('button', { name: 'Reabrir alerta', exact: true }).click();
    await page.waitForSelector('#rv-action');
    await badge(initialPending - 1);
    await page.locator('#rv-observations').fill('Revisión tras reabrir, dato de prueba');
    await page.locator('#rv-action').fill('Actuación posterior, dato de prueba');
    const postUrl = `**/api/team/alerts/${alert.id}/review`;
    const before = await prisma.alertEntry.count({ where: { alertId: alert.id } });
    await page.route(postUrl, (route: any) => route.abort('failed'));
    await page.getByRole('button', { name: /^Guardar (revisión|seguimiento)$/ }).click();
    await page.locator('p.error').waitFor();
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id } }), before);
    await badge(initialPending - 1);
    assert.equal(await page.locator('#rv-observations').inputValue(), 'Revisión tras reabrir, dato de prueba');
    await page.unroute(postUrl);
    // El servidor guarda, pero se pierde la respuesta: el reintento no debe duplicar.
    await page.route(postUrl, async (route: any) => { await route.fetch(); await route.abort('failed'); });
    await page.getByRole('button', { name: /^Guardar (revisión|seguimiento)$/ }).click();
    await page.waitForTimeout(400);
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id } }), before + 1);
    await page.unroute(postUrl);
    await page.getByRole('button', { name: /^Guardar (revisión|seguimiento)$/ }).click();
    await page.locator('header .badge').filter({ hasText: 'Revisión registrada' }).waitFor();
    assert.equal(await prisma.alertEntry.count({ where: { alertId: alert.id } }), before + 1);
    await badge(initialPending - 2);
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 360 });
      const size = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
      assert.ok(size[1] <= size[0] + 1); geometry++;
      await page.screenshot({ path: `/tmp/luchasegura-alert-review-${width}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log(`Navegador + API + PostgreSQL: revisión, seguimiento, reapertura, historial, dashboard, errores de red e idempotencia correctos. ${geometry} comprobaciones de tamaño/tema correctas.`);
    await context.close();
  } finally {
    await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
