import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../invitations/invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthClient, SupabaseAuthError } from '../supabase/supabase-auth.client';
import { decodeImage } from '../visits/image';
import { ChangePasswordDto, UpdateAccountDto } from './account.dto';

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  jobTitle: true,
  avatarUpdatedAt: true,
  navStyle: true,
  theme: true,
  createdAt: true,
} as const;

type SelectedAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  jobTitle: string | null;
  avatarUpdatedAt: Date | null;
  navStyle: string;
  theme: string | null;
  createdAt: Date;
};

function toAccountView(user: SelectedAccount) {
  return {
    ...user,
    hasAvatar: user.avatarUpdatedAt !== null,
  };
}

export const PASSWORD_CHANGE_UNAVAILABLE = 'Não foi possível alterar a senha agora. Tente novamente em instantes.';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseAuthClient,
  ) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });
    if (!user) throw new NotFoundException('Conta não encontrada.');
    return toAccountView(user);
  }

  async update(userId: string, dto: UpdateAccountDto) {
    const data: { name?: string; phone?: string | null; jobTitle?: string | null; navStyle?: string; theme?: string } = {};

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) throw new BadRequestException('O nome não pode ficar em branco.');
      data.name = trimmed;
    }

    if (dto.phone !== undefined) {
      const trimmed = dto.phone.trim();
      data.phone = trimmed || null;
    }

    if (dto.jobTitle !== undefined) {
      const trimmed = dto.jobTitle.trim();
      data.jobTitle = trimmed || null;
    }

    if (dto.navStyle !== undefined) data.navStyle = dto.navStyle;
    if (dto.theme !== undefined) data.theme = dto.theme;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: ACCOUNT_SELECT,
    });

    await this.audit.record({
      userId,
      action: 'ACCOUNT_UPDATED',
      entity: 'User',
      entityId: userId,
      details: { fields: Object.keys(data) },
    });

    return toAccountView(updated);
  }

  async setAvatar(userId: string, imageDataUrl: string) {
    const decoded = decodeImage(imageDataUrl, 'Foto de perfil');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: new Uint8Array(decoded.data),
        avatarMime: decoded.mimeType,
        avatarUpdatedAt: new Date(),
      },
      select: ACCOUNT_SELECT,
    });

    await this.audit.record({
      userId,
      action: 'ACCOUNT_AVATAR_UPDATED',
      entity: 'User',
      entityId: userId,
    });

    return toAccountView(updated);
  }

  async removeAvatar(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: null,
        avatarMime: null,
        avatarUpdatedAt: null,
      },
      select: ACCOUNT_SELECT,
    });

    await this.audit.record({
      userId,
      action: 'ACCOUNT_AVATAR_REMOVED',
      entity: 'User',
      entityId: userId,
    });

    return toAccountView(updated);
  }

  async getAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, avatarMime: true },
    });
    if (!user?.avatar || !user.avatarMime) {
      throw new NotFoundException('Nenhuma foto de perfil cadastrada.');
    }
    return {
      data: Buffer.from(user.avatar),
      mimeType: user.avatarMime,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, authUserId: true },
    });
    if (!user) throw new NotFoundException('Conta não encontrada.');

    // Conta Supabase: senha vive só no Supabase (passwordHash local é aleatório). Nunca usa bcrypt aqui.
    if (user.authUserId) {
      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException('A nova senha precisa ser diferente da senha atual.');
      }
      await this.changeSupabasePassword(user.email, user.authUserId, dto);
      await this.audit.record({ userId, action: 'ACCOUNT_PASSWORD_CHANGED', entity: 'User', entityId: userId });
      return { ok: true };
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('A senha atual está incorreta.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha precisa ser diferente da senha atual.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.record({
      userId,
      action: 'ACCOUNT_PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
    });

    return { ok: true };
  }

  private async changeSupabasePassword(email: string, authUserId: string, dto: ChangePasswordDto) {
    if (!PASSWORD_RULE.test(dto.newPassword)) throw new BadRequestException(PASSWORD_MESSAGE);
    if (!this.supabase.enabled) throw new ServiceUnavailableException(PASSWORD_CHANGE_UNAVAILABLE);
    try {
      await this.supabase.changeOwnPassword(email, dto.currentPassword, dto.newPassword, authUserId);
    } catch (err) {
      if (!(err instanceof SupabaseAuthError)) throw err;
      if (err.kind === 'invalid_credentials') throw new BadRequestException('A senha atual está incorreta.');
      if (err.kind === 'rejected') throw new BadRequestException('A nova senha não foi aceita. Escolha uma senha mais forte.');
      // identity_mismatch: e-mail no Supabase pertence a outra identidade; falha fechado sem alterar nada.
      this.logger.warn(`Troca de senha no Supabase falhou (${err.kind}).`);
      throw new ServiceUnavailableException(PASSWORD_CHANGE_UNAVAILABLE);
    }
  }
}
