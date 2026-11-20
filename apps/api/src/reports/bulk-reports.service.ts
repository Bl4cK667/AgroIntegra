import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { maskCpf } from '../common/cpf';
import { parseDay, toDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { BulkFormat, BulkReportFiltersDto, BulkType } from './bulk-report.dto';
import { renderBulkTable, type BulkColumn } from './bulk.pdf';
import { toCsv } from './csv';

// Limites por arquivo. Acima disso a API pede para restringir os filtros.
export const BULK_LIMITS: Record<BulkFormat, number> = { csv: 20_000, pdf: 2_000 };

const TITLES: Record<BulkType, string> = {
  producers: 'Produtores',
  properties: 'Propriedades',
  visits: 'Visitas técnicas',
};

const AUDIT_ENTITY: Record<BulkType, string> = { producers: 'Producer', properties: 'Property', visits: 'Visit' };

const ENROLLMENT: Record<string, string> = { ENROLLED: 'Inscrito', APPROVED: 'Beneficiário', REJECTED: 'Não aprovado' };

const decimal = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? ''
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const br = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const brDate = (d: Date | null) => br(toDay(d));

interface Table {
  columns: BulkColumn[];
  rows: string[][];
}

// Filtros já validados e com a regra de permissão aplicada.
interface Scope {
  from?: Date;
  to?: Date;
  community?: string;
  technicianId?: string;
  programId?: string;
}

@Injectable()
export class BulkReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Técnico só exporta o que é dele: a API força o filtro, qualquer que seja o pedido.
  private scope(filters: BulkReportFiltersDto, user: AuthUser): Scope {
    if (Boolean(filters.from) !== Boolean(filters.to)) {
      throw new BadRequestException('Informe o início e o fim do período, ou deixe os dois em branco.');
    }
    const from = filters.from ? parseDay(filters.from, 'Início do período') : undefined;
    const to = filters.to ? parseDay(filters.to, 'Fim do período') : undefined;
    if (from && to && to < from) throw new BadRequestException('O fim do período não pode ser antes do início.');
    return {
      from,
      to,
      community: filters.community?.trim() || undefined,
      technicianId: user.role === Role.TECHNICIAN ? user.id : filters.technicianId,
      programId: filters.programId,
    };
  }

  // Visitas que contam para os filtros (período e técnico).
  private visitWhere(s: Scope): Prisma.VisitWhereInput {
    return {
      deletedAt: null,
      ...(s.from && s.to ? { visitedOn: { gte: s.from, lte: s.to } } : {}),
      ...(s.technicianId ? { technicianId: s.technicianId } : {}),
    };
  }

  // Período ou técnico informados: só entra quem teve visita que atende a eles.
  private needsVisit(s: Scope) {
    return Boolean((s.from && s.to) || s.technicianId);
  }

  private producerWhere(s: Scope): Prisma.ProducerWhereInput {
    return {
      deletedAt: null,
      ...(s.community ? { community: s.community } : {}),
      ...(s.programId ? { enrollments: { some: { programId: s.programId } } } : {}),
      ...(this.needsVisit(s) ? { visits: { some: this.visitWhere(s) } } : {}),
    };
  }

  private propertyWhere(s: Scope): Prisma.PropertyWhereInput {
    return {
      deletedAt: null,
      producer: {
        deletedAt: null,
        ...(s.community ? { community: s.community } : {}),
        ...(s.programId ? { enrollments: { some: { programId: s.programId } } } : {}),
      },
      ...(this.needsVisit(s) ? { visits: { some: this.visitWhere(s) } } : {}),
    };
  }

  private visitListWhere(s: Scope): Prisma.VisitWhereInput {
    return {
      ...this.visitWhere(s),
      producer: {
        deletedAt: null,
        ...(s.community ? { community: s.community } : {}),
        ...(s.programId ? { enrollments: { some: { programId: s.programId } } } : {}),
      },
    };
  }

  private countWhere(type: BulkType, s: Scope) {
    if (type === 'producers') return this.prisma.producer.count({ where: this.producerWhere(s) });
    if (type === 'properties') return this.prisma.property.count({ where: this.propertyWhere(s) });
    return this.prisma.visit.count({ where: this.visitListWhere(s) });
  }

  async count(type: BulkType, filters: BulkReportFiltersDto, user: AuthUser) {
    const total = await this.countWhere(type, this.scope(filters, user));
    return { type, total, limits: BULK_LIMITS };
  }

  // Opções dos selects da tela. Técnico vê só ele mesmo na lista de técnicos.
  async filterOptions(user: AuthUser) {
    const [communities, technicians, programs] = await Promise.all([
      this.prisma.producer.findMany({
        where: { deletedAt: null },
        distinct: ['community'],
        select: { community: true },
        orderBy: { community: 'asc' },
      }),
      this.prisma.visit.findMany({
        where: { deletedAt: null, ...(user.role === Role.TECHNICIAN ? { technicianId: user.id } : {}) },
        distinct: ['technicianId'],
        select: { technician: { select: { id: true, name: true } } },
      }),
      this.prisma.program.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return {
      communities: communities.map((c) => c.community),
      technicians: technicians.map((t) => t.technician).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      programs,
      technicianLocked: user.role === Role.TECHNICIAN,
      limits: BULK_LIMITS,
    };
  }

  async export(type: BulkType, format: BulkFormat, filters: BulkReportFiltersDto, user: AuthUser) {
    const s = this.scope(filters, user);
    const total = await this.countWhere(type, s);
    const limit = BULK_LIMITS[format];
    if (total > limit) {
      throw new BadRequestException(
        `A exportação teria ${total.toLocaleString('pt-BR')} registros, acima do limite de ${limit.toLocaleString('pt-BR')} para ${format.toUpperCase()}. Restrinja os filtros.`,
      );
    }

    const table = type === 'producers' ? await this.producers(s) : type === 'properties' ? await this.properties(s) : await this.visits(s);
    const description = await this.describe(s, user);
    const generatedAt = new Date();
    const stamp = toDay(generatedAt)!;
    const base = `relatorio-${type === 'producers' ? 'produtores' : type === 'properties' ? 'propriedades' : 'visitas'}-${stamp}`;

    await this.audit.record({
      userId: user.id,
      action: 'REPORT_EXPORTED',
      entity: AUDIT_ENTITY[type],
      details: {
        type,
        format,
        rows: table.rows.length,
        filters: {
          from: filters.from ?? null,
          to: filters.to ?? null,
          community: s.community ?? null,
          technicianId: s.technicianId ?? null,
          programId: s.programId ?? null,
        },
      },
    });

    if (format === 'csv') {
      const csv = toCsv(
        table.columns.map((c) => c.label),
        table.rows,
      );
      return { body: Buffer.from(csv, 'utf8'), contentType: 'text/csv; charset=utf-8', filename: `${base}.csv` };
    }
    const pdf = await renderBulkTable({
      title: `Relatório de ${TITLES[type].toLowerCase()}`,
      filters: description,
      columns: table.columns.filter((c) => c.pdf !== false),
      rows: table.rows.map((row) => row.filter((_, i) => table.columns[i].pdf !== false)),
      total: table.rows.length,
      generatedBy: user.name,
      generatedAt,
    });
    return { body: pdf, contentType: 'application/pdf', filename: `${base}.pdf` };
  }

  // Linha de filtros que vai no cabeçalho do PDF.
  private async describe(s: Scope, user: AuthUser) {
    const parts: string[] = [];
    parts.push(s.from && s.to ? `Período: ${brDate(s.from)} a ${brDate(s.to)}` : 'Período: todos');
    if (s.community) parts.push(`Comunidade: ${s.community}`);
    if (s.technicianId) {
      const name =
        s.technicianId === user.id
          ? user.name
          : (await this.prisma.visit.findFirst({ where: { technicianId: s.technicianId }, select: { technician: { select: { name: true } } } }))?.technician.name;
      parts.push(`Técnico: ${name ?? 'não encontrado'}`);
    }
    if (s.programId) {
      const program = await this.prisma.program.findFirst({ where: { id: s.programId }, select: { name: true } });
      parts.push(`Programa: ${program?.name ?? 'não encontrado'}`);
    }
    return parts.join('   ·   ');
  }

  private async producers(s: Scope): Promise<Table> {
    const visitWhere = this.visitWhere(s);
    const items = await this.prisma.producer.findMany({
      where: this.producerWhere(s),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        name: true,
        cpf: true,
        community: true,
        consentAt: true,
        properties: { where: { deletedAt: null }, select: { areaHa: true } },
        visits: { where: visitWhere, select: { visitedOn: true }, orderBy: { visitedOn: 'desc' } },
        _count: { select: { requests: { where: { deletedAt: null, status: { not: 'DONE' } } } } },
        enrollments: { select: { status: true, program: { select: { name: true } } }, orderBy: { enrolledOn: 'asc' } },
      },
    });
    return {
      columns: [
        { label: 'Produtor', width: 3 },
        { label: 'CPF', width: 1.6 },
        { label: 'Comunidade', width: 2 },
        { label: 'Consentimento', width: 1.4 },
        { label: 'Propriedades', width: 1.1, align: 'right' },
        { label: 'Área declarada (ha)', width: 1.4, align: 'right' },
        { label: 'Visitas', width: 0.9, align: 'right' },
        { label: 'Última visita', width: 1.3 },
        { label: 'Solicitações abertas', width: 1.3, align: 'right' },
        { label: 'Programas', width: 2.6 },
      ],
      rows: items.map((p) => [
        p.name,
        maskCpf(p.cpf),
        p.community,
        p.consentAt ? brDate(p.consentAt) : 'Pendente',
        String(p.properties.length),
        decimal(p.properties.reduce((sum, x) => sum + Number(x.areaHa), 0)),
        String(p.visits.length),
        brDate(p.visits[0]?.visitedOn ?? null),
        String(p._count.requests),
        p.enrollments.map((e) => `${e.program.name} (${ENROLLMENT[e.status]})`).join('; '),
      ]),
    };
  }

  private async properties(s: Scope): Promise<Table> {
    const items = await this.prisma.property.findMany({
      where: this.propertyWhere(s),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        name: true,
        locality: true,
        city: true,
        state: true,
        mainActivity: true,
        areaHa: true,
        calculatedAreaHa: true,
        producer: { select: { name: true, community: true } },
        visits: { where: this.visitWhere(s), select: { visitedOn: true }, orderBy: { visitedOn: 'desc' } },
      },
    });
    return {
      columns: [
        { label: 'Propriedade', width: 2.4 },
        { label: 'Produtor', width: 2.4 },
        { label: 'Comunidade', width: 1.8 },
        { label: 'Localidade', width: 1.8 },
        { label: 'Município/UF', width: 1.6 },
        { label: 'Atividade principal', width: 1.8 },
        { label: 'Área declarada (ha)', width: 1.3, align: 'right' },
        { label: 'Área calculada (ha)', width: 1.3, align: 'right' },
        { label: 'Demarcada', width: 1, align: 'center' },
        { label: 'Visitas', width: 0.9, align: 'right' },
        { label: 'Última visita', width: 1.3 },
      ],
      rows: items.map((p) => [
        p.name,
        p.producer.name,
        p.producer.community,
        p.locality,
        [p.city, p.state].filter(Boolean).join('/'),
        p.mainActivity ?? '',
        decimal(Number(p.areaHa)),
        p.calculatedAreaHa === null ? '' : decimal(Number(p.calculatedAreaHa)),
        p.calculatedAreaHa === null ? 'Não' : 'Sim',
        String(p.visits.length),
        brDate(p.visits[0]?.visitedOn ?? null),
      ]),
    };
  }

  private async visits(s: Scope): Promise<Table> {
    const items = await this.prisma.visit.findMany({
      where: this.visitListWhere(s),
      orderBy: [{ visitedOn: 'desc' }, { createdAt: 'desc' }],
      select: {
        visitedOn: true,
        diagnosis: true,
        actionPlan: true,
        returnOn: true,
        impact: true,
        producer: { select: { name: true, community: true } },
        property: { select: { name: true } },
        technician: { select: { name: true } },
        request: { select: { subject: true } },
        _count: { select: { photos: true } },
      },
    });
    return {
      columns: [
        { label: 'Data', width: 1 },
        { label: 'Produtor', width: 2 },
        { label: 'Comunidade', width: 1.5 },
        { label: 'Propriedade', width: 1.6 },
        { label: 'Técnico', width: 1.6 },
        { label: 'Diagnóstico', width: 3.2 },
        { label: 'Plano de ação', width: 3.2 },
        { label: 'Retorno', width: 1 },
        { label: 'Impacto', width: 2, pdf: false },
        { label: 'Solicitação', width: 1.6, pdf: false },
        { label: 'Fotos', width: 0.7, align: 'right' },
      ],
      rows: items.map((v) => [
        brDate(v.visitedOn),
        v.producer.name,
        v.producer.community,
        v.property?.name ?? '',
        v.technician.name,
        v.diagnosis,
        v.actionPlan,
        brDate(v.returnOn),
        v.impact ?? '',
        v.request?.subject ?? '',
        String(v._count.photos),
      ]),
    };
  }
}
