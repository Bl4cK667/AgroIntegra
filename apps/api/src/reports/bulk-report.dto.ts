import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const BULK_TYPES = ['producers', 'properties', 'visits'] as const;
export type BulkType = (typeof BULK_TYPES)[number];

export const BULK_FORMATS = ['csv', 'pdf'] as const;
export type BulkFormat = (typeof BULK_FORMATS)[number];

// Filtros da exportação em massa. Todos opcionais; período exige início e fim juntos (conferido no serviço).
export class BulkReportFiltersDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Início do período (AAAA-MM-DD), inclusive' })
  @IsOptional()
  @Matches(DAY, { message: 'Início do período: use o formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'Fim do período (AAAA-MM-DD), inclusive' })
  @IsOptional()
  @Matches(DAY, { message: 'Fim do período: use o formato AAAA-MM-DD.' })
  to?: string;

  @ApiPropertyOptional({ description: 'Comunidade do produtor (igual ao cadastro)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  community?: string;

  @ApiPropertyOptional({ description: 'Técnico autor das visitas. Para técnicos, a API sempre usa o próprio usuário.' })
  @IsOptional()
  @IsUUID('all', { message: 'Técnico inválido.' })
  technicianId?: string;

  @ApiPropertyOptional({ description: 'Programa em que o produtor está inscrito (qualquer situação)' })
  @IsOptional()
  @IsUUID('all', { message: 'Programa inválido.' })
  programId?: string;
}

export class BulkReportDownloadDto extends BulkReportFiltersDto {
  @ApiPropertyOptional({ enum: BULK_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(BULK_FORMATS, { message: 'Formato deve ser csv ou pdf.' })
  format?: BulkFormat;
}
