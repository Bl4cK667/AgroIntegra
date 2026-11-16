import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RequestStatus, ServiceRequest } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { parseDay, toDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto, MoveRequestDto, PriorityDto } from './request.dto';

const include = {
  producer: { select: { id: true, name: true, community: true } },
  property: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { visits: true } },
} satisfies Prisma.ServiceRequestInclude;

type RequestWithRelations = Prisma.ServiceRequestGetPayload<{ include: typeof include }>;

export function requestView(r: RequestWithRelations) {
  return {
    id: r.id,
    producer: r.producer,
    property: r.property,
    subject: r.subject,
    description: r.description,
    priority: r.priority,
    status: r.status,
    scheduledFor: toDay(r.scheduledFor),
    completedAt: r.completedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    visitCount: r._count.visits,
  };
}

// Campos que mudam junto com a situação: data de conclusão e data agendada.
export function statusChange(current: Pick<ServiceRequest, 'completedAt' | 'scheduledFor'>, to: RequestStatus) {
  return {
    status: to,
    completedAt: to === 'DONE' ? (current.completedAt ?? new Date()) : null,
    scheduledFor: to === 'NEW' || to === 'IN_REVIEW' ? null : current.scheduledFor,
  };
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filter: { producerId?: string; open?: boolean }) {
    const where: Prisma.ServiceRequestWhereInput = {
      ...(filter.producerId ? { producerId: filter.producerId } : {}),
      ...(filter.open ? { status: { not: 'DONE' } } : {}),
    };
    const rows = await this.prisma.serviceRequest.findMany({
      where,
      // Prioridade segue a ordem do enum: alta, média, baixa.
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include,
    });
    return { items: rows.map(requestView), total: rows.length };
  }

  async create(dto: CreateRequestDto, user: AuthUser) {
    const producer = await this.prisma.producer.findUnique({ where: { id: dto.producerId } });
    if (!producer) throw new NotFoundException('Produtor não encontrado.');
    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
      if (!property || property.producerId !== producer.id) {
        throw new BadRequestException('A propriedade escolhida não pertence a este produtor.');
      }
    }
    const r = await this.prisma.serviceRequest.create({
      data: {
        producerId: producer.id,
        propertyId: dto.propertyId ?? null,
        subject: dto.subject,
        description: dto.description || null,
        priority: dto.priority,
        createdById: user.id,
      },
      include,
    });
    await this.audit.record({
      userId: user.id,
      action: 'REQUEST_CREATED',
      entity: 'ServiceRequest',
      entityId: r.id,
      details: { producerId: producer.id, priority: r.priority },
    });
    return requestView(r);
  }

  private async find(id: string) {
    const r = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Solicitação não encontrada.');
    return r;
  }

  async move(id: string, dto: MoveRequestDto, user: AuthUser) {
    const current = await this.find(id);
    const data = statusChange(current, dto.status);
    if (dto.scheduledFor) {
      if (dto.status !== 'SCHEDULED') throw new BadRequestException('Só a solicitação agendada recebe data.');
      data.scheduledFor = parseDay(dto.scheduledFor, 'Data agendada');
    }
    const r = await this.prisma.serviceRequest.update({ where: { id }, data, include });
    await this.audit.record({
      userId: user.id,
      action: 'REQUEST_MOVED',
      entity: 'ServiceRequest',
      entityId: id,
      details: { from: current.status, to: r.status, scheduledFor: toDay(r.scheduledFor) },
    });
    return requestView(r);
  }

  async setPriority(id: string, dto: PriorityDto, user: AuthUser) {
    const current = await this.find(id);
    const r = await this.prisma.serviceRequest.update({ where: { id }, data: { priority: dto.priority }, include });
    await this.audit.record({
      userId: user.id,
      action: 'REQUEST_PRIORITY',
      entity: 'ServiceRequest',
      entityId: id,
      details: { from: current.priority, to: r.priority },
    });
    return requestView(r);
  }
}
