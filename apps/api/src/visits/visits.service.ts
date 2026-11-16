import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { decodeImage } from './image';
import { CreateVisitDto } from './visit.dto';
import { visitRow, visitRowInclude, visitView } from './visit.view';

// "2026-11-16" -> Date na meia-noite UTC; recusa dias que não existem (ex.: 30/02).
function parseDay(value: string, label: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label}: data inválida.`);
  }
  return d;
}

// Hoje no fuso do servidor (a secretaria), no formato AAAA-MM-DD.
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const detailInclude = {
  producer: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  technician: { select: { name: true } },
  photos: { select: { id: true, position: true, mimeType: true }, orderBy: { position: 'asc' } },
} as const;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateVisitDto, user: AuthUser) {
    const visitedOn = parseDay(dto.visitedOn, 'Data da visita');
    if (dto.visitedOn > today()) throw new BadRequestException('A data da visita não pode ser no futuro.');
    const returnOn = dto.returnOn ? parseDay(dto.returnOn, 'Data de retorno') : null;
    if (returnOn && returnOn < visitedOn) {
      throw new BadRequestException('A data de retorno não pode ser antes da visita.');
    }

    const photos = (dto.photos ?? []).map((p, i) => decodeImage(p, `Foto ${i + 1}`));
    const signature = dto.signature ? decodeImage(dto.signature, 'Assinatura', ['image/png']) : null;

    const producer = await this.prisma.producer.findUnique({ where: { id: dto.producerId } });
    if (!producer) throw new NotFoundException('Produtor não encontrado.');
    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
      if (!property || property.producerId !== producer.id) {
        throw new BadRequestException('A propriedade escolhida não pertence a este produtor.');
      }
    }

    const visit = await this.prisma.visit.create({
      data: {
        producerId: producer.id,
        propertyId: dto.propertyId ?? null,
        technicianId: user.id,
        visitedOn,
        diagnosis: dto.diagnosis,
        actionPlan: dto.actionPlan,
        returnOn,
        impact: dto.impact || null,
        signature: signature ? new Uint8Array(signature.data) : null,
        latitude: dto.location?.latitude ?? null,
        longitude: dto.location?.longitude ?? null,
        locationAccuracy: dto.location?.accuracy ?? null,
        photos: {
          create: photos.map((p, i) => ({
            position: i + 1,
            mimeType: p.mimeType,
            data: new Uint8Array(p.data),
            size: p.data.length,
          })),
        },
      },
      include: detailInclude,
    });

    await this.audit.record({
      userId: user.id,
      action: 'VISIT_CREATED',
      entity: 'Visit',
      entityId: visit.id,
      details: { producerId: producer.id, photos: photos.length, signature: !!signature, location: !!dto.location },
    });
    return visitView(visit);
  }

  async get(id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id }, include: detailInclude });
    if (!visit) throw new NotFoundException('Visita não encontrada.');
    return visitView(visit);
  }

  async list(producerId?: string) {
    const where = producerId ? { producerId } : {};
    const [rows, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: [{ visitedOn: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: visitRowInclude,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { items: rows.map(visitRow), total };
  }

  async photo(visitId: string, photoId: string) {
    const photo = await this.prisma.visitPhoto.findFirst({ where: { id: photoId, visitId } });
    if (!photo) throw new NotFoundException('Foto não encontrada.');
    return { mimeType: photo.mimeType, data: Buffer.from(photo.data) };
  }

  async signature(visitId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId }, select: { signature: true } });
    if (!visit?.signature) throw new NotFoundException('Visita sem assinatura.');
    return { mimeType: 'image/png', data: Buffer.from(visit.signature) };
  }
}
