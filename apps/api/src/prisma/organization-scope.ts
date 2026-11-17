import { ForbiddenException } from '@nestjs/common';

// Prisma query extensions also run inside interactive transactions. Centralizing this filter
// prevents a newly added list/count/update endpoint from accidentally reading every organization.
export const ORGANIZATION_MODELS = new Set([
  'Producer', 'Property', 'Visit', 'VisitPhoto', 'ServiceRequest', 'Program',
  'Enrollment', 'Delivery', 'Notification', 'AuditLog',
]);

type Args = Record<string, any>;
const READ_OR_MUTATE = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'updateManyAndReturn',
  'delete', 'deleteMany', 'upsert',
]);

function createData(data: Args, organizationId: string): Args {
  if (data.organization || (data.organizationId && data.organizationId !== organizationId)) {
    throw new ForbiddenException('Não é permitido alterar a organização do registro.');
  }
  const result: Args = { ...data, organizationId };
  // Visit photos are the only nested domain create used by the application. Their composite
  // FK must carry the same organization instead of falling back to the legacy default.
  if (data.photos) {
    const nested = data.photos;
    if (Object.keys(nested).some((key) => key !== 'create')) {
      throw new ForbiddenException('Operação de fotos não permitida.');
    }
    const items = Array.isArray(nested.create) ? nested.create : [nested.create];
    result.photos = { create: items.map((item: Args) => createData(item, organizationId)) };
  }
  return result;
}

export function scopeOrganizationOperation(operation: string, input: Args | undefined, organizationId: string): Args {
  const args = { ...(input ?? {}) };
  if (!organizationId) throw new ForbiddenException('Organização não identificada para esta operação.');
  if (READ_OR_MUTATE.has(operation)) args.where = { ...args.where, organizationId };
  if (operation === 'create') args.data = createData(args.data, organizationId);
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    args.data = (Array.isArray(args.data) ? args.data : [args.data]).map((item: Args) => createData(item, organizationId));
  }
  if (operation === 'upsert') args.create = createData(args.create, organizationId);
  const update = operation === 'upsert' ? args.update : operation.startsWith('update') ? args.data : undefined;
  if (update && ('organization' in update || 'organizationId' in update)) {
    throw new ForbiddenException('Não é permitido alterar a organização do registro.');
  }
  if (!READ_OR_MUTATE.has(operation) && !['create', 'createMany', 'createManyAndReturn'].includes(operation)) {
    throw new ForbiddenException('Operação não autorizada para esta organização.');
  }
  return args;
}
