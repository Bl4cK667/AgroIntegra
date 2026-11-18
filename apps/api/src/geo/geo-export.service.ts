import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PropertyFeatureType } from '@prisma/client';
import JSZip from 'jszip';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DbfField, writeShapefile } from './formats/shapefile';
import { writeKml } from './formats/kml';
import { featureView, FeatureRow, GeoFeaturesService } from './geo-features.service';
import { FEATURE_LABELS, NormalizedGeometry } from './geometry';

export const EXPORT_FORMATS = ['geojson', 'kml', 'kmz', 'shp'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFile {
  filename: string;
  contentType: string;
  body: Buffer;
}

// Camadas do shapefile: uma por tema e tipo de geometria (o formato exige um tipo por arquivo).
// AREA_IMOVEL, APP e RESERVA_LEGAL seguem os temas que o SICAR importa separadamente.
const LAYERS: Record<PropertyFeatureType, Partial<Record<NormalizedGeometry['type'], string>>> = {
  PERIMETER: { MultiPolygon: 'AREA_IMOVEL' },
  PLOT: { MultiPolygon: 'TALHAO' },
  APP: { MultiPolygon: 'APP' },
  LEGAL_RESERVE: { MultiPolygon: 'RESERVA_LEGAL' },
  HEADQUARTERS: { Point: 'SEDE_PONTO', MultiPolygon: 'SEDE_AREA' },
  IMPROVEMENT: { Point: 'BENFEITORIA_PONTO', MultiPolygon: 'BENFEITORIA_AREA' },
  WATER: { Point: 'AGUA_PONTO', MultiLineString: 'AGUA_LINHA', MultiPolygon: 'AGUA_AREA' },
  ROAD: { MultiLineString: 'ESTRADA' },
};

const DBF_FIELDS: DbfField[] = [
  { name: 'ID', type: 'C', length: 36 },
  { name: 'TIPO', type: 'C', length: 20 },
  { name: 'NOME', type: 'C', length: 120 },
  { name: 'AREA_HA', type: 'N', length: 14, decimals: 4 },
  { name: 'PERIM_M', type: 'N', length: 14, decimals: 2 },
  { name: 'COMPR_M', type: 'N', length: 14, decimals: 2 },
  { name: 'VERSAO', type: 'N', length: 6, decimals: 0 },
];

const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

export function fileSlug(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return slug || 'propriedade';
}

function readme(propertyName: string, layers: string[]) {
  return [
    `Demarcação da propriedade "${propertyName}", exportada pelo AgroIntegra em ${new Date().toISOString().slice(0, 10)}.`,
    '',
    'Sistema de referência: SIRGAS 2000 geográfico (EPSG:4674), coordenadas em graus decimais.',
    'As coordenadas foram registradas em WGS 84; a diferença para o SIRGAS 2000 é de centímetros.',
    'Áreas e perímetros nos atributos foram calculados no elipsoide (PostGIS, geography).',
    '',
    'Camadas neste arquivo (uma por tema; cada uma é um shapefile completo .shp/.shx/.dbf/.prj/.cpg):',
    ...layers.map((l) => `- ${l}`),
    '',
    'No SICAR, importe cada tema separadamente (ex.: AREA_IMOVEL, APP, RESERVA_LEGAL).',
    'Este arquivo é um apoio técnico: não substitui o cadastro oficial no CAR nem a certificação no SIGEF.',
    '',
  ].join('\r\n');
}

@Injectable()
export class GeoExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: GeoFeaturesService,
    private readonly audit: AuditService,
  ) {}

  async export(propertyId: string, format: ExportFormat, user: AuthUser): Promise<ExportFile> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true, name: true, producer: { select: { name: true } } },
    });
    if (!property) throw new NotFoundException('Propriedade não encontrada.');
    const rows = await this.features.listRows(propertyId);
    if (!rows.length) {
      throw new UnprocessableEntityException('Nada para exportar: a propriedade ainda não tem feições demarcadas.');
    }

    const base = `${fileSlug(property.name)}_${new Date().toISOString().slice(0, 10)}`;
    const title = `${property.name} (${property.producer.name})`;
    let file: ExportFile;
    switch (format) {
      case 'geojson':
        file = {
          filename: `${base}.geojson`,
          contentType: 'application/geo+json',
          body: Buffer.from(JSON.stringify({ type: 'FeatureCollection', name: title, features: rows.map(featureView) }, null, 2)),
        };
        break;
      case 'kml':
        file = { filename: `${base}.kml`, contentType: 'application/vnd.google-earth.kml+xml', body: Buffer.from(this.kml(title, rows)) };
        break;
      case 'kmz': {
        const zip = new JSZip();
        zip.file('doc.kml', this.kml(title, rows));
        file = { filename: `${base}.kmz`, contentType: 'application/vnd.google-earth.kmz', body: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
        break;
      }
      case 'shp':
        file = { filename: `${base}_shapefile.zip`, contentType: 'application/zip', body: await this.shapefileZip(property.name, base, rows) };
        break;
    }

    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_FEATURES_EXPORTED',
      entity: 'Property',
      entityId: propertyId,
      details: { format, features: rows.length },
    });
    return file;
  }

  private kml(title: string, rows: FeatureRow[]) {
    return writeKml(
      title,
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        geometry: r.geometry,
        data: {
          tipo: FEATURE_LABELS[r.type],
          area_ha: num(r.areaHa),
          perimetro_m: num(r.perimeterM),
          comprimento_m: num(r.lengthM),
          versao: r.version,
        },
      })),
    );
  }

  private async shapefileZip(propertyName: string, base: string, rows: FeatureRow[]) {
    const groups = new Map<string, FeatureRow[]>();
    for (const r of rows) {
      const layer = LAYERS[r.type][r.geometry.type];
      if (!layer) continue; // a CHECK do banco impede combinações fora da tabela
      groups.set(layer, [...(groups.get(layer) ?? []), r]);
    }
    const zip = new JSZip();
    const names: string[] = [];
    for (const [layer, items] of groups) {
      const files = writeShapefile(
        items.map((r) => ({
          geometry: r.geometry,
          values: [r.id, r.type, r.name, num(r.areaHa), num(r.perimeterM), num(r.lengthM), r.version],
        })),
        DBF_FIELDS,
      );
      const name = `${base}_${layer}`;
      names.push(`${name} (${items.length})`);
      zip.file(`${name}.shp`, files.shp);
      zip.file(`${name}.shx`, files.shx);
      zip.file(`${name}.dbf`, files.dbf);
      zip.file(`${name}.prj`, files.prj);
      zip.file(`${name}.cpg`, files.cpg);
    }
    zip.file('LEIAME.txt', readme(propertyName, names));
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
