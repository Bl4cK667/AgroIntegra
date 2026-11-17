import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Usuários fictícios da demonstração.
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_USERS = [
  { name: 'Helena Vasconcelos Duarte', email: 'coordenacao@agrointegra.demo', role: Role.COORDINATION },
  { name: 'Rafael Lins Moreira', email: 'tecnico@agrointegra.demo', role: Role.TECHNICIAN },
  // Acesso rápido para uso local (perfil Coordenação). Senha fraca de propósito: não usar fora da demo.
  { name: 'Administrador', email: 'admin@agrointegra.demo', role: Role.COORDINATION, password: 'admin' },
];

export async function seedUsers(prisma: PrismaClient) {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  await prisma.organization.upsert({ where: { id: organizationId }, create: { id: organizationId, name: 'AgroIntegra' }, update: {} });
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const { password, ...u } of DEMO_USERS as { name: string; email: string; role: Role; password?: string }[]) {
    const passwordHash = password ? await bcrypt.hash(password, 10) : demoHash;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash },
    });
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      create: { userId: user.id, organizationId, role: u.role },
      update: { role: u.role, active: true },
    });
  }
}
