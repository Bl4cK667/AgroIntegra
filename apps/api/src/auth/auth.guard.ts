import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseIdentityService } from '../supabase/supabase-identity.service';
import { SupabaseJwtVerifier } from '../supabase/supabase-jwt.verifier';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from './current-user.decorator';
import { MembershipsService } from './memberships.service';
import { IS_PUBLIC } from './public.decorator';
import { ROLES } from './roles.decorator';

const INVALID_SESSION = 'Sessão inválida ou expirada.';
export const ORGANIZATION_HEADER = 'x-organization-id';

// Guarda global: toda rota exige token, salvo as marcadas com @Public().
// 1) Identidade: JWT local (sub = User.id) ou, com SUPABASE_AUTH_ENABLED=true, access token do Supabase
//    (sub = User.authUserId). 2) Usuário local ativo. 3) Membership ativa em organização ativa
//    (X-Organization-Id validado ou a única existente). 4) Perfil = role da membership.
// 5) Contexto de tenancy preenchido só depois disso.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseJwtVerifier,
    private readonly supabaseIdentity: SupabaseIdentityService,
    private readonly memberships: MembershipsService,
    private readonly tenancy: TenancyService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar.');

    const sub = await this.resolveUserId(token);

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, name: true, email: true, active: true, navStyle: true, theme: true },
    });
    if (!user?.active) throw new UnauthorizedException(INVALID_SESSION);

    const membership = await this.memberships.resolve(user.id, req.headers[ORGANIZATION_HEADER]);
    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      organizationId: membership.organizationId,
      navStyle: user.navStyle,
      theme: user.theme,
    };
    req.user = authUser;
    this.tenancy.set({ organizationId: membership.organizationId, userId: user.id, role: membership.role });

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta área.');
    }
    return true;
  }

  private async resolveUserId(token: string): Promise<string> {
    try {
      if (this.supabase.isSupabaseToken(token)) {
        const claims = await this.supabase.verify(token);
        return await this.supabaseIdentity.resolveLocalUserId(claims);
      }
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token, { algorithms: ['HS256'] });
      if (typeof sub !== 'string' || !sub) throw new Error('sub ausente');
      return sub;
    } catch {
      // Mensagem única: não revela se o token é local, Supabase, expirado ou sem vínculo.
      throw new UnauthorizedException(INVALID_SESSION);
    }
  }
}
