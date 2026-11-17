// Aplica as migrações no banco de teste (os testes limpam as tabelas que usam).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.test', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const target = new URL(env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !/^\/[a-z0-9_]+_test$/.test(target.pathname)) {
  throw new Error('Migrations de teste exigem banco local com nome terminado em _test.');
}
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, ...env },
});
