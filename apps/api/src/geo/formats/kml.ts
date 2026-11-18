import { PropertyFeatureType } from '@prisma/client';
import { FEATURE_LABELS, NormalizedGeometry, Position } from '../geometry';

// KML 2.2 (OGC). Coordenadas "longitude,latitude", como no GeoJSON.

export interface KmlFeature {
  id: string;
  type: PropertyFeatureType;
  name: string | null;
  geometry: NormalizedGeometry;
  data: Record<string, string | number | null>;
}

// Paleta provisória, escrita como aarrggbb para ficar legível. O passo 4b move as cores para
// packages/map-styles.
const COLORS: Record<PropertyFeatureType, string> = {
  PERIMETER: 'ffffd400', // amarelo-ouro
  PLOT: 'ff4caf50', // verde
  APP: 'ff2e7d32', // verde-escuro
  LEGAL_RESERVE: 'ff1b5e20', // verde-mata
  HEADQUARTERS: 'ff795548', // marrom
  IMPROVEMENT: 'ff8d6e63', // marrom-claro
  WATER: 'ff1e88e5', // azul
  ROAD: 'ff9e9e9e', // cinza
};

// KML usa aabbggrr: converte a partir de aarrggbb.
function kmlColor(argb: string, alpha = argb.slice(0, 2)): string {
  const rr = argb.slice(2, 4);
  const gg = argb.slice(4, 6);
  const bb = argb.slice(6, 8);
  return `${alpha}${bb}${gg}${rr}`;
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

const coords = (pts: Position[]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

function polygonXml(polygon: Position[][]): string {
  const [outer, ...holes] = polygon;
  const inner = holes.map((h) => `<innerBoundaryIs><LinearRing><coordinates>${coords(h)}</coordinates></LinearRing></innerBoundaryIs>`).join('');
  return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(outer)}</coordinates></LinearRing></outerBoundaryIs>${inner}</Polygon>`;
}

function geometryXml(g: NormalizedGeometry): string {
  if (g.type === 'Point') return `<Point><coordinates>${g.coordinates[0]},${g.coordinates[1]}</coordinates></Point>`;
  const items =
    g.type === 'MultiPolygon'
      ? g.coordinates.map(polygonXml)
      : g.coordinates.map((line) => `<LineString><coordinates>${coords(line)}</coordinates></LineString>`);
  return items.length === 1 ? items[0] : `<MultiGeometry>${items.join('')}</MultiGeometry>`;
}

function style(type: PropertyFeatureType): string {
  const color = COLORS[type];
  return (
    `<Style id="${type}"><LineStyle><color>${kmlColor(color)}</color><width>2</width></LineStyle>` +
    `<PolyStyle><color>${kmlColor(color, '55')}</color></PolyStyle>` +
    `<IconStyle><color>${kmlColor(color)}</color></IconStyle></Style>`
  );
}

export function writeKml(documentName: string, features: KmlFeature[]): string {
  const types = [...new Set(features.map((f) => f.type))];
  const folders = types.map((type) => {
    const placemarks = features
      .filter((f) => f.type === type)
      .map((f) => {
        const data = Object.entries(f.data)
          .map(([k, v]) => `<Data name="${escapeXml(k)}"><value>${v === null ? '' : escapeXml(String(v))}</value></Data>`)
          .join('');
        const name = escapeXml(f.name ?? FEATURE_LABELS[f.type]);
        return `<Placemark id="${escapeXml(f.id)}"><name>${name}</name><styleUrl>#${type}</styleUrl><ExtendedData>${data}</ExtendedData>${geometryXml(f.geometry)}</Placemark>`;
      })
      .join('');
    return `<Folder><name>${escapeXml(FEATURE_LABELS[type])}</name>${placemarks}</Folder>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(documentName)}</name>` +
    `${types.map(style).join('')}${folders.join('')}</Document></kml>\n`
  );
}
