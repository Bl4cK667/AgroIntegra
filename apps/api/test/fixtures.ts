import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_PASSWORD, seedUsers } from '../prisma/seed-users';

// Gera um CPF fictício válido a partir de uma semente (sempre o mesmo para a mesma semente).
export function makeCpf(seed: number): string {
  const base = String(100000000 + ((seed * 7919) % 899999999)).padStart(9, '0').split('').map(Number);
  const digit = (nums: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = digit(base);
  const d2 = digit([...base, d1]);
  return [...base, d1, d2].join('');
}

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

// Apaga os dados na ordem certa por causa das chaves estrangeiras.
export async function resetData(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.visitPhoto.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.property.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.user.deleteMany();
  await seedUsers(prisma);
}

export async function tokenFor(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: DEMO_PASSWORD });
  return res.body.accessToken as string;
}
