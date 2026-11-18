import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { GeoExportService } from './geo-export.service';
import { GeoFeaturesService } from './geo-features.service';
import { GeoMapService } from './geo-map.service';
import {
  CreateFeatureDto,
  ExportQueryDto,
  ImportFeaturesDto,
  ImportQueryDto,
  MapQueryDto,
  NearQueryDto,
  UpdateFeatureDto,
  ValidateFeatureDto,
} from './geo.dto';

// Só o que usamos da resposta do Express (o projeto não depende de @types/express).
interface StatusResponse {
  status(code: number): unknown;
}

// Rotas do módulo geo sob /properties. Este controller é separado do PropertiesController
// (módulo do Tiago): nenhuma rota aqui usa o mesmo método + caminho de lá. O e2e
// "rotas fixas não são capturadas" protege /properties/geojson e /properties/near.
@ApiTags('geo')
@ApiBearerAuth()
@Controller('properties')
export class GeoPropertiesController {
  constructor(
    private readonly features: GeoFeaturesService,
    private readonly map: GeoMapService,
    private readonly exporter: GeoExportService,
  ) {}

  @Get('geojson')
  @ApiOperation({ summary: 'Mapa territorial: propriedades em GeoJSON (perímetro ou ponto digitado), com filtros. Sem CPF.' })
  territorialMap(@Query() q: MapQueryDto) {
    return this.map.territorialMap(q);
  }

  @Get('geojson/filters')
  @ApiOperation({ summary: 'Valores disponíveis para os filtros do mapa territorial.' })
  mapFilters() {
    return this.map.filterOptions();
  }

  @Get('near')
  @ApiOperation({ summary: 'Propriedades num raio (metros) de um ponto, da mais próxima para a mais distante.' })
  near(@Query() q: NearQueryDto) {
    return this.map.near(q.lat, q.lng, q.radius);
  }

  @Get(':propertyId/features')
  @ApiOperation({ summary: 'Feições ativas da propriedade (FeatureCollection).' })
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.features.listByProperty(propertyId);
  }

  @Post(':propertyId/features')
  @ApiOperation({ summary: 'Cria uma feição. Área, perímetro e comprimento são calculados pelo banco.' })
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: CreateFeatureDto, @CurrentUser() user: AuthUser) {
    return this.features.create({ ...dto, propertyId }, user);
  }

  @Post(':propertyId/features/import')
  @ApiOperation({
    summary: 'Importa feições (GeoJSON já convertido de KML/KMZ/Shapefile no navegador).',
    description: 'dryRun=true devolve o relatório por feição sem gravar (200). Sem dryRun grava tudo ou nada (201); com problema, 422 e o relatório.',
  })
  async import(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() q: ImportQueryDto,
    @Body() dto: ImportFeaturesDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: StatusResponse,
  ) {
    const dryRun = q.dryRun === true;
    const result = await this.features.importFeatures(propertyId, dto.features, dryRun, user);
    res.status(dryRun ? 200 : 201);
    return result;
  }

  @Get(':propertyId/features/export')
  @ApiOperation({ summary: 'Exporta as feições em GeoJSON, KML, KMZ ou Shapefile (SIRGAS 2000, um arquivo por tema).' })
  @ApiProduces('application/geo+json', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', 'application/zip')
  async export(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() q: ExportQueryDto, @CurrentUser() user: AuthUser) {
    const file = await this.exporter.export(propertyId, q.format, user);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
      length: file.body.length,
    });
  }
}

@ApiTags('geo')
@ApiBearerAuth()
@Controller('features')
export class FeaturesController {
  constructor(private readonly features: GeoFeaturesService) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida uma geometria e, se inválida, PROPÕE correção (ST_MakeValid). Não grava nada.' })
  validate(@Body() dto: ValidateFeatureDto) {
    return this.features.suggestFix(dto.type, dto.geometry);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Uma feição (GeoJSON Feature).' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.features.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Altera nome e/ou geometria. Gera nova versão no histórico.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeatureDto, @CurrentUser() user: AuthUser) {
    return this.features.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclusão lógica. Só a coordenação ou quem desenhou a feição.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.features.remove(id, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Histórico de versões da feição (inclusive a exclusão).' })
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.features.history(id);
  }
}
