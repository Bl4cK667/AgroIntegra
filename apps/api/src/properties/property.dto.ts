import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { trim } from '../common/search';

const AREA_MSG = 'Informe a área em hectares, maior que zero, com até 2 casas decimais.';

export const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

// Texto vazio vira null: no cadastro fica sem valor; na edição, apaga o valor salvo.
const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};
const stateCode = (arg: { value: unknown }) => {
  const v = blankToNull(arg);
  return typeof v === 'string' ? v.toUpperCase() : v;
};

export class CoordinatesDto {
  @IsLatitude({ message: 'Latitude inválida. Use graus decimais entre -90 e 90.' })
  latitude: number;

  @IsLongitude({ message: 'Longitude inválida. Use graus decimais entre -180 e 180.' })
  longitude: number;
}

// Campos de localização, todos opcionais. Em PATCH, null apaga o valor salvo.
class PropertyLocationFields {
  @Transform(blankToNull)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(160, { message: 'Use no máximo 160 caracteres neste campo.' })
  address?: string | null;

  @Transform(blankToNull)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  city?: string | null;

  @Transform(stateCode)
  @IsOptional()
  @IsIn(STATES, { message: 'Estado inválido. Use a sigla da UF, por exemplo: PE.' })
  state?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto | null;
}

export class CreatePropertyDto extends PropertyLocationFields {
  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe o nome da propriedade.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres neste campo.' })
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: AREA_MSG })
  @IsPositive({ message: AREA_MSG })
  @Max(99999999, { message: AREA_MSG })
  areaHa: number;

  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe a localidade.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  locality: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  mainActivity?: string;
}

export class UpdatePropertyDto extends PropertyLocationFields {
  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe o nome da propriedade.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres neste campo.' })
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: AREA_MSG })
  @IsPositive({ message: AREA_MSG })
  @Max(99999999, { message: AREA_MSG })
  areaHa?: number;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe a localidade.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  locality?: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  mainActivity?: string;
}
