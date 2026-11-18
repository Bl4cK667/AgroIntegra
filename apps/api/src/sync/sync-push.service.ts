import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { GeoFeaturesService } from '../geo/geo-features.service';
import { CreateProducerDto, UpdateProducerDto } from '../producers/producer.dto';
import { ProducersService } from '../producers/producers.service';
import { CreatePropertyDto, UpdatePropertyDto } from '../properties/property.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from '../visits/visit.dto';
import { VisitsService } from '../visits/visits.service';
import { PushEntity, SyncOperationDto } from './sync.dto';
import { SYNC_VISIT_SELECT, syncFeature, syncProducer, syncProperty, syncVisit } from './sync-views';

// Resultado de cada operação do lote:
// - applied:   gravada (conflict=true quando havia alteração concorrente e a do aparelho venceu);
// - duplicate: nada a fazer (reenvio, ou os dados já estão iguais no servidor);
// - rejected:  conflito em que a versão do servidor venceu; `record` traz essa versão;
// - error:     não aplicada; `message` explica. retry=true só para falha temporária do servidor.
export type PushStatus = 'applied' | 'duplicate' | 'rejected' | 'error';

export interface PushResult {
  index: number;
  entity: PushEntity;
  id: string;
  status: PushStatus;
  conflict?: boolean;
  message?: string;
  retry?: boolean;
  record?: unknown;
}

type Outcome = Omit<PushResult, 'index' | 'entity' | 'id'>;
type Resolution = 'apply' | 'apply-conflict' | 'reject';

// Relógio do aparelho adiantado além disso é recusado: senão ele venceria qualquer conflito.
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const ENTITY_NAME: Record<PushEntity, string> = {
  producer: 'Producer',
  property: 'Property',
  visit: 'Visit',
  feature: 'PropertyFeature',
};

const ID_IN_USE = 'Este identificador já está em uso por outro registro.';
const UNEXPECTED = 'Erro inesperado ao aplicar esta operação. Ela será reenviada na próxima sincronização.';

// Igualdade por valor, sem depender da ordem das chaves (ex.: coordenadas vindas do aparelho).
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));

// Campos enviados (≠ undefined) que diferem do servidor.
function changedFields(incoming: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return Object.keys(incoming).filter((k) => incoming[k] !== undefined && !same(incoming[k], current[k]));
}

const pick = (source: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, source[k] ?? null]));

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...validationMessages(e.children ?? [])]);
}

@Injectable()
export class SyncPushService {
  private readonly logger = new Logger(SyncPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly producers: ProducersService,
    private readonly visits: VisitsService,
    private readonly features: GeoFeaturesService,
  ) {}

  // Aplica as operações na ordem recebida. Cada uma é independente: um erro não impede as seguintes.
  async push(operations: SyncOperationDto[], user: AuthUser) {
    const results: PushResult[] = [];
    // Versão que o servidor acabou de gravar, por registro. Uma operação seguinte do mesmo registro
    // no mesmo lote (ex.: criar e depois editar offline) passa a ter essa versão como base, em vez
    // de parecer concorrente. Entre lotes, o aparelho faz o mesmo com o `record` da resposta.
    const known = new Map<string, string>();
    for (const [index, op] of operations.entries()) {
      const key = `${op.entity}:${op.id}`;
      const effective = !op.baseUpdatedAt && known.has(key) ? { ...op, baseUpdatedAt: known.get(key) } : op;
      let outcome: Outcome;
      try {
        outcome = await this.apply(effective, user);
      } catch (e) {
        outcome = this.failure(e, op);
      }
      const stamp = (outcome.record as { updatedAt?: Date } | undefined)?.updatedAt;
      // Só o que o próprio aparelho gravou (ou já estava igual) vira base; versão que venceu o aparelho, não.
      if (stamp instanceof Date && (outcome.status === 'applied' || outcome.status === 'duplicate')) known.set(key, stamp.toISOString());
      results.push({ index, entity: op.entity, id: op.id, ...outcome });
    }
    const count = (s: PushStatus) => results.filter((r) => r.status === s).length;
    return {
      serverTime: new Date(),
      summary: { applied: count('applied'), duplicate: count('duplicate'), rejected: count('rejected'), error: count('error') },
      results,
    };
  }

  private failure(e: unknown, op: SyncOperationDto): Outcome {
    if (e instanceof HttpException) {
      const body = e.getResponse();
      const raw = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      const message = Array.isArray(raw) ? raw.join(' ') : String(raw ?? e.message);
      return { status: 'error', message, retry: e.getStatus() >= 500 };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { status: 'error', message: ID_IN_USE, retry: false };
    }
    this.logger.error(
      JSON.stringify({ event: 'sync_push_failed', entity: op.entity, id: op.id, op: op.op, error: e instanceof Error ? e.message : String(e) }),
    );
    return { status: 'error', message: UNEXPECTED, retry: true };
  }

  private async apply(op: SyncOperationDto, user: AuthUser): Promise<Outcome> {
    const clientAt = new Date(op.updatedAt);
    if (clientAt.getTime() > Date.now() + MAX_CLOCK_SKEW_MS) {
      throw new BadRequestException('A data da alteração está no futuro. Acerte a data e a hora do aparelho e sincronize de novo.');
    }
    const base = op.baseUpdatedAt ? new Date(op.baseUpdatedAt) : null;
    const data = op.data ?? {};

    if (op.op === 'delete') {
      if (op.entity !== 'feature') {
        throw new BadRequestException('Pelo aplicativo, só feições do mapa podem ser excluídas.');
      }
      return this.deleteFeature(op, clientAt, base, user);
    }
    switch (op.entity) {
      case 'producer':
        return this.upsertProducer(op, data, clientAt, base, user);
      case 'property':
        return this.upsertProperty(op, data, clientAt, base, user);
      case 'visit':
        return this.createVisit(op, data, user);
      case 'feature':
        return this.upsertFeature(op, data, clientAt, base, user);
    }
  }

  // Última gravação vence, mas só quando há alteração concorrente: o servidor mudou depois da
  // versão que o aparelho conhecia (baseUpdatedAt). Sem base, o registro já existia sem o
  // aparelho saber (ex.: reenvio de um cadastro), e isso também conta como concorrente.
  private resolve(serverAt: Date, base: Date | null, clientAt: Date): Resolution {
    const concurrent = !base || serverAt.getTime() > base.getTime();
    if (!concurrent) return 'apply';
    return clientAt.getTime() > serverAt.getTime() ? 'apply-conflict' : 'reject';
  }

  private async recordConflict(
    op: SyncOperationDto,
    user: AuthUser,
    winner: 'client' | 'server',
    serverAt: Date,
    base: Date | null,
    fields: string[],
    discarded: Record<string, unknown>,
  ) {
    await this.audit.record({
      userId: user.id,
      action: 'SYNC_CONFLICT',
      entity: ENTITY_NAME[op.entity],
      entityId: op.id,
      details: {
        winner,
        op: op.op,
        clientUpdatedAt: op.updatedAt,
        serverUpdatedAt: serverAt.toISOString(),
        baseUpdatedAt: base?.toISOString() ?? null,
        fields,
        discarded, // valores que perderam, para conferência
      } as Prisma.InputJsonObject,
    });
  }

  private async validated<T extends object>(cls: ClassConstructor<T>, data: Record<string, unknown>): Promise<T> {
    const instance = plainToInstance(cls, data);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new BadRequestException(validationMessages(errors));
    return instance;
  }

  // ---------------------------------------------------------------- produtor

  private async upsertProducer(op: SyncOperationDto, data: Record<string, unknown>, clientAt: Date, base: Date | null, user: AuthUser): Promise<Outcome> {
    const current = await this.prisma.producer.findUnique({ where: { id: op.id } });
    if (!current) {
      if (base) throw new NotFoundException('Produtor não encontrado no servidor.');
      const dto = await this.validated(CreateProducerDto, data);
      await this.producers.create(dto, user, { id: op.id });
      return { status: 'applied', record: syncProducer(await this.prisma.producer.findUniqueOrThrow({ where: { id: op.id } })) };
    }
    if (current.deletedAt) return { status: 'rejected', message: 'Este produtor foi excluído no servidor.', record: syncProducer(current) };

    // O aparelho pode mandar o registro inteiro: CPF igual é ignorado; consentimento é registrado uma vez.
    const { cpf, consent, ...rest } = data;
    if (cpf !== undefined && String(cpf).replace(/\D/g, '') !== current.cpf) {
      throw new BadRequestException('O CPF não pode ser alterado depois do cadastro.');
    }
    const dto = await this.validated(UpdateProducerDto, rest);
    const incoming = { name: dto.name, phone: dto.phone === undefined ? undefined : dto.phone || null, community: dto.community };
    const fields = changedFields(incoming, current);
    const wantsConsent = consent === true && !current.consentAt;

    if (fields.length) {
      const resolution = this.resolve(current.updatedAt, base, clientAt);
      if (resolution === 'reject') {
        await this.recordConflict(op, user, 'server', current.updatedAt, base, fields, pick(incoming, fields));
        // O consentimento não entra em conflito: se o produtor autorizou, isso vale.
        if (wantsConsent) await this.producers.registerConsent(op.id, user);
        return { status: 'rejected', message: 'O servidor tem uma alteração mais recente deste produtor.', record: await this.producerRecord(op.id) };
      }
      await this.producers.update(op.id, Object.assign(new UpdateProducerDto(), pick(incoming, fields)), user);
      if (resolution === 'apply-conflict') {
        await this.recordConflict(op, user, 'client', current.updatedAt, base, fields, pick(current, fields));
      }
      if (wantsConsent) await this.producers.registerConsent(op.id, user);
      return { status: 'applied', conflict: resolution === 'apply-conflict' || undefined, record: await this.producerRecord(op.id) };
    }
    if (wantsConsent) {
      await this.producers.registerConsent(op.id, user);
      return { status: 'applied', record: await this.producerRecord(op.id) };
    }
    return { status: 'duplicate', record: syncProducer(current) };
  }

  private async producerRecord(id: string) {
    return syncProducer(await this.prisma.producer.findUniqueOrThrow({ where: { id } }));
  }

  // ------------------------------------------------------------- propriedade

  private async upsertProperty(op: SyncOperationDto, data: Record<string, unknown>, clientAt: Date, base: Date | null, user: AuthUser): Promise<Outcome> {
    const { producerId, ...rest } = data;
    const current = await this.prisma.property.findUnique({ where: { id: op.id } });
    if (!current) {
      if (base) throw new NotFoundException('Propriedade não encontrada no servidor.');
      if (typeof producerId !== 'string') throw new BadRequestException('Informe o produtor (producerId) da propriedade.');
      const dto = await this.validated(CreatePropertyDto, rest);
      await this.producers.addProperty(producerId, dto, user, { id: op.id });
      return { status: 'applied', record: await this.propertyRecord(op.id) };
    }
    if (current.deletedAt) return { status: 'rejected', message: 'Esta propriedade foi excluída no servidor.', record: syncProperty(current) };
    if (producerId !== undefined && producerId !== current.producerId) {
      throw new BadRequestException('Não é possível trocar o produtor de uma propriedade.');
    }

    const dto = await this.validated(UpdatePropertyDto, rest);
    const incoming: Record<string, unknown> = {
      name: dto.name,
      areaHa: dto.areaHa,
      locality: dto.locality,
      mainActivity: dto.mainActivity === undefined ? undefined : dto.mainActivity || null,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      coordinates:
        dto.coordinates === undefined ? undefined : dto.coordinates && { latitude: dto.coordinates.latitude, longitude: dto.coordinates.longitude },
    };
    const server: Record<string, unknown> = {
      ...current,
      areaHa: Number(current.areaHa),
      coordinates: current.latitude !== null && current.longitude !== null ? { latitude: current.latitude, longitude: current.longitude } : null,
    };
    const fields = changedFields(incoming, server);
    if (!fields.length) return { status: 'duplicate', record: syncProperty(current) };

    const resolution = this.resolve(current.updatedAt, base, clientAt);
    if (resolution === 'reject') {
      await this.recordConflict(op, user, 'server', current.updatedAt, base, fields, pick(incoming, fields));
      return { status: 'rejected', message: 'O servidor tem uma alteração mais recente desta propriedade.', record: syncProperty(current) };
    }
    await this.producers.updateProperty(op.id, Object.assign(new UpdatePropertyDto(), pick(incoming, fields)), user);
    if (resolution === 'apply-conflict') {
      await this.recordConflict(op, user, 'client', current.updatedAt, base, fields, pick(server, fields));
    }
    return { status: 'applied', conflict: resolution === 'apply-conflict' || undefined, record: await this.propertyRecord(op.id) };
  }

  private async propertyRecord(id: string) {
    return syncProperty(await this.prisma.property.findUniqueOrThrow({ where: { id } }));
  }

  // ------------------------------------------------------------------ visita

  // Visita não é editada: o upsert só cria. Reenvio do mesmo id devolve a que já existe.
  private async createVisit(op: SyncOperationDto, data: Record<string, unknown>, user: AuthUser): Promise<Outcome> {
    const existing = await this.prisma.visit.findUnique({ where: { id: op.id }, select: SYNC_VISIT_SELECT });
    if (existing) {
      if (typeof data.producerId === 'string' && data.producerId !== existing.producerId) throw new BadRequestException(ID_IN_USE);
      return { status: 'duplicate', record: syncVisit(existing) };
    }
    if (data.photos !== undefined) {
      throw new BadRequestException('As fotos da visita são enviadas depois, separadas dos dados. Envie a visita sem o campo photos.');
    }
    const dto = await this.validated(CreateVisitDto, data);
    await this.visits.create(dto, user, { id: op.id });
    return { status: 'applied', record: syncVisit(await this.prisma.visit.findUniqueOrThrow({ where: { id: op.id }, select: SYNC_VISIT_SELECT })) };
  }

  // ------------------------------------------------------------------ feição

  private async upsertFeature(op: SyncOperationDto, data: Record<string, unknown>, clientAt: Date, base: Date | null, user: AuthUser): Promise<Outcome> {
    const current = await this.features.findForSync(op.id);
    if (!current) {
      if (base) throw new NotFoundException('Feição não encontrada no servidor.');
      if (typeof data.propertyId !== 'string') throw new BadRequestException('Informe a propriedade (propertyId) da feição.');
      await this.features.create(
        { id: op.id, propertyId: data.propertyId, type: data.type as never, name: data.name as string | null | undefined, geometry: data.geometry },
        user,
      );
      return { status: 'applied', record: await this.featureRecord(op.id) };
    }
    if (current.deletedAt) return { status: 'rejected', message: 'Esta feição foi excluída no servidor.', record: syncFeature(current) };
    if ((data.propertyId !== undefined && data.propertyId !== current.propertyId) || (data.type !== undefined && data.type !== current.type)) {
      throw new BadRequestException('Não é possível trocar a propriedade ou o tipo de uma feição. Exclua e desenhe outra.');
    }

    const incoming = { name: data.name === undefined ? undefined : data.name || null, geometry: data.geometry };
    const fields = changedFields({ name: incoming.name }, { name: current.name });
    if (incoming.geometry !== undefined && !this.features.isSameGeometry(current.type, incoming.geometry, current.geometry)) {
      fields.push('geometry');
    }
    if (!fields.length) return { status: 'duplicate', record: syncFeature(current) };

    const resolution = this.resolve(current.updatedAt, base, clientAt);
    if (resolution === 'reject') {
      await this.recordConflict(op, user, 'server', current.updatedAt, base, fields, pick(incoming, fields));
      return { status: 'rejected', message: 'O servidor tem uma alteração mais recente desta feição.', record: syncFeature(current) };
    }
    await this.features.update(
      op.id,
      {
        name: fields.includes('name') ? (incoming.name as string | null) : undefined,
        geometry: fields.includes('geometry') ? incoming.geometry : undefined,
        expectedVersion: current.version, // se alguém gravar no meio do caminho, vira erro e o aparelho reenvia
      },
      user,
    );
    if (resolution === 'apply-conflict') {
      await this.recordConflict(op, user, 'client', current.updatedAt, base, fields, pick({ name: current.name, geometry: current.geometry }, fields));
    }
    return { status: 'applied', conflict: resolution === 'apply-conflict' || undefined, record: await this.featureRecord(op.id) };
  }

  private async deleteFeature(op: SyncOperationDto, clientAt: Date, base: Date | null, user: AuthUser): Promise<Outcome> {
    const current = await this.features.findForSync(op.id);
    // Nada a excluir (nunca chegou ao servidor, ou já excluída): idempotente.
    if (!current || current.deletedAt) return { status: 'duplicate', record: current ? syncFeature(current) : undefined };

    const resolution = this.resolve(current.updatedAt, base, clientAt);
    if (resolution === 'reject') {
      await this.recordConflict(op, user, 'server', current.updatedAt, base, ['deletedAt'], { deletedAt: op.updatedAt });
      return { status: 'rejected', message: 'A feição foi alterada no servidor depois da exclusão feita no aparelho.', record: syncFeature(current) };
    }
    await this.features.remove(op.id, user); // permissão: coordenação ou quem desenhou
    if (resolution === 'apply-conflict') {
      await this.recordConflict(op, user, 'client', current.updatedAt, base, ['deletedAt'], {
        name: current.name,
        version: current.version,
        geometry: current.geometry,
      });
    }
    return { status: 'applied', conflict: resolution === 'apply-conflict' || undefined, record: await this.featureRecord(op.id) };
  }

  private async featureRecord(id: string) {
    const row = await this.features.findForSync(id);
    return row ? syncFeature(row) : undefined;
  }
}
