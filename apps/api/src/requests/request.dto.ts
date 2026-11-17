import { RequestPriority, RequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { trim } from '../common/search';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateRequestDto {
  @IsUUID('4', { message: 'Escolha um produtor da lista.' })
  producerId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Escolha uma propriedade da lista.' })
  propertyId?: string;

  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe o assunto da solicitação.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres neste campo.' })
  subject: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(2000, { message: 'Use no máximo 2000 caracteres neste campo.' })
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
