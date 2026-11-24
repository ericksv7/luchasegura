const { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');

const [from, to, before, extraBefore] = process.argv.slice(2);
if (!from || !to) throw new Error('Uso: node backend/tests/visual/artifacts.cjs RESULTADOS DESTINO [ANTES] [ANTES_ADICIONAL]');
const source = resolve(from);
const destination = resolve(to);
const result = JSON.parse(readFileSync(join(source, 'resultados.json'), 'utf8'));
const imageDir = join(destination, 'capturas');
const gallery = join(destination, 'galeria');
mkdirSync(imageDir, { recursive: true });
mkdirSync(gallery, { recursive: true });

const roleNames = { GUEST: 'Público', ATHLETE: 'Deportista', PHYSIO: 'Fisioterapia', COACH: 'Entrenador', ADMIN: 'Administración' };
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const cell = value => String(value ?? '—').replaceAll('|', '\\|');
const mainRoutes = result.matrix.filter(row => !row.path.includes(' · '));
const inventory = result.entries.map(entry => {
  const checks = mainRoutes.filter(row => row.role === entry.role && row.path === entry.path);
  const state = entry.state ?? entry.headings?.[0];
  return `| \`${entry.path}\` | ${roleNames[entry.role]} | \`${entry.component}\` | ${entry.forms} | ${cell(state)} | ${cell(entry.actions.join(', ') || null)} | ${checks.length} |`;
});
writeFileSync(join(destination, 'INVENTARIO.md'), [
  '# Inventario de rutas', '',
  'Generado desde el arreglo de rutas Angular y la vista abierta con cada cuenta. Los formularios y acciones se cuentan en el estado inicial. Las comprobaciones combinan ancho y tema.',
  '', '| Ruta | Rol | Componente | Formularios | Encabezado o estado | Acciones visibles | Comprobaciones |',
  '|---|---|---|---:|---|---|---:|', ...inventory, '',
].join('\n'));

const representative = new Map([
  ['guest_registro_390_light.png', false],
  ['guest_olvide-contrasena_390_light.png', true],
  ['athlete_deportista-bienestar_390_light.png', false],
  ['coach_equipo-deportistas-id_390_light.png', true],
  ['admin_admin_390_light.png', true],
  ['physio_equipo_1440_dark.png', true],
  ['physio_equipo-alertas-id_390_light.png', true],
  ['physio_equipo-informes-programa_1440_dark.png', false],
]);
const figures = [];
for (const item of result.captures) {
  if (!representative.has(item.name)) continue;
  const caption = `${roleNames[item.role]} · ${item.path} · ${item.width} × ${item.height} · ${item.theme === 'dark' ? 'Oscuro' : 'Claro'}`;
  copyFileSync(join(source, item.name), join(imageDir, item.name));
  const prior = representative.get(item.name) && [before, extraBefore].filter(Boolean)
    .map(directory => resolve(directory, item.name)).find(existsSync);
  if (prior) copyFileSync(prior, join(imageDir, 'antes_' + item.name));
  const render = (name, state) => `<figure><a href="../capturas/${name}"><img src="../capturas/${name}" loading="lazy" alt="${escapeHtml(caption + ' · ' + state)}"></a><figcaption>${state}</figcaption></figure>`;
  figures.push(`<section><h2>${escapeHtml(caption)}</h2><p>${escapeHtml(item.state)}</p><div class="images">${prior ? render('antes_' + item.name, 'Antes') : ''}${render(item.name, 'Fase 11')}</div></section>`);
}

writeFileSync(join(gallery, 'index.html'), `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Galería visual · LuchaSegura</title>
<style>
:root {color-scheme:light dark}
body {margin: auto; max-width: 72rem; padding: 1.25rem; font: 1rem/1.5 system-ui,sans-serif}
section {border-top:1px solid; padding-block:1rem}
h2 {font-size:1.125rem; overflow-wrap:anywhere}
.images {display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));align-items:start}
figure {margin:0} img {display:block;width:100%;height:auto;max-height:36rem;object-fit:contain}
figcaption {text-align:center;padding:.4rem}
a:focus-visible {outline:.15rem solid;outline-offset:.2rem}
</style>
<h1>Galería visual de LuchaSegura</h1><p>Capturas sintéticas en Brave. Abre una imagen para verla a tamaño completo.</p>
${figures.join('\n')}
</html>\n`);
