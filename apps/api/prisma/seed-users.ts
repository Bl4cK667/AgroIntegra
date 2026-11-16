import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Usuários fictícios da demonstração.
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_USERS = [
  { name: 'Helena Vasconcelos Duarte', email: 'coordenacao@agrointegra.demo', role: Role.COORDINATION },
  { name: 'Rafael Lins Moreira', email: 'tecnico@agrointegra.demo', role: Role.TECHNICIAN },
];

export async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash },
    });
  }
}
