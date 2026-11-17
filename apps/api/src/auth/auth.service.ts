import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const INVALID = 'E-mail ou senha inválidos.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    const ok = !!user && user.active && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !ok) {
      // Nunca grava a senha digitada.
      await this.audit.record({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        details: { email: normalized },
      });
      throw new UnauthorizedException(INVALID);
    }

    await this.audit.record({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, navStyle: user.navStyle },
    };
  }
}
