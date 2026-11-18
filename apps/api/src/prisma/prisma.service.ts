import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenancyService } from '../tenancy/tenancy.service';
import { ORGANIZATION_MODELS, scopeOrganizationOperation } from './organization-scope';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client = new PrismaClient();
  private readonly scoped;

  constructor(private readonly tenancy: TenancyService) {
    this.scoped = this.client.$extends({
      name: 'organization-isolation',
      query: {
        $allModels: {
          $allOperations: ({ model, operation, args, query }) => {
            if (!ORGANIZATION_MODELS.has(model)) return query(args);
            const organizationId = this.tenancy.organizationId();
            return query(scopeOrganizationOperation(operation, args, organizationId) as typeof args);
          },
        },
      },
    });
  }

  // Identity and invitation operations require explicit authorization in their services.
  get user() { return this.client.user; }
  get organization() { return this.client.organization; }
  get organizationMembership() { return this.client.organizationMembership; }
  get invitation() { return this.client.invitation; }
  get producer() { return this.scoped.producer; }
  get property() { return this.scoped.property; }
  get visit() { return this.scoped.visit; }
  get visitPhoto() { return this.scoped.visitPhoto; }
  get serviceRequest() { return this.scoped.serviceRequest; }
  get program() { return this.scoped.program; }
  get enrollment() { return this.scoped.enrollment; }
  get delivery() { return this.scoped.delivery; }
  get notification() { return this.scoped.notification; }
  get auditLog() { return this.scoped.auditLog; }
  get propertyFeature() { return this.scoped.propertyFeature; }
  get propertyFeatureVersion() { return this.scoped.propertyFeatureVersion; }
  get weatherForecast() { return this.scoped.weatherForecast; }
  get localPrice() { return this.scoped.localPrice; }
  // Globais (sem organizationId): preço público da CONAB. O escopo não se aplica a eles.
  get marketPrice() { return this.scoped.marketPrice; }
  get marketPriceImport() { return this.scoped.marketPriceImport; }
  get $transaction() { return this.scoped.$transaction.bind(this.scoped); }

  // Raw SQL is limited to the existing health check and the explicitly scoped dashboard SQL.
  get $queryRaw() { return this.client.$queryRaw.bind(this.client); }
  get $executeRaw() { return this.client.$executeRaw.bind(this.client); }
  get $connect() { return this.client.$connect.bind(this.client); }
  get $disconnect() { return this.client.$disconnect.bind(this.client); }

  // Pre-authentication events have no validated organization. Keep them private (NULL scope),
  // never attribute a client's attempted login to an organization supplied by the client.
  recordSecurityEvent(data: Omit<Prisma.AuditLogUncheckedCreateInput, 'organizationId'>) {
    return this.client.auditLog.create({ data: { ...data, organizationId: null } });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
