import { Logger } from '@nestjs/common';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenancyService } from '../src/tenancy/tenancy.service';

describe('Destinatários de notificações por organização', () => {
  it('só entrega para membros ativos da organização corrente', async () => {
    const findMany = jest.fn(async () => [{ userId: 'member-a' }]);
    const createMany = jest.fn(async () => ({ count: 1 }));
    const tenancy = new TenancyService();
    const service = new NotificationsService({ organizationMembership: { findMany }, notification: { createMany } } as unknown as PrismaService, tenancy);
    await tenancy.run({ organizationId: 'org-a' }, () => service.notifyUsers(['member-a', 'member-b'], { type: 'REQUEST_DONE', title: 'Pedido atendido', body: 'Visita registrada.' }));
    expect(findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-a', active: true, userId: { in: ['member-a', 'member-b'] }, user: { active: true } }, select: { userId: true } });
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ userId: 'member-a' })] });
  });

  it('falha ao consultar destinatários não desfaz a operação de negócio', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    try {
      const tenancy = new TenancyService();
      const service = new NotificationsService({ organizationMembership: { findMany: async () => { throw new Error('database unavailable'); } } } as unknown as PrismaService, tenancy);
      await expect(tenancy.run({ organizationId: 'org-a' }, () => service.notifyUsers(['member-a'], { type: 'REQUEST_DONE', title: 'Pedido atendido', body: 'Visita registrada.' }))).resolves.toBeUndefined();
    } finally { error.mockRestore(); }
  });
});
