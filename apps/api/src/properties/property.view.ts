import { Prisma, Property } from '@prisma/client';
import { normalizeSearch } from '../common/search';

export const propertySearchText = (name: string, locality: string) => normalizeSearch(`${name} ${locality}`);

// Formato público da propriedade: área como número, sem dados internos.
export function propertyView(p: Property) {
  return {
    id: p.id,
    producerId: p.producerId,
    name: p.name,
    areaHa: new Prisma.Decimal(p.areaHa).toNumber(),
    locality: p.locality,
    mainActivity: p.mainActivity,
    createdAt: p.createdAt,
  };
}
