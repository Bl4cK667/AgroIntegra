import { PrismaClient } from '@prisma/client';
import { DEMO_USERS, seedUsers } from './seed-users';

const prisma = new PrismaClient();

seedUsers(prisma)
  .then(() => console.log(`Usuários da demo prontos: ${DEMO_USERS.map((u) => u.email).join(', ')}`))
  .finally(() => prisma.$disconnect());
