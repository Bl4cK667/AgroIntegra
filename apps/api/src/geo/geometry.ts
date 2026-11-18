import { BadRequestException } from '@nestjs/common';
import { PropertyFeatureType } from '@prisma/client';

// Validação estrutural de GeoJSON (RFC 7946), sem banco. A validade topológica
// (auto-intersecção etc.) é conferida depois pelo PostGIS (ST_IsValid).

export type Position = [number, number];
export type NormalizedGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

type Kind = 'point' | 'line' | 'polygon';

// Formas aceitas por tipo de feição. Espelha a CHECK "PropertyFeature_geom_check" da migração.
export const FEATURE_KINDS: Record<PropertyFeatureType, Kind[]> = {
  PERIMETER: ['polygon'],
  PLOT: ['polygon'],
  APP: ['polygon'],
  LEGAL_RESERVE: ['polygon'],
  HEADQUARTERS: ['point', 'polygon'],
  IMPROVEMENT: ['point', 'polygon'],
  WATER: ['point', 'line', 'polygon'],
  ROAD: ['line'],
};

export const FEATURE_LABELS: Record<PropertyFeatureType, string> = {
  PERIMETER: 'Perímetro',
  PLOT: 'Talhão',
  APP: 'APP',
  LEGAL_RESERVE: 'Reserva legal',
  HEADQUARTERS: 'Sede',
  IMPROVEMENT: 'Benfeitoria',
  WATER: 'Água',
  ROAD: 'Estrada',
};

const KIND_LABELS: Record<Kind, string> = { point: 'ponto', line: 'linha', polygon: 'polígono' };
const KIND_OF: Record<string, Kind> = {
  Point: 'point',
  LineString: 'line',
  MultiLineString: 'line',
  Polygon: 'polygon',
  MultiPolygon: 'polygon',
};

// Território brasileiro com folga (inclui ilhas oceânicas). Coordenada fora disso quase sempre
// é latitude e longitude trocadas.
export const BRAZIL_BOUNDS = { minLng: -75, maxLng: -28, minLat: -35, maxLat: 6 };
export const MAX_VERTICES = 20000;

const SHAPE_MSG = 'Geometria mal formada. Envie GeoJSON com "type" e "coordinates" no formato da RFC 7946.';

function fail(message: string): never {
  throw new BadRequestException(message);
}

export const formatCoordinate = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });

const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
const distinctCount = (pts: Position[]) => new Set(pts.map((p) => `${p[0]},${p[1]}`)).size;

interface Counter { n: number }

function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) fail(SHAPE_MSG);
  return value;
}

function position(value: unknown, counter: Counter): Position {
  if (
    !Array.isArray(value) || value.length < 2 || value.length > 3 ||
    !value.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    fail('Coordenada inválida: cada vértice deve ser [longitude, latitude] em graus decimais.');
  }
  const [lng, lat] = value as number[];
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    fail('Coordenada fora da faixa válida (longitude de -180 a 180, latitude de -90 a 90). Confira se a ordem é [longitude, latitude].');
  }
  const b = BRAZIL_BOUNDS;
  if (lng < b.minLng || lng > b.maxLng || lat < b.minLat || lat > b.maxLat) {
    fail(
      `Coordenada fora do Brasil (latitude ${formatCoordinate(lat)}, longitude ${formatCoordinate(lng)}). ` +
        'Confira se a ordem é [longitude, latitude].',
    );
  }
  if (++counter.n > MAX_VERTICES) fail(`A geometria tem mais de ${MAX_VERTICES} vértices. Simplifique antes de enviar.`);
  return [lng, lat]; // altitude descartada: as colunas são 2D
}

// Remove vértices repetidos em sequência (comum em GPS parado e em desenho com duplo clique).
function dedupe(pts: Position[]): Position[] {
  return pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]));
}

function ring(value: unknown, counter: Counter): Position[] {
  const pts = dedupe(list(value).map((p) => position(p, counter)));
  if (pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts.pop();
  if (distinctCount(pts) < 3) fail('O polígono precisa de pelo menos 3 vértices diferentes.');
  return [...pts, pts[0]]; // anel sempre fechado
}

function line(value: unknown, counter: Counter): Position[] {
  const pts = dedupe(list(value).map((p) => position(p, counter)));
  if (distinctCount(pts) < 2) fail('A linha precisa de pelo menos 2 pontos diferentes.');
  return pts;
}

const polygon = (value: unknown, counter: Counter) => list(value).map((r) => ring(r, counter));

export function isFeatureType(value: unknown): value is PropertyFeatureType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FEATURE_KINDS, value);
}

// Valida e normaliza: Polygon → MultiPolygon, LineString → MultiLineString, sem altitude, anéis fechados.
export function normalizeGeometry(featureType: PropertyFeatureType, input: unknown): NormalizedGeometry {
  if (!isFeatureType(featureType)) fail('Tipo de feição inválido.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('Envie a geometria em GeoJSON (objeto com "type" e "coordinates").');
  }
  const { type, coordinates } = input as { type?: unknown; coordinates?: unknown };
  const kind = typeof type === 'string' ? KIND_OF[type] : undefined;
  if (!kind) fail('Tipo de geometria não suportado. Use Point, LineString, MultiLineString, Polygon ou MultiPolygon.');

  const allowed = FEATURE_KINDS[featureType];
  if (!allowed.includes(kind)) {
    const options = allowed.map((k) => KIND_LABELS[k]).join(' ou ');
    fail(`${FEATURE_LABELS[featureType]} aceita apenas ${options}; a geometria enviada é ${KIND_LABELS[kind]}.`);
  }

  const counter: Counter = { n: 0 };
  switch (type) {
    case 'Point':
      return { type: 'Point', coordinates: position(coordinates, counter) };
    case 'LineString':
      return { type: 'MultiLineString', coordinates: [line(coordinates, counter)] };
    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: list(coordinates).map((l) => line(l, counter)) };
    case 'Polygon':
      return { type: 'MultiPolygon', coordinates: [polygon(coordinates, counter)] };
    default:
      return { type: 'MultiPolygon', coordinates: list(coordinates).map((p) => polygon(p, counter)) };
  }
}

// Motivos do GEOS (ST_IsValidReason) traduzidos. "Ring Self-intersection" antes de "Self-intersection".
const REASONS: [RegExp, string][] = [
  [/^Ring Self-intersection/i, 'O contorno do polígono encosta em si mesmo'],
  [/^Self-intersection/i, 'O contorno do polígono se cruza (forma de laço)'],
  [/^Too few points/i, 'O polígono tem pontos de menos'],
  [/^Hole lies outside shell/i, 'Há um recorte (buraco) fora do contorno externo'],
  [/^Holes are nested/i, 'Há recortes (buracos) um dentro do outro'],
  [/^Interior is disconnected/i, 'Os recortes dividem o polígono em partes soltas'],
  [/^Nested shells/i, 'Há partes do polígono umas dentro das outras'],
  [/^Duplicate Rings/i, 'Há contornos repetidos'],
  [/^Invalid Coordinate/i, 'Há uma coordenada inválida'],
];

export function translateInvalidReason(reason: string): string {
  const match = REASONS.find(([re]) => re.test(reason));
  const base = match ? match[1] : 'A geometria é inválida';
  const at = /\[\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/.exec(reason);
  const where = at
    ? ` perto de latitude ${formatCoordinate(Number(at[2]))}, longitude ${formatCoordinate(Number(at[1]))}`
    : '';
  return `${base}${where}. Ajuste os vértices e tente de novo.`;
}
