// Sobe/derruba o PostgreSQL da demo com um comando.
// Usa Docker Compose quando o Docker existe; senão, um PostgreSQL local via embedded-postgres.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.pgdata');
const logFile = path.join(dataDir, 'server.log');

// Caminho do pg_ctl que vem no pacote binário do embedded-postgres para esta plataforma.
function pgCtl() {
  const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
  const pkg = `@embedded-postgres/${os}-${process.arch}`;
  const dir = path.join(root, 'node_modules', pkg);
  return path.join(dir, 'native', 'bin', process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
}
const PORT = 5433;
const USER = 'agro';
const PASSWORD = 'agro';
const DATABASES = ['agrointegra', 'agrointegra_test'];

function hasDocker() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.end(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitPort(port, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`PostgreSQL não respondeu na porta ${port}`);
}

async function createDatabases() {
  const { default: pg } = await import('pg');
  let client;
  for (let i = 0; ; i++) {
    client = new pg.Client({ host: '127.0.0.1', port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    try { await client.connect(); break; } catch (e) {
      await client.end().catch(() => {});
      if (i > 30) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  for (const db of DATABASES) {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (!rowCount) await client.query(`CREATE DATABASE ${db}`);
  }
  await client.end();
}

async function up() {
  if (await portOpen(PORT)) {
    console.log(`PostgreSQL já está rodando na porta ${PORT}.`);
    await createDatabases();
    return;
  }
  if (hasDocker()) {
    console.log('Docker encontrado: subindo com docker compose...');
    execSync('docker compose up -d --wait', { cwd: root, stdio: 'inherit' });
  } else {
    console.log('Docker não encontrado: subindo PostgreSQL local (embedded-postgres)...');
    const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
    mkdirSync(dataDir, { recursive: true });
    if (fresh) {
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: USER, password: PASSWORD, port: PORT, persistent: true,
        initdbFlags: ['--encoding=UTF8', '--locale=C'] });
      await pg.initialise();
    }
    // pg_ctl inicia o servidor como processo independente: ele continua rodando depois que este comando termina.
    execFileSync(pgCtl(), ['start', '-w', '-D', dataDir, '-l', logFile, '-o', `-p ${PORT}`], { stdio: 'ignore' });
    await waitPort(PORT);
  }
  await createDatabases();
  console.log(`Banco pronto em postgresql://${USER}:***@localhost:${PORT}/agrointegra`);
}

async function down() {
  if (hasDocker()) {
    execSync('docker compose down', { cwd: root, stdio: 'inherit' });
    return;
  }
  if (!existsSync(path.join(dataDir, 'postmaster.pid'))) { console.log('Nenhum banco local rodando.'); return; }
  execFileSync(pgCtl(), ['stop', '-w', '-m', 'fast', '-D', dataDir], { stdio: 'ignore' });
  console.log('Banco parado.');
}

const cmd = process.argv[2];
if (cmd === 'up') await up();
else if (cmd === 'down') await down();
else { console.error('Uso: node scripts/db.mjs up|down'); process.exit(1); }
