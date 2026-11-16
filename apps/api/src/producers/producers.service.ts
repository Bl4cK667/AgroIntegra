import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Producer } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { maskCpf, onlyDigits } from '../common/cpf';
import { normalizeSearch, searchWords } from '../common/search';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from '../properties/property.dto';
import { propertySearchText, propertyView } from '../properties/property.view';
import { visitRow, visitRowInclude } from '../visits/visit.view';
import { CreateProducerDto, UpdateProducerDto } from './producer.dto';

// Formato público do produtor: o CPF sai sempre mascarado.
function producerView(p: Producer) {
  return {
    id: p.id,
    name: p.name,
    cpf: maskCpf(p.cpf),
    phone: p.phone,
    community: p.community,
    consentAt: p.consentAt,
    createdAt: p.createdAt,
  };
}

@Injectable()
export class ProducersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(search?: string) {
    const where = this.searchWhere(search);
    const [rows, total] = await Promise.all([
      this.prisma.producer.findMany({
        where,
        orderBy: { searchName: 'asc' },
        take: 200,
        include: { _count: { select: { properties: true } } },
      }),
      this.prisma.producer.count({ where }),
    ]);
    return {
      items: rows.map((p) => ({ ...producerView(p), propertyCount: p._count.properties })),
      total,
    };
  }

  // Texto com 11 dígitos (com ou sem pontuação) busca pelo CPF exato; o resto busca pelo nome.
  private searchWhere(search?: string): Prisma.ProducerWhereInput {
    const term = (search ?? '').trim();
    if (!term) return {};
    if (/^[\d.\-\s]+$/.test(term) && onlyDigits(term).length === 11) {
      return { cpf: onlyDigits(term) };
    }
    return { AND: searchWords(term).map((w) => ({ searchName: { contains: w } })) };
  }

  async get(id: string) {
    const p = await this.prisma.producer.findUnique({
      where: { id },
      include: {
        properties: { orderBy: { name: 'asc' } },
        createdBy: { select: { name: true } },
        visits: { orderBy: [{ visitedOn: 'desc' }, { createdAt: 'desc' }], include: visitRowInclude },
      },
    });
    if (!p) throw new NotFoundException('Produtor não encontrado.');
    return {
      ...producerView(p),
      createdBy: p.createdBy,
      properties: p.properties.map(propertyView),
      visits: p.visits.map(visitRow),
    };
  }

  async create(dto: CreateProducerDto, user: AuthUser) {
    const cpf = onlyDigits(dto.cpf);
    try {
      const p = await this.prisma.producer.create({
        data: {
          name: dto.name,
          searchName: normalizeSearch(dto.name),
          cpf,
          phone: dto.phone || null,
          community: dto.community,
          consentAt: dto.consent ? new Date() : null,
          createdById: user.id,
        },
      });
      await this.audit.record({
        userId: user.id,
        action: 'PRODUCER_CREATED',
        entity: 'Producer',
        entityId: p.id,
        details: { consent: !!dto.consent },
      });
      return producerView(p);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um produtor com este CPF.');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProducerDto, user: AuthUser) {
    await this.ensureExists(id);
    const data: Prisma.ProducerUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.searchName = normalizeSearch(dto.name);
    }
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.community !== undefined) data.community = dto.community;

    const p = await this.prisma.producer.update({ where: { id }, data });
    await this.audit.record({
      userId: user.id,
      action: 'PRODUCER_UPDATED',
      entity: 'Producer',
      entityId: id,
      details: { changed: Object.keys(dto).filter((k) => dto[k as keyof UpdateProducerDto] !== undefined) },
    });
    return producerView(p);
  }

  // Registra o consentimento uma única vez; chamadas seguintes mantêm a data original.
  async registerConsent(id: string, user: AuthUser) {
    const current = await this.ensureExists(id);
    if (current.consentAt) return producerView(current);
    const p = await this.prisma.producer.update({ where: { id }, data: { consentAt: new Date() } });
    await this.audit.record({ userId: user.id, action: 'PRODUCER_CONSENT', entity: 'Producer', entityId: id });
    return producerView(p);
  }

  async addProperty(producerId: string, dto: CreatePropertyDto, user: AuthUser) {
    await this.ensureExists(producerId);
    const prop = await this.prisma.property.create({
      data: {
        producerId,
        name: dto.name,
        areaHa: new Prisma.Decimal(dto.areaHa),
        locality: dto.locality,
        searchText: propertySearchText(dto.name, dto.locality),
        mainActivity: dto.mainActivity || null,
        createdById: user.id,
      },
    });
    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_CREATED',
      entity: 'Property',
      entityId: prop.id,
      details: { producerId },
    });
    return propertyView(prop);
  }

  private async ensureExists(id: string) {
    const p = await this.prisma.producer.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Produtor não encontrado.');
    return p;
  }
}
