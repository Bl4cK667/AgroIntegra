import { Prisma, Producer, Property, ServiceRequest } from '@prisma/client';
import { maskCpf } from '../common/cpf';
import { toDay } from '../common/dates';
import { FeatureRow } from '../geo/geo-features.service';

// Formato dos registros que o aparelho recebe (pull e resposta do push).
// Registro excluído sai só com id e datas: o aparelho apaga a cópia local e não recebe mais dados dele.

interface Stamped {
  id: string;
  updatedAt: Date;
  deletedAt: Date | null;
}

const deletedView = (r: Stamped) => ({ id: r.id, updatedAt: r.updatedAt, deletedAt: r.deletedAt });
const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

export function syncProducer(p: Producer) {
  if (p.deletedAt) return deletedView(p);
  return {
    id: p.id,
    name: p.name,
    cpf: maskCpf(p.cpf), // nunca completo (LGPD)
    phone: p.phone,
    community: p.community,
    consentAt: p.consentAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: null,
  };
}

export function syncProperty(p: Property) {
  if (p.deletedAt) return deletedView(p);
  return {
    id: p.id,
    producerId: p.producerId,
    name: p.name,
    areaHa: Number(p.areaHa), // declarada
    calculatedAreaHa: num(p.calculatedAreaHa),
    calculatedPerimeterM: num(p.calculatedPerimeterM),
    locality: p.locality,
    mainActivity: p.mainActivity,
    address: p.address,
    city: p.city,
    state: p.state,
    coordinates: p.latitude !== null && p.longitude !== null ? { latitude: p.latitude, longitude: p.longitude } : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: null,
  };
}

export function syncRequest(r: ServiceRequest) {
  if (r.deletedAt) return deletedView(r);
  return {
    id: r.id,
    producerId: r.producerId,
    propertyId: r.propertyId,
    subject: r.subject,
    description: r.description,
    priority: r.priority,
    status: r.status,
    scheduledFor: toDay(r.scheduledFor),
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  };
}

// Campos da visita lidos no pull: sem os bytes da assinatura e das fotos (vão por rotas próprias).
export const SYNC_VISIT_SELECT = {
  id: true,
  producerId: true,
  propertyId: true,
  requestId: true,
  technicianId: true,
  visitedOn: true,
  diagnosis: true,
  actionPlan: true,
  returnOn: true,
  impact: true,
  latitude: true,
  longitude: true,
  locationAccuracy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  photos: { where: { deletedAt: null }, select: { id: true, position: true, mimeType: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.VisitSelect;

export type SyncVisitRow = Prisma.VisitGetPayload<{ select: typeof SYNC_VISIT_SELECT }>;

export function syncVisit(v: SyncVisitRow) {
  if (v.deletedAt) return deletedView(v);
  return {
    id: v.id,
    producerId: v.producerId,
    propertyId: v.propertyId,
    requestId: v.requestId,
    technicianId: v.technicianId,
    visitedOn: toDay(v.visitedOn),
    diagnosis: v.diagnosis,
    actionPlan: v.actionPlan,
    returnOn: toDay(v.returnOn),
    impact: v.impact,
    location:
      v.latitude !== null && v.longitude !== null
        ? { latitude: v.latitude, longitude: v.longitude, accuracy: v.locationAccuracy }
        : null,
    photos: v.photos,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    deletedAt: null,
  };
}

// Feição em GeoJSON (RFC 7946), com as métricas calculadas pelo PostGIS.
export function syncFeature(f: FeatureRow) {
  if (f.deletedAt) return { ...deletedView(f), propertyId: f.propertyId };
  return {
    id: f.id,
    propertyId: f.propertyId,
    type: f.type,
    name: f.name,
    geometry: f.geometry,
    areaHa: num(f.areaHa),
    perimeterM: num(f.perimeterM),
    lengthM: num(f.lengthM),
    version: f.version,
    createdById: f.createdById,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    deletedAt: null,
  };
}
