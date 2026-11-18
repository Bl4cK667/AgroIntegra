import { Module } from '@nestjs/common';
import { FeaturesController, GeoPropertiesController } from './geo.controller';
import { GeoExportService } from './geo-export.service';
import { GeoFeaturesService } from './geo-features.service';
import { GeoMapService } from './geo-map.service';

// Módulo geo (dono: João Pedro): demarcação de propriedades e feições sobre satélite,
// mapa territorial, importação e exportação (GeoJSON, KML, KMZ, Shapefile).
@Module({
  controllers: [GeoPropertiesController, FeaturesController],
  providers: [GeoFeaturesService, GeoMapService, GeoExportService],
  exports: [GeoFeaturesService, GeoMapService],
})
export class GeoModule {}
