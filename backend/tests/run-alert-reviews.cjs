// Solo usa un clúster PostgreSQL nuevo en /tmp; nunca lee DATABASE_URL del proyecto.
const { mkdtempSync, mkdirSync, writeFileSync, cpSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const root = resolve(__dirname, '..');
function run(cmd, args, env) {
  const result = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${cmd} terminó con código ${result.status}`);
}
async function freePort() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function checkProductionStart(env, unavailable = false) {
  const port = await freePort();
  const dbUrl = new URL(env.DATABASE_URL);
  if (unavailable) {
    dbUrl.port = String(await freePort());
    dbUrl.searchParams.set('connect_timeout', '2');
  }
  const child = spawn('npm', ['start'], {
    cwd: root, env: { ...env, DATABASE_URL: dbUrl.href, NODE_ENV: 'production', PORT: String(port) }, detached: true, stdio: 'inherit'
  });
  const stopped = once(child, 'exit');
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (child.exitCode !== null) break;
      const response = await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => null);
      if (unavailable && response?.status === 503) {
        const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'offline@example.test', password: 'fixture-only' })
        });
        const { error } = await login.json();
        if (login.status !== 503 || error !== 'El servicio de datos no está disponible temporalmente') {
          throw new Error('La indisponibilidad de PostgreSQL no produjo la respuesta pública esperada');
        }
        console.log('PostgreSQL inaccesible: 503 en salud y autenticación sin exponer la conexión.');
        return;
      }
      if (!unavailable && response?.ok && (await response.json()).database === 'ok') {
        console.log('Inicio de producción y conexión PostgreSQL verificados mediante /api/health.');
        return;
      }
      await delay(100);
    }
    throw new Error('npm start no respondió correctamente en /api/health');
  } finally {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await stopped;
  }
}

(async () => {
  const temp = mkdtempSync(join(tmpdir(), 'luchasegura-alert-tests-'));
  const data = join(temp, 'data');
  const socket = join(temp, 'socket'); mkdirSync(socket);
  const port = await freePort();
  const env = { ...process.env, DATABASE_URL: `postgresql://ls_test@127.0.0.1:${port}/luchasegura_alert_test`,
    JWT_SECRET: 'alert-tests-only-secret-with-at-least-32-characters', NODE_ENV: 'test', ALERT_REVIEW_TESTS: '1' };
  let started = false;
  try {
    run('initdb', ['-D', data, '-U', 'ls_test', '--auth=trust', '--no-locale', '--encoding=UTF8'], env);
    run('pg_ctl', ['-D', data, '-l', join(temp, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket} -F`, '-w', 'start'], env);
    started = true;
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'ls_test', 'luchasegura_alert_test'], env);
    const schema = join(temp, 'schema.prisma');
    writeFileSync(schema, 'datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n');
    const migrations = join(temp, 'migrations'); mkdirSync(migrations);
    const all = readdirSync(join(root, 'prisma/migrations')).filter(n => /^\d/.test(n)).sort();
    const reviewMigration = '20261117140000_alert_review_history';
    for (const name of [...all.filter(name => name < reviewMigration), 'migration_lock.toml']) cpSync(join(root, 'prisma/migrations', name), join(migrations, name), { recursive: true });
    const prisma = join(root, 'node_modules/prisma/build/index.js');
    run(process.execPath, [prisma, 'migrate', 'deploy', '--schema', schema], env);
    const legacy = join(temp, 'legacy.sql');
    writeFileSync(legacy, `INSERT INTO "User" (id,email,"passwordHash","fullName",role) VALUES ('00000000-0000-4000-8000-000000000001','legacy@example.test','test-only','Registro previo','ATHLETE');
INSERT INTO "Athlete" (id,"userId","updatedAt") VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',now());
INSERT INTO "Injury" (id,"athleteId","bodyZone") VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Zona de prueba');
INSERT INTO "Alert" (id,"injuryId",status) VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','REVIEWED');`);
    run('psql', [env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', legacy], env);
    for (const name of all.filter(name => name >= reviewMigration)) {
      cpSync(join(root, 'prisma/migrations', name), join(migrations, name), { recursive: true });
    }
    run(process.execPath, [prisma, 'migrate', 'deploy', '--schema', schema], env);
    const browserOnly = process.argv.includes('--browser-only');
    if (!browserOnly) {
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/alert-reviews.test.ts'], env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/team-export.test.ts'], env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/security.test.ts'], env);
      if (process.argv.includes('--availability')) await checkProductionStart(env, true);
    }
    if (browserOnly || process.argv.includes('--browser')) {
      run(process.execPath, [prisma, 'migrate', 'status', '--schema', schema], env);
      run(process.execPath, [prisma, 'migrate', 'diff', '--from-schema-datasource', schema,
        '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], env);
      await checkProductionStart(env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), 'tests/alert-review-browser.ts'], env);
    }
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], env);
    console.log('Clúster temporal detenido. Archivos de prueba:', temp);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
