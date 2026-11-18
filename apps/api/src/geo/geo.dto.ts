import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyFeatureType, RequestStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EXPORT_FORMATS, ExportFormat } from './geo-export.service';
import { MAX_IMPORT_FEATURES } from './geo-features.service';
import { MAP_MAX_LIMIT, NEAR_MAX_RADIUS_M } from './geo-map.service';

const TYPE_MSG = `Tipo de feição inválido. Use: ${Object.values(PropertyFeatureType).join(', ')}.`;
const GEOMETRY_DOC =
  'Geometria GeoJSON (RFC 7946), coordenadas [longitude, latitude] em graus decimais (WGS 84). ' +
  'Polígonos: perímetro, talhão, APP, reserva legal (sede, benfeitoria e água também aceitam). ' +
  'Linhas: estrada e água. Pontos: sede, benfeitoria e água.';
const SAMPLE_POLYGON = {
  type: 'Polygon',
  coordinates: [[[-38.5, -12.97], [-38.499, -12.97], [-38.499, -12.971], [-38.5, -12.971], [-38.5, -12.97]]],
};

export class CreateFeatureDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID v4 gerado no aparelho (offline). Reenviar o mesmo id não duplica.' })
  @IsOptional()
  @IsUUID('4', { message: 'Identificador inválido: use um UUID v4.' })
  id?: string;

  @ApiProperty({ enum: PropertyFeatureType, enumName: 'PropertyFeatureType' })
  @IsEnum(PropertyFeatureType, { message: TYPE_MSG })
  type: PropertyFeatureType;

  @ApiPropertyOptional({ maxLength: 120, nullable: true, example: 'Talhão 1' })
  @IsOptional()
  @IsString({ message: 'O nome da feição deve ser texto.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres no nome da feição.' })
  name?: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: GEOMETRY_DOC, example: SAMPLE_POLYGON })
  @IsObject({ message: 'Envie a geometria em GeoJSON (objeto com "type" e "coordinates").' })
  geometry: Record<string, unknown>;
}

export class UpdateFeatureDto {
  @ApiPropertyOptional({ maxLength: 120, nullable: true, description: 'null ou texto vazio apaga o nome.' })
  @IsOptional()
  @IsString({ message: 'O nome da feição deve ser texto.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres no nome da feição.' })
  name?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: GEOMETRY_DOC })
  @IsOptional()
  @IsObject({ message: 'Envie a geometria em GeoJSON (objeto com "type" e "coordinates").' })
  geometry?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, description: 'Versão que o usuário estava editando. Se outra pessoa salvou antes, responde 409.' })
  @IsOptional()
  @IsInt({ message: 'expectedVersion deve ser um número inteiro.' })
  @Min(1, { message: 'expectedVersion deve ser maior que zero.' })
  expectedVersion?: number;
}

export class ValidateFeatureDto {
  @ApiProperty({ enum: PropertyFeatureType, enumName: 'PropertyFeatureType' })
  @IsEnum(PropertyFeatureType, { message: TYPE_MSG })
  type: PropertyFeatureType;

  @ApiProperty({ type: 'object', additionalProperties: true, description: GEOMETRY_DOC })
  @IsObject({ message: 'Envie a geometria em GeoJSON (objeto com "type" e "coordinates").' })
  geometry: Record<string, unknown>;
}

export class ImportFeatureItemDto extends CreateFeatureDto {}

export class ImportFeaturesDto {
  @ApiProperty({ type: [ImportFeatureItemDto], minItems: 1, maxItems: MAX_IMPORT_FEATURES })
  @IsArray({ message: 'Envie a lista de feições em "features".' })
  @ArrayMinSize(1, { message: 'Nenhuma feição para importar.' })
  @ArrayMaxSize(MAX_IMPORT_FEATURES, { message: `Importe no máximo ${MAX_IMPORT_FEATURES} feições por vez.` })
  @ValidateNested({ each: true })
  @Type(() => ImportFeatureItemDto)
  features: ImportFeatureItemDto[];
}

const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);

export class ImportQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: false, description: 'true = só valida e devolve o relatório, sem gravar.' })
  @IsOptional()
  @Transform(toBool)
  @IsIn([true, false], { message: 'dryRun deve ser true ou false.' })
  dryRun?: boolean;
}

export class ExportQueryDto {
  @ApiProperty({ enum: EXPORT_FORMATS, description: 'shp = zip com um shapefile por tema, em SIRGAS 2000 (EPSG:4674).' })
  @IsIn(EXPORT_FORMATS as unknown as string[], { message: `Formato inválido. Use: ${EXPORT_FORMATS.join(', ')}.` })
  format: ExportFormat;
}

export class MapQueryDto {
  @ApiPropertyOptional({ description: 'Comunidade do produtor (valor exato).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  community?: string;

  @ApiPropertyOptional({ description: 'Atividade principal da propriedade (valor exato).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mainActivity?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Produtor inscrito no programa.' })
  @IsOptional()
  @IsUUID('all', { message: 'programId inválido.' })
  programId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Técnico que visitou a propriedade (ou o produtor).' })
  @IsOptional()
  @IsUUID('all', { message: 'technicianId inválido.' })
  technicianId?: string;

  @ApiPropertyOptional({ enum: ['OPEN', ...Object.values(RequestStatus)], description: 'OPEN = qualquer solicitação não concluída.' })
  @IsOptional()
  @IsIn(['OPEN', ...Object.values(RequestStatus)], { message: 'Situação inválida.' })
  requestStatus?: RequestStatus | 'OPEN';

  @ApiPropertyOptional({ example: '-38.6,-13.1,-38.3,-12.8', description: 'Recorte do mapa: lngMin,latMin,lngMax,latMax.' })
  @IsOptional()
  @Matches(/^\s*-?\d+(\.\d+)?\s*(,\s*-?\d+(\.\d+)?\s*){3}$/, { message: 'bbox inválido: use "lngMin,latMin,lngMax,latMax".' })
  bbox?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAP_MAX_LIMIT, default: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser inteiro.' })
  @Min(1)
  @Max(MAP_MAX_LIMIT, { message: `limit deve ser no máximo ${MAP_MAX_LIMIT}.` })
  limit?: number;
}

export class NearQueryDto {
  @ApiProperty({ example: -12.9705 })
  @Type(() => Number)
  @IsLatitude({ message: 'lat inválida: use graus decimais entre -90 e 90.' })
  lat: number;

  @ApiProperty({ example: -38.4995 })
  @Type(() => Number)
  @IsLongitude({ message: 'lng inválida: use graus decimais entre -180 e 180.' })
  lng: number;

  @ApiPropertyOptional({ minimum: 1, maximum: NEAR_MAX_RADIUS_M, default: 5000, description: 'Raio em metros.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'radius deve ser inteiro (metros).' })
  @Min(1)
  @Max(NEAR_MAX_RADIUS_M, { message: `radius deve ser no máximo ${NEAR_MAX_RADIUS_M} metros.` })
  radius?: number;
}
