import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { resolveCorsOrigins } from '../common/http-security';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { DEFAULT_INVITE_HOURS } from './invitation.dto';
import { buildRegistrationUrl, deriveAuthUserId, generateInvitationToken } from './invitation-token';

const HOUR_MS = 60 * 60 * 1000;

const LIST_SELECT = { id: true, email: true, role: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true } as const;

// Convites da organização atual. A tabela Invitation NÃO é auto-escopada: todo acesso filtra
// organizationId explicitamente, vindo do contexto validado pelo AuthGuard (nunca do corpo).
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, input: { email: string; role: Role; expiresInHours?: number }, now = new Date()) {
    const organizationId = this.tenancy.organizationId();
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      // Vincular conta já existente a outra organização é operação administrativa à parte.
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(now.getTime() + (input.expiresInHours ?? DEFAULT_INVITE_HOURS) * HOUR_MS);

    const invitation = await this.prisma.$transaction(async (tx) => {
      // Só o convite mais recente para o mesmo e-mail vale: pendentes anteriores são revogados.
      await tx.invitation.updateMany({
        where: { organizationId, email, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.invitation.create({
        data: { email, tokenHash, organizationId, role: input.role, createdById: actor.id, expiresAt },
        select: { id: true, email: true, role: true, expiresAt: true },
      });
    });

    await this.audit.record({
      userId: actor.id,
      action: 'INVITATION_CREATED',
      entity: 'Invitation',
      entityId: invitation.id,
      details: { role: invitation.role, expiresAt: invitation.expiresAt.toISOString() },
    });

    // O token em claro só existe nesta resposta; quem gera entrega o link à pessoa convidada.
    return { ...invitation, registrationUrl: buildRegistrationUrl(resolveCorsOrigins()[0], token) };
  }

  async list() {
    const organizationId = this.tenancy.organizationId();
    const items = await this.prisma.invitation.findMany({
      where: { organizationId },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { items };
  }

  // Revoga convite pendente OU reservado e ainda não concluído (cadastro em andamento/abandonado).
  // O cadastro revalida revokedAt dentro da transação final; se a revogação vencer, ele aborta e compensa.
  async revoke(actor: AuthUser, id: string, now = new Date()) {
    const organizationId = this.tenancy.organizationId();
    if (!id || id.length > 64) throw new NotFoundException('Convite não encontrado.');
    const found = await this.prisma.invitation.findFirst({ where: { id, organizationId }, select: { id: true, usedAt: true, revokedAt: true } });
    // Convite de outra organização responde igual a inexistente.
    if (!found) throw new NotFoundException('Convite não encontrado.');
    if (found.revokedAt) throw new ConflictException('Este convite já foi cancelado.');
    if (found.usedAt && (await this.prisma.user.findUnique({ where: { authUserId: deriveAuthUserId(id) }, select: { id: true } }))) {
      throw new ConflictException('Este convite já foi utilizado.');
    }
    const { count } = await this.prisma.invitation.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (!count) throw new ConflictException('Este convite já foi cancelado.');
    await this.audit.record({ userId: actor.id, action: 'INVITATION_REVOKED', entity: 'Invitation', entityId: id });
    return { id, revokedAt: now };
  }
}
