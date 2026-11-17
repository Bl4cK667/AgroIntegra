import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveMembership {
  organizationId: string;
  organizationName: string;
  role: Role;
}

export const NO_ACTIVE_ORGANIZATION = 'Sua conta não está vinculada a uma organização ativa.';
export const ORGANIZATION_FORBIDDEN = 'Você não tem acesso a esta organização.';
export const ORGANIZATION_REQUIRED = 'Selecione a organização para continuar.';

// Aceita só identificadores com formato de UUID (o cabeçalho vem do cliente).
const ORG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Memberships ativas em organizações ativas. Tabela de membership NÃO é auto-escopada:
// sempre filtrada por userId explicitamente.
@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async active(userId: string): Promise<ActiveMembership[]> {
    const rows = await this.prisma.organizationMembership.findMany({
      where: { userId, active: true, organization: { active: true } },
      select: { organizationId: true, role: true, organization: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ organizationId: m.organizationId, organizationName: m.organization.name, role: m.role }));
  }

  // Organização da requisição: a pedida no cabeçalho (validada contra memberships ativas) ou a única ativa.
  async resolve(userId: string, requested?: string | string[]): Promise<ActiveMembership> {
    if (Array.isArray(requested)) throw new ForbiddenException(ORGANIZATION_FORBIDDEN);
    const requestedId = requested?.trim();
    if (requestedId && !ORG_ID.test(requestedId)) throw new ForbiddenException(ORGANIZATION_FORBIDDEN);

    const memberships = await this.active(userId);
    if (!memberships.length) throw new ForbiddenException(NO_ACTIVE_ORGANIZATION);
    if (requestedId) {
      const match = memberships.find((m) => m.organizationId.toLowerCase() === requestedId.toLowerCase());
      if (!match) throw new ForbiddenException(ORGANIZATION_FORBIDDEN);
      return match;
    }
    if (memberships.length > 1) throw new ForbiddenException(ORGANIZATION_REQUIRED);
    return memberships[0];
  }
}
