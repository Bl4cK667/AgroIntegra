import { Module } from '@nestjs/common';
import { GeoFeaturesService } from './geo-features.service';

// Módulo geo (dono: João Pedro): demarcação de propriedades e feições sobre satélite.
// Passo 3: só a camada de serviço. Controllers, importação/exportação e mapa entram no passo 4.
@Module({ providers: [GeoFeaturesService], exports: [GeoFeaturesService] })
export class GeoModule {}
