import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';
import { trim } from '../common/search';

const AREA_MSG = 'Informe a área em hectares, maior que zero, com até 2 casas decimais.';

export class CreatePropertyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da propriedade.' })
  @MaxLength(120)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: AREA_MSG })
  @IsPositive({ message: AREA_MSG })
  @Max(99999999, { message: AREA_MSG })
  areaHa: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe a localidade.' })
  @MaxLength(80)
  locality: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mainActivity?: string;
}

export class UpdatePropertyDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da propriedade.' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: AREA_MSG })
  @IsPositive({ message: AREA_MSG })
  @Max(99999999, { message: AREA_MSG })
  areaHa?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe a localidade.' })
  @MaxLength(80)
  locality?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mainActivity?: string;
}
