// Ejecutar contra la demostración persistente de Fase 7. Solo lee datos sintéticos.
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');

const base = 'http://127.0.0.1:4277';
const widths = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440];
const themes = ['light', 'dark'];
const captureDir = process.env.UX_CAPTURE_DIR;

function contrast(first, second) {
  const luminance = color => color.match(/\d+/g).slice(0, 3).map(channel => Number(channel) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
  const colors = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (colors[0] + .05) / (colors[1] + .05);
}

async function capture(page, name) {
  if (!captureDir) return;
  mkdirSync(captureDir, { recursive: true });
  await page.screenshot({ path: resolve(captureDir, name + '.png'), animations: 'disabled' });
}

async function theme(page, mode) {
  await page.evaluate(async value => {
    document.documentElement.dataset.theme = value;
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, mode);
}

async function passwordGeometry(page) {
  const field = page.getByLabel('Contraseña', { exact: true });
  const eye = page.getByRole('button', { name: 'Mostrar contraseña' });
  await page.goto(base + '/login');
  await field.waitFor();
  await field.fill('Texto de prueba 123');
  let submissions = 0;
  page.on('request', request => {
    if (request.url() === base + '/api/auth/login') submissions++;
  });

  const measure = () => field.evaluate(input => {
    const button = input.nextElementSibling;
    const field = input.getBoundingClientRect();
    const eye = button.getBoundingClientRect();
    const style = getComputedStyle(input);
    const focus = getComputedStyle(button);
    return {
      field: [field.x + scrollX, field.y + scrollY, field.width, field.height],
      eye: [eye.x + scrollX, eye.y + scrollY, eye.width, eye.height],
      insets: [eye.left - field.left, field.right - eye.right, eye.top - field.top, field.bottom - eye.bottom],
      textGap: eye.left - (field.right - parseFloat(style.paddingRight)),
      outline: [focus.outlineStyle, parseFloat(focus.outlineWidth), parseFloat(focus.outlineOffset)],
      colors: [style.color, style.backgroundColor, style.borderTopColor, focus.color, focus.outlineColor],
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  for (const zoom of [100, 200]) {
    await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, zoom);
    for (const width of zoom === 100 ? widths : [320, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      for (const mode of themes) {
        await theme(page, mode);
        await eye.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        const idle = await measure();
        const label = `${width}px ${mode} ${zoom}%`;
        assert.ok(idle.insets.every(value => value >= 4), label);
        assert.ok(idle.eye[2] >= 44 && idle.eye[3] >= 44, label);
        assert.ok(idle.textGap >= 4, label);
        assert.equal(idle.overflow, false, label);
        assert.ok(contrast(idle.colors[0], idle.colors[1]) >= 4.5, label + ' texto');
        assert.ok(contrast(idle.colors[2], idle.colors[1]) >= 3, label + ' borde');
        assert.ok(contrast(idle.colors[3], idle.colors[1]) >= 3, label + ' icono');

        await eye.hover();
        const hover = await measure();
        assert.deepEqual(hover.eye, idle.eye, label + ' hover');
        assert.deepEqual(hover.field, idle.field, label + ' hover');
        if (zoom === 100 && [390, 1440].includes(width)) await capture(page, `login-${width}-${mode}`);
        await page.mouse.down();
        const active = await measure();
        assert.deepEqual(active.eye, idle.eye, label + ' active');
        assert.deepEqual(active.field, idle.field, label + ' active');
        await page.mouse.up();
        const hide = page.getByRole('button', { name: 'Ocultar contraseña' });
        await hide.waitFor();
        assert.equal(await field.getAttribute('type'), 'text');
        await field.focus();
        await page.keyboard.press('Tab');
        assert.equal(await hide.evaluate(node => node === document.activeElement), true);
        const keyboard = await measure();
        assert.deepEqual(keyboard.eye, idle.eye, label + ' focus');
        assert.deepEqual(keyboard.field, idle.field, label + ' focus');
        assert.deepEqual(keyboard.outline, ['solid', 2, -2], label + ' focus');
        assert.ok(contrast(keyboard.colors[4], idle.colors[1]) >= 3, label + ' anillo de foco');
        await page.keyboard.press('Space');
        await eye.waitFor();
        assert.equal(await field.getAttribute('type'), 'password');
      }
    }
  }
  assert.equal(submissions, 0);
  assert.equal(await field.getAttribute('autocomplete'), 'current-password');
  assert.equal(await field.inputValue(), 'Texto de prueba 123');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(parseFloat(await eye.evaluate(node => getComputedStyle(node).transitionDuration)) < .001);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
}

async function auditLoginFeedback(page) {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(base + '/login');
  const submit = page.locator('form .btn');
  await submit.click();
  assert.equal(await page.getByRole('alert').count(), 2);
  await page.getByLabel('Correo', { exact: true }).fill('visual@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Texto de prueba 123');
  const idle = await submit.boundingBox();
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/login', async route => {
    await waiting;
    await route.fulfill({ status: 401, json: { error: 'Credenciales inválidas' } });
  });
  try {
    await submit.click();
    await page.getByRole('button', { name: 'Entrando…', exact: true }).waitFor();
    const busy = await submit.boundingBox();
    assert.equal(busy.width, idle.width);
    assert.equal(busy.height, idle.height);
    assert.equal(await submit.isDisabled(), true);
  } finally {
    release();
  }
  await page.getByRole('alert').getByText('Credenciales inválidas').waitFor();
  await capture(page, 'login-error');
}

async function checkMobileLabel(page, name) {
  await page.setViewportSize({ width: 320, height: 820 });
  const link = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name, exact: true });
  await link.evaluate(async element => {
    await document.fonts.ready;
    const label = element.querySelector('.nav-label-mobile') ?? element.querySelector('span');
    const range = document.createRange();
    range.selectNodeContents(label);
    if (range.getClientRects().length !== 1) throw new Error('Etiqueta móvil dividida: ' + label.textContent);
  });
}

async function audit(page, pages) {
  let count = 0;
  for (const [name, path, ready] of pages) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.locator(ready).first().waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 820 });
      for (const mode of themes) {
        await theme(page, mode);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${name} a ${width}px en ${mode}`);
        count++;
        if ([320, 1440].includes(width)) await capture(page, `${name}-${width}-${mode}`);
      }
    }
  }
  return count;
}

async function login(page, role) {
  await page.goto(base + '/login');
  await page.getByLabel('Correo', { exact: true }).fill(role + '-fase7-demo@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Encuestas-sinteticas1');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const home = { deportista: '/deportista', administracion: '/admin' }[role] ?? '/equipo';
  await page.waitForURL(base + home);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? '/usr/bin/brave', args: ['--no-sandbox'] });
  try {
    const publicPage = await browser.newPage();
    await passwordGeometry(publicPage);
    await auditLoginFeedback(publicPage);
    let total = await audit(publicPage, [
      ['registro', '/registro', 'form input'],
      ['recuperacion', '/olvide-contrasena', 'form input'],
      ['enlace-vencido', '/restablecer', 'app-state'],
      ['legal', '/informacion-legal', 'h1'],
    ]);
    await publicPage.close();

    const athlete = await browser.newPage({ reducedMotion: 'reduce' });
    await login(athlete, 'deportista');
    await checkMobileLabel(athlete, 'Mi bienestar');
    total += await audit(athlete, [
      ['inicio', '/deportista', 'main h1'],
      ...['plan', 'reportar', 'progreso', 'bienestar', 'perfil', 'encuestas', 'evaluaciones']
        .map(path => [path, '/deportista/' + path, 'main h1']),
      ['cambiar-clave', '/cambiar-contrasena', 'form input'],
    ]);
    await athlete.close();

    const physio = await browser.newPage({ reducedMotion: 'reduce' });
    await login(physio, 'fisioterapia');
    await checkMobileLabel(physio, 'Deportistas');
    await physio.goto(base + '/equipo/deportistas');
    const row = physio.locator('app-athlete-row a').filter({ has: physio.getByText('deportista', { exact: true }) });
    await row.waitFor();
    const detail = await row.getAttribute('href');
    total += await audit(physio, [
      ['equipo', '/equipo', 'main h1'],
      ...['deportistas', 'alertas', 'ejercicios', 'umbrales'].map(path => [path, '/equipo/' + path, 'main h1']),
      ...['summary', 'history', 'program', 'reviews', 'evaluations', 'wellbeing'].map(tab => [
        'ficha-' + tab, detail + '?tab=' + tab, 'main h1',
      ]),
      ['encuestas-fisioterapia', detail + '/encuestas', 'main .entry'],
    ]);
    await physio.getByRole('button', { name: 'Consultar respuestas' }).click();
    await physio.getByText('En más de la mitad', { exact: true }).waitFor();
    await capture(physio, 'encuesta-presentada');
    await physio.close();

    const coach = await browser.newPage({ reducedMotion: 'reduce' });
    await login(coach, 'entrenador');
    total += await audit(coach, [
      ['inicio-entrenador', '/equipo', 'main h1'],
      ['asignados-entrenador', '/equipo/deportistas', 'app-athlete-row'],
      ['ficha-entrenador', detail, 'main h1'],
      ['encuestas-entrenador', detail + '/encuestas', 'main .entry'],
    ]);
    await coach.close();

    const admin = await browser.newPage({ reducedMotion: 'reduce' });
    await login(admin, 'administracion');
    total += await audit(admin, [
      ['administracion', '/admin', 'main h1'],
      ['asignaciones', '/admin/asignaciones', 'main h1'],
    ]);
    await admin.setViewportSize({ width: 320, height: 640 });
    const logout = admin.getByRole('button', { name: 'Cerrar sesión' }).filter({ visible: true });
    await logout.click();
    const dialog = admin.getByRole('dialog');
    await dialog.waitFor();
    const rect = await dialog.boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 320 && rect.y + rect.height <= 640);
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)));
    await admin.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    console.log(`Auditoría visual en Brave: 22 combinaciones de contraseña y ${total} comprobaciones de ruta, ancho y tema.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
