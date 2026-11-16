// Aplica as migrações no banco de teste (os testes limpam as tabelas que usam).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.test', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, ...env },
});
