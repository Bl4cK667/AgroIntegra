// Validates migrations in a brand-new PostgreSQL process under the OS temporary directory.
// Never reads DATABASE_URL/.env, never connects to the application database, creates no users.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = await new Promise((resolve, reject) => {
  const reservation = net.createServer();
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', () => {
    const allocated = reservation.address().port;
    reservation.close(() => resolve(allocated));
  });
});
const databaseDir = await mkdtemp(path.join(os.tmpdir(), 'agrointegra-registration-'));
const password = randomBytes(24).toString('hex');
const postgres = new EmbeddedPostgres({
  databaseDir, port, user: 'verification', password, persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1', '-k', databaseDir],
  onLog() {}, onError() {},
});
let client;
try {
  await postgres.initialise();
  await postgres.start();
  client = postgres.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  // Test the Supabase-specific branch without touching any roles in an existing server.
  await client.query('CREATE ROLE anon NOLOGIN NOBYPASSRLS');
  await client.query('CREATE ROLE authenticated NOLOGIN NOBYPASSRLS');
  const databaseUrl = `postgresql://verification:${password}@127.0.0.1:${port}/postgres`;
  await new Promise((resolve, reject) => {
    const process = spawn(path.join(root, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
      cwd: path.join(root, 'apps', 'api'),
      env: { ...globalThis.process.env, DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    process.stdout.on('data', (chunk) => { output += chunk; });
    process.stderr.on('data', (chunk) => { output += chunk; });
    process.once('error', reject);
    process.once('exit', (code) => code === 0 ? resolve() : reject(new Error(output.replaceAll(password, '[redacted]'))));
  });
  const counts = await client.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Organization")::int AS organizations');
  assert.deepEqual(counts.rows[0], { users: 0, organizations: 1 });
  const rls = await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity");
  assert.equal(rls.rows[0].count, 14);
  const privileges = await client.query("SELECT has_table_privilege('authenticated', 'public.\"User\"', 'SELECT') AS users, has_table_privilege('anon', 'public.\"Invitation\"', 'SELECT') AS invitations");
  assert.deepEqual(privileges.rows[0], { users: false, invitations: false });
  await client.query('SET ROLE authenticated');
  await assert.rejects(client.query('SELECT "passwordHash" FROM "User"'), (error) => error.code === '42501');
  await assert.rejects(client.query('SELECT "tokenHash" FROM "Invitation"'), (error) => error.code === '42501');
  await client.query('RESET ROLE');
  const foreignKeys = await client.query("SELECT count(*)::int AS count FROM pg_constraint WHERE contype='f' AND cardinality(conkey)=2");
  assert.equal(foreignKeys.rows[0].count, 11);
  console.log('Migrations aplicadas no PostgreSQL temporário: 14 tabelas com RLS, 11 FKs compostas, segredos bloqueados para anon/authenticated, nenhuma conta criada.');
} finally {
  if (client) await client.end().catch(() => {});
  await postgres.stop();
}
