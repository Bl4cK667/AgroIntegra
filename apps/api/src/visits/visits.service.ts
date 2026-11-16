import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { parseDay, today } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { statusChange } from '../requests/requests.service';
import { decodeImage } from './image';
import { CreateVisitDto } from './visit.dto';
import { visitRow, visitRowInclude, visitView } from './visit.view';

const detailInclude = {
  producer: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  technician: { select: { name: true } },
  photos: { select: { id: true, position: true, mimeType: true }, orderBy: { position: 'asc' } },
  request: { select: { id: true, subject: true } },
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

    // A solicitação atendida precisa ser deste produtor e ainda estar aberta.
    const request = dto.requestId
      ? await this.prisma.serviceRequest.findUnique({ where: { id: dto.requestId } })
      : null;
    if (dto.requestId) {
      if (!request || request.producerId !== producer.id) {
        throw new BadRequestException('A solicitação escolhida não é deste produtor.');
      }
      if (request.status === 'DONE') throw new BadRequestException('Esta solicitação já está concluída.');
    }

    // Visita e conclusão da solicitação são gravadas juntas: ou as duas, ou nenhuma.
    const visit = await this.prisma.$transaction(async (tx) => {
      if (request) await tx.serviceRequest.update({ where: { id: request.id }, data: statusChange(request, 'DONE') });
      return tx.visit.create({
        data: {
          requestId: request?.id ?? null,
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
    });

    await this.audit.record({
      userId: user.id,
      action: 'VISIT_CREATED',
      entity: 'Visit',
      entityId: visit.id,
      details: {
        producerId: producer.id,
        requestId: request?.id ?? null,
        photos: photos.length,
        signature: !!signature,
        location: !!dto.location,
      },
    });
    if (request) {
      await this.audit.record({
        userId: user.id,
        action: 'REQUEST_MOVED',
        entity: 'ServiceRequest',
        entityId: request.id,
        details: { from: request.status, to: 'DONE', byVisit: visit.id },
      });
    }
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
