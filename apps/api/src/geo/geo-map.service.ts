import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { BRAZIL_BOUNDS, NormalizedGeometry } from './geometry';

// Mapa territorial (painel do gestor) e busca por proximidade.
// Cada propriedade sai com o perímetro demarcado; sem demarcação, com o ponto digitado (lat/lng);
// sem nenhum dos dois, fica fora do mapa e entra só na contagem "withoutLocation".
// Nenhuma rota devolve CPF.

export interface MapFilters {
  community?: string;
  mainActivity?: string;
  programId?: string;
  technicianId?: string;
  requestStatus?: RequestStatus | 'OPEN';
  bbox?: string; // "minLng,minLat,maxLng,maxLat"
  limit?: number;
}

export const MAP_DEFAULT_LIMIT = 2000;
export const MAP_MAX_LIMIT = 5000;
export const NEAR_DEFAULT_RADIUS_M = 5000;
export const NEAR_MAX_RADIUS_M = 50000;
const NEAR_LIMIT = 50;

interface MapRow {
  id: string;
  name: string;
  producerId: string;
  producerName: string;
  community: string;
  locality: string;
  mainActivity: string | null;
  declaredAreaHa: Prisma.Decimal;
  calculatedAreaHa: Prisma.Decimal | null;
  demarcated: boolean;
  geometry: NormalizedGeometry;
  openRequests: bigint;
  lastVisitOn: Date | null;
}

const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

export function parseBbox(bbox: string) {
  const parts = bbox.split(',').map((v) => Number(v.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new BadRequestException('bbox inválido: use "lngMin,latMin,lngMax,latMax" em graus decimais.');
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    throw new BadRequestException('bbox inválido: o mínimo deve ser menor que o máximo, dentro de -180..180 e -90..90.');
  }
  return { minLng, minLat, maxLng, maxLat };
}

@Injectable()
export class GeoMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  // Base comum: propriedade ativa + produtor + perímetro ativo + ponto digitado, tudo na organização.
  private base(organizationId: string) {
    return Prisma.sql`
      SELECT p.id, p.name, p."producerId", pr.name AS "producerName", pr.community, p.locality,
             p."mainActivity", p."areaHa" AS "declaredAreaHa", p."calculatedAreaHa",
             per.geom AS perimeter,
             CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL
                  THEN ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326) END AS point
      FROM "Property" p
      JOIN "Producer" pr ON pr.id = p."producerId" AND pr."organizationId" = p."organizationId"
      LEFT JOIN LATERAL (
        SELECT f.geom FROM "PropertyFeature" f
        WHERE f."propertyId" = p.id AND f."organizationId" = p."organizationId"
          AND f.type = 'PERIMETER' AND f."deletedAt" IS NULL
        ORDER BY f."updatedAt" DESC LIMIT 1
      ) per ON true
      WHERE p."organizationId" = ${organizationId} AND p."deletedAt" IS NULL AND pr."deletedAt" IS NULL`;
  }

  private filterSql(organizationId: string, f: MapFilters) {
    const conds: Prisma.Sql[] = [];
    if (f.community) conds.push(Prisma.sql`pr.community = ${f.community}`);
    if (f.mainActivity) conds.push(Prisma.sql`p."mainActivity" = ${f.mainActivity}`);
    if (f.programId) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Enrollment" e
        WHERE e."organizationId" = ${organizationId} AND e."producerId" = p."producerId" AND e."programId" = ${f.programId})`);
    }
    // Visita feita nesta propriedade, ou ao produtor sem propriedade indicada.
    if (f.technicianId) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Visit" v
        WHERE v."organizationId" = ${organizationId} AND v."deletedAt" IS NULL AND v."technicianId" = ${f.technicianId}
          AND (v."propertyId" = p.id OR (v."propertyId" IS NULL AND v."producerId" = p."producerId")))`);
    }
    if (f.requestStatus) {
      const status = f.requestStatus === 'OPEN'
        ? Prisma.sql`r.status <> 'DONE'`
        : Prisma.sql`r.status = ${f.requestStatus}::"RequestStatus"`;
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ServiceRequest" r
        WHERE r."organizationId" = ${organizationId} AND r."deletedAt" IS NULL AND ${status}
          AND (r."propertyId" = p.id OR (r."propertyId" IS NULL AND r."producerId" = p."producerId")))`);
    }
    return conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
  }

  async territorialMap(filters: MapFilters) {
    const organizationId = this.tenancy.organizationId();
    const limit = Math.min(filters.limit ?? MAP_DEFAULT_LIMIT, MAP_MAX_LIMIT);
    const box = filters.bbox ? parseBbox(filters.bbox) : null;
    const where = this.filterSql(organizationId, filters);
    const inBox = box
      ? Prisma.sql`AND ST_Intersects(COALESCE(perimeter, point), ST_MakeEnvelope(${box.minLng}, ${box.minLat}, ${box.maxLng}, ${box.maxLat}, 4326))`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<MapRow[]>`
      WITH loc AS (${this.base(organizationId)} ${where})
      SELECT loc.id, loc.name, loc."producerId", loc."producerName", loc.community, loc.locality, loc."mainActivity",
             loc."declaredAreaHa", loc."calculatedAreaHa", loc.perimeter IS NOT NULL AS demarcated,
             ST_AsGeoJSON(COALESCE(loc.perimeter, loc.point), 7)::json AS geometry,
             (SELECT count(*) FROM "ServiceRequest" r
               WHERE r."organizationId" = ${organizationId} AND r."deletedAt" IS NULL AND r.status <> 'DONE'
                 AND (r."propertyId" = loc.id OR (r."propertyId" IS NULL AND r."producerId" = loc."producerId"))) AS "openRequests",
             (SELECT max(v."visitedOn") FROM "Visit" v
               WHERE v."organizationId" = ${organizationId} AND v."deletedAt" IS NULL
                 AND (v."propertyId" = loc.id OR (v."propertyId" IS NULL AND v."producerId" = loc."producerId"))) AS "lastVisitOn"
      FROM loc
      WHERE COALESCE(loc.perimeter, loc.point) IS NOT NULL ${inBox}
      ORDER BY loc.name, loc.id
      LIMIT ${limit + 1}`;

    const [{ withoutLocation }] = await this.prisma.$queryRaw<{ withoutLocation: bigint }[]>`
      WITH loc AS (${this.base(organizationId)} ${where})
      SELECT count(*) AS "withoutLocation" FROM loc WHERE perimeter IS NULL AND point IS NULL`;

    const truncated = rows.length > limit;
    const features = rows.slice(0, limit).map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry: r.geometry,
      properties: {
        name: r.name,
        producerId: r.producerId,
        producerName: r.producerName,
        community: r.community,
        locality: r.locality,
        mainActivity: r.mainActivity,
        declaredAreaHa: num(r.declaredAreaHa),
        calculatedAreaHa: num(r.calculatedAreaHa),
        demarcated: r.demarcated,
        openRequests: Number(r.openRequests),
        lastVisitOn: r.lastVisitOn ? r.lastVisitOn.toISOString().slice(0, 10) : null,
      },
    }));
    return {
      type: 'FeatureCollection' as const,
      features,
      meta: { count: features.length, truncated, limit, withoutLocation: Number(withoutLocation) },
    };
  }

  async near(lat: number, lng: number, radius = NEAR_DEFAULT_RADIUS_M) {
    const organizationId = this.tenancy.organizationId();
    const b = BRAZIL_BOUNDS;
    if (lng < b.minLng || lng > b.maxLng || lat < b.minLat || lat > b.maxLat) {
      throw new BadRequestException('Ponto fora do Brasil. Confira se lat é a latitude e lng a longitude.');
    }
    if (!(radius > 0 && radius <= NEAR_MAX_RADIUS_M)) {
      throw new BadRequestException(`Raio deve ficar entre 1 e ${NEAR_MAX_RADIUS_M} metros.`);
    }
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; producerId: string; producerName: string; community: string; demarcated: boolean; distanceM: Prisma.Decimal }[]
    >`
      WITH loc AS (${this.base(organizationId)}),
           pt AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS g)
      SELECT loc.id, loc.name, loc."producerId", loc."producerName", loc.community,
             loc.perimeter IS NOT NULL AS demarcated,
             ROUND(ST_Distance(COALESCE(loc.perimeter, loc.point)::geography, pt.g)::numeric, 1) AS "distanceM"
      FROM loc, pt
      WHERE COALESCE(loc.perimeter, loc.point) IS NOT NULL
        AND ST_DWithin(COALESCE(loc.perimeter, loc.point)::geography, pt.g, ${radius})
      ORDER BY "distanceM", loc.name
      LIMIT ${NEAR_LIMIT}`;
    return {
      center: { lat, lng },
      radiusM: radius,
      items: rows.map((r) => ({ ...r, distanceM: Number(r.distanceM) })),
    };
  }

  // Valores para os filtros do mapa (só o que existe na organização).
  async filterOptions() {
    const organizationId = this.tenancy.organizationId();
    const [communities, activities, programs, technicians] = await Promise.all([
      this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT community AS value FROM "Producer"
        WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL ORDER BY 1`,
      this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT "mainActivity" AS value FROM "Property"
        WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL AND "mainActivity" IS NOT NULL ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; name: string }[]>`
        SELECT id, name FROM "Program" WHERE "organizationId" = ${organizationId} ORDER BY name`,
      this.prisma.$queryRaw<{ id: string; name: string }[]>`
        SELECT u.id, u.name FROM "User" u
        JOIN "OrganizationMembership" m ON m."userId" = u.id
        WHERE m."organizationId" = ${organizationId} AND m.active AND u.active AND m.role = 'TECHNICIAN'
        ORDER BY u.name`,
    ]);
    return {
      communities: communities.map((c) => c.value),
      mainActivities: activities.map((a) => a.value),
      programs,
      technicians,
      requestStatuses: ['OPEN', ...Object.values(RequestStatus)],
    };
  }
}
