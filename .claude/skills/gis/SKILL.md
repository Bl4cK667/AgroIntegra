---
name: gis
description: Convenções geoespaciais do AgroIntegra (PostGIS, GeoJSON, SRID, zona UTM SIRGAS 2000, cálculo de área/perímetro/distância/declividade, tiles offline). Use antes de criar ou alterar qualquer coluna de geometria, migração PostGIS, rota GeoJSON, cálculo de área ou distância, mapa no painel (Leaflet/MapLibre) ou demarcação de propriedade no app.
---

# GIS no AgroIntegra

Fonte: "AgroIntegra — Planejamento Técnico do MVP" (v1.0, 10/11/2026), seções 10 e 10.1, e prompts 4 e 6.

## Regra número 1

**Nunca calcule área ou distância em graus.** Sempre projete para metros primeiro (UTM SIRGAS 2000) ou use `geography`.

## Sistemas de referência

| Uso | SRID | Observação |
| --- | --- | --- |
| Armazenar e trocar dados | 4326 (WGS 84) | Todas as colunas e todas as rotas |
| Calcular área e perímetro | SIRGAS 2000 / UTM da zona do município | Sul do equador: EPSG = 31960 + zona (ex.: 23S → 31983, 24S → 31984) |
| Distância entre pontos | `geography` (servidor) / Haversine (app) | Resultado em metros |

Zona UTM a partir da longitude: `zona = floor((lon + 180) / 6) + 1`.

**Zona do município: PENDENTE.** O planejamento lista "levantar os limites geográficos do município e a zona UTM" como próximo passo. Até lá, a zona deve vir de uma única constante de configuração (ex.: `GIS_UTM_EPSG` no `.env` da API e no app), nunca repetida em consultas. Quando o município for definido, atualize esta linha.

## Colunas e índices (Prisma não suporta PostGIS nativamente)

- `Property.geom geometry(Polygon, 4326)` e ponto de visita `geometry(Point, 4326)`.
- No `schema.prisma`, declarar como `Unsupported("geometry(Polygon, 4326)")?` e ler/gravar com `$queryRaw` / `$executeRaw`.
- Migração SQL manual com `CREATE EXTENSION IF NOT EXISTS postgis;` e índice GiST:
  ```sql
  CREATE INDEX property_geom_gist ON "Property" USING GIST (geom);
  ```
- O banco atual usa `organizationId` em todas as tabelas de domínio: toda consulta espacial bruta precisa filtrar por `organizationId` explicitamente (o escopo automático do Prisma não cobre `$queryRaw`).

## Validação do polígono

Rejeitar quando:
- tiver menos de 3 vértices distintos (anel GeoJSON fechado tem no mínimo 4 posições, a última igual à primeira);
- `ST_IsValid(geom)` for falso (auto-intersecção). Use `ST_IsValidReason` na mensagem de erro, traduzida para português.

## Cálculos (servidor)

```sql
-- área em hectares, 2 casas
ROUND((ST_Area(ST_Transform(geom, :utm)) / 10000)::numeric, 2)
-- perímetro em metros
ST_Perimeter(ST_Transform(geom, :utm))
-- distância entre dois pontos em metros
ST_Distance(a::geography, b::geography)
-- propriedades num raio (metros) de um ponto
ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
```

Atenção: `ST_MakePoint` recebe **(longitude, latitude)**, nessa ordem. GeoJSON também é `[lng, lat]`.

## Cálculos (app, TypeScript puro, espelhando o servidor)

- Área: projetar os vértices para UTM (proj4 ou Turf.js) e aplicar Gauss/shoelace: `A = ½ |Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|`, dividir por 10.000.
- Perímetro: soma das distâncias entre vértices consecutivos (fechando o anel).
- Distância: Haversine com R = 6.371 km.
- Declividade: `S(%) = Δh / D × 100`, Δh e D em metros (altitude do GPS ou SRTM).
- Tolerância: app e servidor devem bater dentro de **0,5%**. Escrever teste que compara os dois com o mesmo polígono de referência.

## Precisão do GPS

- Exibir a precisão ao gravar cada vértice.
- Alertar quando a precisão for pior que **10 m**.
- Permitir editar e remover vértices manualmente (área de mata degrada o sinal).

## Formato de troca

- Todas as rotas usam GeoJSON. `GET /properties/geojson` devolve `FeatureCollection` com `properties` mínimas (id, nome, produtor, área) — nunca CPF.
- Rotas: `GET /properties/near?lat&lng&radius` (ST_DWithin) e serviço de distância (ST_Distance em geography).

## Mapas e tiles

- Base: OpenStreetMap (gratuito). Satélite: provedor com plano gratuito, avaliar limites antes de escolher (decisão pendente).
- Offline: baixar tiles só da área do município, zoom 12 a 17.
- Painel: Leaflet. App: MapLibre.

## Camadas futuras (fora do MVP)

Limites do município, estradas vicinais, hidrografia e CAR, importados como camadas de referência.

## Testes obrigatórios

- Polígono válido com área conhecida (ex.: quadrado de 100 m × 100 m projetado = 1,00 ha).
- Polígono com auto-intersecção (forma de "laço") → rejeitado.
- Polígono com 2 vértices → rejeitado.
- Ordem lng/lat invertida deve ser detectada pelo teste (o ponto cai fora do município).
