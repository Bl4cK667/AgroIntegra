// Estilos do mapa do AgroIntegra, compartilhados entre o painel web (maplibre-gl) e o futuro app
// (@maplibre/maplibre-react-native). Só objetos simples no formato da especificação de estilo do
// MapLibre: este pacote não depende de nenhuma biblioteca de mapa.

export type FeatureType =
  | 'PERIMETER'
  | 'PLOT'
  | 'APP'
  | 'LEGAL_RESERVE'
  | 'HEADQUARTERS'
  | 'IMPROVEMENT'
  | 'WATER'
  | 'ROAD';

export type GeometryKind = 'polygon' | 'line' | 'point';

export interface FeatureStyle {
  label: string;
  /** cor em #rrggbb */
  color: string;
  fillOpacity: number;
  lineWidth: number;
  /** formas aceitas (espelha a validação da API e a CHECK do banco) */
  kinds: GeometryKind[];
  /** ordem de desenho: menor fica embaixo */
  order: number;
}

export const FEATURE_TYPES: FeatureType[] = [
  'PERIMETER', 'PLOT', 'APP', 'LEGAL_RESERVE', 'HEADQUARTERS', 'IMPROVEMENT', 'WATER', 'ROAD',
];

export const FEATURE_STYLES: Record<FeatureType, FeatureStyle> = {
  PERIMETER: { label: 'Perímetro', color: '#ffd400', fillOpacity: 0.08, lineWidth: 3, kinds: ['polygon'], order: 0 },
  LEGAL_RESERVE: { label: 'Reserva legal', color: '#1b5e20', fillOpacity: 0.35, lineWidth: 2, kinds: ['polygon'], order: 1 },
  APP: { label: 'APP', color: '#2e7d32', fillOpacity: 0.35, lineWidth: 2, kinds: ['polygon'], order: 2 },
  PLOT: { label: 'Talhão', color: '#8bc34a', fillOpacity: 0.3, lineWidth: 2, kinds: ['polygon'], order: 3 },
  WATER: { label: 'Água', color: '#1e88e5', fillOpacity: 0.45, lineWidth: 3, kinds: ['point', 'line', 'polygon'], order: 4 },
  ROAD: { label: 'Estrada', color: '#e0e0e0', fillOpacity: 0, lineWidth: 3, kinds: ['line'], order: 5 },
  IMPROVEMENT: { label: 'Benfeitoria', color: '#bcaaa4', fillOpacity: 0.6, lineWidth: 2, kinds: ['point', 'polygon'], order: 6 },
  HEADQUARTERS: { label: 'Sede', color: '#ff8a65', fillOpacity: 0.6, lineWidth: 2, kinds: ['point', 'polygon'], order: 7 },
};

export const KIND_LABELS: Record<GeometryKind, string> = { polygon: 'polígono', line: 'linha', point: 'ponto' };

// Cores do mapa territorial.
export const TERRITORY_COLORS = {
  demarcated: '#ffd400', // propriedade com perímetro desenhado
  pointOnly: '#ff8a65', // só com lat/lng digitada
  withOpenRequests: '#e53935', // destaque: solicitação aberta
  selected: '#ffffff',
};

type Expression = unknown[];

/** Expressão MapLibre que escolhe a cor pela propriedade `featureType` do GeoJSON. */
export function colorByFeatureType(property = 'featureType'): Expression {
  return ['match', ['get', property], ...FEATURE_TYPES.flatMap((t) => [t, FEATURE_STYLES[t].color]), '#ffffff'];
}

function opacityByFeatureType(property: string): Expression {
  return ['match', ['get', property], ...FEATURE_TYPES.flatMap((t) => [t, FEATURE_STYLES[t].fillOpacity]), 0.2];
}

function widthByFeatureType(property: string): Expression {
  return ['match', ['get', property], ...FEATURE_TYPES.flatMap((t) => [t, FEATURE_STYLES[t].lineWidth]), 2];
}

export interface LayerSpec {
  id: string;
  type: 'fill' | 'line' | 'circle';
  source: string;
  filter?: Expression;
  paint: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/**
 * Camadas para uma fonte GeoJSON de feições da propriedade (cada feature com properties.featureType).
 * Polígonos (preenchimento + contorno), linhas e pontos, nessa ordem.
 */
export function featureLayers(source: string, prefix = source): LayerSpec[] {
  // Aceita as formas simples e Multi*: conforme a versão, o MapLibre devolve uma ou outra.
  const polygon: Expression = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
  const line: Expression = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
  const point: Expression = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];
  return [
    { id: `${prefix}-fill`, type: 'fill', source, filter: polygon, paint: { 'fill-color': colorByFeatureType(), 'fill-opacity': opacityByFeatureType('featureType') } },
    { id: `${prefix}-outline`, type: 'line', source, filter: polygon, paint: { 'line-color': colorByFeatureType(), 'line-width': widthByFeatureType('featureType') } },
    {
      id: `${prefix}-line`, type: 'line', source, filter: line,
      paint: { 'line-color': colorByFeatureType(), 'line-width': widthByFeatureType('featureType') },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: `${prefix}-point`, type: 'circle', source, filter: point,
      paint: { 'circle-color': colorByFeatureType(), 'circle-radius': 7, 'circle-stroke-color': '#18211c', 'circle-stroke-width': 1.5 },
    },
  ];
}

export interface BaseMapOptions {
  /** URL de tiles raster XYZ com {z}/{x}/{y} (ou {z}/{y}/{x}) */
  satelliteUrl: string;
  satelliteAttribution: string;
  /** camada opcional de nomes de lugares e limites por cima do satélite */
  labelsUrl?: string;
  maxZoom?: number;
}

/** Estilo base: satélite + (opcional) rótulos. As camadas do sistema entram por cima. */
export function baseMapStyle(o: BaseMapOptions) {
  const maxzoom = o.maxZoom ?? 19;
  const sources: Record<string, unknown> = {
    satellite: { type: 'raster', tiles: [o.satelliteUrl], tileSize: 256, maxzoom, attribution: o.satelliteAttribution },
  };
  const layers: unknown[] = [{ id: 'satellite', type: 'raster', source: 'satellite' }];
  if (o.labelsUrl) {
    sources.labels = { type: 'raster', tiles: [o.labelsUrl], tileSize: 256, maxzoom };
    layers.push({ id: 'labels', type: 'raster', source: 'labels' });
  }
  return { version: 8 as const, sources, layers };
}
