import { Property, User, Visit, VisitPhoto } from '@prisma/client';
import { toDay } from '../common/dates';

type VisitWithRelations = Visit & {
  producer: { id: string; name: string };
  property: Pick<Property, 'id' | 'name'> | null;
  technician: Pick<User, 'name'>;
  photos: Pick<VisitPhoto, 'id' | 'position' | 'mimeType'>[];
  request: { id: string; subject: string } | null;
};

// Formato público da visita: sem os bytes das fotos e da assinatura.
export function visitView(v: VisitWithRelations) {
  return {
    id: v.id,
    producer: v.producer,
    property: v.property,
    technician: { name: v.technician.name },
    visitedOn: toDay(v.visitedOn),
    diagnosis: v.diagnosis,
    actionPlan: v.actionPlan,
    returnOn: toDay(v.returnOn),
    impact: v.impact,
    hasSignature: v.signature !== null,
    location:
      v.latitude !== null && v.longitude !== null
        ? { latitude: v.latitude, longitude: v.longitude, accuracy: v.locationAccuracy }
        : null,
    photos: v.photos.map((p) => ({ id: p.id, position: p.position, mimeType: p.mimeType })),
    request: v.request,
    createdAt: v.createdAt,
  };
}

// Linha resumida usada nas listas.
export function visitRow(v: Visit & {
  producer: { id: string; name: string };
  property: { id: string; name: string } | null;
  technician: { name: string };
  _count: { photos: number };
}) {
  return {
    id: v.id,
    producer: v.producer,
    property: v.property,
    technician: { name: v.technician.name },
    visitedOn: toDay(v.visitedOn),
    returnOn: toDay(v.returnOn),
    diagnosis: v.diagnosis,
    photoCount: v._count.photos,
  };
}

export const visitRowInclude = {
  producer: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  technician: { select: { name: true } },
  _count: { select: { photos: true } },
} as const;
