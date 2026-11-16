import { Injectable } from '@nestjs/common';
import { periods } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';

// Indicadores do painel. Nenhum número é fixo: tudo sai do banco a cada chamada.
// Regra de consistência: a soma dos meses e a soma das comunidades são iguais às visitas do ano.
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(now = new Date()) {
    const p = periods(now);
    const inYear = { visitedOn: { gte: p.yearStartDay, lt: p.nextYearStartDay } };

    const [openByStatus, highPriorityOpen, completedThisMonth, visitsThisYear, served, producersTotal, byMonth, byCommunity] =
      await Promise.all([
        this.prisma.serviceRequest.groupBy({ by: ['status'], where: { status: { not: 'DONE' } }, _count: { _all: true } }),
        this.prisma.serviceRequest.count({ where: { status: { not: 'DONE' }, priority: 'HIGH' } }),
        this.prisma.serviceRequest.count({
          where: { status: 'DONE', completedAt: { gte: p.monthStart, lt: p.nextMonthStart } },
        }),
        this.prisma.visit.count({ where: inYear }),
        this.prisma.visit.groupBy({ by: ['producerId'], where: inYear }),
        this.prisma.producer.count(),
        this.prisma.$queryRaw<{ month: number; visits: number }[]>`
          SELECT EXTRACT(MONTH FROM "visitedOn")::int AS month, COUNT(*)::int AS visits
          FROM "Visit"
          WHERE "visitedOn" >= ${p.yearStartDay} AND "visitedOn" < ${p.nextYearStartDay}
          GROUP BY 1`,
        this.prisma.$queryRaw<{ community: string; visits: number; producers: number }[]>`
          SELECT pr."community" AS community, COUNT(*)::int AS visits, COUNT(DISTINCT v."producerId")::int AS producers
          FROM "Visit" v
          JOIN "Producer" pr ON pr."id" = v."producerId"
          WHERE v."visitedOn" >= ${p.yearStartDay} AND v."visitedOn" < ${p.nextYearStartDay}
          GROUP BY pr."community"
          ORDER BY visits DESC, community ASC`,
      ]);

    const open = { NEW: 0, IN_REVIEW: 0, SCHEDULED: 0 };
    for (const g of openByStatus) open[g.status as keyof typeof open] = g._count._all;

    const visitsByMonth = Array.from({ length: 12 }, (_, i) => byMonth.find((m) => m.month === i + 1)?.visits ?? 0);

    return {
      year: p.year,
      month: p.month,
      openRequests: open.NEW + open.IN_REVIEW + open.SCHEDULED,
      openByStatus: open,
      highPriorityOpen,
      completedThisMonth,
      visitsThisYear,
      producersServed: served.length,
      producersTotal,
      visitsByMonth,
      visitsByCommunity: byCommunity,
    };
  }
}
