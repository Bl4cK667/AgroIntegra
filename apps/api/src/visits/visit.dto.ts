import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from '../common/search';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class LocationDto {
  @IsLatitude({ message: 'Latitude inválida.' })
  latitude: number;

  @IsLongitude({ message: 'Longitude inválida.' })
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracy?: number;
}

export class CreateVisitDto {
  @IsUUID('4', { message: 'Produtor inválido.' })
  producerId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Propriedade inválida.' })
  propertyId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Solicitação inválida.' })
  requestId?: string;

  @Matches(DAY, { message: 'Informe a data da visita.' })
  visitedOn: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Descreva o diagnóstico.' })
  @MaxLength(5000)
  diagnosis: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Descreva o plano de ação.' })
  @MaxLength(5000)
  actionPlan: string;

  @IsOptional()
  @Matches(DAY, { message: 'Data de retorno inválida.' })
  returnOn?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impact?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Envie no máximo 3 fotos.' })
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
