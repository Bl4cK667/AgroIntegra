# AgroIntegra — demo

Versão de demonstração do sistema de assistência técnica rural. Veja [o plano do MVP](docs/plano_mvp_agrointegra.md).

O [cadastro fechado por convite](docs/cadastro-por-convite.md) está implementado com área administrativa, vínculo de organização e integração server-only com Supabase Auth. O documento explica ativação, segurança e testes. Supabase Auth/cadastro remoto permanecem desativados até configurar e homologar o projeto. O [plano anterior de preparação](docs/preparacao-supabase.md) registra a arquitetura de partida.

## Como rodar

Requisitos: Node.js 22 ou mais novo e **Docker** (Docker Desktop no Windows/macOS). O Docker é obrigatório: o banco usa PostgreSQL + PostGIS para os mapas e a demarcação de propriedades.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run setup        # sobe o banco, gera o Prisma Client, aplica as migrações e cria os usuários da demo
npm run demo:reset   # carrega os dados fictícios da demonstração (apaga os atendimentos atuais) + demarcação no mapa
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

- `npm run db:up` sobe o PostgreSQL 16 + PostGIS 3.5 (`docker-compose.yml`, imagem `postgis/postgis:16-3.5-alpine`) na porta 5433 e cria os bancos `agrointegra` e `agrointegra_test`.
- `npm run db:down` para o banco.
- Sem Docker o comando para com uma mensagem explicando como instalar. Se a porta 5433 já estiver ocupada por outro PostgreSQL, ele precisa ter a extensão PostGIS.
- Use `127.0.0.1` (e não `localhost`) no `DATABASE_URL`: no Docker Desktop do Windows a porta pode não ser encaminhada em IPv6.

## Documentação da API (OpenAPI)

Com a API rodando: interface em http://localhost:3001/docs e especificação em http://localhost:3001/docs/openapi.json.
Para testar rotas protegidas na interface, faça login em `POST /auth/login` e use o `accessToken` em **Authorize**.

- `API_DOCS_ENABLED` (em `apps/api/.env`): `true` liga, `false` desliga. Sem valor, fica ligada fora de produção (`NODE_ENV` diferente de `production`).
- Em produção, deixe desligada ou restrinja o acesso.

## Módulo geo: mapa, demarcação, importação e exportação

O banco calcula área (ha), perímetro (m) e comprimento (m) sobre o elipsoide (PostGIS, `geography`). A área declarada da propriedade (documento do CAR) continua separada da calculada.

| Rota | Para quê |
| --- | --- |
| `GET /properties/geojson` | Mapa territorial: propriedade demarcada sai como polígono; sem demarcação, sai como ponto (lat/lng digitada). Filtros: `community`, `mainActivity`, `programId`, `technicianId`, `requestStatus` (`OPEN` = não concluída), `bbox`, `limit`. Sem CPF. |
| `GET /properties/geojson/filters` | Valores existentes para os filtros. |
| `GET /properties/near?lat&lng&radius` | Propriedades num raio em metros (máximo 50 km). |
| `GET`/`POST /properties/:id/features` | Feições da propriedade: perímetro, talhão, APP, reserva legal, sede, benfeitoria, água, estrada. |
| `GET`/`PATCH`/`DELETE /features/:id` | Uma feição. `PATCH` aceita `expectedVersion` (responde 409 se outra pessoa salvou antes). Excluir é da coordenação ou de quem desenhou. |
| `GET /features/:id/history` | Versões da demarcação, inclusive a exclusão. |
| `POST /features/validate` | Valida e, se inválida, propõe correção (`ST_MakeValid`) sem gravar. |
| `POST /properties/:id/features/import?dryRun=true` | Relatório por feição sem gravar. Sem `dryRun`, grava tudo ou nada (422 com o relatório se algo estiver errado). Recebe GeoJSON: KML/KMZ/Shapefile são convertidos no navegador. |
| `GET /properties/:id/features/export?format=` | `geojson`, `kml`, `kmz` ou `shp`. |

**No painel**

- **Cadastro do produtor:** a seção opcional "Primeira propriedade e demarcação" permite desenhar o perímetro sobre o satélite (ou importar o arquivo do CAR) já no cadastro. O mesmo campo aparece em "Adicionar/Editar propriedade" na página do produtor.
- **Mapa da propriedade** (`/propriedades/:id/mapa`): todas as feições, edição com histórico de versões, importação e exportação.
- **Mapa territorial** (`/mapa`, no menu): propriedades por comunidade, produção, programa, técnico e situação do atendimento.
- A área declarada (digitada) e a demarcada (calculada) aparecem lado a lado nas listas de propriedades.

**Configuração do mapa** (`apps/web/.env.local`, tudo opcional; ver `apps/web/.env.example`)

| Variável | Padrão |
| --- | --- |
| `NEXT_PUBLIC_MAP_SATELLITE_URL` | Esri World Imagery. Os termos da Esri restringem o uso do endereço público fora dos produtos dela: para produção, use conta Esri ou MapTiler. |
| `NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION` | Atribuição da Esri (sempre visível no mapa). |
| `NEXT_PUBLIC_MAP_SATELLITE_MAXZOOM` | `17`. Acima disso o mapa amplia a última imagem (a Esri não tem zoom maior em boa parte do Pará). |
| `NEXT_PUBLIC_MAP_LABELS_URL` | Rótulos e limites municipais da Esri; `none` desliga. |
| `NEXT_PUBLIC_MAP_DEFAULT_CENTER` / `_ZOOM` | Canaã dos Carajás (PA), município do piloto: `-49.8786,-6.4966`, zoom `11`. |

O `npm run dev` e o `npm run build` do web copiam o worker do MapLibre para `apps/web/public/maplibre/` (arquivo gerado, fora do git). Sem ele, o mapa mostra o satélite mas nenhuma camada.

**Dados de demonstração:** `npm run demo:geo` (já incluído no `demo:reset`) desenha perímetros, talhões, sedes e córregos **fictícios** para as propriedades da demo, na zona rural a sudeste de Canaã dos Carajás. As formas são sorteadas com semente fixa e não representam imóveis reais.

**Compatibilidade com CAR/SICAR e SIGEF**

- `format=shp` gera um zip com um shapefile por tema (`AREA_IMOVEL`, `APP`, `RESERVA_LEGAL`, `TALHAO`, ...), em SIRGAS 2000 geográfico (EPSG:4674), com `.prj` e `.cpg` (UTF-8). No SICAR, cada tema é importado separadamente.
- As coordenadas são registradas em WGS 84 e exportadas sem transformação: a diferença para o SIRGAS 2000 é de centímetros.
- Para o SIGEF, o sistema importa a parcela baixada do próprio SIGEF ou do CAR (Shapefile/KML) e exporta o perímetro para o profissional credenciado. O envio oficial (planilha de vértices) continua fora do escopo.
- Os arquivos são apoio técnico: não substituem o cadastro no CAR nem a certificação no SIGEF. Validar com a agrônoma da secretaria antes do piloto.

## Sincronização offline (módulo sync)

Base para o app do técnico trabalhar sem sinal (`apps/api/src/sync`). As duas rotas exigem login e valem para os dois perfis.

**`POST /sync/push`**: até 50 operações por lote, aplicadas na ordem enviada, cada uma independente das outras.

```json
{ "operations": [
  { "entity": "producer", "op": "upsert", "id": "<uuid v4 do aparelho>", "updatedAt": "2026-11-18T13:05:00.000Z",
    "data": { "name": "Maria", "cpf": "123.456.789-09", "community": "Serra Dourada", "consent": true } },
  { "entity": "feature", "op": "upsert", "id": "<uuid>", "updatedAt": "...", "baseUpdatedAt": "<updatedAt recebido do servidor>",
    "data": { "geometry": { "type": "Polygon", "coordinates": [[...]] } } }
] }
```

| Entidade | Operações | `data` |
| --- | --- | --- |
| `producer` | upsert | criar: como `POST /producers`; alterar: só os campos que mudaram. O CPF não muda. |
| `property` | upsert | criar: `producerId` + campos de `POST /producers/:id/properties`; alterar: como `PATCH /properties/:id`. |
| `visit` | upsert (só cria) | como `POST /visits`, **sem `photos`** (as fotos irão separadas, num passo seguinte). |
| `feature` | upsert, delete | criar: `propertyId`, `type`, `name`, `geometry`; alterar: `name` e/ou `geometry`. |

Resultado de cada operação: `applied`, `duplicate` (reenvio ou dados iguais), `rejected` (conflito vencido pelo servidor; `record` traz a versão dele) ou `error` (`message` em português; `retry: true` só para falha temporária do servidor). Gravações passam pelos mesmos serviços das rotas do painel: mesmas validações, permissões, auditoria e notificações.

- **Idempotente:** o id é gerado no aparelho; reenviar o mesmo lote não duplica nada.
- **Conflito:** só existe se o servidor mudou depois da versão que o aparelho conhecia (`baseUpdatedAt`). Aí vence o `updatedAt` mais recente, e o conflito fica na auditoria (`SYNC_CONFLICT`, com os valores descartados). Data mais de 5 minutos no futuro é recusada (relógio do aparelho errado).
- **Contrato do app:** depois de cada resposta, gravar o `record` localmente e usar o `updatedAt` dele como `baseUpdatedAt` das operações pendentes do mesmo registro. Dentro de um mesmo lote o servidor já faz isso (criar e editar offline não vira conflito).

**`GET /sync/pull?since=<cursor>&limit=200`**: produtores (CPF mascarado), propriedades, solicitações, visitas (sem bytes de fotos e assinatura) e feições em GeoJSON, alterados desde o cursor. Registros excluídos vêm só com `id`, `updatedAt` e `deletedAt`, para o app apagar a cópia local. Repita com `since=cursor` enquanto `hasMore` for `true`; `since` vazio faz a sincronização completa.

- O pull entrega o que foi gravado até alguns segundos atrás (`SYNC_PULL_LAG_MS`, padrão 5000), para não perder gravação que termina fora de ordem. Os relógios da API e do banco precisam estar sincronizados (NTP).

## Testes

```bash
npm test             # testes e2e da API, no banco agrointegra_test
```
