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
    const deadline = performance.now() + 30_000;
    while (performance.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`npm start terminó antes de responder (${child.exitCode ?? child.signalCode})`);
      }
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(3_000),
      }).catch(() => null);
      if (unavailable && response?.status === 503) {
        const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5_000),
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
    throw new Error('npm start no respondió correctamente en /api/health dentro del plazo de 30 segundos');
  } finally {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await stopped;
  }
}

(async () => {
  const browserOnly = process.argv.includes('--browser-only');
  const mailOnly = process.argv.includes('--mail-only');
  const wellbeingBrowser = process.argv.includes('--wellbeing-browser');
  const mailBrowser = process.argv.includes('--mail-browser') || process.env.MAIL_BROWSER === '1';
  const temp = mkdtempSync(join(tmpdir(), 'luchasegura-alert-tests-'));
  const data = join(temp, 'data');
  const socket = join(temp, 'socket'); mkdirSync(socket);
  const port = await freePort();
  const env = { ...process.env, DOTENV_CONFIG_PATH: '/dev/null', DATABASE_URL: `postgresql://ls_test@127.0.0.1:${port}/luchasegura_alert_test`,
    JWT_SECRET: 'alert-tests-only-secret-with-at-least-32-characters', NODE_ENV: 'test', ALERT_REVIEW_TESTS: '1', MAIL_TRANSPORT: 'disabled' };
  let started = false;
  try {
    run('initdb', ['-D', data, '-U', 'ls_test', '--auth=trust', '--no-locale', '--encoding=UTF8'], env);
    run('pg_ctl', ['-D', data, '-l', join(temp, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket} -F`, '-w', 'start'], env);
    started = true;
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'ls_test', 'luchasegura_alert_test'], env);
    const connected = spawnSync('psql', ['-XAt', env.DATABASE_URL, '-c',
      "SELECT current_database(), inet_server_port(), current_setting('data_directory')"], { env, encoding: 'utf8' });
    if (connected.status !== 0 || connected.stdout.trim() !== `luchasegura_alert_test|${port}|${data}`) {
      throw new Error('El servidor no confirmó el destino PostgreSQL temporal.');
    }
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
INSERT INTO "Injury" (id,"athleteId","bodyZone","isHistory","occurredAt","createdAt")
VALUES ('legacy-history-no-date','00000000-0000-4000-8000-000000000002','Hombro',true,'2026-11-20 00:30','2026-11-20 00:30'),
       ('legacy-history-with-date','00000000-0000-4000-8000-000000000002','Cuello',true,'2026-11-01 00:00','2026-11-20 00:30');
INSERT INTO "Alert" (id,"injuryId",status) VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','REVIEWED');
INSERT INTO "Exercise" (id, name, component, dosage, description)
VALUES ('legacy-plancha-fixture', 'Plancha frontal', 'Estabilidad', '4 × 15 s', 'Descripción previa de prueba');
INSERT INTO "Exercise" (id, name, component, "mediaUrl")
VALUES ('legacy-custom-fixture', 'Ejercicio histórico de prueba', 'Movilidad', 'https://youtu.be/12345678901');
INSERT INTO "Exercise" (id, name, component)
VALUES ('legacy-bridge-fixture', 'Puente de glúteo', 'Estabilidad'),
       ('legacy-technique-fixture', 'Técnica personalizada de prueba', 'Técnica');
INSERT INTO "ExerciseAssignment" (id, "athleteId", "exerciseId", dosage, note)
VALUES ('legacy-bridge-assignment', '00000000-0000-4000-8000-000000000002', 'legacy-bridge-fixture',
        'Dosis anterior', 'Indicación anterior');`);
    run('psql', [env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', legacy], env);
    for (const name of all.filter(name => name >= reviewMigration)) {
      cpSync(join(root, 'prisma/migrations', name), join(migrations, name), { recursive: true });
    }
    run(process.execPath, [prisma, 'migrate', 'deploy', '--schema', schema], env);
    if (process.argv.includes('--wellbeing-only')) {
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/wellbeing.test.ts'], env);
      return;
    }
    if (!browserOnly && !mailOnly && !wellbeingBrowser) {
      console.log('Integración API, Excel y seguridad (PostgreSQL temporal).');
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/alert-reviews.test.ts'], env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/team-export.test.ts'], env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/security.test.ts', 'tests/wellbeing.test.ts'], env);
    }
    if (!browserOnly && !wellbeingBrowser) {
      console.log(mailBrowser
        ? 'Integración SMTP TLS en loopback con navegador obligatorio.'
        : 'Integración SMTP TLS en loopback. Navegador no solicitado (usa --mail-browser para exigirlo).');
      const cert = join(temp, 'smtp-cert.pem');
      const key = join(temp, 'smtp-key.pem');
      run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
        '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], env);
      run(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', 'tests/mail-recovery.test.ts'],
        { ...env, MAIL_BROWSER: mailBrowser ? '1' : '0', NODE_EXTRA_CA_CERTS: cert, SMTP_FIXTURE_KEY: key });
      if (process.argv.includes('--availability')) await checkProductionStart(env, true);
    }
    if (browserOnly || wellbeingBrowser || process.argv.includes('--browser')) {
      run(process.execPath, [prisma, 'migrate', 'status', '--schema', schema], env);
      run(process.execPath, [prisma, 'migrate', 'diff', '--from-schema-datasource', schema,
        '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], env);
      await checkProductionStart(env);
      const browserTest = join(root, 'node_modules/tsx/dist/cli.mjs');
      if (!wellbeingBrowser) run(process.execPath, [browserTest, 'tests/alert-review-browser.ts'], env);
      if (wellbeingBrowser || (env.DISCLOSURE_VISUAL !== '1' && env.EVALUATIONS_BROWSER_ONLY !== '1')) {
        run(process.execPath, [browserTest, 'tests/wellbeing-browser.ts'], env);
      }
    }
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], env);
    console.log('Clúster temporal detenido. Archivos de prueba:', temp);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
