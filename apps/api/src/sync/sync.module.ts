import { Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { ProducersModule } from '../producers/producers.module';
import { VisitsModule } from '../visits/visits.module';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';

// Módulo sync (dono: João Pedro): POST /sync/push e GET /sync/pull para o app offline.
// Grava só pelos serviços exportados dos outros módulos, para valerem as mesmas regras,
// auditoria e notificações das rotas do painel.
@Module({
  imports: [ProducersModule, VisitsModule, GeoModule],
  controllers: [SyncController],
  providers: [SyncPushService, SyncPullService],
})
export class SyncModule {}
