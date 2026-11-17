import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUPABASE_CONFIG, SupabaseConfig } from './supabase.config';
import { SupabaseClaims, SupabaseTokenError } from './supabase-jwt.verifier';

// Identidade canônica: claims.sub (auth.users.id) === User.authUserId.
// E-mail, app_metadata e user_metadata NUNCA vinculam contas automaticamente.
// O User local continua sendo a fonte de verdade de status; perfil/organização vêm da membership.
@Injectable()
export class SupabaseIdentityService {
  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    private readonly prisma: PrismaService,
  ) {}

  async resolveLocalUserId(claims: SupabaseClaims): Promise<string> {
    if (!this.config.enabled) throw new SupabaseTokenError('Supabase desativado.');
    const user = await this.prisma.user.findUnique({ where: { authUserId: claims.sub }, select: { id: true } });
    if (!user) throw new SupabaseTokenError('Conta Supabase não vinculada.');
    return user.id;
  }
}
