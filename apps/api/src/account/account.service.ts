import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
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
  createdAt: Date;
};

function toAccountView(user: SelectedAccount) {
  return {
    ...user,
    hasAvatar: user.avatarUpdatedAt !== null,
  };
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    const data: { name?: string; phone?: string | null; jobTitle?: string | null; navStyle?: string } = {};

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
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('Conta não encontrada.');

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
}
