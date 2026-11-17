import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly tenancy: TenancyService) {}

  async record(entry: AuditEntry) {
    // Resolve the lazy PrismaPromise while the caller's AsyncLocalStorage context is active.
    // Returning it synchronously from tenancy.run would start the query after that scope ended.
    if (!this.tenancy.current()?.organizationId) return await this.prisma.recordSecurityEvent(entry);
    return await this.prisma.auditLog.create({ data: entry });
  }

  latest(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, role: true } } },
    });
  }
}
