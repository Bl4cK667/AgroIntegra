import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { maskCpf } from '../common/cpf';
import { parseDay, toDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { renderProducerReport } from './report.pdf';

export interface ReportPeriod {
  from: string; // AAAA-MM-DD, inclusive
  to: string; // AAAA-MM-DD, inclusive
}

// Converte o período em limites: dias (colunas DATE) e instantes no fuso local (colunas com hora).
function bounds(period: ReportPeriod) {
  const fromDay = parseDay(period.from, 'Início do período');
  const toDayDate = parseDay(period.to, 'Fim do período');
  if (toDayDate < fromDay) throw new BadRequestException('O fim do período não pode ser antes do início.');
  const [fy, fm, fd] = period.from.split('-').map(Number);
  const [ty, tm, td] = period.to.split('-').map(Number);
  return {
    fromDay,
    toDay: toDayDate,
    fromInstant: new Date(fy, fm - 1, fd),
    afterInstant: new Date(ty, tm - 1, td + 1),
  };
}

export type ProducerReport = Awaited<ReturnType<ReportsService['producerReport']>>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Dados do relatório de um produtor no período. A tela mostra este JSON; o PDF é desenhado a partir dele.
  async producerReport(producerId: string, period: ReportPeriod) {
    const b = bounds(period);
    const producer = await this.prisma.producer.findUnique({
      where: { id: producerId },
      include: { properties: { orderBy: { name: 'asc' } } },
    });
    if (!producer) throw new NotFoundException('Produtor não encontrado.');

    const [visits, requestsOpened, requestsCompleted, deliveries, enrollments] = await Promise.all([
      this.prisma.visit.findMany({
        where: { producerId, visitedOn: { gte: b.fromDay, lte: b.toDay } },
        orderBy: [{ visitedOn: 'asc' }, { createdAt: 'asc' }],
        include: {
          property: { select: { name: true } },
          technician: { select: { name: true } },
          request: { select: { subject: true } },
          _count: { select: { photos: true } },
        },
      }),
      this.prisma.serviceRequest.findMany({
        where: { producerId, createdAt: { gte: b.fromInstant, lt: b.afterInstant } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.serviceRequest.count({
        where: { producerId, status: 'DONE', completedAt: { gte: b.fromInstant, lt: b.afterInstant } },
      }),
      this.prisma.delivery.findMany({
        where: { producerId, deliveredOn: { gte: b.fromDay, lte: b.toDay } },
        orderBy: { deliveredOn: 'asc' },
        include: { program: { select: { name: true, unit: true, unitSingular: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: { producerId },
        orderBy: { enrolledOn: 'asc' },
        include: { program: { select: { name: true } } },
      }),
    ]);

    return {
      period,
      producer: {
        id: producer.id,
        name: producer.name,
        cpf: maskCpf(producer.cpf),
        community: producer.community,
        phone: producer.phone,
        consentAt: producer.consentAt,
      },
      properties: producer.properties.map((p) => ({
        name: p.name,
        locality: p.locality,
        areaHa: Number(p.areaHa),
        mainActivity: p.mainActivity,
      })),
      totals: {
        visits: visits.length,
        requestsOpened: requestsOpened.length,
        requestsCompleted,
        deliveries: deliveries.length,
        deliveredValueCents: deliveries.reduce((sum, d) => sum + d.valueCents, 0),
      },
      visits: visits.map((v) => ({
        id: v.id,
        visitedOn: toDay(v.visitedOn)!,
        property: v.property?.name ?? null,
        technician: v.technician.name,
        request: v.request?.subject ?? null,
        diagnosis: v.diagnosis,
        actionPlan: v.actionPlan,
        returnOn: toDay(v.returnOn),
        impact: v.impact,
        photoCount: v._count.photos,
        hasSignature: v.signature !== null,
        hasLocation: v.latitude !== null,
      })),
      requests: requestsOpened.map((r) => ({
        subject: r.subject,
        priority: r.priority,
        status: r.status,
        openedAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      programs: enrollments.map((e) => ({ name: e.program.name, status: e.status, enrolledOn: toDay(e.enrolledOn)! })),
      deliveries: deliveries.map((d) => ({
        program: d.program.name,
        deliveredOn: toDay(d.deliveredOn)!,
        quantity: d.quantity,
        unit: d.quantity === 1 && d.program.unitSingular ? d.program.unitSingular : d.program.unit,
        valueCents: d.valueCents,
        note: d.note,
      })),
    };
  }

  // PDF do relatório. Exportar dados pessoais fica registrado na auditoria (LGPD).
  async producerPdf(producerId: string, period: ReportPeriod, user: AuthUser) {
    const data = await this.producerReport(producerId, period);
    const pdf = await renderProducerReport(data, { generatedBy: user.name, generatedAt: new Date() });
    await this.audit.record({
      userId: user.id,
      action: 'REPORT_GENERATED',
      entity: 'Producer',
      entityId: producerId,
      details: { from: period.from, to: period.to },
    });
    return { pdf, filename: `relatorio-${slug(data.producer.name)}-${period.from}-a-${period.to}.pdf` };
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
