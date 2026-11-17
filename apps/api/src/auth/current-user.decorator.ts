import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  // Perfil NA organização atual (OrganizationMembership.role), não User.role legado.
  role: Role;
  // Organização validada pelo AuthGuard (membership ativa).
  organizationId: string;
  navStyle: string;
  theme: string | null;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
