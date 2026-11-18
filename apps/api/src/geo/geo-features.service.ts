import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, PrismaClient, PropertyFeatureType, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { isFeatureType, NormalizedGeometry, normalizeGeometry, translateInvalidReason } from './geometry';

// Regras deste serviço:
// - A geometria só entra por aqui (o Prisma Client não grava colunas Unsupported).
// - Todo SQL bruto filtra "organizationId" explicitamente: o escopo automático do Prisma não cobre $queryRaw.
// - Área, perímetro, comprimento, versão e histórico são do banco (triggers da migração 20261118100000).
// - Permissões: técnico e coordenação criam, editam e importam; excluir é da coordenação ou de quem criou.

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

export interface ImportItemInput {
  id?: string;
  type: PropertyFeatureType;
  name?: string | null;
  geometry: unknown;
}

export type ImportStatus = 'ok' | 'invalid' | 'conflict';

export interface ImportReportItem {
  index: number;
  featureType: string;
  name: string | null;
  status: ImportStatus;
  message: string | null;
  suggestion: NormalizedGeometry | null; // correção proposta por ST_MakeValid (não aplicada)
  areaHa: number | null;
  perimeterM: number | null;
  lengthM: number | null;
  featureId: string | null; // preenchido quando a importação é gravada
}

export interface FeatureRow {
  id: string;
  propertyId: string;
  type: PropertyFeatureType;
  name: string | null;
  geometry: NormalizedGeometry;
  areaHa: Prisma.Decimal | null;
  perimeterM: Prisma.Decimal | null;
  lengthM: Prisma.Decimal | null;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type RawClient = Pick<PrismaClient, '$queryRaw'>;

export const MAX_IMPORT_FEATURES = 500;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX = 120;

const FEATURE_COLUMNS = Prisma.sql`
  f.id, f."propertyId", f.type::text AS type, f.name,
  ST_AsGeoJSON(f.geom, 7)::json AS geometry,
  f."areaHa", f."perimeterM", f."lengthM", f.version, f."createdById",
  f."createdAt", f."updatedAt", f."deletedAt"`;

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

function assertClientId(id: unknown) {
  if (id !== undefined && (typeof id !== 'string' || !UUID_V4.test(id))) {
    throw new BadRequestException('Identificador inválido: use um UUID v4 gerado no aparelho.');
  }
}

const PERIMETER_EXISTS = 'Esta propriedade já tem um perímetro demarcado. Edite o atual ou exclua-o antes de desenhar outro.';

@Injectable()
export class GeoFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateFeatureInput, user: AuthUser) {
    const organizationId = this.tenancy.organizationId();
    assertClientId(input.id);
    if (!isFeatureType(input.type)) throw new BadRequestException('Tipo de feição inválido.');
    const geometry = JSON.stringify(normalizeGeometry(input.type, input.geometry));
    const name = cleanName(input.name);
    const id = input.id ?? randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.requireProperty(tx, organizationId, input.propertyId);

      // Reenvio do mesmo id (ex.: o aparelho não recebeu a resposta): devolve o que já existe.
      const existing = await this.findRow(tx, organizationId, id, { includeDeleted: true });
      if (existing) {
        if (existing.propertyId !== input.propertyId || existing.type !== input.type) {
          throw new ConflictException('Este identificador já está em uso por outra feição.');
        }
        return { row: existing, created: false };
      }

      await this.assertValid(tx, geometry);
      if (input.type === 'PERIMETER' && (await this.lockAndCountPerimeters(tx, organizationId, input.propertyId)) > 0) {
        throw new ConflictException(PERIMETER_EXISTS);
      }
      if (!(await this.insert(tx, organizationId, { id, propertyId: input.propertyId, type: input.type, name, geometry }, user))) {
        throw new ConflictException('Este identificador já está em uso por outra feição.');
      }
      return { row: (await this.findRow(tx, organizationId, id))!, created: true };
    });

    if (result.created) await this.auditCreated(result.row, user);
    return featureView(result.row);
  }

  // Importação em lote. dryRun = só o relatório (nada é gravado). Sem dryRun, grava tudo ou nada.
  async importFeatures(propertyId: string, items: ImportItemInput[], dryRun: boolean, user: AuthUser) {
    const organizationId = this.tenancy.organizationId();
    if (!items.length) throw new BadRequestException('Nenhuma feição para importar.');
    if (items.length > MAX_IMPORT_FEATURES) {
      throw new BadRequestException(`Importe no máximo ${MAX_IMPORT_FEATURES} feições por vez.`);
    }
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, name: true } });
    if (!property) throw new NotFoundException('Propriedade não encontrada.');

    const prepared: { item: ImportReportItem; geometry: string | null; id?: string; type: PropertyFeatureType }[] = [];
    for (const [index, raw] of items.entries()) {
      const item: ImportReportItem = {
        index, featureType: String(raw.type), name: null, status: 'ok', message: null,
        suggestion: null, areaHa: null, perimeterM: null, lengthM: null, featureId: null,
      };
      let geometry: string | null = null;
      try {
        assertClientId(raw.id);
        if (!isFeatureType(raw.type)) throw new BadRequestException('Tipo de feição inválido.');
        item.name = cleanName(raw.name);
        geometry = JSON.stringify(normalizeGeometry(raw.type, raw.geometry));
      } catch (e) {
        if (!(e instanceof BadRequestException)) throw e;
        item.status = 'invalid';
        item.message = e.message;
      }
      if (geometry) {
        const [check] = await this.prisma.$queryRaw<
          { valid: boolean; reason: string; areaHa: Prisma.Decimal | null; perimeterM: Prisma.Decimal | null; lengthM: Prisma.Decimal | null; fixed: NormalizedGeometry | null }[]
        >`
          SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason,
            CASE WHEN ST_IsValid(g) AND ST_Dimension(g) = 2 THEN ROUND((ST_Area(g::geography) / 10000)::numeric, 4) END AS "areaHa",
            CASE WHEN ST_IsValid(g) AND ST_Dimension(g) = 2 THEN ROUND(ST_Perimeter(g::geography)::numeric, 2) END AS "perimeterM",
            CASE WHEN ST_IsValid(g) AND ST_Dimension(g) = 1 THEN ROUND(ST_Length(g::geography)::numeric, 2) END AS "lengthM",
            CASE WHEN NOT ST_IsValid(g) AND ST_Dimension(g) > 0
              THEN ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_MakeValid(g), CASE ST_Dimension(g) WHEN 2 THEN 3 ELSE 2 END)), 7)::json
            END AS fixed
          FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326) AS g) s`;
        if (check.valid) {
          item.areaHa = num(check.areaHa);
          item.perimeterM = num(check.perimeterM);
          item.lengthM = num(check.lengthM);
        } else {
          item.status = 'invalid';
          item.message = translateInvalidReason(check.reason);
          item.suggestion = check.fixed && check.fixed.coordinates?.length ? check.fixed : null;
        }
      }
      prepared.push({ item, geometry, id: raw.id, type: raw.type });
    }

    const perimeters = prepared.filter((p) => p.type === 'PERIMETER' && p.item.status === 'ok');
    const hasPerimeter = perimeters.length > 0 && (await this.countPerimeters(this.prisma, organizationId, propertyId)) > 0;
    for (const p of perimeters) {
      if (perimeters.length > 1) {
        p.item.status = 'conflict';
        p.item.message = 'O arquivo traz mais de um perímetro. Escolha só um para importar.';
      } else if (hasPerimeter) {
        p.item.status = 'conflict';
        p.item.message = PERIMETER_EXISTS;
      }
    }

    const report = prepared.map((p) => p.item);
    const summary = {
      total: report.length,
      ok: report.filter((i) => i.status === 'ok').length,
      invalid: report.filter((i) => i.status === 'invalid').length,
      conflict: report.filter((i) => i.status === 'conflict').length,
    };
    if (dryRun) return { dryRun: true, property, summary, items: report };
    if (summary.ok !== summary.total) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Nada foi importado: corrija ou retire as feições com problema e tente de novo.',
        summary,
        items: report,
      });
    }

    const rows = await this.prisma.$transaction(async (tx) => {
      await this.requireProperty(tx, organizationId, propertyId);
      if (perimeters.length && (await this.lockAndCountPerimeters(tx, organizationId, propertyId)) > 0) {
        throw new ConflictException(PERIMETER_EXISTS);
      }
      const saved: FeatureRow[] = [];
      for (const p of prepared) {
        const id = p.id ?? randomUUID();
        const inserted = await this.insert(tx, organizationId, { id, propertyId, type: p.type, name: p.item.name, geometry: p.geometry! }, user);
        if (!inserted) throw new ConflictException(`Feição ${p.item.index + 1}: este identificador já está em uso.`);
        saved.push((await this.findRow(tx, organizationId, id))!);
      }
      return saved;
    });

    for (const [i, row] of rows.entries()) {
      report[i].featureId = row.id;
      await this.auditCreated(row, user, 'import');
    }
    return { dryRun: false, property, summary, items: report };
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
    const current = await this.findRow(this.prisma, organizationId, id);
    if (!current) throw new NotFoundException('Feição não encontrada.');
    if (user.role !== Role.COORDINATION && current.createdById !== user.id) {
      throw new ForbiddenException('Só a coordenação ou quem desenhou a feição pode excluí-la.');
    }
    const rows = await this.prisma.$queryRaw<{ version: number }[]>`
      UPDATE "PropertyFeature"
      SET "deletedAt" = now() AT TIME ZONE 'UTC', "updatedById" = ${user.id}
      WHERE id = ${id} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL
      RETURNING version`;
    if (!rows.length) throw new NotFoundException('Feição não encontrada.');
    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_FEATURE_DELETED',
      entity: 'PropertyFeature',
      entityId: id,
      details: { propertyId: current.propertyId, featureType: current.type, version: rows[0].version },
    });
    return { id, deleted: true, version: rows[0].version };
  }

  async findOne(id: string) {
    const row = await this.findRow(this.prisma, this.tenancy.organizationId(), id);
    if (!row) throw new NotFoundException('Feição não encontrada.');
    return featureView(row);
  }

  async listRows(propertyId: string): Promise<FeatureRow[]> {
    const organizationId = this.tenancy.organizationId();
    await this.requireProperty(this.prisma, organizationId, propertyId);
    return this.prisma.$queryRaw<FeatureRow[]>`
      SELECT ${FEATURE_COLUMNS} FROM "PropertyFeature" f
      WHERE f."propertyId" = ${propertyId} AND f."organizationId" = ${organizationId} AND f."deletedAt" IS NULL
      ORDER BY f.type, f."createdAt"`;
  }

  async listByProperty(propertyId: string) {
    const rows = await this.listRows(propertyId);
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

  private async requireProperty(raw: RawClient, organizationId: string, propertyId: string) {
    const rows = await raw.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Property" WHERE id = ${propertyId} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL`;
    if (!rows.length) throw new NotFoundException('Propriedade não encontrada.');
  }

  private async countPerimeters(raw: RawClient, organizationId: string, propertyId: string) {
    const [{ count }] = await raw.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "PropertyFeature"
      WHERE "propertyId" = ${propertyId} AND "organizationId" = ${organizationId}
        AND type = 'PERIMETER' AND "deletedAt" IS NULL`;
    return Number(count);
  }

  // Trava a propriedade para que dois perímetros não sejam criados ao mesmo tempo.
  private async lockAndCountPerimeters(raw: RawClient, organizationId: string, propertyId: string) {
    await raw.$queryRaw`
      SELECT id FROM "Property" WHERE id = ${propertyId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    return this.countPerimeters(raw, organizationId, propertyId);
  }

  // Devolve false quando o id já existe (em qualquer organização: não revelamos qual).
  private async insert(
    raw: RawClient,
    organizationId: string,
    f: { id: string; propertyId: string; type: PropertyFeatureType; name: string | null; geometry: string },
    user: AuthUser,
  ) {
    const inserted = await raw.$queryRaw<{ id: string }[]>`
      INSERT INTO "PropertyFeature" (
        "organizationId", id, "propertyId", type, name, geom, "createdById", "updatedById", "createdAt", "updatedAt"
      ) VALUES (
        ${organizationId}, ${f.id}, ${f.propertyId}, ${f.type}::"PropertyFeatureType", ${f.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${f.geometry}), 4326), ${user.id}, ${user.id},
        now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id`;
    return inserted.length > 0;
  }

  private async assertValid(raw: RawClient, geometry: string) {
    const [check] = await raw.$queryRaw<{ valid: boolean; reason: string }[]>`
      SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326) AS g) s`;
    if (!check.valid) throw new BadRequestException(translateInvalidReason(check.reason));
  }

  private auditCreated(row: FeatureRow, user: AuthUser, source?: 'import') {
    return this.audit.record({
      userId: user.id,
      action: 'PROPERTY_FEATURE_CREATED',
      entity: 'PropertyFeature',
      entityId: row.id,
      details: { propertyId: row.propertyId, featureType: row.type, version: 1, areaHa: num(row.areaHa), ...(source ? { source } : {}) },
    });
  }

  private async findRow(raw: RawClient, organizationId: string, id: string, opts: { includeDeleted?: boolean } = {}) {
    const rows = await raw.$queryRaw<FeatureRow[]>`
      SELECT ${FEATURE_COLUMNS} FROM "PropertyFeature" f
      WHERE f.id = ${id} AND f."organizationId" = ${organizationId}
      ${opts.includeDeleted ? Prisma.empty : Prisma.sql`AND f."deletedAt" IS NULL`}`;
    return rows[0] ?? null;
  }
}
