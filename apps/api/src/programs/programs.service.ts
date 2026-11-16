import { Injectable, NotFoundException } from '@nestjs/common';
import { Program } from '@prisma/client';
import { toDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';

// Percentual com uma casa decimal; meta ou orçamento zerado dá 0.
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

interface Counts {
  enrolled: number;
  approved: number;
  rejected: number;
  deliveries: number;
  deliveredQuantity: number;
  spentCents: number;
}

// Indicadores de um programa. "Inscritos" conta todas as inscrições; "beneficiários" só as aprovadas.
function programView(p: Program, c: Counts) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startsOn: toDay(p.startsOn),
    endsOn: toDay(p.endsOn),
    unit: p.unit,
    slots: p.slots,
    enrolled: c.enrolled,
    approved: c.approved,
    rejected: c.rejected,
    pending: c.enrolled - c.approved - c.rejected,
    openSlots: Math.max(0, p.slots - c.approved),
    deliveryCount: c.deliveries,
    goalQuantity: p.goalQuantity,
    deliveredQuantity: c.deliveredQuantity,
    physicalPercent: percent(c.deliveredQuantity, p.goalQuantity),
    budgetCents: p.budgetCents,
    spentCents: c.spentCents,
    financialPercent: percent(c.spentCents, p.budgetCents),
  };
}

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  private async counts(programIds: string[]) {
    const [enrollments, deliveries] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ['programId', 'status'],
        where: { programId: { in: programIds } },
        _count: { _all: true },
      }),
      this.prisma.delivery.groupBy({
        by: ['programId'],
        where: { programId: { in: programIds } },
        _count: { _all: true },
        _sum: { quantity: true, valueCents: true },
      }),
    ]);
    const map = new Map<string, Counts>();
    for (const id of programIds) {
      map.set(id, { enrolled: 0, approved: 0, rejected: 0, deliveries: 0, deliveredQuantity: 0, spentCents: 0 });
    }
    for (const e of enrollments) {
      const c = map.get(e.programId)!;
      c.enrolled += e._count._all;
      if (e.status === 'APPROVED') c.approved += e._count._all;
      if (e.status === 'REJECTED') c.rejected += e._count._all;
    }
    for (const d of deliveries) {
      const c = map.get(d.programId)!;
      c.deliveries = d._count._all;
      c.deliveredQuantity = d._sum.quantity ?? 0;
      c.spentCents = d._sum.valueCents ?? 0;
    }
    return map;
  }

  async list() {
    const programs = await this.prisma.program.findMany({ orderBy: [{ startsOn: 'desc' }, { name: 'asc' }] });
    const counts = await this.counts(programs.map((p) => p.id));
    return { items: programs.map((p) => programView(p, counts.get(p.id)!)), total: programs.length };
  }

  async get(id: string) {
    const p = await this.prisma.program.findUnique({
      where: { id },
      include: {
        enrollments: {
          orderBy: [{ status: 'asc' }, { enrolledOn: 'asc' }],
          include: { producer: { select: { id: true, name: true, community: true } } },
        },
        deliveries: {
          orderBy: [{ deliveredOn: 'desc' }, { createdAt: 'desc' }],
          include: { producer: { select: { id: true, name: true, community: true } } },
        },
      },
    });
    if (!p) throw new NotFoundException('Programa não encontrado.');
    const counts = await this.counts([p.id]);
    return {
      ...programView(p, counts.get(p.id)!),
      enrollments: p.enrollments.map((e) => ({
        id: e.id,
        producer: e.producer,
        status: e.status,
        enrolledOn: toDay(e.enrolledOn),
      })),
      deliveries: p.deliveries.map((d) => ({
        id: d.id,
        producer: d.producer,
        deliveredOn: toDay(d.deliveredOn),
        quantity: d.quantity,
        valueCents: d.valueCents,
        note: d.note,
      })),
    };
  }
}
