import turfArea from '@turf/area';
import type { Geometry, MultiPolygonGeometry, Position } from './geo';

// Medidas de PRÉVIA no navegador (Turf, esfera). O valor oficial é o do PostGIS, calculado ao salvar.

const haFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const formatHa = (ha: number) => `${haFmt.format(ha)} ha`;
export const formatMeters = (m: number) => (m >= 1000 ? `${haFmt.format(m / 1000)} km` : `${mFmt.format(m)} m`);

export function previewAreaHa(geometry: Geometry | null): number | null {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null;
  return turfArea({ type: 'Feature', geometry, properties: {} }) / 10000;
}

// Haversine (R = 6.371 km), como no planejamento.
function haversine([lng1, lat1]: Position, [lng2, lat2]: Position) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function previewLengthM(geometry: Geometry | null): number | null {
  if (!geometry) return null;
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : null;
  if (!lines) return null;
  return lines.reduce((sum, line) => sum + line.slice(1).reduce((s, p, i) => s + haversine(line[i], p), 0), 0);
}

/** Junta polígonos soltos num MultiPolygon (ou null se não houver nenhum). */
export function toMultiPolygon(polygons: Position[][][]): MultiPolygonGeometry | null {
  return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
}

/** Caixa envolvente [[oeste, sul], [leste, norte]] de qualquer geometria. */
export function bounds(geometries: Geometry[]): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const visit = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as number[];
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    } else (c as unknown[]).forEach(visit);
  };
  geometries.forEach((g) => visit(g.coordinates));
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}
