import { PrismaService } from '../src/prisma/prisma.service';

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Regra da fase 4: todo número do painel confere com uma contagem feita direto no banco.
// As contagens de referência abaixo leem as linhas cruas e filtram em JavaScript,
// por um caminho diferente do usado pela API.
export async function countFromDatabase(prisma: PrismaService) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const [requests, visits, producers] = await Promise.all([
    prisma.serviceRequest.findMany(),
    prisma.visit.findMany({ include: { producer: true } }),
    prisma.producer.findMany(),
  ]);
  const visitYear = (v: { visitedOn: Date }) => Number(v.visitedOn.toISOString().slice(0, 4));
  const visitMonth = (v: { visitedOn: Date }) => Number(v.visitedOn.toISOString().slice(5, 7));
  const thisYear = visits.filter((v) => visitYear(v) === year);
  const open = requests.filter((r) => r.status !== 'DONE');

  const communities = new Map<string, { visits: number; producers: Set<string> }>();
  for (const v of thisYear) {
    const c = communities.get(v.producer.community) ?? { visits: 0, producers: new Set() };
    c.visits++;
    c.producers.add(v.producerId);
    communities.set(v.producer.community, c);
  }

  return {
    openRequests: open.length,
    openByStatus: {
      NEW: open.filter((r) => r.status === 'NEW').length,
      IN_REVIEW: open.filter((r) => r.status === 'IN_REVIEW').length,
      SCHEDULED: open.filter((r) => r.status === 'SCHEDULED').length,
    },
    highPriorityOpen: open.filter((r) => r.priority === 'HIGH').length,
    completedThisMonth: requests.filter(
      (r) => r.status === 'DONE' && r.completedAt && r.completedAt.getFullYear() === year && r.completedAt.getMonth() === month,
    ).length,
    visitsThisYear: thisYear.length,
    producersServed: new Set(thisYear.map((v) => v.producerId)).size,
    producersTotal: producers.length,
    visitsByMonth: Array.from({ length: 12 }, (_, i) => thisYear.filter((v) => visitMonth(v) === i + 1).length),
    visitsByCommunity: [...communities.entries()]
      .map(([community, c]) => ({ community, visits: c.visits, producers: c.producers.size }))
      .sort((a, b) => b.visits - a.visits || a.community.localeCompare(b.community)),
  };
}
