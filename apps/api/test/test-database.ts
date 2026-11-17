import { OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function disposableDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL de teste não configurada.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/[a-z0-9_]+_test$/.test(url.pathname)) {
    throw new Error('Testes com limpeza de tabelas exigem um banco local com nome terminado em _test.');
  }
  return value;
}

// Only fixture maintenance uses an unscoped client. HTTP requests still use PrismaService
// with real membership checks and organization filters, never this test-only provider.
export class TestDatabase extends PrismaClient implements OnModuleDestroy {
  constructor() { super({ datasourceUrl: disposableDatabaseUrl() }); }
  async onModuleDestroy() { await this.$disconnect(); }
}
