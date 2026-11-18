// Prueba opcional sobre API y PostgreSQL temporales reales. Playwright se carga externamente.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/db';
const externalRequire = createRequire(__filename);
const { chromium } = externalRequire(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');
if (process.env.ALERT_REVIEW_TESTS !== '1' || !process.env.DATABASE_URL?.includes('/luchasegura_alert_test')) throw new Error('Solo se permite la base temporal de pruebas');

async function main() {
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
  const exercise = await prisma.exercise.create({data:{name:'Ejercicio exclusivo de prueba',component:'Movilidad',zone:'Rodilla',description:'Contenido ficticio exclusivo del entorno temporal'}});
  await prisma.functionalTest.create({data:{athleteId:athlete.id,testType:'Instrumento de prueba',phase:'INITIAL',result:{registro:'Medición ficticia exclusiva de prueba'}}});
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
    assert.ok(await page.locator('#rv-action').evaluate((el: Element) => document.activeElement === el && getComputedStyle(el).boxShadow !== 'none'));
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.getByText('Texto de mecanismo registrado para prueba', { exact: true }).count(), 1);
    await page.locator('#rv-observations').fill('Borrador conservado al iniciar la revisión');
    await page.getByRole('button', { name: 'Iniciar revisión', exact: true }).click();
    await page.waitForSelector('#rv-observations');
    assert.equal(await page.locator('#rv-observations').inputValue(), 'Borrador conservado al iniciar la revisión');
    const liveReport = await page.locator('#review-report').elementHandle();
    await page.locator('#rv-action').fill('Actuación documentada por el profesional de prueba');
    await page.locator('.review-options > summary').click();
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
    await page.getByRole('link', { name: 'Por revisar', exact: true }).click();
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
        await page.locator('#section-summary').click();
        await page.locator('#section-program').click();
        assert.equal(await page.locator('#a-note').inputValue(), 'Borrador de asignación conservado entre secciones');
        await page.locator('#a-ex').selectOption(exercise.id);
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
    const card = page.locator('.exc').filter({ hasText: exercise.name });
    const editExercise = card.getByRole('button', { name: 'Editar ' + exercise.name });
    const deleteExercise = card.getByRole('button', { name: 'Eliminar ' + exercise.name });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => document.documentElement.dataset['theme'] = 'light');
    const relativeRect = (el: Element) => {
      const button = el.getBoundingClientRect();
      const cardRect = el.closest('.exc')!.getBoundingClientRect();
      return { x: button.x - cardRect.x, y: button.y - cardRect.y, width: button.width, height: button.height };
    };
    const beforeHover = await deleteExercise.evaluate(relativeRect);
    const editBeforeHover = await editExercise.evaluate(relativeRect);
    assert.ok(beforeHover && beforeHover.width >= 44 && beforeHover.height >= 44);
    assert.equal(await deleteExercise.locator('.del-t').evaluate(el => getComputedStyle(el).opacity), '0');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await deleteExercise.hover();
    await page.waitForFunction(el => getComputedStyle(el.querySelector('.del-t')!).opacity === '1',
      await deleteExercise.elementHandle());
    const expanded = await deleteExercise.evaluate(relativeRect);
    assert.ok(expanded && expanded.width > beforeHover.width);
    assert.ok(Math.abs(expanded.x + expanded.width - beforeHover.x - beforeHover.width) < 1);
    assert.deepEqual(await editExercise.evaluate(relativeRect), editBeforeHover);
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
    await page.getByRole('button', { name: 'Eliminar ' + updatedName }).click();
    await page.locator('.swal2-confirm').click();
    await page.getByRole('button', { name: 'Eliminar ' + updatedName }).waitFor({ state: 'hidden' });
    const savedExercise = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    assert.equal(savedExercise.name, updatedName);
    assert.equal(savedExercise.archived, true);
    assert.equal(await prisma.exerciseAssignment.count({ where: { exerciseId: exercise.id } }), 1);
    console.log('Biblioteca: geometría estable en hover, foco por teclado, consulta, filtros, edición y archivo con asignación conservada.');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).locator('visible=true').click();
    await page.locator('.swal2-confirm').click();
    await page.waitForURL(base + '/login');

    const roles = [
      { account: admin, home: '/admin', path: '/admin/asignaciones', blocked: '/equipo', menu: ['/admin', '/admin/asignaciones'] },
      { account: user, home: '/equipo', path: '/equipo/umbrales', blocked: '/admin',
        menu: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios', '/equipo/umbrales'] },
      { account: coach, home: '/equipo', path: '/equipo/deportistas', blocked: `/equipo/alertas/${alert.id}`,
        menu: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios'] },
      { account: patient, home: '/deportista', path: '/deportista/plan', blocked: '/admin',
        menu: ['/deportista', '/deportista/reportar', '/deportista/plan', '/deportista/progreso', '/deportista/perfil'] }
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
    assert.deepEqual(errors, []);
    console.log(`Navegador + API + PostgreSQL: revisión, seguimiento, reapertura, historial, dashboard, errores de red e idempotencia correctos. ${geometry} comprobaciones de tamaño/tema correctas.`);
    await context.close();
  } finally {
    await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
