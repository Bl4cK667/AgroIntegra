import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, PropertyFeatureType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { isFeatureType, NormalizedGeometry, normalizeGeometry, translateInvalidReason } from './geometry';

// Regras deste serviço:
// - A geometria só entra por aqui (o Prisma Client não grava colunas Unsupported).
// - Todo SQL bruto filtra "organizationId" explicitamente: o escopo automático do Prisma não cobre $queryRaw.
// - Área, perímetro, comprimento, versão e histórico são do banco (triggers da migração 20261118100000).

export interface CreateFeatureInput {
  id?: string; // UUID v4 gerado no aparelho (offline). Reenviar o mesmo id não duplica.
  propertyId: string;
  type: PropertyFeatureType;
  name?: string | null;
  geometry: unknown;
}

export interface UpdateFeatureInput {
  name?: string | null;
  geometry?: unknown;
  expectedVersion?: number; // controle de concorrência otimista
}

interface FeatureRow {
  id: string;
  propertyId: string;
  type: PropertyFeatureType;
  name: string | null;
  geometry: NormalizedGeometry;
  areaHa: Prisma.Decimal | null;
  perimeterM: Prisma.Decimal | null;
  lengthM: Prisma.Decimal | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type RawClient = Pick<PrismaClient, '$queryRaw'>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX = 120;

const FEATURE_COLUMNS = Prisma.sql`
  f.id, f."propertyId", f.type::text AS type, f.name,
  ST_AsGeoJSON(f.geom, 7)::json AS geometry,
  f."areaHa", f."perimeterM", f."lengthM", f.version, f."createdAt", f."updatedAt", f."deletedAt"`;

const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

export function featureView(r: FeatureRow) {
  return {
    type: 'Feature' as const,
    id: r.id,
    geometry: r.geometry,
    properties: {
      propertyId: r.propertyId,
      featureType: r.type,
      name: r.name,
      areaHa: num(r.areaHa),
      perimeterM: num(r.perimeterM),
      lengthM: num(r.lengthM),
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    },
  };
}

function cleanName(name: string | null | undefined): string | null {
  if (name === undefined || name === null) return null;
  if (typeof name !== 'string') throw new BadRequestException('O nome da feição deve ser texto.');
  const v = name.trim();
  if (v.length > NAME_MAX) throw new BadRequestException(`Use no máximo ${NAME_MAX} caracteres no nome da feição.`);
  return v || null;
}

@Injectable()
export class GeoFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateFeatureInput, user: AuthUser) {
    const organizationId = this.tenancy.organizationId();
    if (input.id !== undefined && (typeof input.id !== 'string' || !UUID_V4.test(input.id))) {
      throw new BadRequestException('Identificador inválido: use um UUID v4 gerado no aparelho.');
    }
    if (!isFeatureType(input.type)) throw new BadRequestException('Tipo de feição inválido.');
    const geometry = JSON.stringify(normalizeGeometry(input.type, input.geometry));
    const name = cleanName(input.name);
    const id = input.id ?? randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findFirst({ where: { id: input.propertyId, deletedAt: null }, select: { id: true } });
      if (!property) throw new NotFoundException('Propriedade não encontrada.');

      // Reenvio do mesmo id (ex.: o aparelho não recebeu a resposta): devolve o que já existe.
      const existing = await this.findRow(tx, organizationId, id, { includeDeleted: true });
      if (existing) {
        if (existing.propertyId !== input.propertyId || existing.type !== input.type) {
          throw new ConflictException('Este identificador já está em uso por outra feição.');
        }
        return { row: existing, created: false };
      }

      await this.assertValid(tx, geometry);

      if (input.type === 'PERIMETER') {
        // Trava a propriedade para que dois perímetros não sejam criados ao mesmo tempo.
        await tx.$queryRaw`
          SELECT id FROM "Property" WHERE id = ${input.propertyId} AND "organizationId" = ${organizationId} FOR UPDATE`;
        const [{ count }] = await tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) AS count FROM "PropertyFeature"
          WHERE "propertyId" = ${input.propertyId} AND "organizationId" = ${organizationId}
            AND type = 'PERIMETER' AND "deletedAt" IS NULL`;
        if (Number(count) > 0) {
          throw new ConflictException('Esta propriedade já tem um perímetro demarcado. Edite o atual ou exclua-o antes de desenhar outro.');
        }
      }

      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "PropertyFeature" (
          "organizationId", id, "propertyId", type, name, geom, "createdById", "updatedById", "createdAt", "updatedAt"
        ) VALUES (
          ${organizationId}, ${id}, ${input.propertyId}, ${input.type}::"PropertyFeatureType", ${name},
          ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326), ${user.id}, ${user.id},
          now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id`;
      // Sem linha inserida = id já usado em outra organização (não revelamos qual).
      if (!inserted.length) throw new ConflictException('Este identificador já está em uso por outra feição.');

      return { row: (await this.findRow(tx, organizationId, id))!, created: true };
    });

    if (result.created) {
      await this.audit.record({
        userId: user.id,
        action: 'PROPERTY_FEATURE_CREATED',
        entity: 'PropertyFeature',
        entityId: result.row.id,
        details: { propertyId: result.row.propertyId, featureType: result.row.type, version: 1, areaHa: num(result.row.areaHa) },
      });
    }
    return featureView(result.row);
  }

  async update(id: string, input: UpdateFeatureInput, user: AuthUser) {
    const organizationId = this.tenancy.organizationId();
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.findRow(tx, organizationId, id);
      if (!current) throw new NotFoundException('Feição não encontrada.');
      if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
        throw new ConflictException(
          `Esta feição foi alterada por outra pessoa (versão ${current.version}). Recarregue antes de salvar.`,
        );
      }

      const sets: Prisma.Sql[] = [];
      if (input.name !== undefined) sets.push(Prisma.sql`name = ${cleanName(input.name)}`);
      if (input.geometry !== undefined) {
        const geometry = JSON.stringify(normalizeGeometry(current.type, input.geometry));
        await this.assertValid(tx, geometry);
        sets.push(Prisma.sql`geom = ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326)`);
      }
      if (!sets.length) throw new BadRequestException('Nada para alterar: envie o nome ou a geometria.');
      sets.push(Prisma.sql`"updatedById" = ${user.id}`);

      const updated = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "PropertyFeature" SET ${Prisma.join(sets, ', ')}
        WHERE id = ${id} AND "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL AND version = ${current.version}
        RETURNING id`;
      if (!updated.length) {
        throw new ConflictException('Esta feição foi alterada por outra pessoa. Recarregue antes de salvar.');
      }
      return (await this.findRow(tx, organizationId, id))!;
    });

    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_FEATURE_UPDATED',
      entity: 'PropertyFeature',
      entityId: id,
      details: {
        propertyId: row.propertyId,
        featureType: row.type,
        version: row.version,
        changed: [input.name !== undefined && 'name', input.geometry !== undefined && 'geometry'].filter(Boolean),
        areaHa: num(row.areaHa),
      },
    });
    return featureView(row);
  }

  // Exclusão lógica: a trigger grava a versão DELETED e recalcula a área da propriedade.
  async remove(id: string, user: AuthUser) {
    const organizationId = this.tenancy.organizationId();
    const rows = await this.prisma.$queryRaw<{ id: string; propertyId: string; type: string; version: number }[]>`
      UPDATE "PropertyFeature"
      SET "deletedAt" = now() AT TIME ZONE 'UTC', "updatedById" = ${user.id}
      WHERE id = ${id} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL
      RETURNING id, "propertyId", type::text AS type, version`;
    if (!rows.length) throw new NotFoundException('Feição não encontrada.');
    const [row] = rows;
    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_FEATURE_DELETED',
      entity: 'PropertyFeature',
      entityId: id,
      details: { propertyId: row.propertyId, featureType: row.type, version: row.version },
    });
    return { id, deleted: true, version: row.version };
  }

  async findOne(id: string) {
    const row = await this.findRow(this.prisma, this.tenancy.organizationId(), id);
    if (!row) throw new NotFoundException('Feição não encontrada.');
    return featureView(row);
  }

  async listByProperty(propertyId: string) {
    const organizationId = this.tenancy.organizationId();
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true } });
    if (!property) throw new NotFoundException('Propriedade não encontrada.');
    const rows = await this.prisma.$queryRaw<FeatureRow[]>`
      SELECT ${FEATURE_COLUMNS} FROM "PropertyFeature" f
      WHERE f."propertyId" = ${propertyId} AND f."organizationId" = ${organizationId} AND f."deletedAt" IS NULL
      ORDER BY f.type, f."createdAt"`;
    return { type: 'FeatureCollection' as const, features: rows.map(featureView) };
  }

  async history(id: string) {
    const organizationId = this.tenancy.organizationId();
    const rows = await this.prisma.$queryRaw<
      {
        version: number; change: string; name: string | null; geometry: NormalizedGeometry;
        areaHa: Prisma.Decimal | null; perimeterM: Prisma.Decimal | null; lengthM: Prisma.Decimal | null;
        createdAt: Date; changedById: string; changedByName: string;
      }[]
    >`
      SELECT v.version, v.change::text AS change, v.name, ST_AsGeoJSON(v.geom, 7)::json AS geometry,
             v."areaHa", v."perimeterM", v."lengthM", v."createdAt",
             u.id AS "changedById", u.name AS "changedByName"
      FROM "PropertyFeatureVersion" v
      JOIN "User" u ON u.id = v."changedById"
      WHERE v."featureId" = ${id} AND v."organizationId" = ${organizationId}
      ORDER BY v.version`;
    if (!rows.length) throw new NotFoundException('Feição não encontrada.');
    return rows.map((r) => ({
      version: r.version,
      change: r.change,
      name: r.name,
      geometry: r.geometry,
      areaHa: num(r.areaHa),
      perimeterM: num(r.perimeterM),
      lengthM: num(r.lengthM),
      changedAt: r.createdAt,
      changedBy: { id: r.changedById, name: r.changedByName },
    }));
  }

  // Só PROPÕE correção (ST_MakeValid) para o usuário confirmar; nunca grava.
  async suggestFix(featureType: PropertyFeatureType, input: unknown) {
    const normalized = normalizeGeometry(featureType, input);
    if (normalized.type === 'Point') return { valid: true, message: null, suggestion: null };
    const extract = normalized.type === 'MultiPolygon' ? 3 : 2;
    const [r] = await this.prisma.$queryRaw<{ valid: boolean; reason: string; fixed: NormalizedGeometry | null }[]>`
      SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason,
        CASE WHEN ST_IsValid(g) THEN NULL
             ELSE ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_MakeValid(g), ${extract}::int)), 7)::json END AS fixed
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(normalized)}), 4326) AS g) s`;
    if (r.valid) return { valid: true, message: null, suggestion: null };
    const suggestion = r.fixed && Array.isArray(r.fixed.coordinates) && r.fixed.coordinates.length ? r.fixed : null;
    return { valid: false, message: translateInvalidReason(r.reason), suggestion };
  }

  private async assertValid(raw: RawClient, geometry: string) {
    const [check] = await raw.$queryRaw<{ valid: boolean; reason: string }[]>`
      SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326) AS g) s`;
    if (!check.valid) throw new BadRequestException(translateInvalidReason(check.reason));
  }

  private async findRow(raw: RawClient, organizationId: string, id: string, opts: { includeDeleted?: boolean } = {}) {
    const rows = await raw.$queryRaw<FeatureRow[]>`
      SELECT ${FEATURE_COLUMNS} FROM "PropertyFeature" f
      WHERE f.id = ${id} AND f."organizationId" = ${organizationId}
      ${opts.includeDeleted ? Prisma.empty : Prisma.sql`AND f."deletedAt" IS NULL`}`;
    return rows[0] ?? null;
  }
}
