# AgroIntegra — demo

Versão de demonstração do sistema de assistência técnica rural. Veja `CLAUDE.md` e `docs/plano_mvp_agrointegra.md`.

## Como rodar

Requisitos: Node.js 22 ou mais novo. Docker é opcional.

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run setup        # sobe o banco, aplica as migrações e cria os usuários da demo
npm run dev:api      # API em http://localhost:3001
npm run dev:web      # painel em http://localhost:3000 (outro terminal)
```

Usuários da demo (fictícios), senha `demo1234`:

- `coordenacao@agrointegra.demo`: perfil Coordenação
- `tecnico@agrointegra.demo`: perfil Técnico

## Banco de dados

- `npm run db:up` sobe o PostgreSQL na porta 5433 e cria os bancos `agrointegra` e `agrointegra_test`.
- `npm run db:down` para o banco.
- Com Docker, usa o `docker-compose.yml`. Sem Docker, usa um PostgreSQL local (pacote `embedded-postgres`), com dados em `.pgdata/` e log em `.pgdata/server.log`.

## Testes

```bash
npm test             # testes e2e da API, no banco agrointegra_test
```
