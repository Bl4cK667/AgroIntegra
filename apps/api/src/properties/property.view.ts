import { Prisma, Property } from '@prisma/client';
import { normalizeSearch } from '../common/search';

export const propertySearchText = (name: string, locality: string, city?: string | null) =>
  normalizeSearch(`${name} ${locality} ${city ?? ''}`);

// Converte os campos de localização do DTO para o banco. undefined = não mexe; null = apaga.
export function locationData(dto: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  coordinates?: { latitude: number; longitude: number } | null;
}) {
  return {
    address: dto.address,
    city: dto.city,
    state: dto.state,
    latitude: dto.coordinates === undefined ? undefined : (dto.coordinates?.latitude ?? null),
    longitude: dto.coordinates === undefined ? undefined : (dto.coordinates?.longitude ?? null),
  };
}

// Formato público da propriedade: área como número, sem dados internos.
export function propertyView(p: Property) {
  return {
    id: p.id,
    producerId: p.producerId,
    name: p.name,
    areaHa: new Prisma.Decimal(p.areaHa).toNumber(),
    locality: p.locality,
    mainActivity: p.mainActivity,
    address: p.address,
    city: p.city,
    state: p.state,
    coordinates: p.latitude !== null && p.longitude !== null ? { latitude: p.latitude, longitude: p.longitude } : null,
    createdAt: p.createdAt,
  };
}
