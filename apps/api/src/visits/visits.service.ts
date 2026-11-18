import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VisitPhoto } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { parseDay, today } from '../common/dates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { statusChange } from '../requests/requests.service';
import { decodeImage } from './image';
import { fromStoredPhoto, toStoredPhoto } from './photo-store';
import { CreateVisitDto } from './visit.dto';
import { visitRow, visitRowInclude, visitView } from './visit.view';

// Mesmo limite do cadastro da visita (CreateVisitDto: até 3 fotos).
export const MAX_VISIT_PHOTOS = 3;
const PHOTO_ID_IN_USE = 'Este identificador de foto já está em uso por outro registro.';
const photoSummary = (p: Pick<VisitPhoto, 'id' | 'position' | 'mimeType'>) => ({ id: p.id, position: p.position, mimeType: p.mimeType });

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
    private readonly notifications: NotificationsService,
  ) {}

  // opts.id: UUID gerado no aparelho (sync offline). Sem ele, o banco gera o id.
  async create(dto: CreateVisitDto, user: AuthUser, opts: { id?: string } = {}) {
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
          id: opts.id,
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
          photos: { create: photos.map((p, i) => ({ position: i + 1, ...toStoredPhoto(p) })) },
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
      // Quem abriu o pedido fica sabendo que ele foi atendido.
      if (request.createdById !== user.id) {
        await this.notifications.notifyUsers([request.createdById], {
          type: 'REQUEST_DONE',
          title: 'Pedido atendido com visita',
          body: `${request.subject} — ${producer.name}. Visita feita por ${user.name}.`,
          href: `/visitas/${visit.id}`,
        });
      }
    }
    // A coordenação acompanha as visitas registradas pela equipe.
    await this.notifications.notifyTeam(
      {
        type: 'VISIT_CREATED',
        title: 'Nova visita registrada',
        body: `${user.name} visitou ${producer.name} (${producer.community}).`,
        href: `/visitas/${visit.id}`,
      },
      { except: user.id, roles: ['COORDINATION'] },
    );
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
    return fromStoredPhoto(photo);
  }

  // Foto enviada depois da visita (app offline: os dados vão primeiro, as fotos quando houver sinal).
  // A visita continua sem edição: aqui só se ACRESCENTA foto, até o limite, e só o técnico autor.
  // photoId é o UUID gerado no aparelho: reenviar a mesma foto não duplica.
  async addPhoto(visitId: string, photoId: string, image: string, user: AuthUser) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit || visit.deletedAt) throw new NotFoundException('Visita não encontrada.');
    if (visit.technicianId !== user.id) {
      throw new ForbiddenException('Só o técnico que registrou a visita pode enviar as fotos dela.');
    }

    const existing = await this.prisma.visitPhoto.findUnique({ where: { id: photoId } });
    if (existing) {
      if (existing.visitId !== visitId) throw new ConflictException(PHOTO_ID_IN_USE);
      return { created: false, photo: photoSummary(existing) };
    }

    const decoded = decodeImage(image, 'Foto');
    let photo;
    try {
      photo = await this.prisma.$transaction(async (tx) => {
        // Trava a visita (dois envios ao mesmo tempo não passam do limite) e muda o updatedAt,
        // para o próximo pull entregar a visita com a lista de fotos nova.
        await tx.visit.update({ where: { id: visitId }, data: { updatedAt: new Date() } });
        const current = await tx.visitPhoto.findMany({ where: { visitId, deletedAt: null }, select: { position: true } });
        if (current.length >= MAX_VISIT_PHOTOS) {
          throw new BadRequestException(`A visita já tem ${MAX_VISIT_PHOTOS} fotos, o máximo permitido.`);
        }
        const position = Math.max(0, ...current.map((p) => p.position)) + 1;
        return tx.visitPhoto.create({ data: { id: photoId, visitId, position, ...toStoredPhoto(decoded) } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(PHOTO_ID_IN_USE);
      throw e;
    }

    await this.audit.record({
      userId: user.id,
      action: 'VISIT_PHOTO_ADDED',
      entity: 'Visit',
      entityId: visitId,
      details: { photoId, position: photo.position, mimeType: photo.mimeType, size: photo.size },
    });
    return { created: true, photo: photoSummary(photo) };
  }

  async signature(visitId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId }, select: { signature: true } });
    if (!visit?.signature) throw new NotFoundException('Visita sem assinatura.');
    return { mimeType: 'image/png', data: Buffer.from(visit.signature) };
  }
}
