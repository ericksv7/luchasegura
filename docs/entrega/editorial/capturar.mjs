import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { openBrowser } from './imprimir.mjs';

if (!/^postgresql:\/\/ls_docs@127\.0\.0\.1:\d+\/ls_docs$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Se requiere la base sintética de capturas');
}
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const express = require('express');
const { app } = require('./dist/src/app.js');
const { prisma } = require('./dist/src/db.js');
const dist = resolve('../frontend/dist/frontend/browser');
const site = express();
site.use('/api', (req, res, next) => {
  req.url = req.originalUrl;
  return app(req, res, next);
});
site.use(express.static(dist));
site.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
const server = site.listen(Number(process.env.PORT), '127.0.0.1');
let browser;
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const athlete = await prisma.athlete.findFirstOrThrow({ where: { user: { email: 'deportista@demo.local' }} });
  const program = await prisma.program.findFirstOrThrow();
  await prisma.programSession.createMany({ data: Array.from({ length: 24 }, (_, index) => ({
    programId: program.id, week: 1 + Math.floor(index / 3), number: 1 + index % 3
  })) });
  await prisma.athlete.update({ where: { id: athlete.id }, data: { programStartedAt: new Date(new Date().toISOString().slice(0, 10)) } });
  const exercise = await prisma.exercise.create({ data: { name: 'Ejercicio de demostración', component: 'Movilidad', dosage: 'Ejemplo sintético' } });
  const session = await prisma.programSession.findFirstOrThrow({ where: { programId: program.id, week: 1, number: 1 } });
  await prisma.sessionExercise.create({ data: { exerciseId: exercise.id, sessionId: session.id, position: 1 } });
  await prisma.functionalTest.create({ data: { athleteId: athlete.id, phase: 'INITIAL', testType: 'Medición sintética', result: { observacion: 'Ejemplo de consulta' } } });
  const injury = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: 'Rodilla', intensity: 7, whenOccurs: 'Entrenando', limitation: 'PARTIAL', notes: 'Molestia ficticia para documentación' } });
  await prisma.injury.create({data: {athleteId: athlete.id, bodyZone: 'Hombro', isHistory: true, injuryType: 'Antecedente ficticio'}});
  const alert = await prisma.alert.create({ data: { injuryId: injury.id } });
  const resetToken = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({data: {
    userId: athlete.userId, tokenHash: createHash('sha256').update(resetToken).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 60_000)
  }});
  browser = await openBrowser();
  const { send } = browser;
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1200, height: 860, deviceScaleFactor: 1.5, mobile: false});
  await send('Emulation.setEmulatedMedia', {features: [{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function go(route, exact = true) {
    await send('Page.navigate', {url: base + route});
    for (let attempt = 0; attempt < 55; attempt++) {
      await pause(120);
      try {
        const ready = await evaluate(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.readyState === 'complete' && document.querySelector('app-root')?.innerText.trim().length > 60`);
        if (ready || !exact && attempt > 10) { await pause(250); return; }
      } catch (error) { if (attempt === 54) throw error; }
    }
    throw new Error('Vista sin cargar: ' + route);
  }
  async function capture(name, selector) {
    await evaluate('document.fonts.ready.then(() => true)');
    const params = {format:'png'};
    if (selector) {
      params.captureBeyondViewport = true;
      params.clip = await evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) throw new Error('No se encontró la región solicitada');
        const {left, top, width, height} = element.getBoundingClientRect();
        return {x: left + scrollX, y: top + scrollY, width, height, scale: 1};
      })()`);
    }
    const {data} = await send('Page.captureScreenshot', params);
    await writeFile(new URL('../capturas/' + name + '.png',import.meta.url),Buffer.from(data,'base64'));
    console.log(name);
  }
  async function login(account, target) {
    await evaluate('sessionStorage.clear()');
    await go('/login');
    await evaluate(`(() => {
      const fields = [...document.querySelectorAll('form input')];
      for (const [field, value] of [[fields[0], ${JSON.stringify(account + '@demo.local')}], [fields[1], 'Cambiar123!']]) {
        field.value = value; field.dispatchEvent(new Event('input', {bubbles:true}));
      }
      document.querySelector('form button.btn').click();
    })()`);
    for (let attempt = 0; attempt < 40; attempt++) {
      await pause(230);
      if (await evaluate(`location.pathname === ${JSON.stringify(target)}`)) return;
    }
    throw new Error('No se abrió el área de ' + account);
  }
  async function clickLabel(label) {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === ${JSON.stringify(label)});
      if (!button) throw new Error('No se encontró el botón solicitado');
      button.click();
    })()`);
    await pause(350);
  }
  const matrix = [
    [null, null, [['/login','acceso'],['/registro','registro'],['/olvide-contrasena','recuperacion'],['/restablecer','restablecer-sin-enlace'],['/restablecer?token='+resetToken,'restablecer-formulario']]],
    ['admin','/admin',[['/admin','admin-usuarios'],['/admin/asignaciones','admin-asignaciones'],['/cambiar-contrasena','cambio-contrasena']]],
    ['fisio','/equipo',[['/equipo','fisio-resumen'],['/equipo/alertas','fisio-alertas'],['/equipo/alertas/'+alert.id,'fisio-revision'],
      ['/equipo/deportistas','fisio-deportistas'],...['summary','history','reviews','program','evaluations'].map(tab=>['/equipo/deportistas/'+athlete.id+'?tab='+tab,'fisio-ficha-'+tab]),
      ['/equipo/ejercicios','fisio-catalogo'],['/equipo/umbrales','fisio-umbrales']]],
    ['deportista','/deportista',[['/deportista','atleta-inicio'],['/deportista/reportar','atleta-reportar'],['/deportista/plan','atleta-plan'],
      ['/deportista/progreso','atleta-progreso'],['/deportista/perfil','atleta-perfil']]],
    ['entrenador','/equipo',[['/equipo','coach-resumen'],['/equipo/deportistas','coach-deportistas'],
      ['/equipo/deportistas/'+athlete.id,'coach-ficha'],['/equipo/deportistas/'+athlete.id+'?tab=program','coach-programa'],
      ['/equipo/ejercicios','coach-catalogo'],['/equipo/alertas','coach-alertas'],['/equipo/deportistas/'+athlete.id+'?tab=history','coach-molestias'],['/equipo/umbrales','coach-umbrales']]]
  ];
  for (const [account, target, routes] of matrix) {
    if (account) await login(account, target);
    for (const [path, name] of routes) {
      await go(path);
      await capture(name);
      if (name === 'admin-usuarios') {
        await clickLabel('Nuevo usuario');
        await capture('admin-crear', 'form[aria-labelledby="h-new"]');
      }
      if (name === 'fisio-revision') await capture('fisio-revision-formulario', '[aria-labelledby="review-form-title"]');
      if (name === 'fisio-catalogo') {
        await clickLabel('Nuevo ejercicio');
        await capture('fisio-nuevo-ejercicio', 'form[aria-labelledby="x-form-t"]');
      }
      if (name === 'fisio-ficha-program') {
        await clickLabel('Asignar ejercicio');
        await capture('fisio-asignar-ejercicio', 'form.assign');
      }
      if (name === 'atleta-perfil') {
        await clickLabel('Agregar');
        await capture('atleta-agregar-antecedente', 'section[aria-labelledby="h-ant"] form');
      }
    }
  }
} finally {
  await browser?.close();
  server.close();
  await prisma.$disconnect();
}
