import { assertIsolatedDatabase, assertIsolatedEnvironment } from './isolated-database';
// Prueba opcional sobre API y PostgreSQL temporales reales. Playwright se carga externamente.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/db';
const externalRequire = createRequire(__filename);
const { chromium } = externalRequire(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');
assertIsolatedEnvironment();

async function main() {
  await assertIsolatedDatabase(prisma);
  const captureDir = process.env.UX_CAPTURE_DIR;
  if (!(await prisma.program.findFirst({ where: { sessions: { some: {} } } }))) {
    await prisma.program.create({ data: {
      name: 'Programa sintético de navegación', weeks: 1, sessionsPerWeek: 1,
      sessions: { create: { week: 1, number: 1 } }
    } });
  }
  const planSession = await prisma.programSession.findFirstOrThrow({
    where: { week: 1, number: 1 }, orderBy: { programId: 'asc' },
    include: { exercises: { orderBy: { position: 'desc' }, take: 1 } },
  });
  await prisma.sessionExercise.create({
    data: {
      sessionId: planSession.id,
      exerciseId: 'legacy-plancha-fixture',
      position: (planSession.exercises[0]?.position ?? -1) + 1,
    },
  });
  await prisma.sessionExercise.create({
    data: {
      sessionId: planSession.id, exerciseId: 'legacy-bridge-fixture',
      position: (planSession.exercises[0]?.position ?? -1) + 2,
    },
  });
  const password = 'Browser-test-password-123';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({ data: { email: `browser-${Date.now()}@example.test`, fullName: 'Profesional de prueba', passwordHash, role: 'PHYSIO' } });
  const patient = await prisma.user.create({ data: { email: `patient-${Date.now()}@example.test`, fullName: 'Deportista con nombre extenso para comprobación de interfaz', passwordHash, role: 'ATHLETE' } });
  const admin = await prisma.user.create({ data: { email: 'admin-browser@example.test', fullName: 'Admin de prueba', passwordHash, role: 'ADMIN' } });
  const coach = await prisma.user.create({ data: { email: 'coach-browser@example.test', fullName: 'Entrenador de prueba', passwordHash, role: 'COACH' } });
  const athlete = await prisma.athlete.create({ data: { userId: patient.id, coachId: coach.id } });
  await prisma.injury.create({ data: { athleteId: athlete.id, isHistory: true, bodyZone: 'Rodilla', recurrent: true, injuryType: 'Antecedente registrado para la prueba' } });
  const injury = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: 'Rodilla', intensity: 7, whenOccurs: 'Entrenando', mechanism: 'Texto de mecanismo registrado para prueba', limitation: 'PARTIAL', notes: 'Notas almacenadas del reporte de prueba' } });
  const alert = await prisma.alert.create({ data: { injuryId: injury.id } });
  const directInjury = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: 'Hombro', intensity: 6 } });
  const directAlert = await prisma.alert.create({ data: { injuryId: directInjury.id } });
  const exercise = await prisma.exercise.create({data:{name:'Ejercicio exclusivo de prueba',component:'Movilidad',zone:'Rodilla',description:'Contenido ficticio exclusivo del entorno temporal', illustration:'/exercises/puente.svg'}});
  await prisma.functionalTest.create({data:{athleteId:athlete.id,testType:'Instrumento de prueba',phase:'INITIAL',result:{registro:'Medición ficticia exclusiva de prueba'}}});
  await prisma.exercise.create({ data: {
    name: 'Movilidad de hombro con nombre extenso para verificar la tarjeta',
    component: 'Movilidad', zone: 'Hombro', dosage: 'Dosificación sintética',
  } });
  const initialPending = await prisma.alert.count({ where: { status: { in: ['NEW', 'IN_REVIEW'] } } });
  const initialFollowUps = await prisma.alert.count({ where: { status: 'FOLLOW_UP_PENDING' } });
  const site = express();
  site.use((req, res, next) => req.path.startsWith('/api/') ? app(req, res, next) : next());
  const dist = process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, '../../frontend/dist/frontend/browser');
  site.use(express.static(dist)); site.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  const server = site.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? '/opt/brave-bin/brave', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    assert.ok((await page.getByRole('link', { name: 'Crear cuenta', exact: true }).evaluate((el: Element) => getComputedStyle(el).textDecorationLine)).includes('underline'));
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
    async function verifyEvaluations() {
      await prisma.athlete.update({ where: { id: athlete.id }, data: { programStartedAt: new Date('2025-03-01') } });
      const mobile = await browser.newContext({ viewport: { width: 414, height: 800 },
        hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
      try {
        const professional = await mobile.newPage();
        async function loginAs(target, email: string, destination: string) {
          await target.goto(base + '/login');
          await target.getByLabel('Correo', { exact: true }).fill(email);
          await target.getByLabel('Contraseña', { exact: true }).fill(password);
          await target.getByRole('button', { name: 'Entrar', exact: true }).tap();
          await target.waitForURL(base + destination);
        }
        await loginAs(professional, user.email, '/equipo');
        await professional.goto(base + `/equipo/deportistas/${athlete.id}?tab=evaluations`);
        await professional.getByRole('button', { name: 'Registrar evaluación' }).tap();
        const form = professional.locator('app-athlete-evaluations form');
        await form.getByLabel('Fecha de evaluación').waitFor();
        for (const width of [320, 414]) {
          await professional.setViewportSize({ width, height: 780 });
          for (const theme of ['light', 'dark']) {
            await professional.evaluate(value => document.documentElement.dataset.theme = value, theme);
            assert.ok(await form.evaluate(element => [...element.querySelectorAll('input, select, textarea')]
              .every(control => parseFloat(getComputedStyle(control).fontSize) >= 16)));
            assert.ok(await professional.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          }
        }
        const initialViewport = await professional.evaluate(() => window.visualViewport?.scale);
        await form.getByLabel('Dirección del alcance').tap();
        assert.equal(await professional.evaluate(() => window.visualViewport?.scale), initialViewport);
        assert.doesNotMatch(await professional.locator('meta[name=viewport]').getAttribute('content'), /user-scalable=no|maximum-scale/);
        await form.getByRole('button', { name: 'Guardar evaluación' }).tap();
        await form.getByRole('alert').filter({ hasText: 'Revisa la fecha' }).waitFor();
        await form.getByLabel('Instrumento').selectOption('YBT');
        await form.getByLabel('Fecha de evaluación').fill('2025-02-28');
        await form.getByLabel('Lado de apoyo').selectOption('LEFT');
        await form.getByLabel('Dirección del alcance').fill('Anterior');
        await form.getByLabel('Alcance (cm)').fill('52.5');
        await form.getByLabel('Observaciones privadas de fisioterapia').fill('Observación sintética reservada');
        const route = base + `/api/team/athletes/${athlete.id}/evaluations`;
        const [created] = await Promise.all([
          professional.waitForResponse(response => response.url() === route && response.request().method() === 'POST'),
          form.getByRole('button', { name: 'Guardar evaluación' }).tap(),
        ]);
        assert.equal(created.status(), 201);
        const { id } = await created.json();
        const saved = professional.locator('.evaluation-result summary').filter({ hasText: 'YBT-LQ' });
        await saved.tap();
        await professional.getByText('52.5 cm', { exact: true }).waitFor();
        await professional.getByRole('button', { name: 'Corregir evaluación' }).tap();
        await form.getByLabel('Alcance (cm)').fill('54');
        const [edited] = await Promise.all([
          professional.waitForResponse(response => response.url() === route + '/' + id && response.request().method() === 'PATCH'),
          form.getByRole('button', { name: 'Guardar evaluación' }).tap(),
        ]);
        assert.equal(edited.status(), 200);
        await saved.tap();
        await professional.getByRole('button', { name: 'Ver historial de cambios' }).tap();
        await professional.getByText('Versión 1', { exact: false }).tap();
        await professional.getByText('52.5 cm', { exact: true }).waitFor();

        const selfContext = await browser.newContext({ viewport: { width: 414, height: 800 },
          hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
        try {
          const own = await selfContext.newPage();
          await loginAs(own, patient.email, '/deportista');
          await own.goto(base + '/deportista/perfil');
          await own.getByRole('link', { name: 'Mis evaluaciones funcionales' }).tap();
          await own.waitForURL(base + '/deportista/evaluaciones');
          await own.locator('.evaluation-result summary').filter({ hasText: 'YBT-LQ' }).tap();
          await own.getByText('54 cm', { exact: true }).waitFor();
          assert.equal(await own.getByText('Observación sintética reservada').count(), 0);
          assert.equal(await own.getByText('Instrumento de prueba').count(), 0);
          assert.equal(await own.getByRole('button', { name: 'Corregir evaluación' }).count(), 0);
        } finally {
          await selfContext.close();
        }
        console.log('Evaluaciones: formulario táctil, permisos propios, correcciones, historial, dos temas y controles móviles verificados.');
      } finally {
        await mobile.close();
      }
    }
    if (process.env.EVALUATIONS_BROWSER_ONLY === '1') {
      await verifyEvaluations();
      return;
    }
    await login(); await badge(initialPending);
    if (process.env.DISCLOSURE_VISUAL === '1') {
      const mobile = await browser.newContext({
        viewport: { width: 414, height: 896 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
      });
      try {
        const access = await mobile.newPage();
        const sizes = [[320, 640], [360, 720], [375, 812], [390, 844], [414, 896],
          [428, 926], [480, 800], [768, 1024], [896, 414], [414, 350]] as const;
        for (const route of ['/login', '/registro', '/olvide-contrasena']) {
          await access.goto(base + route, { waitUntil: 'domcontentloaded' });
          await access.locator('input[type=email]').waitFor();
          for (const [width, height] of sizes) {
            await access.setViewportSize({ width, height });
            for (const theme of ['light', 'dark']) {
              const result = await access.evaluate((themeName: string) => {
                document.documentElement.dataset.theme = themeName;
                const fields = [...document.querySelectorAll('input:not([type=checkbox])')];
                return {
                  sizes: fields.map(field => parseFloat(getComputedStyle(field).fontSize)),
                  overflow: document.documentElement.scrollWidth > innerWidth + 1,
                  viewport: document.querySelector('meta[name=viewport]')!.getAttribute('content'),
                };
              }, theme);
              assert.ok(result.sizes.length && result.sizes.every(size => size >= 16), `${route} ${width}×${height}: ${result.sizes}`);
              assert.equal(result.overflow, false, `${route} ${width}×${height}`);
              assert.ok(!/maximum-scale|user-scalable/i.test(result.viewport ?? ''));
            }
          }
        }
        await access.setViewportSize({ width: 414, height: 896 });
        await access.goto(base + '/login', { waitUntil: 'domcontentloaded' });
        const email = access.getByLabel('Correo', { exact: true });
        const passwordInput = access.getByLabel('Contraseña', { exact: true });
        const scale = await access.evaluate(() => visualViewport!.scale);
        await email.tap();
        await email.fill('prueba@example.test');
        await passwordInput.tap();
        await passwordInput.fill('Clave sintetica 123');
        assert.equal(await passwordInput.evaluate((el: Element) => el === document.activeElement), true);
        await passwordInput.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 8));
        const eye = access.getByRole('button', { name: 'Mostrar contraseña' });
        const hitArea = await eye.boundingBox();
        assert.ok(hitArea && hitArea.height >= 44 && hitArea.width >= 44);
        await eye.tap();
        await access.getByRole('button', { name: 'Ocultar contraseña' }).waitFor();
        assert.equal(await passwordInput.getAttribute('type'), 'text');
        assert.equal(await passwordInput.inputValue(), 'Clave sintetica 123');
        assert.equal(await passwordInput.getAttribute('autocomplete'), 'current-password');
        assert.deepEqual(await passwordInput.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]), [2, 8]);
        assert.equal(await access.evaluate(() => visualViewport!.scale), scale);
        await access.getByRole('button', { name: 'Ocultar contraseña' }).tap();
        await eye.waitFor();
        assert.equal(await passwordInput.getAttribute('type'), 'password');
        await passwordInput.tap();
        await access.setViewportSize({ width: 414, height: 350 });
        assert.equal(await access.evaluate(() => visualViewport!.scale), scale);
        const submit = access.getByRole('button', { name: 'Entrar' });
        await submit.scrollIntoViewIfNeeded();
        const rect = await submit.boundingBox();
        assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 351);
        console.log('Móvil: 60 combinaciones de acceso, tipografía, foco, selección, tamaño táctil y desplazamiento en viewport corto.');
      } finally {
        await mobile.close();
      }
      await page.bringToFront();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const report = page.locator('app-team-report-panel details');
      const animatedHeight = async (panel: any, open: boolean) => {
        await panel.evaluate(async (details: HTMLDetailsElement, opening: boolean) => {
          const trigger = details.querySelector('summary')!;
          await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
          const before = details.offsetHeight;
          trigger.click();
          const immediate = details.offsetHeight;
          const heights: number[] = [];
          const rotations: string[] = [];
          const start = performance.now();
          while (performance.now() - start < 340) {
            await new Promise(done => requestAnimationFrame(done));
            heights.push(details.offsetHeight);
            rotations.push(getComputedStyle(trigger, '::after').transform);
          }
          const after = details.offsetHeight;
          if (!rotations.some(value => value !== 'none' && !/^matrix\((?:1|-1), 0,/.test(value))) {
            throw new Error('El chevron no pasó por un ángulo intermedio');
          }
          const gradual = heights.some(height => Math.min(before, after) < height && height < Math.max(before, after));
          if (details.open !== opening || Math.abs(before - immediate) > 4 || !gradual) {
            throw new Error(JSON.stringify({ before, immediate, heights, after, opening }));
          }
          const rotation = getComputedStyle(trigger, '::after').transform;
          if (opening ? !rotation.startsWith('matrix(-1') : rotation !== 'none') throw new Error('Chevron incorrecto: ' + rotation);
        }, open);
      };
      const checkWidth = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      const view = async (width: number, theme: string) => {
        await page.setViewportSize({ width, height: 880 });
        await page.evaluate((theme: string) => document.documentElement.dataset.theme = theme, theme);
      };
      await view(1440, 'light');
      await animatedHeight(report, true);
      await page.locator('#export-athlete').selectOption(athlete.id);
      const privacy = page.locator('#export-privacy');
      await privacy.selectOption('identified');
      await privacy.focus();
      await privacy.press('ArrowUp');
      await privacy.press('Enter');
      assert.equal(await privacy.inputValue(), 'coded');
      await animatedHeight(report, false);
      await animatedHeight(report, true);
      assert.equal(await privacy.inputValue(), 'coded');
      for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
        await view(width, theme);
        assert.ok(await checkWidth());
        const geometry = await report.locator('select').evaluateAll((controls: HTMLSelectElement[]) =>
          controls.map(control => [control.offsetHeight, control.getBoundingClientRect().top]));
        assert.ok(geometry.every(([height, y]) => height === 44 && (width < 768 || y === geometry[0][1])));
        if (captureDir && width === 1440 && theme === 'light') await report.screenshot({ path: resolve(captureDir, 'excel-escritorio.png'), animations: 'disabled' });
      }
      function luminance(color: string) {
        const channels = color.match(/[0-9.]+/g)!.slice(0, 3).map(Number);
        return channels.reduce((total, channel, index) => {
          const normalized = channel / 255;
          const linear = normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
          return total + linear * [.2126, .7152, .0722][index];
        }, 0);
      }
      const widths = [320, 360, 390, 768, 1024, 1440, 1920];
      for (const width of widths) for (const theme of ['light', 'dark']) {
        await view(width, theme);
        const colors = await report.locator('select').first().evaluate((control: HTMLSelectElement) => {
          const style = getComputedStyle(control);
          return [style.borderTopColor, style.backgroundColor];
        });
        const [low, high] = colors.map(luminance).sort((a, b) => a - b);
        const contrast = (high + .05) / (low + .05);
        assert.ok(contrast >= 3, `Borde de selector ${width} ${theme}: ${contrast}`);
        assert.ok(await checkWidth());
      }
      await view(320, 'dark');
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      assert.ok(await checkWidth(), 'La página de exportación desborda con texto al 200 %');
      assert.ok(await report.locator('select').first().evaluate(node => node.getBoundingClientRect().height >= 88));
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal(await report.locator('select').first().evaluate(node => getComputedStyle(node).appearance), 'auto');
      await page.emulateMedia({ forcedColors: 'none' });
      await report.getByRole('button', { name: 'Descargar Excel' }).focus();
      assert.ok(await page.evaluate(() => {
        const focused = document.activeElement?.getBoundingClientRect();
        const navigation = document.querySelector('.nav')?.getBoundingClientRect();
        return focused && navigation && focused.bottom <= navigation.top;
      }), 'La barra móvil cubre el control enfocado');
      await view(1440, 'light');

      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar Excel' }).click()]);
      const book = new ExcelJS.Workbook();
      await book.xlsx.readFile((await download.path())!);
      assert.match(download.suggestedFilename(), /seudonimizado/);
      assert.equal(book.worksheets.length, 8);

      await prisma.alert.update({ where: { id: alert.id }, data: { status: 'FOLLOW_UP_PENDING' } });
      await page.goto(base + '/equipo/alertas/' + alert.id);
      const optional = page.locator('.review-options');
      const summary = optional.locator('summary');
      await summary.waitFor();
      const stableGeometry = () => page.locator('#rv-observations, #rv-action, #review-report').evaluateAll((nodes: HTMLElement[]) =>
        nodes.map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y + scrollY, r.width, r.height]; }));
      const longText = 'Texto sintético que debe conservarse al cerrar y abrir. '.repeat(32);
      await page.locator('#rv-observations').fill(longText);
      await page.locator('.review-workspace').evaluate((el: Element) => Promise.allSettled(
        el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity)
          .map(animation => animation.finished)));
      for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
        await view(width, theme);
        await summary.focus();
        const before = await stableGeometry();
        await animatedHeight(optional, true);
        await page.locator('#rv-recommendations').fill(longText);
        await summary.focus();
        await animatedHeight(optional, false);
        assert.deepEqual(await stableGeometry(), before);
        await summary.press('Space');
        assert.equal(await summary.evaluate((el: Element) => el === document.activeElement), true);
        assert.equal(await page.locator('#rv-recommendations').inputValue(), longText);
        assert.ok(await checkWidth());
        if (captureDir && width === 390 && theme === 'dark') {
          await optional.screenshot({ path: resolve(captureDir, 'seguimiento-movil.png'), animations: 'disabled', style: '.nav { visibility: hidden }' });
        }
        await summary.press('Enter');
        await optional.evaluate((el: Element) => el.getAnimations({ subtree: true }).forEach(a => a.finish()));
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await summary.press('Enter');
      assert.equal(await optional.evaluate((el: Element) => getComputedStyle(el, '::details-content').transitionDuration), '0s, 0s, 0s');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await prisma.alert.update({ where: { id: alert.id }, data: { status: 'REVIEWED' } });
      await page.goto(base + '/equipo/alertas/' + alert.id);
      const reopen = page.locator('.review-editor details');
      await reopen.waitFor();
      await animatedHeight(reopen, true);
      await page.locator('#reopen-reason').fill('Motivo sintético');
      await animatedHeight(reopen, false);
      await animatedHeight(reopen, true);
      assert.equal(await page.locator('#reopen-reason').inputValue(), 'Motivo sintético');

      await page.goto(base + `/equipo/deportistas/${athlete.id}?tab=reviews`);
      const reviewed = page.locator('.review-status.is-reviewed');
      await reviewed.waitFor();
      assert.equal(await reviewed.evaluate((el: HTMLElement) => el.tagName === 'SPAN' && el.tabIndex === -1), true);
      const row = reviewed.locator('xpath=ancestor::li[1]');
      await row.getByRole('link', { name: 'Consultar revisión' }).waitFor();
      const history = row.getByRole('button', { name: 'Ver historial' });
      await history.focus();
      await history.press('Enter');
      await row.getByText('No hay revisiones documentadas para esta alerta.').waitFor();
      await history.press('Space');
      await row.locator('button[aria-expanded="false"]').waitFor();
      assert.equal(await row.locator('.disclosure-fold').getAttribute('inert'), '');
      if (captureDir) await row.screenshot({ path: resolve(captureDir, 'revision-registrada.png'), animations: 'disabled' });

      await page.locator('#section-program').click();
      const start = page.getByRole('button', { name: 'Registrar inicio' });
      await start.click();
      await page.locator('#program-start').fill('2026-11-01');
      await page.getByRole('button', { name: 'Cerrar edición' }).click();
      await start.click();
      assert.equal(await page.locator('#program-start').inputValue(), '2026-11-01');
      await animatedHeight(page.locator('.session-detail').first(), true);
      await page.locator('#section-evaluations').click();
      const academic = page.locator('details').filter({ has: page.getByText('Pruebas contempladas por el proyecto', { exact: true }) });
      await academic.waitFor();
      await animatedHeight(academic, true);
      await animatedHeight(academic, false);

      const touchscreen = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
      const registration = await touchscreen.newPage();
      await registration.goto(base + '/registro');
      const consent = registration.locator('.consent-box summary');
      await consent.tap();
      await registration.waitForFunction(() => document.querySelector('details.consent-box')?.hasAttribute('open'));
      await consent.tap();
      await registration.waitForFunction(() => !document.querySelector('details.consent-box')?.hasAttribute('open'));
      await registration.getByRole('link', { name: 'Privacidad, uso y accesibilidad' }).tap();
      await registration.getByRole('heading', { name: 'Tratamiento de datos personales' }).waitFor();
      assert.equal(await registration.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      if (captureDir) await registration.locator('main').screenshot({ path: resolve(captureDir, 'informacion-legal-movil.png') });

      await registration.goto(base + '/registro');
      const name = registration.getByLabel('Nombre completo');
      assert.equal(await name.getAttribute('aria-required'), 'true');
      await name.fill('Registro de prueba');
      await registration.getByLabel('Correo', { exact: true }).fill(`consent-browser-${Date.now()}@example.test`);
      await registration.getByLabel('Fecha de nacimiento').fill('2000-01-01');
      await registration.getByLabel('Contraseña', { exact: true }).fill(password);
      await registration.getByRole('checkbox', { name: 'He leído y acepto el aviso de esta versión.' }).check();
      await registration.getByRole('button', { name: 'Crear cuenta', exact: true }).tap();
      await registration.waitForURL(base + '/deportista');
      await registration.route('**/api/auth/logout', route => route.abort('failed'), { times: 1 });
      await registration.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').tap();
      await registration.locator('.swal2-confirm').tap();
      await registration.waitForURL(base + '/login');
      assert.equal(await registration.evaluate(() => sessionStorage.getItem('ls_token')), null);
      const warning = registration.locator('.toast').filter({ hasText: 'No pudimos confirmar el cierre' });
      await warning.waitFor();
      const closeWarning = warning.getByRole('button', { name: 'Cerrar aviso' });
      await closeWarning.focus();
      await registration.emulateMedia({ reducedMotion: 'reduce' });
      for (const width of [320, 360, 390, 768, 1024, 1440]) {
        await registration.setViewportSize({ width, height: 900 });
        for (const theme of ['light', 'dark']) {
          const layout = await registration.evaluate(value => {
            document.documentElement.dataset.theme = value;
            document.documentElement.style.fontSize = '200%';
            const toast = document.querySelector('.toast[data-kind=warning]')!.getBoundingClientRect();
            const focused = document.activeElement!.getBoundingClientRect();
            const form = document.querySelector('main form')!.getBoundingClientRect();
            return {
              overlaps: toast.right > form.left && toast.left < form.right &&
                toast.bottom > form.top && toast.top < form.bottom,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              visibleFocus: focused.top >= 0 && focused.bottom <= innerHeight,
            };
          }, theme);
          assert.deepEqual(layout, { overlaps: false, overflow: false, visibleFocus: true }, `${width}px ${theme}`);
        }
      }
      await registration.keyboard.press('Enter');
      await warning.waitFor({ state: 'hidden' });
      await touchscreen.close();
      assert.deepEqual(errors, []);
      console.log('Desplegables: apertura y cierre con altura intermedia, chevron, teclado y toque, contraste, zoom de texto, siete anchos en ambos temas, borradores, registro y Excel real.');
      return;
    }
    if (process.env.PHASE5_VISUAL === '1') {
      const widths = [320, 390, 768, 1024, 1440];
      const setView = async (width: number, theme: string) => {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate((value: string) => { document.documentElement.dataset.theme = value; }, theme);
        await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      };
      const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      await page.getByText('Exportar reporte a Excel', { exact: true }).click();
      await page.locator('#export-athlete').selectOption(athlete.id);
      await page.locator('#export-status').selectOption('FOLLOW_UP_PENDING');
      for (const width of widths) for (const theme of ['light', 'dark']) {
        await setView(width, theme);
        for (const privacy of ['coded', 'identified']) {
          await page.locator('#export-privacy').selectOption(privacy);
          const positions = await page.locator('app-team-report-panel .report-fields select').evaluateAll((els: Element[]) =>
            els.map(el => { const { y, height } = el.getBoundingClientRect(); return { y, height }; }));
          assert.equal(positions.length, 4);
          assert.ok(positions.every(({ height }) => height === positions[0].height));
          if (width >= 768) assert.ok(positions.every(({ y }) => Math.abs(y - positions[0].y) < 1), JSON.stringify({ width, theme, positions }));
          assert.ok(await noOverflow(), `Excel ${width} ${theme}`);
          assert.equal(await page.locator('#export-athlete-hint').innerText(), `${patient.fullName} · ${patient.email}`);
        }
        await page.locator('#export-privacy').selectOption('coded');
        if (captureDir && [[390, 'dark'], [1440, 'light']].some(([w, t]) => width === w && theme === t)) {
          await page.locator('app-team-report-panel details').screenshot({
            path: resolve(captureDir, `excel-${width}-${theme}.png`), style: '.nav { visibility: hidden }'
          });
        }
      }
      await page.locator('#export-report').selectOption('athletes');
      assert.equal(await page.locator('#export-from').count(), 0);
      assert.equal(await page.locator('#export-status').count(), 0);
      await page.locator('#export-report').selectOption('all');
      await setView(390, 'light');
      const [download] = await Promise.all([
        page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar Excel' }).click()
      ]);
      const book = new ExcelJS.Workbook();
      await book.xlsx.readFile((await download.path())!);
      assert.match(download.suggestedFilename(), /seudonimizado/);
      assert.equal(book.worksheets.length, 8);
      assert.equal(book.getWorksheet('Deportistas')!.rowCount, 2);

      await prisma.alert.update({ where: { id: alert.id }, data: { status: 'FOLLOW_UP_PENDING' } });
      await page.goto(base + '/equipo/alertas/' + alert.id);
      await page.getByRole('heading', { name: 'Registrar seguimiento', exact: true }).waitFor();
      const disclosure = page.locator('.review-options summary');
      const required = '#rv-observations, #rv-action, #review-report';
      const measures = (selector: string) => page.locator(selector).evaluateAll((els: Element[]) => els.map(el => {
        const rect = el.getBoundingClientRect();
        return [rect.x, rect.y + window.scrollY, rect.width, rect.height];
      }));
      for (const width of widths) for (const theme of ['light', 'dark']) {
        await setView(width, theme);
        await page.locator('#rv-observations').fill('');
        const stablePanels = width >= 1380 ? required + ', #review-timeline' : required;
        await disclosure.focus();
        const closed = await measures(stablePanels);
        await page.keyboard.press('Enter');
        assert.equal(await disclosure.evaluate((el: Element) => document.activeElement === el && el.parentElement?.hasAttribute('open')), true);
        assert.deepEqual(await measures(stablePanels), closed, `Seguimiento ${width} ${theme}`);
        const observation = 'Observación sintética del seguimiento. '.repeat(20);
        const recommendation = 'Indicación sintética para probar la distribución. '.repeat(20);
        await page.locator('#rv-observations').fill(observation);
        await page.locator('#rv-recommendations').fill(recommendation);
        assert.ok(await noOverflow(), `Seguimiento ${width} ${theme}`);
        if (captureDir && [[390, 'light'], [1440, 'dark']].some(([w, t]) => width === w && theme === t)) {
          await page.locator('.review-workspace').screenshot({
            path: resolve(captureDir, `seguimiento-${width}-${theme}.png`), style: '.nav { visibility: hidden }'
          });
        }
        await disclosure.focus();
        const filled = await measures(stablePanels);
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#rv-recommendations').isVisible(), false);
        assert.deepEqual(await measures(stablePanels), filled);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#rv-recommendations').inputValue(), recommendation);
        assert.equal(await page.locator('#rv-observations').inputValue(), observation);
        await page.keyboard.press('Enter');
      }
      assert.deepEqual(errors, []);
      console.log('Fase 5 preliminar: ambos temas en 320, 390, 768, 1024 y 1440 px; geometría, teclado, texto largo y descarga XLSX real comprobados.');
      return;
    }

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
    const indicators = await page.locator('.alert-kpis').elementHandle();
    assert.equal(await page.locator('.alert-kpis .kpi').first().locator('strong').innerText(),String(initialPending));
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>document.documentElement.dataset['theme']='dark');
    await page.screenshot({path:'/tmp/luchasegura-alertas-1440-dark.png',fullPage:true});
    await page.locator('#alert-status').selectOption('ALL');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => (window as any).alertEntries), 2, 'Cambiar filtros no repite la entrada de toda la pantalla');
    assert.ok(await page.locator('.alert-kpis').evaluate((el:Element,before:Element)=>el===before,indicators),'Los indicadores no se reemplazan al cambiar de filtro');
    await page.locator('#alert-status').selectOption('PENDING');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => release = resolve);
    await page.route(`**/api/team/alerts/${alert.id}`, async (route: any) => { await gate; await route.continue(); });
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).click();
    await page.locator('.review-skeleton[aria-busy="true"]').waitFor();
    assert.equal(await page.locator('.review-skeleton .card').count(), 4);
    assert.equal(await page.locator('.review-skeleton .sk-textarea').count(), 2);
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
    assert.ok(await page.locator('#rv-action').evaluate((el: Element) => {
      const style = getComputedStyle(el);
      return document.activeElement === el && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2;
    }));
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.getByText('Texto de mecanismo registrado para prueba', { exact: true }).count(), 1);
    await page.locator('#rv-observations').fill('Borrador conservado al iniciar la revisión');
    const beginReview = page.getByRole('button', { name: 'Iniciar revisión', exact: true });
    await beginReview.click();
    await beginReview.waitFor({ state: 'hidden' });
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.locator('#rv-observations').inputValue(), 'Borrador conservado al iniciar la revisión');
    const liveReport = await page.locator('#review-report').elementHandle();
    await page.locator('#rv-action').fill('Actuación documentada por el profesional de prueba');
    const reviewOptions = page.locator('.review-options > summary');
    await reviewOptions.press('Enter');
    await page.locator('.review-options[open]').waitFor();
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
        if(width===1440 && theme==='dark') await page.screenshot({path:'/tmp/luchasegura-revision-1440-dark.png',fullPage:true});
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
    const followUp = page.locator('.follow-up-row').filter({ hasText: patient.fullName });
    assert.equal(await followUp.locator('time').innerText(), '15/01/2027');
    await followUp.getByRole('link', { name: /^Registrar seguimiento/ }).waitFor();
    for (const [width, theme] of [[320, 'light'], [768, 'dark'], [1440, 'light']] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(t => document.documentElement.dataset['theme'] = t, theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.locator('section[aria-labelledby="h-follow"]').screenshot({ path: `/tmp/luchasegura-seguimientos-${width}-${theme}.png` });
    }
    await page.getByRole('link', { name: `${initialFollowUps + 1} seguimientos pendientes`, exact: true }).click();
    await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).waitFor();
    assert.equal(await page.locator('#alert-status').inputValue(), 'FOLLOW_UP_PENDING');
    assert.equal(await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).innerText(), 'Registrar seguimiento');
    await page.locator('.alert-kpis').getByRole('link', { name: /^Por revisar/ }).click();
    await page.locator('#alert-status').waitFor(); await page.waitForTimeout(150);
    assert.equal(await page.locator(`a[href="/equipo/alertas/${alert.id}"]`).count(), 0);
    await page.unroute('**/api/team/overview');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
    await page.locator('.swal2-confirm').click(); await page.waitForURL('**/login');
    await login(); await badge(initialPending - 1);
    await page.getByRole('link', { name: `${initialFollowUps + 1} seguimientos pendientes`, exact: true }).click();
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
    await page.locator('#section-summary').waitFor();
    let recordGeometry = 0;
    for (const tab of ['summary', 'history', 'reviews', 'program', 'evaluations']) {
      await page.locator('#section-' + tab).click();
      await page.waitForURL('**tab=' + tab);
      if (tab === 'reviews') {
        await page.getByRole('button', { name: 'Ver historial', exact: true }).first().waitFor();
        await page.getByRole('button', { name: 'Ver historial', exact: true }).first().click();
        await page.locator('app-review-history').waitFor();
      }
      if (tab === 'program') {
        await page.getByText('Registrar inicio', {exact: true}).click();
        await page.locator('#program-start').fill('2026-11-01');
        const response = page.waitForResponse((r: any) => r.url().endsWith(`/athletes/${athlete.id}/program-start`) && r.request().method() === 'PATCH');
        await page.getByRole('button', {name:'Guardar inicio',exact:true}).click();
        assert.equal((await response).status(),200);
        await page.getByText('Editar fecha',{exact:true}).waitFor();
        assert.equal((await prisma.athlete.findUniqueOrThrow({where:{id:athlete.id}})).programStartedAt?.toISOString().slice(0,10),'2026-11-01');
        await page.getByRole('button', { name: 'Asignar ejercicio', exact: true }).click();
        await page.locator('#a-note').fill('Borrador de asignación conservado entre secciones');
        await page.locator('#a-dos').fill('3 series indicadas');
        await page.locator('#section-summary').click();
        await page.locator('#section-program').click();
        assert.equal(await page.locator('#a-note').inputValue(), 'Borrador de asignación conservado entre secciones');
        await page.locator('#a-find').fill('exclusivo');
        await page.locator('#a-ex').selectOption(exercise.id);
        await page.getByRole('button', { name: 'Ver ficha de ' + exercise.name }).click();
        await page.locator('dialog[open] img').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Asignar',exact:true}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
        await page.getByRole('button',{name:'Ver el ejercicio ' + exercise.name,exact:true}).waitFor();
        assert.equal(await prisma.exerciseAssignment.count({where:{athleteId:athlete.id,exerciseId:exercise.id}}),1);
        await page.getByRole('button',{name:'Ver el ejercicio ' + exercise.name,exact:true}).click();
        await page.locator('dialog[open]').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('dialog[open]').waitFor({state:'hidden'});
      }
      if (tab === 'evaluations') {
        await page.getByRole('heading', {name:'Evaluación inicial',exact:true}).waitFor();
        await page.locator('.evaluation-result summary').filter({ hasText: 'Instrumento de prueba' }).click();
        await page.getByText('Medición ficticia exclusiva de prueba',{exact:false}).waitFor();
      }
      for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 600 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((t: string) => document.documentElement.dataset['theme'] = t, theme);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Ficha ${tab}, ${width}, ${theme}`);
          recordGeometry++;
          if ([320,1440].includes(width) && ['summary','program','evaluations'].includes(tab)) {
            await page.waitForFunction(t =>
              getComputedStyle(document.querySelector('app-athlete-detail h1')!).color ===
                (t === 'dark' ? 'rgb(213, 222, 228)' : 'rgb(13, 27, 36)'), theme);
            await page.screenshot({path:`/tmp/luchasegura-ficha-${tab}-${width}-${theme}.png`,fullPage:true});
          }
        }
      }
    }
    await page.reload();
    await page.locator('#section-evaluations[aria-current="page"]').waitFor();
    await page.locator('#section-history').focus();
    await page.keyboard.press('Enter');
    await page.locator('#section-history[aria-current="page"]').waitFor();
    assert.equal(await page.locator('#section-history').evaluate((el: Element) => getComputedStyle(el).textDecorationLine), 'none');
    console.log(`Ficha integral: cinco secciones, historial persistido, borrador conservado, navegación por teclado y ${recordGeometry} combinaciones de tamaño/tema correctas.`);
    await page.getByRole('link', { name: 'Ver revisiones de la ficha', exact: true }).click();
    const reviewLink = page.locator(`a[href="/equipo/alertas/${alert.id}?from=athlete-reviews"]`);
    await reviewLink.click();
    await page.getByRole('link', { name: 'Volver a revisiones de la ficha' }).click();
    await page.waitForURL('**tab=reviews');
    await reviewLink.click();
    await page.waitForURL(`**/equipo/alertas/${alert.id}?from=athlete-reviews`);
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
    let moduleGeometry=0;
    for (const [path,ready] of [['/equipo','.kpi'],['/equipo/deportistas','#t-q'],['/equipo/alertas','#alert-status'],['/equipo/ejercicios','#x-q'],['/equipo/umbrales','#r-zone']]) {
      await page.locator(`.nav a[href="${path}"]`).click();
      await page.waitForURL(base + path); await page.locator(ready).first().waitFor();
      for (const width of [320,375,390,430,768,1024,1280,1440]) {
        await page.setViewportSize({width,height:600});
        for (const theme of ['light','dark']) {
          await page.evaluate((t:string)=>document.documentElement.dataset['theme']=t,theme);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Módulo ${path}, ${width}, ${theme}`);moduleGeometry++;
        }
      }
    }
    console.log(`Espacio del fisioterapeuta: cinco módulos, ${moduleGeometry} combinaciones de tamaño y tema sin desbordamiento.`);
    await page.locator('.nav a[href="/equipo/ejercicios"]').click();
    await page.locator('#x-category-filter').waitFor();
    assert.deepEqual(await page.locator('#x-category-filter option').allTextContents(), ['Todas', 'Fuerza', 'Core', 'Movilidad']);
    assert.equal(await page.getByRole('button', { name: 'Ver el ejercicio Puente de glúteo', exact: true }).count(), 0);
    await page.locator('#x-category-filter').selectOption('Fuerza');
    await page.locator('#x-zone-filter').selectOption('Cadera');
    await page.locator('#x-level-filter').selectOption('Intermedio');
    await page.locator('#x-q').fill('goblet');
    assert.equal(await page.locator('.exc').count(), 1);
    await page.getByRole('button', { name: 'Ver el ejercicio Sentadilla goblet' }).click();
    const sheet = page.locator('dialog.exercise-sheet[open]');
    await sheet.getByRole('heading', { name: 'Cómo se hace' }).waitFor();
    assert.equal(await sheet.locator('ol li').count(), 3);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => document.documentElement.dataset['theme'] = t, theme);
        const image = sheet.locator('img');
        assert.ok(await image.evaluate(async (el: HTMLImageElement) => {
          await el.decode();
          return el.naturalWidth > 0 && el.getBoundingClientRect().width > 250;
        }));
        assert.ok(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        if (captureDir) await sheet.screenshot({ path: resolve(captureDir, `ficha-ejercicio-${width}-${theme}.png`) });
      }
    }
    await page.keyboard.press('Escape');
    await page.locator('#x-q').fill('sin coincidencias');
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await page.locator('#x-q').fill('soportes de seguridad');
    await page.getByRole('button', { name: 'Ver el ejercicio Press de banca con barra' }).click();
    await sheet.getByText('Banco plano, barra y soportes de seguridad', { exact: true }).waitFor();
    await sheet.locator('img').evaluate((image: HTMLImageElement) => image.decode());
    if (captureDir) await sheet.screenshot({ path: resolve(captureDir, 'ficha-press-banca.png') });
    await page.keyboard.press('Escape');
    await page.locator('#x-q').fill('');
    await page.getByRole('button', { name: 'Nuevo ejercicio' }).click();
    await page.locator('#x-name').fill('Ejercicio visual de prueba');
    await page.locator('#x-instructions').fill('Primer paso.\nSegundo paso.');
    await page.locator('#x-image').setInputFiles({
      name: 'ilustracion-de-prueba.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX4sAAAAASUVORK5CYII=', 'base64'),
    });
    await page.locator('.exercise-preview img').waitFor();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver el ejercicio Ejercicio visual de prueba' }).waitFor();
    await page.getByRole('button', { name: 'Eliminar Ejercicio visual de prueba' }).click();
    await page.locator('.swal2-confirm').click();
    await page.getByRole('button', { name: 'Ver el ejercicio Ejercicio visual de prueba' }).waitFor({ state: 'hidden' });
    const card = page.locator('.exc').filter({ hasText: exercise.name });
    const editExercise = card.getByRole('button', { name: 'Editar ' + exercise.name });
    const deleteExercise = card.getByRole('button', { name: 'Archivar ' + exercise.name });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => document.documentElement.dataset['theme'] = 'light');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.mouse.move(0, 0);
    await page.waitForFunction(el => !el.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'),
      await card.elementHandle());
    const relativeRect = (el: HTMLElement) => ({
      x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight
    });
    const beforeHover = await deleteExercise.evaluate(relativeRect);
    const editBeforeHover = await editExercise.evaluate(relativeRect);
    assert.ok(beforeHover.width >= 44 && beforeHover.height >= 44);
    assert.equal(await deleteExercise.locator('.del-t').evaluate(el => getComputedStyle(el).opacity), '0');
    await deleteExercise.hover();
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.del-t')!).opacity === '1' &&
      !el.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'),
      await deleteExercise.elementHandle());
    const expanded = await deleteExercise.evaluate(relativeRect);
    assert.ok(expanded.width > beforeHover.width);
    assert.equal(expanded.x, beforeHover.x);
    assert.deepEqual(await editExercise.evaluate(relativeRect), editBeforeHover);
    if (captureDir) await card.screenshot({ path: resolve(captureDir, 'fisioterapia-eliminar-hover-320-claro.png') });
    await editExercise.hover();
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.edit-t')!).opacity === '1' &&
      !el.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'),
      await editExercise.elementHandle());
    const expandedEdit = await editExercise.evaluate(relativeRect);
    assert.ok(expandedEdit.width > editBeforeHover.width);
    assert.ok(Math.abs(expandedEdit.x + expandedEdit.width - editBeforeHover.x - editBeforeHover.width) < 1);
    await page.mouse.move(0, 0);
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.edit-t')!).opacity === '0',
      await editExercise.elementHandle());
    await card.screenshot({ path: '/tmp/luchasegura-ejercicio-320-light.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card.locator('.exc-main').focus();
    await page.keyboard.press('Tab');
    assert.ok(await editExercise.evaluate(el => el.matches(':focus-visible')));
    assert.equal(await editExercise.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'x-form-t');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.waitForFunction(name => document.activeElement?.getAttribute('aria-label') === name, 'Editar ' + exercise.name);
    await deleteExercise.click();
    await page.locator('.swal2-cancel').click();
    await card.waitFor();
    await card.getByRole('button', { name: 'Ver el ejercicio ' + exercise.name }).click();
    await page.locator('dialog[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.locator('#x-q').fill('sin coincidencias');
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await card.waitFor();
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.evaluate(() => document.documentElement.dataset['theme'] = 'dark');
    await card.screenshot({ path: '/tmp/luchasegura-ejercicio-1440-dark.png' });
    const updatedName = 'Ejercicio actualizado en prueba de navegador';
    await editExercise.click();
    await page.locator('#x-name').fill(updatedName);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Archivar ' + updatedName }).click();
    const [archived] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/exercises/${exercise.id}`) && response.request().method() === 'DELETE'),
      page.locator('.swal2-confirm').click()
    ]);
    assert.equal(archived.status(), 200);
    await page.locator('.exc').filter({ hasText: updatedName }).waitFor({ state: 'hidden' });
    const savedExercise = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    assert.equal(savedExercise.name, updatedName);
    assert.equal(savedExercise.archived, true);
    assert.equal(await prisma.exerciseAssignment.count({ where: { exerciseId: exercise.id } }), 1);
    console.log('Biblioteca: geometría estable en hover, foco por teclado, consulta, filtros, edición y archivo con asignación conservada.');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
    await page.locator('.swal2-confirm').click();
    await page.waitForURL(base + '/login');

    const widths = [320, 360, 375, 390, 414, 428, 480, 768, 1024, 1280, 1440, 1920];
    async function checkWorkspace(path: string, file: string, widthForCapture: number, themeForCapture: string) {
      await page.goto(base + path);
      await page.locator('main h1').waitFor();
      await page.locator('main .sk').first().waitFor({ state: 'hidden' });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate(t => document.documentElement.dataset['theme'] = t, theme);
          const overflow = await page.evaluate(() => {
            if (document.documentElement.scrollWidth <= innerWidth + 1) return [];
            return [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 8).map(el => el.tagName + '.' + el.getAttribute('class')).concat('documento desbordado');
          });
          assert.deepEqual(overflow, [], `${path}, ${width}px, ${theme}`);
          if (width < 900) {
            const smallFields = await page.locator('main :is(input:not([type=checkbox], [type=radio], [type=hidden], [type=range]), textarea, select)').evaluateAll((fields: Element[]) =>
              fields.filter(field => field.getClientRects().length && parseFloat(getComputedStyle(field).fontSize) < 16)
                .map(field => (field as HTMLElement).id || field.tagName));
            assert.deepEqual(smallFields, [], `Tipografía de campos · ${path}, ${width}px, ${theme}`);
          }
          if (captureDir && width === widthForCapture && theme === themeForCapture) {
            await page.waitForFunction(t => getComputedStyle(document.querySelector('main h1')!).color ===
              (t === 'dark' ? 'rgb(213, 222, 228)' : 'rgb(13, 27, 36)'), theme);
            await page.screenshot({ path: resolve(captureDir, file), fullPage: true });
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      console.log(`UX responsive: ${path}, ${widths.length * 2} combinaciones verificadas.`);
    }

    const roles = [
      { account: admin, home: '/admin', path: '/admin/asignaciones', blocked: '/equipo', menu: ['/admin', '/admin/asignaciones'] },
      { account: user, home: '/equipo', path: '/equipo/umbrales', blocked: '/admin',
        menu: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios', '/equipo/umbrales'] },
      { account: coach, home: '/equipo', path: '/equipo/deportistas', blocked: `/equipo/alertas/${alert.id}`,
        menu: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios'] },
      { account: patient, home: '/deportista', path: '/deportista/plan', blocked: '/admin',
        menu: ['/deportista', '/deportista/reportar', '/deportista/plan', '/deportista/progreso', '/deportista/bienestar', '/deportista/perfil'] }
    ];
    for (const role of roles) {
      await page.getByLabel('Correo', { exact: true }).fill(role.account.email);
      await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByText('Correo o contraseña incorrectos', { exact: true }).waitFor();
      await page.getByLabel('Contraseña', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL(base + role.home);
      await page.locator('.nav a').first().waitFor();
      await page.getByRole('link', { name: 'Saltar al contenido' }).press('Enter');
      await page.waitForFunction(() => document.activeElement?.id === 'contenido');
      assert.deepEqual(await page.locator('.nav a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), role.menu);
      await page.locator(`.nav a[href="${role.path}"]`).click();
      await page.waitForURL(base + role.path);
      await page.reload();
      await page.locator('.nav').waitFor();
      assert.equal(page.url(), base + role.path);

      if (role.account.role === 'ATHLETE') {
        const session = page.getByRole('button', { name: /Marcar como completada la sesión/ }).first();
        await session.waitFor();
        await page.getByRole('button', { name: 'Ver cómo se hace ' + updatedName }).waitFor();
        const toggle = '**/api/program/sessions/*/toggle';
        await page.route(toggle, route => route.abort('failed'));
        await session.click();
        await page.getByText('No se pudo conectar con el servidor. Revisa tu conexión.', { exact: true }).waitFor();
        assert.equal(await page.getByText('Sesión completada', { exact: true }).count(), 0);
        await page.unroute(toggle);
        await session.click();
        await page.getByText('Sesión completada', { exact: true }).waitFor();
        await page.reload();
        await page.getByRole('button', { name: /Desmarcar la sesión/ }).first().waitFor();
      }

      if (role.account.role === 'ADMIN') {
        await checkWorkspace('/admin', 'administrador-usuarios-768-oscuro.png', 768, 'dark');
        await checkWorkspace('/admin/asignaciones', 'administrador-asignaciones-390-claro.png', 390, 'light');
      } else if (role.account.role === 'ATHLETE') {
        await checkWorkspace('/deportista', 'deportista-inicio-1440-claro.png', 1440, 'light');
        await checkWorkspace('/deportista/plan', 'deportista-plan-390-oscuro.png', 390, 'dark');
        await page.getByRole('button', { name: 'Ir a ejercicios individuales' }).click();
        await page.waitForFunction(() => document.activeElement?.id === 'p-individual');
        const individual = page.getByRole('button', { name: 'Ver cómo se hace ' + updatedName });
        await individual.getByText('3 series indicadas', { exact: true }).waitFor();
        assert.equal(await individual.getByText(/Orientativa/).count(), 0);
        await individual.click();
        await page.locator('dialog[open]').getByText('Borrador de asignación conservado entre secciones').waitFor();
        await page.locator('dialog[open] img').evaluate((image: HTMLImageElement) => image.decode());
        if (captureDir) await page.locator('dialog[open]').screenshot({ path: resolve(captureDir, 'deportista-asignacion.png') });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Ver cómo se hace Puente de glúteo' }).click();
        await page.locator('dialog[open] img').evaluate((image: HTMLImageElement) => image.decode());
        await page.keyboard.press('Escape');
        const programExercise = page.getByRole('button', { name: 'Ver cómo se hace Plancha frontal' });
        await programExercise.getByText(/Orientativa/).waitFor();
        await programExercise.click();
        await page.locator('dialog[open]').getByText(/Semana 1 · Sesión 1/).waitFor();
        await page.keyboard.press('Escape');
        await checkWorkspace('/deportista/perfil', 'deportista-perfil-768-claro.png', 768, 'light');
        await checkWorkspace('/deportista/reportar', 'deportista-reportar-390-claro.png', 390, 'light');
        await checkWorkspace('/deportista/progreso', 'deportista-progreso-1280-oscuro.png', 1280, 'dark');
        const scalePage = base + '/deportista/reportar';
        await page.goto(scalePage);
        await page.setViewportSize({ width: 320, height: 800 });
        const radio = page.getByRole('radio', { name: '0', exact: true });
        const bounds = await radio.boundingBox();
        // El área clicable está dentro del borde de su etiqueta de 44px.
        assert.ok(bounds && bounds.width >= 42 && bounds.height >= 42);

        await radio.focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('radio', { name: '1', exact: true }).isChecked(), true);
      } else if (role.account.role === 'COACH') {
        await checkWorkspace('/equipo', 'entrenador-resumen-1440-oscuro.png', 1440, 'dark');
        assert.equal(await page.getByText('Exportar reporte a Excel', { exact: true }).count(), 0);
        await checkWorkspace(`/equipo/deportistas/${athlete.id}?tab=program`, 'entrenador-programa-768-claro.png', 768, 'light');
        assert.equal(await page.getByRole('button', { name: 'Registrar inicio', exact: true }).count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Evaluaciones', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Ejercicios individuales', exact: true }).click();
        assert.ok(page.url().endsWith('?tab=program'));
        await page.waitForFunction(() => document.activeElement?.id === 'individual-exercises');

      }
      await page.goto(base + role.blocked);
      await page.waitForURL(base + role.home);
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
      await page.locator('.swal2-confirm').click();
      await page.waitForURL(base + '/login');
      await page.goto(base + role.path);
      await page.waitForURL(base + '/login');

      const expired = jwt.sign({ sub: role.account.id, role: role.account.role }, config.jwtSecret, { expiresIn: -1 });
      assert.equal((await page.request.get(base + '/api/auth/me', {
        headers: { Authorization: 'Bearer ' + expired }
      })).status(), 401);
      await page.evaluate(({ expired, account }) => {
        sessionStorage.setItem('ls_token', expired);
        sessionStorage.setItem('ls_user', JSON.stringify(account));
        sessionStorage.setItem('ls_last', String(Date.now()));
      }, { expired, account: { id: role.account.id, fullName: role.account.fullName, role: role.account.role } });
      await page.goto(base + role.path);
      await page.waitForURL(base + '/login');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('ls_token')), null);
    }
    async function signIn(email: string, secret: string, path: string) {
      await page.getByLabel('Correo', { exact: true }).fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(secret);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL(base + path);
    }
    async function signOut() {
      const token = await page.evaluate(() => sessionStorage.getItem('ls_token'));
      assert.ok(token);
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
      const [logout] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/api/auth/logout')),
        page.locator('.swal2-confirm').click(),
      ]);
      assert.equal(logout.status(), 204);
      await page.waitForURL(base + '/login');
      const oldSession = await page.request.get(base + '/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      assert.equal(oldSession.status(), 401);
    }

    await signIn(admin.email, password, '/admin');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const staffEmail = 'personal-creado-browser@example.test';
    await page.getByLabel('Nombre completo', { exact: true }).fill('Personal creado desde formulario');
    await page.getByLabel('Correo', { exact: true }).fill(staffEmail);
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    const temporaryPassword = await page.locator('code.secret').innerText();
    await page.getByRole('button', { name: 'Listo', exact: true }).click();
    await page.locator('#u-q').fill(staffEmail);
    await page.getByRole('button', { name: 'Editar a Personal creado desde formulario' }).click();
    await page.getByLabel('Nombre completo', { exact: true }).fill('Profesional actualizado desde formulario');
    await page.getByRole('button', { name: 'Fisioterapeuta', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByRole('button', { name: 'Editar a Profesional actualizado desde formulario' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Editar a Profesional actualizado desde formulario' }).waitFor();
    const savedStaff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    assert.equal(savedStaff.role, 'PHYSIO');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const disable = page.getByRole('button', { name: 'Desactivar a Profesional actualizado desde formulario' });
    await disable.hover();
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.expand-label')!).opacity === '1', await disable.elementHandle());
    assert.equal(await disable.evaluate(el => getComputedStyle(el).getPropertyValue('--action-ink').trim()),
      await disable.evaluate(el => getComputedStyle(el).getPropertyValue('--warn-fg').trim()));
    await disable.click();
    await page.locator('.swal2-confirm').click();
    const enable = page.getByRole('button', { name: 'Activar a Profesional actualizado desde formulario' });
    await enable.hover();
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.expand-label')!).opacity === '1', await enable.elementHandle());
    assert.equal(await enable.evaluate(el => getComputedStyle(el).getPropertyValue('--action-ink').trim()),
      await enable.evaluate(el => getComputedStyle(el).getPropertyValue('--ok-fg').trim()));
    await enable.click();
    await disable.waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.setViewportSize({ width: 320, height: 800 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('.nav a[href="/admin/asignaciones"]').click();
    const coachSelect = page.getByLabel('Entrenador de ' + patient.fullName);
    await coachSelect.selectOption('');
    await page.getByText('Asignación guardada', { exact: true }).first().waitFor();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/admin/athletes/${athlete.id}/coach`) && response.ok()),
      coachSelect.selectOption(coach.id)
    ]);
    assert.equal((await prisma.athlete.findUniqueOrThrow({ where: { id: athlete.id } })).coachId, coach.id);
    await page.setViewportSize({ width: 1440, height: 800 });
    await signOut();

    await signIn(staffEmail, temporaryPassword, '/cambiar-contrasena');
    const newPassword = 'Browser-personal-2026';
    await page.getByLabel('Contraseña actual', { exact: true }).fill(temporaryPassword);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill(newPassword);
    await page.getByLabel('Repite la contraseña nueva', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL(base + '/equipo');
    await page.locator('.nav a[href="/equipo/umbrales"]').click();
    await page.locator('#r-zone').selectOption('Rodilla');
    await page.locator('#r-min').selectOption('6');
    await page.getByRole('button', { name: 'Guardar umbral' }).click();
    await page.locator('#r-list').locator('..').getByText('Rodilla', { exact: true }).waitFor();
    await signOut();

    await signIn(patient.email, password, '/deportista');
    await page.locator('.nav a[href="/deportista/perfil"]').click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.locator('#p-weight').fill('71.5');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('71.5 kg', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.locator('#h-zone').selectOption('Hombro');
    await page.locator('#h-type').fill('Antecedente desde formulario');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('button', { name: 'Editar antecedente de Hombro' }).click();
    await page.locator('#h-days').fill('2');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText(/2 días sin entrenar/).waitFor();
    await page.reload();
    await page.getByText(/2 días sin entrenar/).waitFor();

    await page.locator('.nav a[href="/deportista/reportar"]').click();
    await page.getByRole('button', { name: 'Rodilla', exact: true }).click();
    await page.getByRole('radio', { name: '7', exact: true }).click();
    const symptom = 'Reporte sintético <b>texto literal</b>';
    await page.locator('#r-notes').fill(symptom);
    const reportRequest = '**/api/injuries';
    await page.route(reportRequest, async route => {
      await route.fetch();
      await route.abort('failed');
    }, { times: 1 });
    await page.getByRole('button', { name: 'Enviar reporte' }).click();
    await page.getByText('No se pudo conectar con el servidor. Revisa tu conexión.', { exact: true }).waitFor();
    assert.equal(await page.locator('#r-notes').inputValue(), symptom);
    await page.getByRole('button', { name: 'Enviar reporte' }).click();
    await page.getByText('Molestia reportada', { exact: true }).waitFor();
    const reported = await prisma.injury.findMany({ where: { athleteId: athlete.id, notes: symptom }, include: { alerts: true } });
    assert.equal(reported.length, 1);
    assert.equal(reported[0].alerts.length, 1);
    const generatedAlert = reported[0].alerts[0];
    await signOut();

    await signIn(staffEmail, newPassword, '/equipo');
    await page.locator('.nav a[href="/equipo/alertas"]').click();
    await page.locator(`a[href="/equipo/alertas/${generatedAlert.id}"]`).click();
    await page.getByText(symptom, { exact: false }).waitFor();
    assert.equal(await page.locator('.review-context b').filter({ hasText: 'texto literal' }).count(), 0);
    await page.locator('#rv-observations').fill('Observación sintética desde el formulario profesional');
    await page.locator('#rv-action').fill('Actuación sintética desde el formulario profesional');
    await page.getByLabel('Necesita seguimiento', { exact: true }).check();
    await page.locator('.review-options > summary').click();
    await page.locator('#rv-date').fill('2026-01-01');
    await page.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
    await page.locator('header .badge').filter({ hasText: 'Seguimiento pendiente' }).waitFor();
    const entry = await prisma.alertEntry.findFirstOrThrow({ where: { alertId: generatedAlert.id, kind: 'REVIEW' } });
    assert.equal(entry.authorId, savedStaff.id);
    assert.equal(entry.followUpRequired, true);
    assert.equal(entry.followUpDate?.toISOString().slice(0, 10), '2026-01-01');
    await page.locator('.nav a[href="/equipo"]').click();
    const overdue = page.locator('.follow-up-row').filter({ hasText: '01/01/2026' });
    await overdue.getByText('Vencido', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByText('Exportar reporte a Excel', { exact: true }).click();
    await page.locator('#export-report').selectOption('alerts');
    await page.locator('#export-athlete').selectOption(athlete.id);
    await page.locator('#export-status').selectOption('FOLLOW_UP_PENDING');
    await page.locator('#export-from').fill('2026-02-01');
    await page.locator('#export-to').fill('2026-01-01');
    assert.equal(await page.getByRole('button', { name: 'Descargar Excel' }).isEnabled(), false);
    await page.locator('#export-from').fill('');
    await page.locator('#export-to').fill('');

    const exportPattern = '**/api/team/export?**';
    let served: Buffer | undefined;
    await page.route(exportPattern, async route => {
      const response = await route.fetch();
      served = await response.body();
      assert.equal(response.status(), 200);
      await route.fulfill({ response, body: served });
    }, { times: 1 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar Excel' }).click()
    ]);
    assert.match(download.suggestedFilename(), /luchasegura_alerts_seudonimizado_.*\.xlsx/);
    const downloaded = await readFile((await download.path())!);
    assert.deepEqual(downloaded, served);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(downloaded as unknown as ExcelJS.Buffer);
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Resumen', 'Alertas y seguimientos', 'Historial profesional']);
    const rows = workbook.getWorksheet('Alertas y seguimientos')!;
    assert.equal(rows.rowCount - 1, await prisma.alert.count({ where: { status: 'FOLLOW_UP_PENDING', injury: { athleteId: athlete.id } } }));
    assert.ok(rows.getRows(2, rows.rowCount - 1)?.every(row => String(row.getCell(1).value).startsWith('D-')));
    await page.getByText('Excel generado. Revisa las descargas del navegador.', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(context.pages().length, 1);
    await page.route(exportPattern, route => route.abort('failed'), { times: 1 });
    await page.getByRole('button', { name: 'Descargar Excel' }).click();
    await page.getByText('No se pudo conectar con el servidor. Revisa tu conexión.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Excel generado. Revisa las descargas del navegador.', { exact: true }).count(), 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Excel: descarga real filtrada a 390 px, contenido cotejado byte a byte y fallo de red verificado.');

    const overviewPattern = '**/api/team/overview';
    const staffToken = await page.evaluate(() => sessionStorage.getItem('ls_token'));
    assert.ok(staffToken);
    const overviewResponse = await page.request.get(base + '/api/team/overview', {
      headers: { Authorization: 'Bearer ' + staffToken },
    });
    assert.equal(overviewResponse.status(), 200, 'La agenda requiere datos confirmados de fisioterapia');
    const overview = await overviewResponse.json();
    const example = overview.followUps.find((row: { id: string }) => row.id === generatedAlert.id);
    assert.ok(example, 'El seguimiento recién registrado debe estar en la agenda real');
    for (const size of [0, 1, 8]) {
      const followUps = Array.from({ length: size }, (_, i) => ({
        ...example, id: `preview-${i}`, followUpDate: i % 3 === 0 ? example.followUpDate : i % 3 === 1 ? '2030-01-01' : null,
      }));
      await page.route(overviewPattern, route => route.fulfill({
        json: { ...overview, followUps, stats: { ...overview.stats, followUpAlerts: size } },
      }));
      await page.reload();
      const agenda = page.locator('section[aria-labelledby="h-follow"]');
      if (size === 0) {
        await agenda.getByText('Sin seguimientos pendientes', { exact: true }).waitFor();
      } else if (size === 1) {
        await agenda.locator('.follow-up-row').waitFor();
        assert.equal(await agenda.locator('.follow-up-row').count(), 1);
      } else {
        await agenda.getByText('Con fecha próxima', { exact: false }).waitFor();
        assert.equal(await agenda.locator('.follow-up-row').count(), 6);
        await agenda.getByText('Pendiente sin fecha').first().waitFor();
        await agenda.getByText(/Se muestran hasta dos por grupo/).waitFor();
        if (captureDir) {
          await page.setViewportSize({ width: 768, height: 850 });
          await page.evaluate(() => document.documentElement.dataset['theme'] = 'light');
          await page.waitForFunction(() => getComputedStyle(document.querySelector('main h1')!).color === 'rgb(13, 27, 36)');
          await agenda.screenshot({ path: resolve(captureDir, 'fisioterapia-seguimientos-768-claro.png'), style: '.nav { visibility: hidden }' });
          await page.setViewportSize({ width: 1440, height: 900 });
        }
      }
      await page.unroute(overviewPattern);
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const start = document.startViewTransition.bind(document);
      (window as any).themeRevealStarted = false;
      document.startViewTransition = (...args: any[]) => {
        if (document.documentElement.classList.contains('theme-transition')) (window as any).themeRevealStarted = true;
        return start(args[0]);
      };
      document.documentElement.dataset['theme'] = 'light';
    });
    await page.locator('.theme-btn:visible').click();
    await page.waitForFunction(() => (window as any).themeRevealStarted && !document.documentElement.classList.contains('theme-transition'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { (window as any).themeRevealStarted = false; });
    const beforeTheme = await page.locator('html').getAttribute('data-theme');
    await page.locator('.theme-btn:visible').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), beforeTheme);
    assert.equal(await page.evaluate(() => (window as any).themeRevealStarted), false);

    await page.goto(base + `/equipo/deportistas/${athlete.id}?tab=program`);
    await page.getByRole('button', { name: 'Quitar ' + updatedName }).click();
    const [unassigned] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/exercises/assignments/') && response.request().method() === 'DELETE'),
      page.locator('.swal2-confirm').click()
    ]);
    assert.equal(unassigned.status(), 200);
    await page.getByRole('button', { name: 'Quitar ' + updatedName }).waitFor({ state: 'hidden' });
    assert.equal(await prisma.exerciseAssignment.count({ where: { exerciseId: exercise.id } }), 0);
    await signOut();
    console.log('Fase 2: creación, edición y acceso de personal; perfil, antecedentes, reintento de molestia, revisión y retiro desde formularios reales.');

    await login();
    await page.reload();
    await page.locator('.nav').waitFor();
    await page.evaluate(() => {
      sessionStorage.setItem('ls_last', String(Date.now() - 31 * 60_000));
      window.dispatchEvent(new PointerEvent('pointerdown'));
    });
    await page.waitForURL(base + '/login');
    await page.getByText('Tu sesión se cerró por inactividad. Inicia sesión de nuevo.', { exact: true }).waitFor();
    console.log('Cuatro roles: credenciales, menús, permisos, recarga, cierre de sesión y expiración verificados.');
    const touch = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
    try {
      const mobile = await touch.newPage();
      await mobile.goto(base + '/login');
      await mobile.getByLabel('Correo', { exact: true }).fill(user.email);
      await mobile.getByLabel('Contraseña', { exact: true }).fill(password);
      await mobile.getByRole('button', { name: 'Entrar', exact: true }).tap();
      await mobile.waitForURL(base + '/equipo');
      await mobile.goto(base + '/equipo/ejercicios');
      const edit = mobile.locator('.exc-footer .edit').first();
      if (await edit.count() === 0) await mobile.locator('.exc-footer .edit').first().waitFor();
      assert.equal(await edit.locator('.expand-label').evaluate(el => getComputedStyle(el).opacity), '1');
      assert.ok((await edit.boundingBox())!.height >= 44);
      if (captureDir) await mobile.locator('.exc').first().screenshot({ path: resolve(captureDir, 'fisioterapia-ejercicio-390-tactil.png') });
      await edit.tap();
      await mobile.getByRole('heading', { name: 'Editar ejercicio', exact: true }).waitFor();
    } finally {
      await touch.close();
    }
    console.log('UX: matriz responsive de perfiles, teclado, interacción táctil, movimiento reducido y agenda vacía/con 1/con 8 registros.');
    assert.deepEqual(errors, []);
    await verifyEvaluations();
    console.log(`Navegador + API + PostgreSQL: revisión, seguimiento, reapertura, historial, dashboard, errores de red e idempotencia correctos. ${geometry} comprobaciones de tamaño/tema correctas.`);
    await context.close();
  } finally {
    await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
