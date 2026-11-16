import { RequestPriority, RequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { trim } from '../common/search';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateRequestDto {
  @IsUUID('4', { message: 'Produtor inválido.' })
  producerId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Propriedade inválida.' })
  propertyId?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o assunto da solicitação.' })
  @MaxLength(120)
  subject: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(RequestPriority, { message: 'Prioridade inválida.' })
  priority: RequestPriority;
}

export class MoveRequestDto {
  @IsEnum(RequestStatus, { message: 'Situação inválida.' })
  status: RequestStatus;

  @IsOptional()
  @Matches(DAY, { message: 'Data agendada inválida.' })
  scheduledFor?: string;
}

export class PriorityDto {
  @IsEnum(RequestPriority, { message: 'Prioridade inválida.' })
  priority: RequestPriority;
}
