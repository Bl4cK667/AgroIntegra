import { Module } from '@nestjs/common';
import type { FetchLike } from '../common/external-http';
import { ConabImportService } from './conab-import.service';
import { CotacoesController } from './cotacoes.controller';
import { COTACOES_CONFIG, COTACOES_FETCH, cotacoesConfigFromEnv } from './cotacoes.config';
import { CotacoesService } from './cotacoes.service';

// Módulo cotacoes (dono: João Pedro): preço recebido pelo produtor (CONAB, semanal) e preços locais
// lançados pela equipe. Fontes e licenças no README (seção "Cotações").
// O agendador (ScheduleModule.forRoot) é registrado no AppModule.
@Module({
  controllers: [CotacoesController],
  providers: [
    CotacoesService,
    ConabImportService,
    { provide: COTACOES_CONFIG, useFactory: () => cotacoesConfigFromEnv() },
    { provide: COTACOES_FETCH, useValue: ((url, init) => fetch(url, init)) as FetchLike },
  ],
  exports: [CotacoesService],
})
export class CotacoesModule {}
