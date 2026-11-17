import { ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthClient, SupabaseAuthError } from '../supabase/supabase-auth.client';
import { TenancyService } from '../tenancy/tenancy.service';
import { MembershipsService, NO_ACTIVE_ORGANIZATION } from './memberships.service';

const INVALID = 'E-mail ou senha inválidos.';
export const LOGIN_UNAVAILABLE = 'Não foi possível entrar agora. Tente novamente em instantes.';
// Hash gerado no boot para comparar quando o e-mail não existe (tempo de resposta parecido).
const DUMMY_HASH = bcrypt.hashSync('agrointegra-dummy-password', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly memberships: MembershipsService,
    private readonly supabase: SupabaseAuthClient,
    private readonly tenancy: TenancyService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, email: true, active: true, navStyle: true, theme: true, passwordHash: true, authUserId: true },
    });
    if (!user) await burnPasswordCheck(password);
    const ok = !!user && user.active && (await this.checkPassword(user, normalized, password));

    if (!user || !ok) {
      // Antes de qualquer membership validada: auditoria cai na trilha padrão (sem organização). Nunca grava a senha.
      await this.audit.record({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        details: { email: normalized },
      });
      throw new UnauthorizedException(INVALID);
    }

    const memberships = await this.memberships.active(user.id);
    if (!memberships.length) {
      await this.audit.record({ userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, details: { reason: 'no_membership' } });
      throw new ForbiddenException(NO_ACTIVE_ORGANIZATION);
    }
    // Uma organização: ela é a padrão. Várias: o painel escolhe e envia X-Organization-Id.
    const current = memberships.length === 1 ? memberships[0] : null;
    const auditOrg = (current ?? memberships[0]).organizationId;
    await this.tenancy.run({ organizationId: auditOrg, userId: user.id }, () =>
      this.audit.record({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id }),
    );

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (current ?? memberships[0]).role,
        organizationId: current?.organizationId ?? null,
        organizations: memberships.map((m) => ({ id: m.organizationId, name: m.organizationName, role: m.role })),
        navStyle: user.navStyle,
        theme: user.theme,
      },
    };
  }

  // Conta com authUserId: só Supabase (o passwordHash local é aleatório e inutilizável). Legado: bcrypt.
  private async checkPassword(user: { passwordHash: string; authUserId: string | null }, email: string, password: string) {
    if (!user.authUserId) return safeCompare(password, user.passwordHash);
    if (!this.supabase.enabled) {
      this.logger.warn('Login de conta Supabase recusado: SUPABASE_AUTH_ENABLED desligado.');
      return false;
    }
    try {
      const remote = await this.supabase.verifyPassword(email, password);
      return remote.id === user.authUserId;
    } catch (err) {
      if (err instanceof SupabaseAuthError && err.kind === 'invalid_credentials') return false;
      this.logger.warn(`Verificação de senha no Supabase falhou (${err instanceof SupabaseAuthError ? err.kind : 'erro'}).`);
      if (err instanceof SupabaseAuthError && err.kind === 'rejected') return false;
      throw new ServiceUnavailableException(LOGIN_UNAVAILABLE);
    }
  }
}

async function safeCompare(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// Para quando o usuário não existe: gasta tempo equivalente a um bcrypt.
async function burnPasswordCheck(password: string) {
  await safeCompare(password, DUMMY_HASH);
}
