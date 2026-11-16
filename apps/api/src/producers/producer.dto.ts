import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
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
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do produtor.' })
  @MaxLength(120)
  name: string;

  @Validate(CpfConstraint)
  cpf: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Informe a comunidade.' })
  @MaxLength(80)
  community: string;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}

// O CPF não pode ser alterado depois do cadastro.
export class UpdateProducerDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do produtor.' })
  @MaxLength(120)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe a comunidade.' })
  @MaxLength(80)
  community?: string;
}
