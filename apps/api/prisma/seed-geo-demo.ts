// Demarcação FICTÍCIA para as propriedades da demo (módulo geo, dono: João Pedro).
// Roda depois de `demo:reset` (o comando da raiz já encadeia os dois). Não altera o seed do Tiago:
// só lê as propriedades e grava feições/coordenadas.
//
// Onde: zona rural a sudeste da cidade de Canaã dos Carajás (PA), município do piloto. As formas são
// geradas por sorteio com semente fixa e NÃO representam imóveis reais: servem só para demonstração.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG = '00000000-0000-4000-8000-000000000001';
const CITY = { lng: -49.8786, lat: -6.4966 };
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320 * Math.cos((CITY.lat * Math.PI) / 180);

type Pos = [number, number];

// Sorteio determinístico (mulberry32): a mesma semente gera sempre o mesmo mapa.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261118);
const between = (min: number, max: number) => min + rand() * (max - min);

// Metros a partir da cidade (x leste, y norte) → [lng, lat].
const toLngLat = (x: number, y: number): Pos => [
  Number((CITY.lng + x / M_PER_DEG_LNG).toFixed(7)),
  Number((CITY.lat + y / M_PER_DEG_LAT).toFixed(7)),
];

function shoelace(pts: [number, number][]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

// Polígono em estrela (vértices ordenados por ângulo em volta do centro): nunca se cruza.
// Escala o resultado para ter `areaM2` metros quadrados.
function starPolygon(cx: number, cy: number, areaM2: number, n: number, jitter = 0.2): Pos[] {
  const rot = between(0, Math.PI * 2);
  const local = Array.from({ length: n }, (_, i) => {
    const ang = rot + (i / n) * Math.PI * 2 + between(-0.25, 0.25) * (Math.PI / n);
    const r = between(1 - jitter, 1 + jitter);
    return [Math.cos(ang) * r, Math.sin(ang) * r] as [number, number];
  });
  const k = Math.sqrt(areaM2 / shoelace(local));
  const ring = local.map(([x, y]) => toLngLat(cx + x * k, cy + y * k));
  return [...ring, ring[0]];
}

// Raio do maior círculo seguro dentro de uma estrela com `jitter` (para talhões e pontos internos).
const innerRadius = (areaM2: number, n: number, jitter = 0.2) =>
  (1 - jitter) * Math.cos(Math.PI / n) * Math.sqrt(areaM2 / (0.5 * n * Math.sin((2 * Math.PI) / n)));

async function main() {
  const tech = await prisma.user.findUnique({ where: { email: 'tecnico@agrointegra.demo' } });
  if (!tech) throw new Error('Rode antes `npm run demo:reset` (usuário tecnico@agrointegra.demo não encontrado).');
  const props = await prisma.property.findMany({
    where: { organizationId: ORG, deletedAt: null },
    select: { id: true, name: true, areaHa: true, locality: true },
    orderBy: [{ locality: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });
  if (!props.length) throw new Error('Nenhuma propriedade na demo. Rode `npm run demo:reset` antes.');

  await prisma.$executeRaw`DELETE FROM "PropertyFeature" WHERE "organizationId" = ${ORG}`;
  await prisma.property.updateMany({ where: { organizationId: ORG }, data: { latitude: null, longitude: null } });

  // Um bloco por comunidade. Dentro do bloco, lotes em fileiras (cada um com o espaço do próprio
  // tamanho); blocos em 3 colunas (cada comunidade vai para a coluna mais baixa), numa área de
  // ~10,5 km × 8 km a partir de 7,5 km a leste e 4 km ao sul do centro. Conferido sobre a camada de
  // limites da Esri: fora da área urbana (que cresceu para o sudeste) e antes das divisas com
  // Curionópolis (leste) e Água Azul do Norte (sul/sudoeste).
  const byCommunity = new Map<string, typeof props>();
  for (const p of props) byCommunity.set(p.locality, [...(byCommunity.get(p.locality) ?? []), p]);

  const REGION = { x: 7500, y: -4000, width: 10500, columns: 3 };
  const GAP = 700;
  // Espaço do lote = 1,7 × √área. Um pentágono irregular (±15%) com área até 1,1 × a declarada alcança
  // ~0,78 × √área a partir do centro; meio espaço (0,85) − deslocamento (2% × 1,7) ainda dá folga.
  const STAR_JITTER = 0.15;
  const sideOf = (areaHa: number) => Math.max(160, Math.sqrt(areaHa * 10000) * 1.7);

  // Posição (centro, em metros a partir da cidade) de cada lote, por empacotamento em fileiras.
  const placed: { p: (typeof props)[number]; cx: number; cy: number }[] = [];
  const colWidth = (REGION.width - GAP * (REGION.columns - 1)) / REGION.columns;
  const colHeights = Array.from({ length: REGION.columns }, () => 0);
  for (const [, unsorted] of byCommunity) {
    // Maiores primeiro: fileiras com lotes de tamanho parecido desperdiçam menos espaço.
    const group = [...unsorted].sort((a, b) => Number(b.areaHa) - Number(a.areaHa) || a.id.localeCompare(b.id));
    const sides = group.map((p) => sideOf(Number(p.areaHa)));
    const width = colWidth;
    const local: { p: (typeof props)[number]; x: number; y: number }[] = [];
    let x = 0;
    let y = 0;
    let rowH = 0;
    group.forEach((p, i) => {
      const side = sides[i];
      if (x > 0 && x + side > width) {
        x = 0;
        y -= rowH;
        rowH = 0;
      }
      local.push({ p, x: x + side / 2, y: y - side / 2 });
      x += side;
      rowH = Math.max(rowH, side);
    });
    const height = -y + rowH;
    const col = colHeights.indexOf(Math.min(...colHeights));
    const blockX = REGION.x + col * (colWidth + GAP);
    const blockY = REGION.y - colHeights[col];
    for (const l of local) placed.push({ p: l.p, cx: blockX + l.x, cy: blockY + l.y });
    colHeights[col] += height + GAP;
  }

  const counts = { perimeter: 0, pointOnly: 0, none: 0, plots: 0, hq: 0, water: 0 };

  for (const { p, cx: baseX, cy: baseY } of placed) {
    {
      const jitter = sideOf(Number(p.areaHa)) * 0.02;
      const cx = baseX + between(-jitter, jitter);
      const cy = baseY + between(-jitter, jitter);
      const roll = rand();
      if (roll < 0.05) { counts.none++; continue; }
      if (roll < 0.15) {
        const [lng, lat] = toLngLat(cx, cy);
        await prisma.property.update({ where: { id: p.id }, data: { latitude: lat, longitude: lng } });
        counts.pointOnly++;
        continue;
      }

      // Área desenhada diverge um pouco da declarada, como acontece com o documento.
      const areaM2 = Number(p.areaHa) * 10000 * between(0.9, 1.1);
      const n = 5 + Math.floor(rand() * 4);
      const features: { type: string; name: string | null; geometry: object }[] = [
        { type: 'PERIMETER', name: null, geometry: { type: 'MultiPolygon', coordinates: [[starPolygon(cx, cy, areaM2, n, STAR_JITTER)]] } },
      ];
      const safe = innerRadius(areaM2, n, STAR_JITTER);
      if (rand() < 0.4) {
        const plots = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < plots; k++) {
          const ang = (k / plots) * Math.PI * 2 + between(0, 0.5);
          const off = safe * 0.5;
          const r = safe * 0.42;
          const plotArea = Math.PI * r * r * 0.7;
          features.push({
            type: 'PLOT',
            name: `Talhão ${k + 1}`,
            geometry: { type: 'MultiPolygon', coordinates: [[starPolygon(cx + Math.cos(ang) * off, cy + Math.sin(ang) * off, plotArea, 5, 0.15)]] },
          });
          counts.plots++;
        }
      }
      if (rand() < 0.6) {
        const ang = between(0, Math.PI * 2);
        features.push({ type: 'HEADQUARTERS', name: 'Sede', geometry: { type: 'Point', coordinates: toLngLat(cx + Math.cos(ang) * safe * 0.2, cy + Math.sin(ang) * safe * 0.2) } });
        counts.hq++;
      }
      if (rand() < 0.25) {
        const ang = between(0, Math.PI);
        const a = toLngLat(cx + Math.cos(ang) * safe * 0.9, cy + Math.sin(ang) * safe * 0.9);
        const mid = toLngLat(cx + between(-0.15, 0.15) * safe, cy + between(-0.15, 0.15) * safe);
        const b = toLngLat(cx - Math.cos(ang) * safe * 0.9, cy - Math.sin(ang) * safe * 0.9);
        features.push({ type: 'WATER', name: 'Córrego', geometry: { type: 'MultiLineString', coordinates: [[a, mid, b]] } });
        counts.water++;
      }

      for (const f of features) {
        await prisma.$executeRaw`
          INSERT INTO "PropertyFeature" ("organizationId", id, "propertyId", type, name, geom, "createdById", "updatedById")
          VALUES (${ORG}, gen_random_uuid()::text, ${p.id}, ${f.type}::"PropertyFeatureType", ${f.name},
                  ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326), ${tech.id}, ${tech.id})`;
      }
      counts.perimeter++;
    }
  }

  // Coordenadas das demarcadas: ponto dentro do perímetro (como a API faz).
  await prisma.$executeRaw`
    UPDATE "Property" p SET latitude = ST_Y(pt.g), longitude = ST_X(pt.g)
    FROM (SELECT f."propertyId", ST_PointOnSurface(f.geom) AS g FROM "PropertyFeature" f
          WHERE f."organizationId" = ${ORG} AND f.type = 'PERIMETER' AND f."deletedAt" IS NULL) pt
    WHERE p.id = pt."propertyId" AND p."organizationId" = ${ORG}`;

  const [{ invalid }] = await prisma.$queryRaw<{ invalid: bigint }[]>`
    SELECT count(*) AS invalid FROM "PropertyFeature" WHERE "organizationId" = ${ORG} AND NOT ST_IsValid(geom)`;
  if (Number(invalid) > 0) throw new Error(`${invalid} geometrias inválidas geradas.`);

  console.log(
    `Demarcação fictícia pronta em Canaã dos Carajás (PA): ${counts.perimeter} propriedades demarcadas ` +
      `(${counts.plots} talhões, ${counts.hq} sedes, ${counts.water} córregos), ${counts.pointOnly} só com ponto, ` +
      `${counts.none} sem localização.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
