import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

// Cada usuário só vê e altera as próprias notificações.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ?before=<data ISO> pagina o histórico; ?unread=true traz só as não lidas.
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('before') before?: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(user.id, { before, unread: unread === 'true', limit: limit ? Number(limit) || undefined : undefined });
  }

  @Get('unread-count')
  async count(@CurrentUser() user: AuthUser) {
    return { unread: await this.notifications.unreadCount(user.id) };
  }

  @Patch('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
