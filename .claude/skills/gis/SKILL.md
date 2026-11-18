---
name: gis
description: Convenções geoespaciais do AgroIntegra (PostGIS, GeoJSON, SRID 4326, área e perímetro via geography, feições da propriedade, KML/KMZ/Shapefile, MapLibre, tiles offline). Use antes de criar ou alterar qualquer coluna de geometria, migração PostGIS, rota GeoJSON, importação/exportação de arquivo geográfico, cálculo de área ou distância, mapa no painel ou demarcação de propriedade no app.
---

# GIS no AgroIntegra

Fontes: "AgroIntegra — Planejamento Técnico do MVP" (v1.0, 10/11/2026), seções 10 e 10.1, mais as decisões do João Pedro de 17/11/2026. Quando as duas divergem, valem as decisões de 17/11: área via `geography`, `MultiPolygon` e MapLibre no lugar de Leaflet.

## Regra número 1

**Nunca calcule área ou distância em graus.** No servidor, use `geography`.

## Sistemas de referência

| Uso | Como | Observação |
| --- | --- | --- |
| Armazenar e trocar dados | SRID 4326 (WGS 84) | Todas as colunas e todas as rotas |
| Área e perímetro | `ST_Area(geom::geography)` / `ST_Perimeter(geom::geography)` | Cálculo sobre o esferoide, em m² e m. Não depende da zona UTM |
| Distância entre pontos | `geography` (servidor) / Haversine (app) | Resultado em metros |

A zona UTM SIRGAS 2000 do município (EPSG = 31960 + zona no hemisfério sul) só é necessária para exportações que a exijam, como alguns fluxos do SIGEF. Nesse caso, ela vem de uma única constante de configuração (`GIS_UTM_EPSG`), nunca repetida em consultas.

**Município piloto: Canaã dos Carajás (PA)**, zona **22S**, **EPSG:31982**. Centro aproximado: latitude −6,4966, longitude −49,8786. A Floresta Nacional de Carajás e a mina S11D ficam a oeste e noroeste da cidade; dados fictícios de demonstração ficam a leste e ao sul.

## Colunas e índices (o Prisma não suporta PostGIS nativamente)

- Geometria de área (perímetro da propriedade, talhão, APP, Reserva Legal): `geometry(MultiPolygon, 4326)`. O tipo das feições pontuais e lineares (sede, benfeitoria, água, estrada) se define na modelagem de `property_features`.
- No `schema.prisma`: `Unsupported("geometry(MultiPolygon, 4326)")?`. Ler e gravar com `$queryRaw` / `$executeRaw`.
- Índice GiST declarado **no schema** (`@@index([geom], type: Gist)`), para o Prisma não acusar drift. Na migração, à mão, só o que o Prisma não representa: `CREATE EXTENSION IF NOT EXISTS postgis;`, `CHECK` e triggers.
- Implementação de referência: `PropertyFeature`/`PropertyFeatureVersion` (migração `20261118100000_geo_features_sync_base`) e `apps/api/src/geo/geo-features.service.ts`.
- **Multi-organização:** toda consulta espacial bruta filtra `"organizationId"` explicitamente, inclusive nos JOINs. O escopo automático do Prisma não cobre `$queryRaw`. Ver o checklist no `CLAUDE.md`.
- Toda tabela geográfica tem `deletedAt`, auditoria e histórico de versões da demarcação.

## Área calculada × área declarada

- **Área calculada** (ha, 2 casas): sempre do PostGIS, nunca digitada.
- **Área declarada**: campo separado, vinda do documento (CAR, matrícula). As duas podem divergir; a tela mostra ambas.

## Validação da geometria

Rejeitar, com mensagem clara em português, quando:
- o anel tiver menos de 3 vértices distintos (um anel GeoJSON fechado tem no mínimo 4 posições, com a última igual à primeira);
- `ST_IsValid(geom)` for falso (ex.: auto-intersecção). Traduza o `ST_IsValidReason` na mensagem.

`ST_MakeValid` serve só para **propor** correção (ex.: arquivo importado com pequenos defeitos), mostrando o resultado para o usuário confirmar. Nunca corrija em silêncio.

## Cálculos (servidor)

```sql
-- área em hectares, 2 casas
ROUND((ST_Area(geom::geography) / 10000)::numeric, 2)
-- perímetro em metros
ST_Perimeter(geom::geography)
-- distância entre dois pontos em metros
ST_Distance(a::geography, b::geography)
-- propriedades num raio (metros) de um ponto
ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
-- centroide (usado pelo módulo clima)
ST_PointOnSurface(geom)  -- garante ponto dentro do polígono; ST_Centroid pode cair fora
```

Atenção: `ST_MakePoint` recebe **(longitude, latitude)**, nessa ordem. GeoJSON também é `[lng, lat]` (RFC 7946).

## Cálculos (cliente: web e app)

- `@turf/turf` **só para prévia** (área enquanto desenha). O valor oficial vem do servidor.
- Distância no app: Haversine com R = 6.371 km.
- Declividade: `S(%) = Δh / D × 100`, com Δh e D em metros (altitude do GPS ou SRTM).
- Meta do planejamento: prévia e servidor batem dentro de **0,5%**. Escrever um teste com polígono de referência; se o Turf (esfera) e o `geography` (esferoide) divergirem acima disso, reporte em vez de mascarar.

## Precisão do GPS (app)

- Exibir a precisão ao gravar cada vértice.
- Alertar quando a precisão for pior que **10 m**.
- Permitir editar e remover vértices manualmente (a mata degrada o sinal).

## Formato de troca, importação e exportação

- Todas as rotas usam GeoJSON. `GET /properties/geojson` devolve `FeatureCollection` com `properties` mínimas (id, nome, produtor, área), **nunca CPF**, e aceita filtros.
- `GET /properties/near?lat&lng&radius` (ST_DWithin) e CRUD de feições em GeoJSON.
- Importar e exportar **KML, KMZ, GeoJSON e Shapefile**, compatíveis com CAR/SICAR e SIGEF/INCRA.
- No navegador: `@tmcw/togeojson` + `jszip` (KML/KMZ) e `shpjs` (Shapefile). O servidor revalida tudo; nunca confie na geometria vinda do cliente.

## Mapas e tiles

- **MapLibre GL em tudo.** Web: `react-map-gl` + `maplibre-gl`, com `dynamic(() => import(...), { ssr: false })`. Mobile: `@maplibre/maplibre-react-native`. **Não usar Leaflet.**
- Satélite: **Esri World Imagery**, atribuição sempre visível, URL vinda do `.env` (troca futura por MapTiler).
- Desenho e edição: `terra-draw`.
- Estilos e cores por tipo de feição em `packages/map-styles`, compartilhados entre web e mobile.
- Offline (app): baixar tiles só da área do município, zoom 12 a 17.

## Camadas de referência (futuras)

Limites do município, estradas vicinais, hidrografia e CAR, importados como camadas de referência.

## Testes obrigatórios

- Polígono de área conhecida (ex.: quadrado de ~100 m × 100 m perto do equador ≈ 1,00 ha; conferir o valor esperado com o próprio PostGIS).
- Polígono com auto-intersecção (forma de "laço") → rejeitado com mensagem em português.
- Anel com 2 vértices distintos → rejeitado.
- Ordem lng/lat invertida é detectada (o ponto cai fora do município ou da faixa válida).
- Consulta espacial não vaza dados de outra organização (e2e com uma segunda organização).
