import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthClient, SupabaseAuthError } from '../supabase/supabase-auth.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { deriveAuthUserId, hashInvitationToken, isWellFormedToken } from './invitation-token';

export const MSG = {
  invalid: 'Convite inválido. Confira o link recebido ou peça um novo à administração.',
  expired: 'Este convite expirou. Peça um novo convite à administração.',
  revoked: 'Este convite foi cancelado. Peça um novo convite à administração.',
  used: 'Este convite já foi utilizado. Se já tem cadastro, faça login.',
  inProgress: 'Este cadastro já está sendo concluído. Aguarde alguns instantes e tente novamente.',
  emailMismatch: 'Use o mesmo e-mail para o qual o convite foi enviado.',
  accountExists: 'Já existe uma conta com este e-mail. Faça login ou procure a administração.',
  remoteConflict: 'Não foi possível concluir o cadastro com este e-mail. Procure a administração.',
  rejected: 'Não foi possível concluir o cadastro com esses dados. Revise as informações e tente novamente.',
  unavailable: 'O cadastro está temporariamente indisponível. Tente novamente em alguns minutos.',
  closed: 'O cadastro por convite ainda não está disponível. Procure a administração.',
  done: 'Cadastro concluído. Agora você já pode entrar com seu e-mail e senha.',
} as const;

// Reserva de convite (usedAt) sem usuário local após este tempo é considerada abandonada
// (processo caiu no meio) e pode ser retomada, ainda dentro da validade do convite.
export const STALE_CLAIM_MS = 10 * 60 * 1000;

type Lease = { invitationId: string; at: Date };

type InvitationRow = {
  id: string;
  email: string;
  organizationId: string;
  role: Prisma.InvitationGetPayload<object>['role'];
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  organization: { name: string; active: boolean };
};

const INVITATION_SELECT = {
  id: true,
  email: true,
  organizationId: true,
  role: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
  organization: { select: { name: true, active: true } },
} as const;

// Cadastro fechado: só com convite válido, de uso único, com e-mail/perfil/organização fixos no convite.
// Não há cadastro público no Supabase: contas são criadas pela Admin API, no servidor, após validar o convite.
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAuthClient,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  // Pré-visualização para a página de cadastro. Não reserva o convite.
  async inspect(token: string, now = new Date()) {
    const invitation = await this.find(token);
    await this.assertUsable(invitation, now, { allowStaleClaim: true });
    return { email: invitation.email, organizationName: invitation.organization.name, expiresAt: invitation.expiresAt };
  }

  async register(input: { token: string; name: string; email: string; phone: string; password: string }, now = new Date()) {
    // Fail-closed: sem SUPABASE_REGISTRATION_ENABLED + service role, nada é criado (nem local, nem remoto).
    if (!this.supabase.registrationEnabled) throw new ServiceUnavailableException(MSG.closed);

    const invitation = await this.find(input.token);
    await this.assertUsable(invitation, now, { allowStaleClaim: true });
    const email = input.email.trim().toLowerCase();
    if (email !== invitation.email.toLowerCase()) throw new BadRequestException(MSG.emailMismatch);
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException(MSG.accountExists);

    // 1) Reserva atômica (compare-and-swap no usedAt observado): só uma requisição concorrente vence.
    // A reserva funciona como lease: `lease.at` é o valor de usedAt que ESTA tentativa possui.
    const lease = { invitationId: invitation.id, at: now };
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitation.id, usedAt: invitation.usedAt, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: lease.at },
    });
    if (count !== 1) throw new ConflictException(MSG.inProgress);

    const authUserId = deriveAuthUserId(invitation.id);
    try {
      // 2) Conta remota (idempotente pelo id determinístico).
      await this.ensureRemoteUser(lease, authUserId, email, input.password, input.name);

      // 3) Conta local + membership, revalidando a reserva (convite pode ter sido revogado no meio).
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10); // inutilizável: login vai ao Supabase
      const user = await this.prisma.$transaction(async (tx) => {
        // Revalida tudo na finalização: reserva ainda nossa, não revogada, não expirada e organização ativa.
        // (Quem emitiu o convite pode ter sido desativado depois: a emissão já foi autorizada e continua valendo.)
        const finalNow = new Date(Math.max(Date.now(), now.getTime()));
        const still = await tx.invitation.updateMany({
          where: { id: invitation.id, usedAt: lease.at, revokedAt: null, expiresAt: { gt: finalNow } },
          data: { usedAt: lease.at },
        });
        if (still.count !== 1) {
          // Diz o motivo real: revogado, expirado, concluído por outra tentativa ou reserva tomada.
          const cur = await tx.invitation.findUnique({ where: { id: invitation.id }, select: { revokedAt: true, expiresAt: true } });
          if (!cur || cur.revokedAt) throw new GoneException(MSG.revoked);
          if (cur.expiresAt.getTime() <= finalNow.getTime()) throw new GoneException(MSG.expired);
          if (await tx.user.findUnique({ where: { authUserId }, select: { id: true } })) throw new GoneException(MSG.used);
          throw new ConflictException(MSG.inProgress);
        }
        const org = await tx.organization.findFirst({ where: { id: invitation.organizationId, active: true }, select: { id: true } });
        if (!org) throw new GoneException(MSG.revoked);
        const created = await tx.user.create({
          data: { name: input.name, email, phone: input.phone, passwordHash, role: invitation.role, authUserId, active: true },
          select: { id: true },
        });
        await tx.organizationMembership.create({
          data: { userId: created.id, organizationId: invitation.organizationId, role: invitation.role, active: true },
        });
        return created;
      });

      await this.safeAudit(invitation.organizationId, user.id, {
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: user.id,
        details: { invitationId: invitation.id, role: invitation.role },
      });
      return { message: MSG.done };
    } catch (err) {
      await this.releaseLease(lease);
      throw this.toHttp(err);
    }
  }

  private async find(token: string): Promise<InvitationRow> {
    if (!isWellFormedToken(token)) throw new NotFoundException(MSG.invalid);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: INVITATION_SELECT,
    });
    if (!invitation) throw new NotFoundException(MSG.invalid);
    return invitation;
  }

  private async assertUsable(invitation: InvitationRow, now: Date, { allowStaleClaim }: { allowStaleClaim: boolean }) {
    if (invitation.revokedAt) throw new GoneException(MSG.revoked);
    if (!invitation.organization.active) throw new GoneException(MSG.revoked);
    if (invitation.expiresAt.getTime() <= now.getTime()) throw new GoneException(MSG.expired);
    if (!invitation.usedAt) return;

    // usedAt preenchido: concluído (há usuário) ou reserva em andamento/abandonada.
    const authUserId = deriveAuthUserId(invitation.id);
    const completed = await this.prisma.user.findFirst({
      where: { OR: [{ authUserId }, { email: invitation.email.toLowerCase() }] },
      select: { id: true },
    });
    if (completed) throw new GoneException(MSG.used);
    const stale = now.getTime() - invitation.usedAt.getTime() >= STALE_CLAIM_MS;
    if (!allowStaleClaim || !stale) throw new ConflictException(MSG.inProgress);
  }

  // Garante a conta remota DESTE convite (id determinístico) e confere que o Supabase devolveu exatamente ela.
  //
  // Contas remotas NUNCA são apagadas automaticamente pelo cadastro: com reservas retomáveis, outra
  // tentativa pode já ter adotado e vinculado a mesma conta, e um delete atrasado a destruiria.
  // Uma conta remota sem User local (authUserId) e sem membership não acessa nada: login e guard exigem
  // ambos. Ela é recuperada pela próxima tentativa do mesmo convite (mesmo id). Contas com outro id
  // (de terceiros ou criadas fora do convite) nunca são assumidas, alteradas nem apagadas.
  //
  // RECONCILIAÇÃO ADMINISTRATIVA: se o convite expirar ou for revogado com uma conta remota órfã
  // (id = deriveAuthUserId(invitation.id), sem User.authUserId correspondente), a administração deve
  // removê-la manualmente no painel do Supabase (ou por rotina administrativa futura que confira
  // a ausência de vínculo local antes de apagar).
  private async ensureRemoteUser(lease: Lease, id: string, email: string, password: string, name: string) {
    let created: { id: string; email: string | null };
    try {
      created = await this.supabase.createUser({ id, email, password, name });
    } catch (err) {
      if (!(err instanceof SupabaseAuthError) || err.kind !== 'email_exists') throw err;
      const remote = await this.supabase.getUser(id);
      if (!remote || remote.email !== email) throw new ConflictException(MSG.remoteConflict);
      // Antes de mexer numa conta existente: renova o lease (CAS). Se outra tentativa retomou a reserva
      // ou concluiu o cadastro, esta aborta sem tocar na conta (não sobrescreve a senha de quem venceu).
      await this.renewLease(lease);
      if (await this.prisma.user.findUnique({ where: { authUserId: id }, select: { id: true } })) {
        throw new GoneException(MSG.used);
      }
      await this.supabase.updatePassword(id, password);
      return;
    }
    if (created.id !== id || created.email !== email) {
      // Supabase ignorou o id pedido ou devolveu outra conta: não seguimos (identidade não garantida).
      this.logger.error('Cadastro por convite: Supabase devolveu conta diferente da esperada.');
      throw new SupabaseAuthError('identity_mismatch');
    }
  }

  // CAS do lease: só renova se usedAt ainda é o desta tentativa. Novo valor estritamente diferente.
  private async renewLease(lease: Lease) {
    const next = new Date(Math.max(Date.now(), lease.at.getTime() + 1));
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: lease.invitationId, usedAt: lease.at, revokedAt: null },
      data: { usedAt: next },
    });
    if (count !== 1) throw new ConflictException(MSG.inProgress);
    lease.at = next;
  }

  // Compensação: só libera a reserva, e só se ainda for desta tentativa (CAS). Nunca apaga conta remota
  // e nunca desfaz reserva/finalização de outra tentativa.
  private async releaseLease(lease: Lease) {
    try {
      await this.prisma.invitation.updateMany({ where: { id: lease.invitationId, usedAt: lease.at }, data: { usedAt: null } });
    } catch (err) {
      // Sem liberar, a reserva vira "abandonada" após STALE_CLAIM_MS e pode ser retomada.
      this.logger.error(`Reserva do convite ${lease.invitationId} não liberada (${errKind(err)}).`);
    }
  }

  private toHttp(err: unknown): HttpException {
    if (err instanceof HttpException) return err;
    if (err instanceof SupabaseAuthError) {
      if (err.kind === 'email_exists') return new ConflictException(MSG.remoteConflict);
      if (err.kind === 'rejected') return new BadRequestException(MSG.rejected);
      if (err.kind === 'disabled') return new ServiceUnavailableException(MSG.closed);
      if (err.kind === 'identity_mismatch') return new ConflictException(MSG.remoteConflict);
      return new ServiceUnavailableException(MSG.unavailable);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return new ConflictException(MSG.accountExists);
    this.logger.error(`Cadastro por convite falhou (${errKind(err)}).`);
    return new ServiceUnavailableException(MSG.unavailable);
  }

  private async safeAudit(organizationId: string, userId: string, entry: Omit<Parameters<AuditService['record']>[0], 'userId'>) {
    try {
      await this.tenancy.run({ organizationId, userId }, () => this.audit.record({ ...entry, userId }));
    } catch (err) {
      // Cadastro já foi concluído; falha de auditoria não deve desfazer nem esconder o sucesso.
      this.logger.error(`Auditoria do cadastro não registrada (${errKind(err)}).`);
    }
  }
}

function errKind(err: unknown) {
  if (err instanceof SupabaseAuthError) return `supabase:${err.kind}`;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `prisma:${err.code}`;
  return err instanceof Error ? err.name : typeof err;
}
