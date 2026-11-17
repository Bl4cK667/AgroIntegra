import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenancyService } from '../src/tenancy/tenancy.service';

describe('Auditoria com query Prisma adiada', () => {
  it('inicia a query dentro da organização mesmo quando o chamador aguarda fora do run', async () => {
    const tenancy = new TenancyService();
    const prisma = {
      auditLog: {
        create: () => ({
          // PrismaPromise resolves lazily: no database work occurs until awaited.
          then: (resolve: (row: unknown) => void) => resolve({ organizationId: tenancy.organizationId() }),
        }),
      },
    } as unknown as PrismaService;
    const audit = new AuditService(prisma, tenancy);
    const pending = tenancy.run({ organizationId: 'org-a' }, () => audit.record({ action: 'LOGIN', entity: 'User' }));
    expect(tenancy.current()).toBeUndefined();
    await expect(pending).resolves.toEqual({ organizationId: 'org-a' });
  });

  it('eventos sem organização validada vão somente à trilha privada de autenticação', async () => {
    const recordSecurityEvent = jest.fn(async () => ({ organizationId: null }));
    const create = jest.fn();
    const prisma = { recordSecurityEvent, auditLog: { create } } as unknown as PrismaService;
    const audit = new AuditService(prisma, new TenancyService());
    await audit.record({ action: 'LOGIN_FAILED', entity: 'User' });
    expect(recordSecurityEvent).toHaveBeenCalledWith({ action: 'LOGIN_FAILED', entity: 'User' });
    expect(create).not.toHaveBeenCalled();
  });
});
