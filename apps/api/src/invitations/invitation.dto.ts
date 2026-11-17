import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TOKEN_PATTERN } from './invitation-token';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const MIN_INVITE_HOURS = 1;
export const MAX_INVITE_HOURS = 168;
export const DEFAULT_INVITE_HOURS = 72;

export class CreateInvitationDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'E-mail muito longo.' })
  email!: string;

  @IsEnum(Role, { message: 'Escolha um perfil válido.' })
  role!: Role;

  @IsOptional()
  @IsInt({ message: 'A validade deve ser um número inteiro de horas.' })
  @Min(MIN_INVITE_HOURS, { message: `A validade mínima é de ${MIN_INVITE_HOURS} hora.` })
  @Max(MAX_INVITE_HOURS, { message: `A validade máxima é de ${MAX_INVITE_HOURS} horas (7 dias).` })
  expiresInHours?: number;
}

export class RegistrationTokenDto {
  @IsString({ message: 'Convite inválido.' })
  @Matches(TOKEN_PATTERN, { message: 'Convite inválido.' })
  token!: string;
}

// Senha: 8 a 72 caracteres (limite do bcrypt/Supabase), com pelo menos uma letra e um número.
export const PASSWORD_RULE = /^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).{8,72}$/s;
export const PASSWORD_MESSAGE = 'A senha precisa ter de 8 a 72 caracteres, com letras e números.';

export class RegisterDto extends RegistrationTokenDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: 'Informe seu nome completo.' })
  @MinLength(3, { message: 'Informe seu nome completo.' })
  @MaxLength(120, { message: 'O nome pode ter no máximo 120 caracteres.' })
  @Matches(/^\S+(\s\S+)+$/, { message: 'Informe nome e sobrenome.' })
  name!: string;

  @Transform(lower)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'E-mail muito longo.' })
  email!: string;

  // Aceita (61) 99999-9999, 61999999999 ou +55 61 99999-9999; guardado só com dígitos.
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString({ message: 'Informe um telefone válido.' })
  @Matches(/^(55)?\d{10,11}$/, { message: 'Informe o telefone com DDD, por exemplo (61) 99999-9999.' })
  phone!: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}
