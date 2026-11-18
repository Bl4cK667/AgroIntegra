# AgroIntegra — demo

Versão de demonstração do sistema de assistência técnica rural. Veja [o plano do MVP](docs/plano_mvp_agrointegra.md).

O [cadastro fechado por convite](docs/cadastro-por-convite.md) está implementado com área administrativa, vínculo de organização e integração server-only com Supabase Auth. O documento explica ativação, segurança e testes. Supabase Auth/cadastro remoto permanecem desativados até configurar e homologar o projeto. O [plano anterior de preparação](docs/preparacao-supabase.md) registra a arquitetura de partida.

## Como rodar

Requisitos: Node.js 22 ou mais novo. Docker é opcional.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run setup        # sobe o banco, gera o Prisma Client, aplica as migrações e cria os usuários da demo
npm run demo:reset   # carrega os dados fictícios da demonstração (apaga os atendimentos atuais)
npm run dev          # API (http://localhost:3001) e painel (http://localhost:3000) juntos; Ctrl+C encerra os dois
```

Usuários da demo (fictícios), senha `demo1234`:

- `coordenacao@agrointegra.demo`: perfil Coordenação
- `tecnico@agrointegra.demo`: perfil Técnico
- `admin@agrointegra.demo`, senha `admin`: perfil Coordenação, só para uso local

## Demonstração

- Roteiro de 15 minutos: `docs/roteiro_demo.md`.
- Gravação de backup do ensaio: `docs/demo/ensaio-demo.mp4`.
- `npm run demo:reset` recria os dados fictícios com datas relativas a hoje: 140 produtores em 7 comunidades inventadas, visitas desde janeiro, solicitações em todas as colunas e 4 programas. Rode no dia da apresentação e depois de cada ensaio.
- Usuários extras (técnicos): `tecnico2@agrointegra.demo` e `tecnico3@agrointegra.demo`, mesma senha.

## Banco de dados

- `npm run db:up` sobe o PostgreSQL na porta 5433 e cria os bancos `agrointegra` e `agrointegra_test`.
- `npm run db:down` para o banco.
- Com Docker, usa o `docker-compose.yml`. Sem Docker, usa um PostgreSQL local (pacote `embedded-postgres`), com dados em `.pgdata/` e log em `.pgdata/server.log`.

## Testes

```bash
npm test             # testes e2e da API, no banco agrointegra_test
```
