import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationInput {
  type: string; // identificador estável (ex.: 'REQUEST_CREATED'), usado pela tela para escolher o ícone
  title: string;
  body: string;
  href?: string;
}

const PAGE = 20;

// Avisos para a equipe. Os módulos de negócio chamam notify*() depois de gravar;
// uma falha aqui nunca desfaz nem bloqueia a operação principal.
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUsers(userIds: string[], n: NotificationInput) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    try {
      await this.prisma.notification.createMany({ data: ids.map((userId) => ({ userId, ...n, href: n.href ?? null })) });
    } catch (e) {
      this.log.error(`Falha ao criar notificação ${n.type}`, e as Error);
    }
  }

  // Avisa toda a equipe ativa (ou só alguns perfis), menos quem fez a ação.
  async notifyTeam(n: NotificationInput, opts: { except?: string; roles?: Role[] } = {}) {
    try {
      const users = await this.prisma.user.findMany({
        where: { active: true, ...(opts.roles ? { role: { in: opts.roles } } : {}), ...(opts.except ? { id: { not: opts.except } } : {}) },
        select: { id: true },
      });
      await this.notifyUsers(users.map((u) => u.id), n);
    } catch (e) {
      this.log.error(`Falha ao buscar destinatários de ${n.type}`, e as Error);
    }
  }

  async list(userId: string, opts: { before?: string; unread?: boolean; limit?: number }) {
    const take = Math.min(Math.max(opts.limit ?? PAGE, 1), 50);
    const before = opts.before ? new Date(opts.before) : null;
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts.unread ? { readAt: null } : {}),
        ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const items = rows.slice(0, take).map(({ userId: _u, ...n }) => n);
    return { items, unread: await this.unreadCount(userId), hasMore: rows.length > take };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    // Notificação de outra pessoa responde como inexistente: não revela que existe.
    if (!n || n.userId !== userId) throw new NotFoundException('Notificação não encontrada.');
    if (!n.readAt) await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { unread: await this.unreadCount(userId) };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { unread: 0 };
  }
}
