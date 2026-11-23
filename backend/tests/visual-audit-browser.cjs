// Ejecutar contra la demostración persistente de Fase 7. Solo lee datos sintéticos.
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');

const base = new URL('http://127.0.0.1:' + Number(process.env.UX_AUDIT_PORT ?? 4277)).origin;
const widths = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440];
const themes = ['light', 'dark'];
const captureDir = process.env.UX_CAPTURE_DIR;
const precision = process.argv.includes('--precision');
const precisionWidths = [320, 390, 768, 1440];

function contrast(first, second) {
  const luminance = color => color.match(/\d+/g).slice(0, 3).map(channel => Number(channel) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
  const colors = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (colors[0] + .05) / (colors[1] + .05);
}

async function capture(page, name, options = {}) {
  if (!captureDir) return;
  mkdirSync(captureDir, { recursive: true });
  await page.screenshot({ path: resolve(captureDir, name + '.png'), animations: 'disabled', ...options });
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
  const sample = 'Texto de prueba 123 '.repeat(4).trim();
  let submissions = 0;
  page.on('request', request => {
    if (request.url() === base + '/api/auth/login') submissions++;
  });
  await eye.click();
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await eye.waitFor();
  assert.equal(await field.inputValue(), '');
  await field.fill(sample);

  const measure = () => field.evaluate(input => {
    const button = input.nextElementSibling;
    const field = input.getBoundingClientRect();
    const eye = button.getBoundingClientRect();
    const style = getComputedStyle(input);
    const focus = getComputedStyle(button);
    const email = document.querySelector('input[autocomplete="username"]');
    const other = getComputedStyle(email);
    const shape = css => [css.width, css.height, css.borderRadius, css.borderTopWidth, css.backgroundColor, css.fontSize];
    return {
      field: [field.x + scrollX, field.y + scrollY, field.width, field.height],
      eye: [eye.x + scrollX, eye.y + scrollY, eye.width, eye.height],
      insets: [eye.left - field.left, field.right - eye.right, eye.top - field.top, field.bottom - eye.bottom],
      textGap: eye.left - (field.right - parseFloat(style.paddingRight)),
      outline: [focus.outlineStyle, parseFloat(focus.outlineWidth), parseFloat(focus.outlineOffset)],
      colors: [style.color, style.backgroundColor, style.borderTopColor, focus.color, focus.outlineColor],
      background: focus.backgroundColor,
      sameShape: JSON.stringify(shape(style)) === JSON.stringify(shape(other)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  for (const zoom of [100, 200]) {
    await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, zoom);
    for (const width of zoom === 100 ? (precision ? precisionWidths : widths) : [320, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      for (const mode of themes) {
        await theme(page, mode);
        await eye.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.activeElement.blur());
        await page.mouse.move(0, 0);
        const idle = await measure();
        const label = `${width}px ${mode} ${zoom}%`;
        assert.ok(idle.insets.every(value => value >= 0), label);
        assert.equal(idle.sameShape, true, label);
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
        assert.equal(hover.colors[1], idle.colors[1], label + ' superficie');
        assert.equal(hover.background, 'rgba(0, 0, 0, 0)', label + ' hover');
        if (zoom === 100 && (precision || [390, 1440].includes(width))) await capture(page, `login-${width}-${mode}`);
        await page.mouse.down();
        const active = await measure();
        assert.deepEqual(active.eye, idle.eye, label + ' active');
        assert.deepEqual(active.field, idle.field, label + ' active');
        assert.equal(active.background, 'rgba(0, 0, 0, 0)', label + ' active');
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
        assert.deepEqual(keyboard.outline, ['solid', 2, -3], label + ' focus');
        assert.equal(keyboard.background, 'rgba(0, 0, 0, 0)', label + ' focus');
        assert.ok(contrast(keyboard.colors[4], idle.colors[1]) >= 3, label + ' anillo de foco');
        await field.evaluate(input => input.setSelectionRange(2, 8));
        if (zoom === 100 && width === 390 && mode === 'light') await capture(page, 'login-visible-foco');
        await page.keyboard.press(width === 390 ? 'Enter' : 'Space');
        await eye.waitFor();
        assert.equal(await field.getAttribute('type'), 'password');
        assert.deepEqual(await field.evaluate(input => [input.selectionStart, input.selectionEnd]), [2, 8]);
      }
    }
  }
  assert.equal(submissions, 0);
  assert.equal(await field.getAttribute('autocomplete'), 'current-password');
  assert.equal(await field.inputValue(), sample);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(parseFloat(await eye.evaluate(node => getComputedStyle(node).transitionDuration)) < .001);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
}

async function auditLoginFeedback(page) {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(base + '/login');
  const submit = page.locator('form .btn');
  await submit.click();
  await page.getByRole('alert').nth(1).waitFor();
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
    await page.locator('main .sk').first().waitFor({ state: 'hidden' });
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

async function surveyNavigation(browser) {
  let detail;
  for (const role of ['fisioterapia', 'entrenador', 'deportista', 'administracion']) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    try {
      await login(page, role);
      if (role === 'deportista') {
        if (process.argv.includes('--navigation')) {
          await page.locator('.home-cards').waitFor();
          await page.goto(base + '/deportista/bienestar');
          await page.getByRole('heading', { name: 'Mi bienestar', exact: true }).waitFor();
          await page.goto(base + '/deportista/progreso');
          await page.getByRole('heading', { name: 'Mi progreso', exact: true }).waitFor();
        }
        await page.goto(base + '/deportista/plan');
        await page.getByRole('link', { name: 'Encuestas preventivas', exact: true }).click();
        const back = page.getByRole('link', { name: 'Volver a Mi plan' });
        await back.waitFor();
        assert.equal(await back.locator('app-icon[name="arrow-left"] svg').count(), 1);
        await back.press('Enter');
        await page.waitForURL(base + '/deportista/plan');
        continue;
      }
      if (role === 'administracion') {
        await page.goto(base + detail + '/encuestas');
        await page.waitForURL(base + '/admin');
        continue;
      }
      await page.goto(base + '/equipo/deportistas');
      const row = page.locator('app-athlete-row a').filter({ has: page.getByText('deportista', { exact: true }) });
      detail = await row.getAttribute('href');
      await row.click();
      const evaluation = page.getByRole('link', { name: 'Evaluaciones', exact: true });
      const physio = role === 'fisioterapia';
      const link = page.getByRole('link', { name: physio ? 'Ver encuestas' : 'Abrir cuestionario', exact: true });
      const target = base + detail + (physio ? '?tab=evaluations' : '');
      if (physio) {
        assert.equal(await link.count(), 0);
        await evaluation.click();
      } else {
        assert.equal(await evaluation.count(), 0);
      }
      await link.waitFor();
      assert.equal(await page.locator('main header.page-head a').count(), 0);
      for (const width of precisionWidths) {
        await page.setViewportSize({ width, height: 820 });
        for (const mode of themes) {
          await theme(page, mode);
          await link.scrollIntoViewIfNeeded();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          await capture(page, `ficha-${role}-${width}-${mode}`);
        }
      }
      await link.click();
      await page.waitForURL(base + detail + '/encuestas');
      await page.reload();
      if (physio) {
        await page.getByRole('button', { name: 'Consultar respuestas' }).click();
        await page.getByText('Giro durante práctica sintética', { exact: true }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Cuestionario del entrenador' }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Encuesta inicial' }).count(), 0);
      }
      const back = page.getByRole('link', { name: 'Volver a la ficha' });
      await back.waitFor();
      assert.equal(await back.locator('app-icon[name="arrow-left"] svg').count(), 1);
      await back.press('Enter');
      await page.waitForURL(target);
      await link.waitFor();
    } finally {
      await page.close();
    }
  }
}

const tolerance = 1;
const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} (${actual} frente a ${expected})`);

async function settleMotion(locator) {
  await locator.evaluate(async element => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished));
  });
}

async function registrationLayout(page) {
  await page.goto(base + '/registro');
  const details = page.locator('.consent-box');
  const summary = details.locator('summary');
  const password = page.getByLabel('Contraseña', { exact: true });
  const submit = page.getByRole('button', { name: 'Crear cuenta', exact: true });
  const geometry = () => page.evaluate(() => {
    const selectors = ['.brand-content', '.brand .logo-mark', '.brand .logo-text', '.brand h2', '.brand p',
      '.logo-sm', 'form h1', 'input[autocomplete="new-password"]', '.consent-box summary'];
    return Object.fromEntries(selectors.flatMap(selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return height ? [[selector, [x + scrollX, y + scrollY, width, height]]] : [];
    }));
  });
  const stable = (before, after, label) => {
    for (const [selector, rect] of Object.entries(before)) {
      rect.forEach((value, i) => near(after[selector][i], value, `${label} ${selector} dimensión ${i}`));
    }
  };
  await summary.waitFor();
  for (const zoom of [100, 200]) {
    await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, zoom);
    for (const width of [320, 360, 390, 414, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(expected => innerWidth === expected && innerHeight === 900 &&
        Boolean(document.querySelector('.brand').getClientRects().length) === (expected >= 900), width);
      for (const mode of themes) {
        await theme(page, mode);
        await page.emulateMedia({ reducedMotion: mode === 'dark' ? 'reduce' : 'no-preference' });
        const label = `Registro ${width}px ${mode} ${zoom}%`;
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await settleMotion(details);
        const baseline = await geometry();
        const desktopCapture = zoom === 100 && width === 1440 && mode === 'light';
        if (desktopCapture) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await capture(page, 'registro-cerrado');
        }
        await summary.focus();
        await page.keyboard.press('Enter');
        await settleMotion(details);
        assert.ok(await details.evaluate(el => el.open));
        assert.ok(await summary.evaluate(el => el === document.activeElement));
        stable(baseline, await geometry(), label + ' abierto');
        const content = await details.evaluate(el => {
          const paragraphs = [...el.querySelectorAll('p')];
          const bounds = el.getBoundingClientRect();
          const summaryBottom = el.querySelector('summary').getBoundingClientRect().bottom;
          return paragraphs.length > 0 && paragraphs.every(p => {
            const box = p.getBoundingClientRect();
            return box.top >= summaryBottom && box.bottom <= bounds.bottom + 1 &&
              box.left >= bounds.left && box.right <= bounds.right + 1 && p.scrollWidth <= p.clientWidth + 1;
          });
        });
        assert.ok(content, label);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
        if (desktopCapture) {
          console.log('Registro en Brave 1440 claro, coordenadas abierto:', JSON.stringify(await geometry()));
          await capture(page, 'registro-abierto', { fullPage: true });
        }
        if (zoom === 200 && width === 320 && mode === 'dark') {
          await capture(page, 'registro-abierto-320-200-oscuro', { fullPage: true });
        }
        await page.keyboard.press('Space');
        await settleMotion(details);
        assert.equal(await details.evaluate(el => el.open), false);
        assert.ok(await summary.evaluate(el => el === document.activeElement));
        stable(baseline, await geometry(), label + ' cerrado');
      }
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await theme(page, 'dark');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const independent = async () => Object.fromEntries(Object.entries(await geometry())
    .filter(([selector]) => selector.startsWith('.brand') || selector === 'form h1'));
  const baseline = await independent();
  await submit.click();
  await page.locator('#register-consent-error').waitFor();
  stable(baseline, await independent(), 'Registro con errores');
  await page.getByLabel('Nombre completo').fill('Deportista sintético');
  await page.getByLabel('Correo', { exact: true }).fill('revision-visual@example.test');
  await page.getByLabel('Fecha de nacimiento').fill('2000-01-01');
  await password.fill('Sintetico12345');
  const fieldGeometry = await geometry();
  await page.getByRole('button', { name: 'Mostrar contraseña' }).press('Enter');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).waitFor();
  assert.equal(await password.getAttribute('type'), 'text');
  stable(fieldGeometry, await geometry(), 'Contraseña visible');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).press('Enter');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).waitFor();
  assert.equal(await password.getAttribute('type'), 'password');
  stable(fieldGeometry, await geometry(), 'Contraseña oculta');
  await page.getByRole('checkbox').check();
  // Intercepta el POST para presentar el error sin registrar cuentas ni consentimientos.
  await page.route('**/api/auth/register', route =>
    route.fulfill({ status: 409, json: { error: 'Error sintético de registro.' } }));
  try {
    await submit.press('Enter');
    await page.getByText('Error sintético de registro.', { exact: true }).waitFor();
    stable(baseline, await independent(), 'Registro con error de servidor');
  } finally {
    await page.unroute('**/api/auth/register');
  }
}

async function sidebarPulse(page, sidebar, name, path, keyboard = false, reduced = false) {
  const link = sidebar.getByRole('link', { name });
  const icon = link.locator('.nav-icon');
  await settleMotion(icon);
  await link.evaluate(el => {
    const svg = el.querySelector('svg');
    const links = [...el.parentElement.querySelectorAll('a')];
    const geometry = () => links.map(item => {
      const { x, y, width, height } = item.getBoundingClientRect();
      return [x, y, width, height];
    });
    const expected = geometry();
    const width = svg.getBoundingClientRect().width;
    window.pulseResult = new Promise(resolve => {
      el.addEventListener('click', () => {
        const start = performance.now();
        let peak = 1;
        let layoutShift = 0;
        const sample = () => {
          const scale = svg.getBoundingClientRect().width / width;
          peak = Math.max(peak, scale);
          geometry().forEach((rect, i) => rect.forEach((value, j) => {
            layoutShift = Math.max(layoutShift, Math.abs(value - expected[i][j]));
          }));
          if (performance.now() - start < 320) requestAnimationFrame(sample);
          else resolve({ peak, final: scale, layoutShift });
        };
        requestAnimationFrame(sample);
      }, { once: true });
    });
  });
  if (keyboard) await link.press('Enter');
  else await link.click();
  await page.waitForURL(base + path);
  const result = await page.evaluate(() => window.pulseResult);
  assert.ok(Math.abs(result.final - 1) < .005, JSON.stringify(result));
  assert.ok(result.layoutShift <= tolerance, JSON.stringify(result));
  assert.ok(reduced ? result.peak < 1.005 : result.peak >= 1.10 && result.peak <= 1.14, JSON.stringify(result));
  assert.equal(await sidebar.locator('[aria-current="page"]').count(), 1);
  assert.equal(await link.getAttribute('aria-current'), 'page');
  assert.ok(!await icon.evaluate(el => el.classList.contains('pulse')));
  console.log('Sidebar en Brave', JSON.stringify({ path, keyboard, reduced, ...result }));
}

async function professionalWellbeing(page, detail) {
  const panel = page.locator('app-wellbeing');
  const measure = () => panel.evaluate(el => [...el.querySelectorAll('.professional-summary, .sleep-card')].map(card => {
    const { left, top, right, bottom, height } = card.getBoundingClientRect();
    return { left, top, right, bottom, height, overflow: Math.max(card.scrollWidth - card.clientWidth, card.scrollHeight - card.clientHeight) };
  }));
  const startedOn = '2026-11-01';
  const name = 'Programa de seguimiento sintético con un nombre largo para verificar reflow de filtros';
  const entry = { id: 'fixture', day: startedOn, startedOn, week: 1, version: 1, program: { id: 'fixture', name },
    current: { version: 1, recordedAt: startedOn + 'T12:00:00Z', sleepHours: 8, rest: 'RESTFUL', fatigue: 'MILD', recovery: 'GOOD' } };
  const days = Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-0${i + 1}`, week: 1, hours: 6 + i / 2 }));
  const sleepRoute = '**/api/team/athletes/*/sleep';
  const wellbeingRoute = '**/api/team/athletes/*/wellbeing';
  for (const state of ['vacío', 'un registro', 'historial', 'restringido', 'error']) {
    const populated = ['un registro', 'historial'].includes(state);
    await page.route(wellbeingRoute, route => route.fulfill({ json: {
      entries: populated ? [entry] : [], nextCursor: null,
    } }));
    let release;
    const loading = new Promise(resolve => { release = resolve; });
    await page.route(sleepRoute, async route => {
      if (state === 'vacío') await loading;
      const status = { restringido: 403, error: 500 }[state] ?? 200;
      const period = { programId: 'fixture', name, startedOn, points: state === 'historial' ? days : days.slice(0, 1) };
      await route.fulfill({ status, json: status === 200
        ? { periods: populated ? [period] : [], next: null } : { error: 'Error sintético de consulta.' } });
    });
    await page.goto(base + detail + '?tab=wellbeing');
    if (state === 'vacío') {
      await page.getByText('Cargando mediciones de sueño…').waitFor();
      try {
        const [summary, sleep] = await measure();
        near(summary.bottom, sleep.bottom, 'Bienestar cargando');
      } finally { release(); }
    }
    const readyText = {
      vacío: 'Aún no hay horas de sueño registradas.',
      'un registro': 'Horas de sueño (h)',
      historial: 'Horas de sueño (h)',
      restringido: 'Las horas de sueño no están disponibles para esta consulta.',
      error: 'No pudimos cargar el sueño',
    }[state];
    await panel.getByText(readyText, { exact: true }).waitFor();
    for (const width of [320, 360, 390, 414, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const mode of themes) {
        await theme(page, mode);
        const [summary, sleep] = await measure();
        const label = `Bienestar ${state} ${width}px ${mode}`;
        assert.ok(summary.overflow <= tolerance && sleep.overflow <= tolerance, label);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
        if (width >= 1024) {
          near(summary.top, sleep.top, label);
          near(summary.bottom, sleep.bottom, label);
          assert.ok(summary.right < sleep.left, label);
        } else if (width <= 414) {
          assert.ok(sleep.top > summary.bottom, label);
          near(summary.left, sleep.left, label);
          near(summary.right, sleep.right, label);
        }
        if (width === 1440 && ['vacío', 'historial'].includes(state)) {
          console.log(label, JSON.stringify([summary, sleep]));
          await capture(page, `bienestar-profesional-${state}-${mode}`);
        }
      }
    }
    if (state === 'historial') {
      const table = panel.locator('.sleep-details summary');
      const before = await measure();
      await table.press('Enter');
      await panel.getByRole('table', { name: 'Mediciones de sueño de la semana 1' }).waitFor();
      const after = await measure();
      near(before[0].top, after[0].top, 'Sueño expandido');
      near(after[0].bottom, after[1].bottom, 'Sueño expandido');
      assert.ok(after[1].height > before[1].height);
      assert.equal(await panel.locator('.sleep-table tbody tr').count(), days.length);
      assert.ok(await table.evaluate(el => el === document.activeElement));
    }
    await page.unroute(sleepRoute);
    await page.unroute(wellbeingRoute);
  }
}

async function navigationStates(browser) {
  const widths = [320, 360, 390, 414, 768, 1024, 1280, 1440];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await login(page, 'fisioterapia');
    await page.goto(base + '/equipo/deportistas');
    const rows = page.locator('app-athlete-row a');
    const detail = await rows.filter({ has: page.getByText('deportista', { exact: true }) }).getAttribute('href');
    const other = await rows.filter({ has: page.getByText('otro', { exact: true }) }).getAttribute('href');
    const rail = page.getByRole('navigation', { name: 'Secciones de la ficha' });
    const selected = rail.locator('[aria-current="page"]');
    const sidebar = page.getByRole('navigation', { name: 'Navegación principal' });
    const measure = link => link.evaluate(el => ({
      rect: el.getBoundingClientRect().toJSON(), surface: getComputedStyle(el).backgroundColor,
      outline: getComputedStyle(el).outlineStyle,
    }));
    const settle = link => link.evaluate(async el => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
    });

    await page.goto(base + detail + '?tab=wellbeing');
    await page.locator('app-wellbeing').waitFor();
    for (const mode of themes) {
      await theme(page, mode);
      const current = sidebar.getByRole('link', { name: 'Deportistas', exact: true });
      const alerts = sidebar.getByRole('link', { name: /^Alertas/ });
      await page.evaluate(() => document.activeElement.blur());
      await page.mouse.move(0, 0);
      await settle(alerts);
      const idle = await measure(alerts);
      const active = await measure(current);
      await alerts.hover();
      await settle(alerts);
      const hover = await measure(alerts);
      assert.notEqual(hover.surface, idle.surface);
      assert.notEqual(hover.surface, active.surface);
      assert.deepEqual(hover.rect, idle.rect);
      assert.deepEqual(await measure(current), active);
      if (mode === 'light') await capture(page, 'sidebar-despues');
      await page.mouse.down();
      await settle(alerts);
      const pressed = await measure(alerts);
      assert.deepEqual(pressed.rect, idle.rect);
      assert.notEqual(pressed.surface, active.surface);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await settle(alerts);
      assert.deepEqual(await measure(alerts), idle);
      await sidebar.getByRole('link', { name: 'Resumen', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await alerts.evaluate(el => el === document.activeElement), true);
      const focused = await measure(alerts);
      assert.equal(focused.outline, 'solid');
      assert.deepEqual(focused.rect, idle.rect);
    }
    await sidebarPulse(page, sidebar, /^Alertas/, '/equipo/alertas');
    await sidebarPulse(page, sidebar, /^Alertas/, '/equipo/alertas');
    await sidebarPulse(page, sidebar, 'Resumen', '/equipo', true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sidebarPulse(page, sidebar, 'Deportistas', '/equipo/deportistas', true, true);
    await page.goto(base + detail + '?tab=wellbeing');

    const panels = {
      summary: '#d-c', history: '#d-d', reviews: 'app-athlete-reviews',
      program: 'app-athlete-program', evaluations: 'app-athlete-evaluations', wellbeing: 'app-wellbeing',
    };
    for (const [tab, panel] of Object.entries(panels)) {
      await rail.locator('#section-' + tab).click();
      await page.waitForURL(base + detail + '?tab=' + tab);
      assert.equal(await selected.count(), 1);
      assert.equal(await selected.getAttribute('id'), 'section-' + tab);
      await page.locator(panel).waitFor();
    }
    await page.goBack();
    await rail.locator('#section-evaluations[aria-current="page"]').waitFor();
    await page.goForward();
    await rail.locator('#section-wellbeing[aria-current="page"]').waitFor();
    await page.goto(base + other + '?tab=invalida');
    assert.equal(await selected.getAttribute('id'), 'section-summary');
    await page.locator(panels.summary).waitFor();
    await page.goto(base + detail + '?tab=wellbeing');
    await page.locator(panels.wellbeing).waitFor();

    await page.goto(base + detail + '?tab=wellbeing&origen=auditoria');
    await rail.getByRole('link', { name: 'Evaluaciones', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('tab') === 'evaluations' &&
      url.searchParams.get('origen') === 'auditoria');
    await page.goBack();
    await rail.locator('#section-wellbeing[aria-current="page"]').waitFor();

    const summary = rail.getByRole('link', { name: 'Resumen', exact: true });
    await theme(page, 'light');
    await summary.hover();
    await settle(summary);
    assert.notEqual((await measure(summary)).surface, (await measure(selected)).surface);
    assert.equal(await summary.getAttribute('aria-current'), null);
    await capture(page, 'ficha-despues');
    await page.mouse.move(0, 0);
    for (const size of [100, 200]) {
      await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom + '%'; }, size);
      for (const width of size === 100 ? widths : [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of themes) {
          await theme(page, mode);
          const result = await rail.evaluate(el => {
            const current = el.querySelector('[aria-current="page"]').getBoundingClientRect();
            const outer = el.getBoundingClientRect();
            return {
              visible: current.left >= outer.left - 1 && current.right <= outer.right + 1,
              rows: new Set([...el.querySelectorAll('a')].map(link => link.offsetTop)).size,
              local: el.scrollWidth > el.clientWidth + 1,
              global: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          const label = `${width}px ${mode} ${size}%`;
          assert.equal(result.global, false, label);
          assert.equal(result.rows, 1, label);
          assert.equal(result.visible, true, label);
          if (width >= 1024 && size === 100) assert.equal(result.local, false, label);
          if (width === 320 && size === 100 && mode === 'dark') await capture(page, 'ficha-movil-despues');
        }
      }
    }
    await summary.focus();
    await page.keyboard.press('Tab');
    assert.ok(await rail.evaluate(el => el.contains(document.activeElement) &&
      getComputedStyle(document.activeElement).outlineStyle === 'solid'));
    await page.reload();
    assert.equal(await selected.getAttribute('id'), 'section-wellbeing');
    await page.setViewportSize({ width: 1440, height: 900 });
    await rail.getByRole('link', { name: 'Evaluaciones', exact: true }).click();
    await page.getByRole('link', { name: 'Ver encuestas' }).click();
    await page.getByRole('link', { name: 'Volver a la ficha' }).waitFor();
    await page.locator('.entry').first().waitFor();
    await capture(page, 'regreso-despues');
    await professionalWellbeing(page, detail);
  } finally {
    await page.close();
  }
}

async function renderWindow(page, label, action, nextTheme) {
  await page.evaluate(() => {
    const root = document.documentElement;
    const selectors = ['.app-shell', '.sidebar', '.nav', '.topbar'];
    const nodes = selectors.map(selector => document.querySelector(selector));
    const nav = nodes[2];
    const geometry = () => [...nav.querySelectorAll('a')].map(link => {
      const { x, y, width, height } = link.getBoundingClientRect();
      return [x, y, width, height];
    });
    const expected = geometry();
    const theme = () => root.dataset.theme;
    const start = performance.now();
    const startTheme = theme();
    const initialCaptures = window.renderCaptures;
    const bg = getComputedStyle(document.body).backgroundColor;
    const rows = [];
    const themeChanges = [];
    const observer = new MutationObserver(records => themeChanges.push(...records.map(record => record.oldValue)));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'], attributeOldValue: true });
    window.renderFinished = false;
    window.renderWindow = new Promise(resolve => {
      const sample = () => {
        const style = getComputedStyle(nav);
        const rect = nav.getBoundingClientRect();
        rows.push({
          ms: Math.round(performance.now() - start),
          same: nodes.every((node, i) => node?.isConnected && node === document.querySelector(selectors[i])),
          visible: rect.width > 0 && rect.height > 0 && [nav, nodes[1], nodes[0]].every(el => {
            const css = getComputedStyle(el);
            return css.display !== 'none' && css.visibility === 'visible' && css.opacity === '1';
          }),
          stable: geometry().every((link, i) => link.every((value, j) => Math.abs(value - expected[i]?.[j]) <= 1)),
          theme: theme(),
          background: getComputedStyle(document.body).backgroundColor,
          native: root.matches(':active-view-transition'),
          intentional: root.classList.contains('theme-transition'),
          path: location.pathname + location.search,
          heading: document.querySelector('main h1')?.textContent?.trim(),
          selected: nav.querySelector('[aria-current="page"]')?.getAttribute('href'),
        });
        if (window.renderFinished && performance.now() - start >= 330 && !root.classList.contains('theme-transition')) {
          observer.disconnect();
          resolve({ rows, themeChanges, startTheme, bg, startedAt: performance.timeOrigin + start,
            calls: window.renderCaptures - initialCaptures });
        } else requestAnimationFrame(sample);
      };
      sample();
    });
  });
  await action();
  await page.evaluate(() => { window.renderFinished = true; });
  await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transition'));
  const result = await page.evaluate(() => window.renderWindow);
  assert.ok(result.rows.length >= 5, label + ' cuadros');
  const final = result.rows.at(-1);
  for (const row of result.rows) {
    assert.ok(row.same && row.visible && row.stable, label + ' ' + JSON.stringify(row));
    if (!nextTheme) {
      assert.ok(row.theme === result.startTheme && row.background === result.bg && !row.native,
        label + ' fondo inicial ' + result.bg + ' ' + JSON.stringify(row));
    } else {
      assert.ok([result.startTheme, nextTheme].includes(row.theme) &&
        [result.bg, final.background].includes(row.background) && (!row.native || row.intentional), label);
    }
  }
  assert.deepEqual(result.themeChanges, nextTheme ? [result.startTheme] : [], label);
  if (nextTheme) {
    assert.equal(final.theme, nextTheme, label);
    assert.notEqual(final.background, result.bg, label);
  }
  if (!nextTheme) assert.equal(result.calls, 0, label + ' capturas nativas');
  return result;
}

async function compositeFrames(page, action) {
  const client = await page.context().newCDPSession(page);
  const frames = [];
  client.on('Page.screencastFrame', frame => {
    frames.push(frame);
    void client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  let series;
  try {
    await client.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });
    await page.screenshot();
    series = await action();
  } finally {
    await client.send('Page.stopScreencast');
    await client.detach();
  }
  assert.ok(frames.length >= 5, 'cuadros del compositor');
  const pixels = await page.evaluate(async images => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const colors = [];
    for (const data of images) {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + data;
      await img.decode();
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      context.drawImage(img, 0, 0);
      // Muestra la superficie lateral, fuera de enlaces y controles.
      colors.push([...context.getImageData(110, 400, 1, 1).data].slice(0, 3));
    }
    return colors;
  }, frames.map(frame => frame.data));
  for (const rgb of pixels) {
    assert.ok(rgb.every((channel, i) => Math.abs(channel - pixels[0][i]) <= 3), JSON.stringify(pixels));
  }
  if (captureDir) {
    const { writeFileSync } = require('node:fs');
    const dir = resolve(captureDir, 'render', series.startTheme);
    mkdirSync(dir, { recursive: true });
    const composites = frames.map((frame, i) => {
      const image = String(i).padStart(3, '0') + '.jpg';
      writeFileSync(resolve(dir, image), Buffer.from(frame.data, 'base64'));
      return { image, ms: Math.round(frame.metadata.timestamp * 1000 - series.startedAt), pixel: pixels[i] };
    });
    writeFileSync(resolve(dir, 'series.json'), JSON.stringify({ ...series, composites }, null, 2));
  }
  return frames.length;
}

async function stableNavigation(browser) {
  const viewports = [320, 390, 768, 1024, 1440];
  const paths = {
    fisioterapia: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios', '/equipo/umbrales', '/equipo'],
    deportista: ['/deportista', '/deportista/plan', '/deportista/bienestar', '/deportista/progreso', '/deportista/perfil', '/deportista'],
    entrenador: ['/equipo', '/equipo/alertas', '/equipo/deportistas', '/equipo/ejercicios', '/equipo'],
    administracion: ['/admin', '/admin/asignaciones', '/admin'],
  };
  let journeys = 0;
  for (const [role, routes] of Object.entries(paths)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const errors = [];
    const documents = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) errors.push(msg.text());
    });
    page.on('request', request => {
      if (request.isNavigationRequest() && request.resourceType() === 'document') documents.push(request.url());
    });
    await page.addInitScript(() => {
      window.renderCaptures = 0;
      if (!localStorage.getItem('ls_theme')) localStorage.setItem('ls_theme', 'light');
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = callback => {
        window.renderCaptures++;
        return start(callback);
      };
    });
    const go = path => async () => {
      await page.locator(`.nav a[href="${path}"]`).click();
      await page.waitForURL(base + path);
      await page.locator(`.nav a[href="${path}"][aria-current="page"]`).waitFor();
    };
    const toggle = mode => page.getByRole('button', {
      name: `Cambiar a modo ${mode === 'dark' ? 'oscuro' : 'claro'}`,
    }).filter({ visible: true }).click();
    try {
      await login(page, role);
      await page.locator('.nav a[aria-current="page"]').waitFor();
      const documentCount = documents.length;
      for (const width of viewports) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of themes) {
          await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
          if (await page.locator('html').getAttribute('data-theme') !== mode) await toggle(mode);
          await page.waitForFunction(expected => {
            const root = document.documentElement;
            const background = expected === 'dark' ? 'rgb(15, 23, 29)' : 'rgb(244, 246, 248)';
            return root.dataset.theme === expected && !root.classList.contains('theme-transition') &&
              getComputedStyle(document.body).backgroundColor === background;
          }, mode);
          for (const path of routes.slice(1)) {
            const label = `${role} ${width} ${mode} ${path}`;
            await renderWindow(page, label, go(path));
            journeys++;
          }
          if (role === 'fisioterapia' && width === 1440) {
            await page.locator('.kpi').first().waitFor();
            const label = `Resumen → Deportistas ${width} ${mode}`;
            const count = await compositeFrames(page, () =>
              renderWindow(page, label, go('/equipo/deportistas')));
            console.log(label, count, 'cuadros del compositor');
            await page.goBack();
            await page.waitForURL(base + '/equipo');
          }
        }
      }
      if (role === 'fisioterapia') {
        await renderWindow(page, 'Atrás', async () => {
          await page.goBack();
          await page.waitForURL(base + '/equipo/umbrales');
        });
        await renderWindow(page, 'Adelante', async () => {
          await page.goForward();
          await page.waitForURL(base + '/equipo');
        });
        const accordion = page.getByText('Exportar reporte a Excel', { exact: true });
        await renderWindow(page, 'Abrir acordeón', () => accordion.press('Enter'));
        await renderWindow(page, 'Cerrar acordeón', () => accordion.press('Enter'));
        await renderWindow(page, 'Rutas rápidas', async () => {
          await page.evaluate(() => {
            for (const path of ['/equipo/alertas', '/equipo/ejercicios', '/equipo/deportistas']) {
              document.querySelector(`.nav a[href="${path}"]`).click();
            }
          });
          await page.waitForURL(base + '/equipo/deportistas');
        });
        const rows = page.locator('app-athlete-row a');
        const first = rows.filter({ has: page.getByText('deportista', { exact: true }) });
        const other = rows.filter({ has: page.getByText('otro', { exact: true }) });
        const target = await first.getAttribute('href');
        const otherTarget = await other.getAttribute('href');
        await renderWindow(page, 'Abrir ficha', async () => {
          await first.click();
          await page.waitForURL(base + target);
        });
        await renderWindow(page, 'Pestaña Evaluaciones', async () => {
          await page.locator('#section-evaluations').press('Enter');
          await page.waitForURL(base + target + '?tab=evaluations');
        });
        await renderWindow(page, 'Consulta de encuesta', async () => {
          await page.getByRole('link', { name: 'Ver encuestas' }).click();
          await page.waitForURL(base + target + '/encuestas');
        });
        await renderWindow(page, 'Expandir respuestas de encuesta', async () => {
          await page.getByRole('button', { name: 'Consultar respuestas' }).click();
          await page.getByText('En más de la mitad', { exact: true }).waitFor();
        });
        await go('/equipo/deportistas')();
        await renderWindow(page, 'Otra ficha', async () => {
          await rows.filter({ has: page.getByText('otro', { exact: true }) }).click();
          await page.waitForURL(base + otherTarget);
        });
      }
      if (role === 'entrenador') {
        await go('/equipo/deportistas')();
        await renderWindow(page, 'Ficha del entrenador', async () => {
          await page.locator('app-athlete-row a').first().click();
          await page.waitForURL(/\/equipo\/deportistas\/[^/]+$/);
        });
      }
      if (role === 'administracion') {
        await renderWindow(page, 'Abrir formulario', async () => {
          await page.getByRole('button', { name: 'Nuevo usuario' }).click();
          await page.getByRole('heading', { name: 'Nuevo usuario' }).waitFor();
        });
        await renderWindow(page, 'Cerrar formulario', () => page.getByRole('button', { name: 'Cancelar' }).click());
        await renderWindow(page, 'Filtro sin navegación', () => page.getByLabel('Buscar usuario').fill('deportista'));
        const logout = page.getByRole('button', { name: 'Cerrar sesión' }).filter({ visible: true });
        await renderWindow(page, 'Abrir modal', async () => {
          await logout.click();
          await page.getByRole('dialog').waitFor();
        });
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      assert.equal(documents.length, documentCount, role + ' navegación sin recarga');
      if (role === 'fisioterapia') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await toggle('light');
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        for (const [mode, next] of [['no-preference', 'dark'], ['no-preference', 'light'],
          ['reduce', 'dark'], ['reduce', 'light']]) {
          await page.emulateMedia({ colorScheme: 'light', reducedMotion: mode });
          const result = await renderWindow(page, 'Tema ' + mode, () => toggle(next), next);
          assert.equal(result.calls, mode === 'reduce' ? 0 : 1);
        }
        await page.reload();
        await page.locator('.sidebar .nav').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        assert.equal(documents.length, documentCount + 1);
      }
      assert.deepEqual(errors, [], role);
    } finally {
      await page.close();
    }
  }
  console.log(`Brave: ${journeys} navegaciones muestreadas cuadro a cuadro, más interacciones, historial y cambios de tema.`);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN ?? '/usr/bin/brave', args: ['--no-sandbox'] });
  try {
    if (process.argv.includes('--render')) {
      await stableNavigation(browser);
      return;
    }
    const publicPage = await browser.newPage();
    await passwordGeometry(publicPage);
    await auditLoginFeedback(publicPage);
    if (process.argv.includes('--navigation')) await registrationLayout(publicPage);
    if (precision || process.argv.includes('--navigation')) {
      await publicPage.close();
      if (process.argv.includes('--navigation')) await navigationStates(browser);
      await surveyNavigation(browser);
      console.log('Brave: autenticación, navegación y retorno por rol verificados.');
      return;
    }
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
    await athlete.setViewportSize({ width: 1440, height: 900 });
    await athlete.goto(base + '/deportista/progreso');
    const compliance = await athlete.getByRole('region', { name: 'Cumplimiento' }).boundingBox();
    const activity = await athlete.getByRole('region', { name: 'Actividad registrada' }).boundingBox();
    const chart = await athlete.getByRole('region', { name: 'Sesiones por semana' }).boundingBox();
    assert.ok(compliance && activity && chart);
    near(compliance.y, activity.y, 'Progreso, inicio de fila');
    near(compliance.height, activity.height, 'Progreso, altura de fila');
    near(activity.x + activity.width, chart.x + chart.width, 'Progreso, borde derecho');
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
