// Todos los destinos se crean en un clúster nuevo. No se lee DATABASE_URL del proyecto.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const backend = resolve(__dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'luchasegura-catalog-'));
const data = join(temp, 'data');
const socket = join(temp, 'socket');
mkdirSync(socket);
const env = { ...process.env, DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test', MAIL_TRANSPORT: 'disabled' };

function run(file, args, extra = {}, input) {
  const result = spawnSync(file, args, { cwd: backend, env: { ...env, ...extra }, encoding: 'utf8', input });
  if (result.status !== 0) throw new Error(`${file}: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}

async function main() {
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise(resolve => listener.close(resolve));
  const databaseUrl = name => `postgresql://ls_catalog@127.0.0.1:${port}/${name}`;
  const sql = (url, statement) => run('psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1', url], {}, statement);
  const migrate = (url, schema) =>
    run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', schema], { DATABASE_URL: url });
  const create = name => {
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'ls_catalog', name]);
    const url = databaseUrl(name);
    assert.equal(sql(url, 'SELECT current_database();'), name);
    return url;
  };

  run('initdb', ['-D', data, '-U', 'ls_catalog', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  run('pg_ctl', ['-D', data, '-l', join(temp, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, '-w', 'start']);
  try {
    const clean = create('ls_catalog_clean_test');
    const upgrade = create('ls_catalog_upgrade_test');
    const from = join(backend, 'prisma/migrations');
    const migrations = join(temp, 'migrations');
    mkdirSync(migrations);
    const schema = join(temp, 'schema.prisma');
    writeFileSync(schema, 'datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n');
    for (const name of readdirSync(from).filter(name => name <= '20261119120000_exercise_library' || name === 'migration_lock.toml')) {
      cpSync(join(from, name), join(migrations, name), { recursive: true });
    }
    migrate(upgrade, schema);

    sql(upgrade, `
      INSERT INTO "User" (id, email, "passwordHash", "fullName", role)
          VALUES ('catalog-user','catalog@example.test','unused','Atleta sintético','ATHLETE');
      INSERT INTO "Athlete" (id,"userId","updatedAt") VALUES ('catalog-athlete','catalog-user',now());
      INSERT INTO "FunctionalTest" (id,"athleteId","testType",phase,result,"measuredAt")
          VALUES ('catalog-evaluation-old','catalog-athlete','Histórica sintética','INITIAL','{"original":42}','2025-12-01 03:30:00');
      INSERT INTO "Program" (id,name) VALUES ('catalog-program','Programa sintético');
      INSERT INTO "ProgramSession" (id,"programId",week,number) VALUES ('catalog-session','catalog-program',1,1);
      INSERT INTO "Exercise" (id,component,name,illustration)
          VALUES ('catalog-legacy','Estabilidad','Puente de glúteo','/exercises/puente.svg');
      INSERT INTO "SessionExercise" ("sessionId","exerciseId",position)
          VALUES ('catalog-session','catalog-legacy',0);
      INSERT INTO "ExerciseAssignment" (id,"athleteId","exerciseId",dosage,note)
          VALUES ('catalog-assignment','catalog-athlete','catalog-legacy','2','Nota sintética');
    `);
    const archives = "SELECT archived FROM \"Exercise\" WHERE id='catalog-legacy';";
    assert.equal(sql(upgrade, archives), 'f');
    migrate(upgrade, 'prisma/schema.prisma');
    assert.equal(sql(upgrade, archives), 't');
    assert.equal(sql(upgrade, 'SELECT "exerciseId" FROM "SessionExercise" WHERE "sessionId"=\'catalog-session\';'), 'catalog-legacy');
    assert.equal(sql(upgrade, 'SELECT "exerciseId",dosage,note FROM "ExerciseAssignment" WHERE id=\'catalog-assignment\';'),
      'catalog-legacy|2|Nota sintética');
    const active = 'SELECT id || \'|\' || illustration FROM "Exercise" WHERE "isBase" AND NOT archived ORDER BY id;';
    const previous = sql(upgrade, active);
    assert.match(previous, /gym-banca-barra\|\/exercises\/banca-barra\.svg/);
    migrate(upgrade, 'prisma/schema.prisma');
    assert.equal(sql(upgrade, active), previous);
    migrate(clean, 'prisma/schema.prisma');
    assert.equal(sql(clean, active), previous);
    const assets = new Set(readdirSync(join(backend, '../frontend/public/exercises')));
    assert.equal([...assets].filter(name => name.endsWith('.svg')).length, 40);
    for (const [, path] of previous.split('\n').map(record => record.split('|'))) {
      assert.ok(path.startsWith('/exercises/') && assets.has(path.substring('/exercises/'.length)), path);
    }

    function seed() {
      for (const file of ['seed.ts', 'seed-program.ts', 'seed-team.ts']) {
        run(process.execPath, ['--import', 'tsx', 'prisma/' + file], { DATABASE_URL: clean });
      }
    }
    const census = 'SELECT (SELECT count(*) FROM "User"), (SELECT count(*) FROM "ProgramSession"), (SELECT count(*) FROM "Injury"), (SELECT count(*) FROM "CompletedSession");';
    seed();
    const sample = sql(clean, census);
    assert.equal(sample.split('|')[1], '24');
    seed();
    assert.equal(sql(clean, census), sample);
    assert.equal(sql(clean, active), previous);

    const legacyEvaluation = `SELECT "testType", result->>'original', "measuredAt", version,
      "programId" IS NULL FROM "FunctionalTest" WHERE id='catalog-evaluation-old';`;
    assert.equal(sql(upgrade, legacyEvaluation), 'Histórica sintética|42|2025-12-01 03:30:00|0|t');
    sql(upgrade, `
      INSERT INTO "User" (id,email,"passwordHash","fullName",role)
          VALUES ('catalog-physio','catalog-physio@example.test','unused','Fisioterapia sintética','PHYSIO');
      INSERT INTO "FunctionalTest" (id,"athleteId","testType",phase,result,"programId","interventionStartedAt",version)
          VALUES ('catalog-evaluation-new','catalog-athlete','T_TEST','FINAL','{"measurements":[{"value":10}]}','catalog-program','2025-12-02',2);
      INSERT INTO "FunctionalTestRevision" ("operationId","testId",version,"authorId","authorName","measuredOn",result,fingerprint)
          VALUES ('operation-1','catalog-evaluation-new',1,'catalog-physio','Fisioterapia sintética','2026-01-27','{"measurements":[{"value":10}]}','synthetic'),
                 ('operation-2','catalog-evaluation-new',2,'catalog-physio','Fisioterapia sintética','2026-01-28','{"measurements":[{"value":10}]}','synthetic');
    `);
    const restored = create('ls_catalog_restore_test');
    const dump = join(temp, 'catalog-test.dump');
    run('pg_dump', ['--format=custom', '--file', dump, upgrade]);
    run('pg_restore', ['--exit-on-error', '--no-owner', '--dbname', restored, dump]);
    assert.equal(sql(restored, active), previous);
    assert.equal(sql(restored, archives), 't');
    assert.equal(sql(restored, 'SELECT count(*) FROM "SessionExercise";'), '1');
    assert.equal(sql(restored, 'SELECT count(*) FROM "ExerciseAssignment";'), '1');
    assert.equal(sql(restored, legacyEvaluation), sql(upgrade, legacyEvaluation));
    assert.equal(sql(restored, 'SELECT version, "measuredOn" FROM "FunctionalTestRevision" ORDER BY version;'),
      '1|2026-01-27\n2|2026-01-28');
    console.log('Catálogo y evaluaciones: instalación limpia, actualización histórica, deploy y seeds repetidos, 40 SVG y restauración sintética correctos.');
  } finally {
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
