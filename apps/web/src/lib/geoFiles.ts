import { FEATURE_STYLES, FEATURE_TYPES, type FeatureType } from '@agrointegra/map-styles';
import type { Geometry, Position } from './geo';

// Leitura de arquivos geográficos NO NAVEGADOR: KML, KMZ, Shapefile (.zip) e GeoJSON.
// O resultado vai para a API, que revalida tudo (nunca confiamos na geometria vinda do cliente).

export interface ImportedFeature {
  layer: string;
  name: string | null;
  geometry: Geometry;
  suggestedType: FeatureType | null;
}

export const ACCEPTED_FILES = '.kml,.kmz,.zip,.geojson,.json';
const MAX_BYTES = 20 * 1024 * 1024;

type RawGeometry = { type: string; coordinates?: unknown; geometries?: RawGeometry[] } | null;
type RawFeature = { geometry: RawGeometry; properties?: Record<string, unknown> | null };

// Temas do CAR/SICAR e camadas exportadas pelo próprio AgroIntegra.
const LAYER_RULES: [RegExp, FeatureType][] = [
  [/AREA_IMOVEL|IMOVEL|PERIMETRO|PERIMETER/i, 'PERIMETER'],
  [/RESERVA_LEGAL|RESERVA|LEGAL_RESERVE/i, 'LEGAL_RESERVE'],
  [/(^|[^A-Z])APP([^A-Z]|$)|PRESERVACAO_PERMANENTE/i, 'APP'],
  [/TALHAO|TALHOES|PLOT/i, 'PLOT'],
  [/SEDE|HEADQUARTERS/i, 'HEADQUARTERS'],
  [/BENFEITORIA|IMPROVEMENT|EDIFICA/i, 'IMPROVEMENT'],
  [/HIDROGRAFIA|AGUA|WATER|RIO|CORREGO|NASCENTE|ACUDE|LAGO/i, 'WATER'],
  [/ESTRADA|RODOVIA|ROAD|VIA_/i, 'ROAD'],
];

const LABEL_TO_TYPE = new Map<string, FeatureType>(
  FEATURE_TYPES.map((t) => [FEATURE_STYLES[t].label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), t]),
);

function suggestType(layer: string, props: Record<string, unknown>): FeatureType | null {
  const tipo = String(props.TIPO ?? props.tipo ?? props.featureType ?? '').trim();
  if ((FEATURE_TYPES as string[]).includes(tipo)) return tipo as FeatureType;
  const byLabel = LABEL_TO_TYPE.get(tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  if (byLabel) return byLabel;
  return LAYER_RULES.find(([re]) => re.test(layer))?.[1] ?? null;
}

function nameOf(props: Record<string, unknown>): string | null {
  for (const key of ['name', 'NOME', 'nome', 'Name', 'NAME', 'DESCRICAO', 'descricao']) {
    const v = props[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
  }
  return null;
}

// Achata GeometryCollection e MultiPoint; descarta o que não é ponto, linha ou polígono.
function flatten(g: RawGeometry): Geometry[] {
  if (!g) return [];
  if (g.type === 'GeometryCollection') return (g.geometries ?? []).flatMap(flatten);
  if (g.type === 'MultiPoint') return ((g.coordinates as Position[]) ?? []).map((c) => ({ type: 'Point', coordinates: c }));
  if (['Point', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(g.type)) return [g as Geometry];
  return [];
}

function collect(features: RawFeature[], layer: string): ImportedFeature[] {
  return features.flatMap((f) => {
    const props = f.properties ?? {};
    return flatten(f.geometry).map((geometry) => ({ layer, name: nameOf(props), geometry, suggestedType: suggestType(layer, props) }));
  });
}

async function readKml(text: string, layer: string) {
  const { kml } = await import('@tmcw/togeojson');
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo KML está corrompido ou não é um KML válido.');
  return collect(kml(doc).features as RawFeature[], layer);
}

export async function readGeoFile(file: File): Promise<ImportedFeature[]> {
  if (file.size > MAX_BYTES) throw new Error('Arquivo grande demais (máximo de 20 MB).');
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const base = file.name.replace(/\.[^.]+$/, '');
  let items: ImportedFeature[];

  if (ext === 'geojson' || ext === 'json') {
    let data: { type?: string; features?: RawFeature[]; geometry?: RawGeometry };
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('O arquivo GeoJSON não é um JSON válido.');
    }
    const features = data.type === 'FeatureCollection' ? data.features ?? [] : data.type === 'Feature' ? [data as RawFeature] : [{ geometry: data as RawGeometry }];
    items = collect(features, base);
  } else if (ext === 'kml') {
    items = await readKml(await file.text(), base);
  } else if (ext === 'kmz') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.kml'));
    if (!entry) throw new Error('O KMZ não contém nenhum arquivo .kml.');
    items = await readKml(await entry.async('string'), base);
  } else if (ext === 'zip') {
    const { parseZip } = await import('shpjs');
    let result;
    try {
      result = await parseZip(await file.arrayBuffer());
    } catch {
      throw new Error('Não encontrei um Shapefile válido no zip. Ele precisa ter pelo menos os arquivos .shp, .shx e .dbf (e de preferência o .prj).');
    }
    const collections = Array.isArray(result) ? result : [result];
    items = collections.flatMap((c) => collect(c.features as RawFeature[], (c.fileName ?? base).split('/').pop()!));
  } else if (ext === 'shp') {
    throw new Error('Envie o Shapefile compactado em .zip, junto com os arquivos .shx, .dbf e .prj.');
  } else {
    throw new Error('Formato não suportado. Use KML, KMZ, Shapefile (.zip) ou GeoJSON.');
  }

  if (!items.length) throw new Error('Nenhuma geometria (ponto, linha ou polígono) encontrada no arquivo.');
  return items;
}

export const isPolygon = (g: Geometry) => g.type === 'Polygon' || g.type === 'MultiPolygon';

/** Todos os polígonos de uma lista de geometrias, como lista de anéis (para montar um MultiPolygon). */
export function polygonsOf(geometries: Geometry[]): Position[][][] {
  return geometries.flatMap((g) =>
    g.type === 'Polygon'
      ? [g.coordinates.map((r) => r.map(([x, y]) => [x, y] as Position))]
      : g.type === 'MultiPolygon'
        ? g.coordinates.map((p) => p.map((r) => r.map(([x, y]) => [x, y] as Position)))
        : [],
  );
}
