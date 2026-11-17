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
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const { password, ...u } of DEMO_USERS as { name: string; email: string; role: Role; password?: string }[]) {
    const passwordHash = password ? await bcrypt.hash(password, 10) : demoHash;
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash },
    });
  }
}
