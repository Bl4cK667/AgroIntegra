import { Injectable } from '@nestjs/common';
import { GeoFeaturesService } from '../geo/geo-features.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cursor, decodeCursor, encodeCursor, Position, PULL_ENTITIES, PullEntity } from './sync-cursor';
import { DEFAULT_PULL_LIMIT } from './sync.dto';
import { SYNC_VISIT_SELECT, syncFeature, syncProducer, syncProperty, syncRequest, syncVisit } from './sync-views';

// Margem de segurança do pull. Uma gravação pode receber o updatedAt e só terminar a transação
// depois; se o pull já tivesse passado daquele instante, ela nunca seria entregue. Por isso o pull
// só entrega o que tem updatedAt até "agora menos a margem" (o restante vem no próximo pull).
// Pressupõe os relógios da API e do banco sincronizados (NTP).
export const DEFAULT_PULL_LAG_MS = 5000;

interface Page {
  rows: { updatedAt: Date; id: string }[];
  items: unknown[];
}

@Injectable()
export class SyncPullService {
  private readonly lagMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly features: GeoFeaturesService,
  ) {
    const env = Number(process.env.SYNC_PULL_LAG_MS);
    this.lagMs = Number.isFinite(env) && env >= 0 ? env : DEFAULT_PULL_LAG_MS;
  }

  async pull(since: string | undefined, limit = DEFAULT_PULL_LIMIT) {
    const cursor = decodeCursor(since);
    const serverTime = new Date();
    const until = new Date(serverTime.getTime() - this.lagMs);

    const next: Cursor = { ...cursor };
    const changes = {} as Record<PullEntity, unknown[]>;
    let hasMore = false;

    // Uma entidade por vez, em sequência: o escopo de organização usa AsyncLocalStorage.
    for (const entity of PULL_ENTITIES) {
      const page = await this.page(entity, cursor[entity] ?? null, until, limit + 1);
      if (page.rows.length > limit) {
        hasMore = true;
        page.rows = page.rows.slice(0, limit);
        page.items = page.items.slice(0, limit);
      }
      const last = page.rows[page.rows.length - 1];
      if (last) next[entity] = { updatedAt: last.updatedAt, id: last.id };
      changes[entity] = page.items;
    }

    return { cursor: encodeCursor(next), hasMore, serverTime, changes };
  }

  private async page(entity: PullEntity, after: Position | null, until: Date, take: number): Promise<Page> {
    // (updatedAt, id) > after, até `until`, na mesma ordem do cursor.
    const where = {
      updatedAt: { lte: until },
      ...(after ? { OR: [{ updatedAt: { gt: after.updatedAt } }, { updatedAt: after.updatedAt, id: { gt: after.id } }] } : {}),
    };
    const orderBy = [{ updatedAt: 'asc' as const }, { id: 'asc' as const }];

    switch (entity) {
      case 'producers': {
        const rows = await this.prisma.producer.findMany({ where, orderBy, take });
        return { rows, items: rows.map(syncProducer) };
      }
      case 'properties': {
        const rows = await this.prisma.property.findMany({ where, orderBy, take });
        return { rows, items: rows.map(syncProperty) };
      }
      case 'requests': {
        const rows = await this.prisma.serviceRequest.findMany({ where, orderBy, take });
        return { rows, items: rows.map(syncRequest) };
      }
      case 'visits': {
        const rows = await this.prisma.visit.findMany({ where, orderBy, take, select: SYNC_VISIT_SELECT });
        return { rows, items: rows.map(syncVisit) };
      }
      case 'features': {
        const rows = await this.features.changedSince(after, until, take);
        return { rows, items: rows.map(syncFeature) };
      }
    }
  }
}
