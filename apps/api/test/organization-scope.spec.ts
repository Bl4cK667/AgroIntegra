import { ForbiddenException } from '@nestjs/common';
import { scopeOrganizationOperation } from '../src/prisma/organization-scope';
import { TenancyService } from '../src/tenancy/tenancy.service';

describe('Isolamento de dados por organização', () => {
  it.each(['findUnique', 'findMany', 'count', 'groupBy', 'aggregate', 'update', 'deleteMany'])(
    '%s aplica organização mesmo com um filtro malicioso enviado pelo chamador', (operation) => {
      const original = { where: { id: 'resource-b', organizationId: 'organization-b' } };
      const scoped = scopeOrganizationOperation(operation, original, 'organization-a');
      expect(scoped.where).toEqual({ id: 'resource-b', organizationId: 'organization-a' });
      expect(original.where.organizationId).toBe('organization-b');
    },
  );

  it('createMany atribui organização a todos os registros; upsert filtra o alvo e a criação', () => {
    expect(scopeOrganizationOperation('createMany', { data: [{ name: 'a' }, { name: 'b' }] }, 'org-a').data)
      .toEqual([{ name: 'a', organizationId: 'org-a' }, { name: 'b', organizationId: 'org-a' }]);
    expect(scopeOrganizationOperation('upsert', { where: { id: 'x' }, create: { name: 'a' }, update: { name: 'b' } }, 'org-a'))
      .toMatchObject({ where: { id: 'x', organizationId: 'org-a' }, create: { organizationId: 'org-a' } });
  });

  it('fotos criadas junto com a visita não recebem organizationId: o Prisma herda da visita pela FK composta', () => {
    const scoped = scopeOrganizationOperation('create', { data: { photos: { create: [{ position: 1 }, { position: 2 }] } } }, 'org-a');
    expect(scoped.data).toEqual({ organizationId: 'org-a', photos: { create: [{ position: 1 }, { position: 2 }] } });
  });

  it('não permite mover registros ou conectar uma organização por nested write', () => {
    expect(() => scopeOrganizationOperation('update', { data: { organizationId: 'org-b' } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('create', { data: { organizationId: 'org-b' } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('create', { data: { organization: { connect: { id: 'org-b' } } } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('create', { data: { photos: { connect: { id: 'photo-b' } } } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('create', { data: { photos: { create: [{ position: 1, organizationId: 'org-b' }] } } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('create', { data: { photos: { create: { organization: { connect: { id: 'org-b' } } } } } }, 'org-a')).toThrow(ForbiddenException);
    expect(() => scopeOrganizationOperation('findMany', {}, '')).toThrow(ForbiddenException);
  });

  it('requisições paralelas e promises preservam contextos isolados e falham fora deles', async () => {
    const tenancy = new TenancyService();
    const results = await Promise.all(['org-a', 'org-b'].map((organizationId) => tenancy.run({}, async () => {
      tenancy.set({ organizationId, userId: organizationId + '-user' });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return tenancy.organizationId();
    })));
    expect(results).toEqual(['org-a', 'org-b']);
    expect(() => tenancy.organizationId()).toThrow(ForbiddenException);
    tenancy.run({ organizationId: 'org-a' }, () => {
      expect(() => tenancy.set({ organizationId: 'org-b' })).toThrow();
    });
  });
});
