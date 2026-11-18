# AgroIntegra

Sistema de assistência técnica e extensão rural (ATER) para secretarias municipais de agricultura, da Integra Tech.

## Fase atual

- A **demo** (fases 0 a 6 de `docs/plano_mvp_agrointegra.md`) está concluída e serve para apresentações. O roteiro fica em `docs/roteiro_demo.md`, e `npm run demo:reset` recarrega os dados fictícios.
- O projeto agora avança para o **piloto**, guiado pelo "Planejamento Técnico do MVP" (PDF v1.0, fora do repositório). As regras que valem estão neste arquivo.
- Entram agora o que a demo deixou de fora de propósito: mapa e demarcação (GIS), app mobile offline com sincronização, cálculos agronômicos e zootécnicos, clima e cotações.
- **Continuam fora:** integração direta com sistemas federais ou estaduais, emissão de documentos oficiais, módulo financeiro, insumos, maquinário e análise avançada de imagens de satélite. A exceção é importar e exportar arquivos **compatíveis** com CAR/SICAR e SIGEF/INCRA.
- Na dúvida sobre escopo, não construa: pergunte.

## Eixo central do domínio

**Produtor → Propriedade → Solicitação → Atendimento → Resultado**

| Elo | Modelo no código |
| --- | --- |
| Produtor | `Producer` |
| Propriedade | `Property` (e, no piloto, suas feições do mapa) |
| Solicitação | `ServiceRequest` (quadro Nova, Em análise, Agendada, Concluída) |
| Atendimento | `Visit` (pode concluir uma solicitação na mesma transação) |
| Resultado | impacto e retorno da visita, recomendações técnicas, relatórios |

Toda funcionalidade nova se liga a um elo dessa cadeia. Exemplos: uma feição do mapa pertence a uma Propriedade; um cálculo é salvo ligado a uma Visita e à Propriedade ou ao talhão. Não crie dado solto.

## Equipe e responsabilidades

| Pessoa | Módulos |
| --- | --- |
| Tiago (Bl4cK667) | Demo: `auth`, `audit`, `producers`, `properties`, `visits`, `requests`, `dashboard` (API), `programs`, `reports`, seed da demo |
| Abner Castro | Multi-organização (`tenancy`, `prisma/organization-scope.ts`, RLS), `invitations`, `supabase`, `account`, `notifications`, temas e widgets do painel web |
| João Pedro | `geo`, `sync`, `calculos`, `clima`, `cotacoes`, `packages/map-styles`, `packages/calculos` |

Na dúvida sobre quem é dono de um arquivo, use `git log`.

- **Não altere módulos de outra pessoa sem avisar o João Pedro.**
- **Coisas compartilhadas:** schema de `Property`/`Visit`/`Producer`, `organization-scope.ts`, `PrismaService`, auth, `docker-compose.yml` e o `package.json` da raiz. Antes de mexer, explique a mudança e espere o ok.
- Os módulos do João Pedro são **módulos NestJS isolados** (`apps/api/src/geo`, `sync`, `calculos`, `clima`, `cotacoes`). Eles conversam com o resto só por serviços exportados, nunca importando arquivos internos de outro módulo.

## Estrutura do monorepo

- `apps/api`: NestJS 11 + Prisma 6 + PostgreSQL. Testes Jest (unitários e e2e) em `apps/api/test`.
- `apps/web`: Next.js 16 (App Router, CSS Modules, sem Tailwind). **Leia `apps/web/AGENTS.md`**: esta versão do Next tem mudanças que quebram o que você conhece, e a documentação certa está em `node_modules/next/dist/docs/`.
- `apps/api/src/geo`: módulo geo.
  - `geometry.ts`: validação de GeoJSON, sem banco.
  - `geo-features.service.ts`: feições, importação, histórico, idempotência e permissão de exclusão.
  - `geo-map.service.ts`: mapa territorial e busca por raio.
  - `geo-export.service.ts` + `formats/`: GeoJSON, KML/KMZ e Shapefile próprio, sem dependência externa.
  - `geo.controller.ts`: rotas.
- `apps/api/src/clima`: previsão do tempo. INMET por município (principal) e Open-Meteo por coordenada (plano grátis só não comercial: em produção exige chave), cache e último valor válido em `WeatherForecast`. Web: `components/clima/WeatherCard` no mapa da propriedade. Fontes e licenças no `README.md`.
- `apps/api/src/cotacoes`: preço recebido pelo produtor (CONAB, semanal, importação diária com `@nestjs/schedule`) e preços locais lançados pela equipe. Produtos e conversão de unidades em `products.ts`. Web: `/cotacoes`. Fontes e licenças no `README.md`.
- `apps/api/src/common/external-http.ts`: cliente das fontes externas (timeout, novas tentativas, log estruturado), usado por `clima` e `cotacoes`.
- `apps/api/src/sync`: sync offline (`POST /sync/push`, `GET /sync/pull`). Grava só pelos serviços exportados de `producers`, `visits` e `geo`; o conflito vai para a auditoria (`SYNC_CONFLICT`). Contrato do app no `README.md`.
- `apps/web/src/components/geo` + `lib/geo*.ts`: editor de geometria (`GeometryEditor`), campo de perímetro dos formulários (`PerimeterField`), importação (`ImportPanel`), mapa territorial. Telas: `/mapa` e `/propriedades/[id]/mapa`.
- `packages/map-styles`: estilos e definições de camadas do mapa (cores por tipo de feição), compartilhados entre web e mobile.
- `packages/calculos` (a criar): funções puras dos cálculos agronômicos e zootécnicos, reaproveitáveis no app offline.
- `apps/mobile` (futuro): React Native + Expo + SQLite + MapLibre.
- `supabase/`: preparação do Supabase Auth, **desativado por flag** (ver `docs/cadastro-por-convite.md`).

## Stack e decisões aprovadas

Para trocar qualquer item da stack, explique em poucas linhas e espere a resposta do usuário.

- **Banco:** PostgreSQL + **PostGIS**.
- **API:** NestJS 11. Não suba para o 12, que é só ESM e quebra o Jest. Prisma 6: não atualize para 7 ou 8 sem pedir, mesmo que o CLI sugira.
- **Painel web:** Next.js 16.
- **Mapa: MapLibre GL.** No web, `react-map-gl` + `maplibre-gl`, carregado com `dynamic(() => import(...), { ssr: false })`. No mobile, `@maplibre/maplibre-react-native`. **Não use Leaflet.**
  - Motivo: o app do técnico precisa de mapa nativo e offline no campo. Usando MapLibre nos dois, web e mobile compartilham a mesma biblioteca, os mesmos estilos e as mesmas camadas.
  - O PDF do planejamento dizia Leaflet; esta decisão o substitui.
- **Satélite:** Esri World Imagery, com a atribuição sempre visível. A URL da fonte vem do `.env`, para trocar por MapTiler depois.
- **Desenho e edição de polígonos:** `terra-draw`.
- **Importação no navegador:** `@tmcw/togeojson` + `jszip` (KML/KMZ) e `shpjs` (Shapefile).
- **`@turf/turf` só para prévia** (ex.: área enquanto desenha). O valor oficial sempre vem do PostGIS.
- **Fotos no piloto:** storage compatível com S3, enviadas depois dos dados e comprimidas. Por enquanto continuam em `bytea` (decisão de 18/11); a troca fica em `visits/photo-store.ts`.
- **Visita salva não é editada**, com uma exceção (decisão de 18/11): o técnico autor pode **acrescentar** fotos depois, até 3 no total (`VisitsService.addPhoto`, rota `PUT /sync/visits/:id/photos/:photoId`). Foto gravada não é trocada nem apagada.
- Detalhes de GIS: use a skill `gis` (`.claude/skills/gis/SKILL.md`).

## Regras de dados

### Multi-organização (obrigatório em toda tabela de domínio nova)

O isolamento por organização tem duas camadas:

1. **Na API (camada principal):** `PrismaService` expõe clientes com escopo, e `prisma/organization-scope.ts` injeta `organizationId` em leituras, escritas e criações. A organização vem do `TenancyService` (AsyncLocalStorage, preenchido a partir do vínculo do usuário logado).
2. **No banco (defesa em profundidade):** RLS para os papéis do Supabase (`authenticated`), via `app_private.has_organization_access`. A API conecta como dona das tabelas e não passa pela RLS, por isso a camada 1 é a que protege a aplicação.

Checklist para cada modelo novo:

- [ ] Campo `organizationId` + relação com `Organization`, `@@index([organizationId])` e `@@unique([id, organizationId])`. Relações com outras tabelas de domínio usam chave composta `[xId, organizationId]`.
- [ ] Em tabelas novas, **não** use `@default` em `organizationId`: é melhor falhar alto do que gravar na organização padrão.
- [ ] Incluir o modelo em `ORGANIZATION_MODELS` e expor um getter com escopo no `PrismaService`. São arquivos do Abner: avisar.
- [ ] Na migração: `ENABLE ROW LEVEL SECURITY`, `REVOKE` de `PUBLIC`/`anon`/`authenticated` e a policy `organization_read`, no mesmo padrão de `prisma/migrations/20261118091000_closed_registration_rls`.
- [ ] **SQL bruto (`$queryRaw`/`$executeRaw`) não tem escopo automático.** Toda consulta bruta filtra `"organizationId" = ${this.tenancy.organizationId()}` de forma explícita, inclusive nos JOINs (ver `dashboard/dashboard.service.ts`). Isso vale para todas as consultas PostGIS.
- [ ] **Creates aninhados:** quando a FK composta inclui `organizationId`, o Prisma herda o valor do registro pai e **rejeita** o campo explícito. Hoje o `createData` só conhece `photos`; um create aninhado novo precisa ser tratado lá.
- [ ] Teste e2e que cria dados em **outra organização** (não a padrão) e prova o isolamento.

**Exceção aprovada (18/11/2026):** `MarketPrice` e `MarketPriceImport` (módulo `cotacoes`) são **globais**, sem `organizationId`: guardam preço público da CONAB, igual para todas as organizações. RLS só libera leitura de `MarketPrice` para `authenticated`; a escrita é só da API. Não crie outra tabela global sem perguntar.

### Exclusão lógica, datas e auditoria

- Tabelas novas têm `createdAt`, `updatedAt` (`@updatedAt`) e `deletedAt DateTime?` (exclusão lógica). Datas em UTC.
- O schema usa colunas em camelCase sem `@map` (`"organizationId"`, `"visitedOn"`). O `deleted_at` do planejamento vira `deletedAt` aqui.
- Listagens ignoram registros com `deletedAt`. Excluir = preencher `deletedAt`, nunca `DELETE`, em registros oficiais.
- Toda criação, alteração ou exclusão de registro oficial (produtor, propriedade, demarcação, visita, recomendação técnica) grava na auditoria (`AuditService.record`: quem, o quê, quando, detalhes).

### Preparado para offline (app futuro)

- Entidades que o app vai criar aceitam **UUID gerado no cliente** (v4, validado na API). O `@default(uuid())` continua valendo para quem não envia id.
- O app grava numa `sync_queue` local (entidade, id, operação, tentativas, erro) e envia em lotes pequenos com retry.
- O servidor tem `POST /sync/push` e `GET /sync/pull?since=` (módulo `sync`). O pull devolve também os registros excluídos (`deletedAt`) para o app apagar a cópia local.
- Entidade nova que o app cria: o serviço de criação aceita `{ id }` opcional (como `ProducersService.create`, `addProperty` e `VisitsService.create`), e o sync chama esse serviço. Nunca grave direto no banco pelo sync.
- O cursor do pull usa `(updatedAt, id)`: toda escrita em tabela sincronizada precisa atualizar `updatedAt` (o `@updatedAt` do Prisma faz isso; em SQL bruto ou trigger, atualize à mão).
- **Operações idempotentes:** reenviar o mesmo lote não duplica nada (upsert por id).
- Conflito: vence o `updatedAt` mais recente, e o conflito fica registrado em log.
- Ao modelar qualquer tabela nova, considere desde já como ela entra no sync.

### GIS (resumo; detalhes na skill `gis`)

- Guardar em SRID 4326. Geometria de área: `Unsupported("geometry(MultiPolygon, 4326)")`. Coluna, índice GiST e funções vão em **SQL manual na migração**.
- Área (ha) e perímetro (m) são **calculados** com `ST_Area(geom::geography)` / `ST_Perimeter(geom::geography)`. Nunca calcule em graus.
- A **área declarada** (documento do CAR) é um campo separado da área calculada. Os dois valores podem divergir. No schema, `Property.areaHa` é a declarada (nome mantido para não mexer em 19 arquivos da demo); `Property.calculatedAreaHa` e `calculatedPerimeterM` são as calculadas.
- O perímetro da propriedade é uma feição `PERIMETER` em `PropertyFeature`, com no máximo um ativo por propriedade.
- Validar com `ST_IsValid` e rejeitar polígono inválido com mensagem clara em português. `ST_MakeValid` serve só para **propor** correção (ex.: arquivo importado), nunca para corrigir em silêncio.
- A demarcação guarda histórico de versões.
- GeoJSON segue a RFC 7946: ordem `[longitude, latitude]`. Rotas públicas de mapa nunca devolvem CPF.

## Permissões

- Perfis atuais (`enum Role`): `COORDINATION` e `TECHNICIAN`. O planejamento fala em TECHNICIAN/MANAGER/ADMIN; não crie perfis novos sem perguntar.
- Toda permissão é validada **na API** (RBAC com `@Roles(...)` e, quando depender do registro, ABAC no serviço; ex.: técnico só edita o que é dele). Esconder um botão na interface não é controle de acesso.

## Interface, idioma e unidades

- Textos da interface em **português do Brasil**.
- Variáveis, funções, tabelas e arquivos em inglês. **Exceção:** os nomes dos módulos `geo`, `calculos`, `clima` e `cotacoes`, definidos pelo João Pedro.
- Unidades brasileiras: ha, m, kg/ha, sc/ha, @ (arroba), UA, UA/ha, mm, °C, R$. Números com vírgula decimal (`toLocaleString('pt-BR')`). Área com 2 casas em ha.
- Visual institucional e discreto (ver `docs/redesign-corporativo/`): fundo neutro claro, texto escuro, uma cor principal verde-escura (#1F5A3D) e cores só para status; fonte IBM Plex Sans; cantos de 2 a 4px, bordas finas, sem sombra decorativa, gradiente ou desfoque; animação só quando explica uma ação; contraste WCAG AA e foco visível. Mapa e gráficos mantêm as cores funcionais. Textos formais, sem emoji nem exclamação. Os 6 temas em Configurações → Aparência seguem esse padrão.
- **Nenhum número fixo no painel:** tudo que aparece é calculado do banco, com teste que confere contra uma contagem independente (padrão em `test/dashboard.e2e.spec.ts`).

## LGPD e dados

- Dados de exemplo e seeds 100% fictícios. Nenhum nome, CPF ou endereço real.
- CPF sempre mascarado na tela (`***.456.789-**`). A API nunca devolve o CPF completo em listagens.
- Guardar a data do consentimento do produtor e registrar auditoria.

## Integrações externas (clima, cotações, mapas)

- Chaves e URLs no `.env`, com o `.env.example` atualizado. Nunca no código. Nada de segredo em variáveis `NEXT_PUBLIC_*`.
- Toda chamada externa tem timeout, retry com espera progressiva e logs estruturados.
- Sempre mostrar a fonte, a praça (quando houver) e a data/hora do dado. Se a fonte falhar, usar o último valor válido com aviso de desatualizado.
- **Nada de scraping que viole os termos de uso.** Antes de implementar `cotacoes`, apresentar a tabela de fontes (API pública, licença ou scraping) e esperar decisão.
- Documentar a configuração de cada integração no `README.md`.

## API

- Endpoints documentados no OpenAPI. Listagens com paginação e filtros. Exportação em PDF, Excel ou CSV quando fizer sentido.
- Mensagens de erro para o usuário em português e claras.

## Como trabalhar

- **Uma etapa por vez.** Antes de começar, explique o plano em poucos itens. Ao final, mostre o que mudou, rode os testes e **espere a confirmação** antes da próxima etapa.
- Testes antes ou junto do código (skill `tdd` para os cálculos). A etapa só está pronta com todos os testes passando.
- Commit só quando o usuário confirmar a etapa.

## Comandos

```bash
npm install
cp apps/api/.env.example apps/api/.env          # trocar o JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run setup        # sobe o banco, gera o Prisma Client, aplica migrações, cria usuários
npm run demo:reset   # dados fictícios da demo (apaga atendimentos atuais) + demarcação fictícia no mapa
npm run dev          # API :3001 + web :3000
npm test             # testes da API (banco agrointegra_test)
```

Usuários locais: `coordenacao@agrointegra.demo` e `tecnico@agrointegra.demo` (senha `demo1234`); `admin@agrointegra.demo` (senha `admin`).

## Armadilhas conhecidas

- **Use `127.0.0.1`, não `localhost`, no `DATABASE_URL`.** O Docker Desktop no Windows pode não encaminhar o IPv6 (`::1`), e o Prisma falha com P1001.
- **`npm install` na raiz não gera o Prisma Client** (o schema está em `apps/api/prisma`). Use `npm run setup` ou `npm run -w apps/api db:generate`. No Windows, pare a API antes, porque a DLL do engine fica travada.
- **Testes não usam `prisma migrate reset`** (o Prisma bloqueia quando chamado por IA). Eles usam `migrate deploy` e limpam as tabelas. `TestDatabase` é um cliente **sem escopo**, só para fixtures. As requisições HTTP passam pelo `PrismaService` real.
- **Docker é obrigatório** (decisão de 18/11): `npm run db:up` sobe `postgis/postgis:16-3.5-alpine`. O caminho antigo com `embedded-postgres` foi removido porque ele não tem PostGIS.
- **Nome de migração nova:** as migrações do Abner usam horários "adiantados" (`20261118090000`, `20261118091000`) e o Prisma aplica por ordem alfabética. Confira que a pasta nova fica **depois** da última (`ls apps/api/prisma/migrations`) e renomeie se precisar. Senão, num banco novo, ela roda antes das tabelas de que depende.
- **Não use `prisma migrate dev --create-only` para checar drift:** mesmo sem mudança, ele cria uma migração vazia, e a execução seguinte a aplica. Para checar, use `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (vazio = sem drift).
- **PostGIS no Prisma:** colunas `Unsupported("geometry(...)")` não entram no Prisma Client. Ler e gravar só com `$queryRaw` (com `organizationId` explícito). Extensão, `CHECK`, triggers e RLS ficam em SQL manual na migração; o Prisma não os representa nem tenta removê-los.
- **Hoisting do npm no monorepo:** `@nestjs/core` e `@nestjs/common` ficam na raiz (por causa do `@nestjs/swagger`), mas `@nestjs/platform-express` fica em `apps/api/node_modules`. Por isso o `main.ts` passa `new ExpressAdapter()` explicitamente. Os testes não pegam esse tipo de problema (o `@nestjs/testing` resolve a partir de `apps/api`): depois de instalar pacotes na API, suba a API de verdade (`npm run dev:api`) e chame `/health`.
- **Não rode `npm dedupe`** sem necessidade: ele reescreve milhares de linhas do lockfile.
- **Rotas fixas sob `/properties`:** o módulo `geo` registra `GET /properties/geojson`, `/properties/geojson/filters` e `/properties/near` num controller próprio. Se alguém criar `GET /properties/:id` no `PropertiesController`, essas rotas podem ser capturadas pelo parâmetro. O e2e `geo-api.e2e.spec.ts` acusa isso.
- **Mapa no web (MapLibre 6 + react-map-gl + terra-draw):**
  - O worker do MapLibre é copiado para `apps/web/public/maplibre/` no `predev`/`prebuild` e apontado com `setWorkerUrl` (`components/geo/maplibreWorker.ts`). Sem isso, o satélite aparece mas **nenhuma camada GeoJSON** é desenhada (erro "Worker failed to load").
  - `mapStyle()` precisa devolver **sempre o mesmo objeto**. Um estilo novo a cada renderização faz o react-map-gl reaplicar o estilo e apagar as camadas do terra-draw (o desenho some, mas a área continua sendo calculada).
  - `draw.stop()` na desmontagem fica em try/catch: o react-map-gl pode destruir o mapa antes e derrubar a navegação ("This page couldn't load").
  - Componentes de mapa só com `next/dynamic(..., { ssr: false })` dentro de componente `'use client'`. Evite vários mapas na mesma tela (cada um abre um contexto WebGL; o navegador limita).
  - Mudança no mapa: confira no navegador (`playwright-cli`), não só no `tsc`/build. Os três bugs acima passaram no build.
- **Pacote `packages/map-styles`:** fonte única de cores e camadas por tipo de feição. O Next 16 transpila workspaces sozinho (sem `transpilePackages`). O KML da API ainda tem a paleta copiada em `geo/formats/kml.ts`: mantenha as duas iguais.
- **Seed `demo:geo`** (`apps/api/prisma/seed-geo-demo.ts`): roda no `demo:reset` da raiz, depois do seed do Tiago, e não altera o seed dele. A área foi conferida sobre a camada de limites municipais da Esri. Ao mudar a disposição dos lotes, verifique no mapa que nada cruza as divisas com Curionópolis e Água Azul do Norte nem a área urbana, e que não há sobreposição (`ST_Intersects`).
- **Triggers do módulo `geo`** (migração `20261118100000_geo_features_sync_base`): em `PropertyFeature`, calculam `areaHa`/`perimeterM`/`lengthM` sobre `geography`, incrementam `version`, gravam `PropertyFeatureVersion` e atualizam `Property.calculatedAreaHa`/`calculatedPerimeterM` a partir do perímetro ativo. Tipo, propriedade e organização de uma feição não mudam; o histórico não pode ser reescrito.
- Iniciar o Next em produção com `node node_modules/next/dist/bin/next start`, não com `npx`: o `npx` deixa um processo órfão segurando a porta.
- O `next dev` reescreve `apps/web/AGENTS.md`. Faça commit desse arquivo junto, sem apagar o bloco.

## Histórico da demo (referência)

- Login por perfil com JWT e auditoria. Produtores com CPF validado e mascarado, consentimento e busca sem acento. Propriedades com área digitada, endereço e lat/lng.
- Visitas: diagnóstico, plano de ação, retorno, impacto, até 3 fotos reduzidas no aparelho, assinatura e localização do aparelho. Fotos e assinatura em `bytea`, servidas só com login e com o tipo conferido pelo conteúdo. Visita salva não é editada.
- Solicitações em quadro com prioridade e data agendada. Painel com números do banco (`GET /dashboard`).
- Programas em modo leitura (valores em centavos). Relatório do produtor com prévia e PDF (pdfkit) montados dos mesmos dados; `test/reports.e2e.spec.ts` lê o PDF e confere com a tela.
- Abner (17/11): temas, widgets arrastáveis no painel, notificações, conta e avatar, cadastro fechado por convite, Supabase Auth desativado por flag e multi-organização com RLS.
