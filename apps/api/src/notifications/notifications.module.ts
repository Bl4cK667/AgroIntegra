import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Global: qualquer módulo de negócio pode injetar NotificationsService para avisar a equipe.
@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
