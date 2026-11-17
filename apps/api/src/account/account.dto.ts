import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const NAV_STYLES = ['topbar', 'sidebar'] as const;
export type NavStyle = (typeof NAV_STYLES)[number];

export const THEME_IDS = ['midnight-black', 'forest-dark', 'pure-light', 'sand-earth', 'ocean-blue', 'graphite'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export class UpdateAccountDto {
  @IsOptional()
  @IsString({ message: 'Informe um nome válido.' })
  @IsNotEmpty({ message: 'O nome não pode ficar em branco.' })
  @MaxLength(120, { message: 'O nome pode ter no máximo 120 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Informe um telefone válido.' })
  @MaxLength(30, { message: 'O telefone pode ter no máximo 30 caracteres.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Informe um cargo ou função válida.' })
  @MaxLength(80, { message: 'O cargo pode ter no máximo 80 caracteres.' })
  jobTitle?: string;

  @IsOptional()
  @IsIn(NAV_STYLES, { message: 'Escolha um estilo de navegação válido.' })
  navStyle?: NavStyle;

  @IsOptional()
  @IsIn(THEME_IDS, { message: 'Escolha um tema válido.' })
  theme?: ThemeId;
}

export class UpdateAvatarDto {
  @IsString({ message: 'Selecione uma imagem válida.' })
  @IsNotEmpty({ message: 'Selecione uma imagem para a foto de perfil.' })
  image!: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'Informe sua senha atual.' })
  @IsNotEmpty({ message: 'Informe sua senha atual.' })
  currentPassword!: string;

  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(6, { message: 'A nova senha precisa ter pelo menos 6 caracteres.' })
  @MaxLength(100, { message: 'A nova senha pode ter no máximo 100 caracteres.' })
  newPassword!: string;
}
