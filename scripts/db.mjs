// Sobe/derruba o PostgreSQL + PostGIS do projeto com um comando, via Docker Compose.
// Docker é obrigatório: o módulo geo depende do PostGIS, que não existe num PostgreSQL embutido.
import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 127.0.0.1, não "localhost": o Docker Desktop no Windows pode não encaminhar o IPv6 (::1).
const HOST = '127.0.0.1';
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

function requireDocker() {
  if (hasDocker()) return;
  console.error(
    'Docker não encontrado ou parado.\n' +
      'O AgroIntegra precisa do Docker para rodar o PostgreSQL com PostGIS (mapas e demarcação).\n' +
      'Instale o Docker Desktop (https://www.docker.com/products/docker-desktop/), abra-o e rode o comando de novo.',
  );
  process.exit(1);
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, HOST);
    socket.once('connect', () => { socket.end(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function connect(database) {
  const { default: pg } = await import('pg');
  for (let i = 0; ; i++) {
    const client = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database });
    try {
      await client.connect();
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      if (i > 30) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function createDatabases() {
  const client = await connect('postgres');
  try {
    // Se a porta já estava ocupada por outro PostgreSQL, ele precisa ter PostGIS.
    const { rowCount: postgis } = await client.query("SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'");
    if (!postgis) {
      throw new Error(
        `O PostgreSQL na porta ${PORT} não tem a extensão PostGIS. ` +
          'Pare esse banco e rode "npm run db:up" para subir o do projeto (docker-compose.yml).',
      );
    }
    for (const db of DATABASES) {
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
      if (!rowCount) await client.query(`CREATE DATABASE ${db}`);
    }
  } finally {
    await client.end();
  }
}

async function up() {
  if (await portOpen(PORT)) {
    console.log(`PostgreSQL já está rodando na porta ${PORT}.`);
  } else {
    requireDocker();
    console.log('Subindo PostgreSQL + PostGIS com docker compose...');
    execSync('docker compose up -d --wait', { cwd: root, stdio: 'inherit' });
  }
  await createDatabases();
  console.log(`Banco pronto em postgresql://${USER}:***@${HOST}:${PORT}/agrointegra`);
}

function down() {
  requireDocker();
  execSync('docker compose down', { cwd: root, stdio: 'inherit' });
}

const cmd = process.argv[2];
if (cmd === 'up') await up();
else if (cmd === 'down') down();
else { console.error('Uso: node scripts/db.mjs up|down'); process.exit(1); }
