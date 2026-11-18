import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PUSH_ENTITIES = ['producer', 'property', 'visit', 'feature'] as const;
export type PushEntity = (typeof PUSH_ENTITIES)[number];
export const PUSH_OPS = ['upsert', 'delete'] as const;
export type PushOp = (typeof PUSH_OPS)[number];

export const MAX_PUSH_OPERATIONS = 50;
export const MAX_PULL_LIMIT = 500;
export const DEFAULT_PULL_LIMIT = 200;

export class SyncOperationDto {
  @ApiProperty({ enum: PUSH_ENTITIES })
  @IsIn(PUSH_ENTITIES, { message: `Entidade inválida. Use: ${PUSH_ENTITIES.join(', ')}.` })
  entity: PushEntity;

  @ApiProperty({ enum: PUSH_OPS, description: 'upsert = cria se não existe, senão altera. delete = exclusão lógica (só feições).' })
  @IsIn(PUSH_OPS, { message: 'Operação inválida. Use upsert ou delete.' })
  op: PushOp;

  @ApiProperty({ format: 'uuid', description: 'UUID v4 gerado no aparelho. Reenviar o mesmo id não duplica.' })
  @IsUUID('4', { message: 'Identificador inválido: use um UUID v4 gerado no aparelho.' })
  id: string;

  @ApiProperty({ format: 'date-time', description: 'Quando a alteração foi feita no aparelho (UTC). Decide o conflito.' })
  @IsISO8601({ strict: true }, { message: 'Informe updatedAt em ISO 8601 (UTC).' })
  updatedAt: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'updatedAt do servidor na última vez que o aparelho recebeu este registro. Ausente = registro criado no aparelho.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Informe baseUpdatedAt em ISO 8601 (UTC).' })
  baseUpdatedAt?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Campos do registro, no mesmo formato das rotas do painel (POST para criar; numa alteração, só os campos que mudaram). ' +
      'Produtor: name, cpf, phone, community, consent. Propriedade: producerId, name, areaHa, locality, mainActivity, address, city, state, coordinates. ' +
      'Visita (só criação, sem fotos): producerId, propertyId, requestId, visitedOn, diagnosis, actionPlan, returnOn, impact, signature, location. ' +
      'Feição: propertyId, type, name, geometry.',
  })
  @IsOptional()
  @IsObject({ message: 'data deve ser um objeto.' })
  data?: Record<string, unknown>;
}

export class SyncPushDto {
  @ApiProperty({ type: [SyncOperationDto], maxItems: MAX_PUSH_OPERATIONS, description: 'Aplicadas na ordem enviada.' })
  @IsArray({ message: 'Envie a lista de operações.' })
  @ArrayMinSize(1, { message: 'Envie ao menos uma operação.' })
  @ArrayMaxSize(MAX_PUSH_OPERATIONS, { message: `Envie no máximo ${MAX_PUSH_OPERATIONS} operações por lote.` })
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations: SyncOperationDto[];
}

export class SyncPullQueryDto {
  @ApiPropertyOptional({ description: 'Marcador devolvido pelo pull anterior (campo cursor). Vazio = sincronização completa.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  since?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PULL_LIMIT, default: DEFAULT_PULL_LIMIT, description: 'Máximo de registros por entidade nesta página.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro.' })
  @Min(1, { message: 'limit deve ser no mínimo 1.' })
  @Max(MAX_PULL_LIMIT, { message: `limit deve ser no máximo ${MAX_PULL_LIMIT}.` })
  limit?: number;
}
