import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, Validate, ValidateIf, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isValidCpf } from '../common/cpf';
import { trim } from '../common/search';

@ValidatorConstraint({ name: 'cpf' })
class CpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidCpf(value);
  }
  defaultMessage() {
    return 'CPF inválido. Confira os 11 números.';
  }
}

export class CreateProducerDto {
  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe o nome do produtor.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres neste campo.' })
  name: string;

  @Validate(CpfConstraint)
  cpf: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(30, { message: 'Use no máximo 30 caracteres neste campo.' })
  phone?: string;

  @Transform(trim)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe a comunidade.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  community: string;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}

// O CPF não pode ser alterado depois do cadastro.
export class UpdateProducerDto {
  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe o nome do produtor.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres neste campo.' })
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Preencha este campo com texto.' })
  @MaxLength(30, { message: 'Use no máximo 30 caracteres neste campo.' })
  phone?: string;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Preencha este campo com texto.' })
  @IsNotEmpty({ message: 'Informe a comunidade.' })
  @MaxLength(80, { message: 'Use no máximo 80 caracteres neste campo.' })
  community?: string;
}
