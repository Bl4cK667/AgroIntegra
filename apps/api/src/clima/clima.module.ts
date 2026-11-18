import { Module } from '@nestjs/common';
import { ClimaController } from './clima.controller';
import { CLIMA_CONFIG, climaConfigFromEnv } from './clima.config';
import { ClimaService } from './clima.service';
import { CLIMA_FETCH, FetchLike } from './http-json';
import { IbgeClient } from './ibge.client';
import { InmetClient } from './inmet.client';
import { OpenMeteoClient } from './open-meteo.client';

// Módulo clima (dono: João Pedro): previsão do tempo por propriedade e por município.
// Fontes e licenças no README (seção "Clima").
@Module({
  controllers: [ClimaController],
  providers: [
    ClimaService,
    InmetClient,
    OpenMeteoClient,
    IbgeClient,
    { provide: CLIMA_CONFIG, useFactory: () => climaConfigFromEnv() },
    // fetch global do Node; os testes trocam por um falso (sem rede).
    { provide: CLIMA_FETCH, useValue: ((url, init) => fetch(url, init)) as FetchLike },
  ],
  exports: [ClimaService],
})
export class ClimaModule {}
