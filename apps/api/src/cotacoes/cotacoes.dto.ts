import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { trim } from '../common/search';
import { TRACKED_PRODUCTS } from './products';

const KEYS = TRACKED_PRODUCTS.map((p) => p.key);

export class CreateLocalPriceDto {
  @ApiPropertyOptional({ enum: KEYS, description: 'Produto da lista acompanhada. Sem ele, informe productName e unit.' })
  @IsOptional()
  @IsIn(KEYS, { message: 'Produto inválido. Escolha um da lista ou deixe em branco e informe o nome.' })
  productKey?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'Queijo coalho' })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres no nome do produto.' })
  productName?: string;

  @ApiPropertyOptional({ maxLength: 30, example: 'R$/kg', description: 'Unidade do preço. Com productKey, vale a unidade do produto.' })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(30, { message: 'Use no máximo 30 caracteres na unidade.' })
  unit?: string;

  @ApiProperty({ example: 310.5 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe o preço em reais, com até 2 casas decimais.' })
  @IsPositive({ message: 'O preço deve ser maior que zero.' })
  @Max(10_000_000, { message: 'Preço alto demais: confira o valor.' })
  price: number;

  @ApiProperty({ maxLength: 120, example: 'Laticínio Serra Dourada, Canaã dos Carajás' })
  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe a praça (onde o preço foi praticado).' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres na praça.' })
  place: string;

  @ApiProperty({ example: '2026-11-18', description: 'Data do preço (AAAA-MM-DD).' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a data do preço.' })
  observedOn: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(300, { message: 'Use no máximo 300 caracteres na observação.' })
  notes?: string;
}

export class LocalPriceQueryDto {
  @ApiPropertyOptional({ enum: KEYS })
  @IsOptional()
  @IsIn(KEYS, { message: 'Produto inválido.' })
  productKey?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser no mínimo 1.' })
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize deve ser um número inteiro.' })
  @Min(1, { message: 'pageSize deve ser no mínimo 1.' })
  @Max(100, { message: 'pageSize deve ser no máximo 100.' })
  pageSize?: number;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ minimum: 4, maximum: 104, default: 26, description: 'Semanas de histórico.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weeks deve ser um número inteiro.' })
  @Min(4, { message: 'weeks deve ser no mínimo 4.' })
  @Max(104, { message: 'weeks deve ser no máximo 104.' })
  weeks?: number;
}
