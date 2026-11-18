import { NormalizedGeometry, Position } from '../geometry';

// Gravador mínimo de ESRI Shapefile (ESRI Shapefile Technical Description, 1998):
// .shp (geometrias), .shx (índice), .dbf (atributos, dBase III), .prj (sistema de referência)
// e .cpg (codificação dos textos do .dbf). Um arquivo por tipo de geometria, como exige o formato.

// SIRGAS 2000 geográfico (EPSG:4674), no WKT do ESRI. As coordenadas guardadas em WGS 84 não
// são transformadas: a diferença entre os dois referenciais é de centímetros (IBGE).
export const SIRGAS_2000_PRJ =
  'GEOGCS["GCS_SIRGAS_2000",DATUM["D_SIRGAS_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

export type DbfValue = string | number | null;

export interface DbfField {
  name: string; // até 10 caracteres ASCII
  type: 'C' | 'N';
  length: number;
  decimals?: number;
}

export interface ShapefileFiles {
  shp: Buffer;
  shx: Buffer;
  dbf: Buffer;
  prj: string;
  cpg: string;
}

const SHAPE_TYPE: Record<NormalizedGeometry['type'], number> = { Point: 1, MultiLineString: 3, MultiPolygon: 5 };

// Área com sinal no plano lon/lat: positiva = anti-horário.
function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return sum / 2;
}

// Shapefile: anel externo no sentido horário, furos no anti-horário (o contrário da RFC 7946).
function orient(ring: Position[], clockwise: boolean): Position[] {
  const isClockwise = signedArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function parts(geometry: NormalizedGeometry): Position[][] {
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => polygon.map((ring, i) => orient(ring, i === 0)));
  }
  return [[geometry.coordinates]];
}

interface Box { xmin: number; ymin: number; xmax: number; ymax: number }

function boxOf(points: Position[]): Box {
  const box = { xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity };
  for (const [x, y] of points) {
    box.xmin = Math.min(box.xmin, x);
    box.ymin = Math.min(box.ymin, y);
    box.xmax = Math.max(box.xmax, x);
    box.ymax = Math.max(box.ymax, y);
  }
  return box;
}

function recordContent(geometry: NormalizedGeometry): Buffer {
  const type = SHAPE_TYPE[geometry.type];
  if (geometry.type === 'Point') {
    const buf = Buffer.alloc(20);
    buf.writeInt32LE(type, 0);
    buf.writeDoubleLE(geometry.coordinates[0], 4);
    buf.writeDoubleLE(geometry.coordinates[1], 12);
    return buf;
  }
  const ps = parts(geometry);
  const points = ps.flat();
  const buf = Buffer.alloc(44 + 4 * ps.length + 16 * points.length);
  const box = boxOf(points);
  buf.writeInt32LE(type, 0);
  buf.writeDoubleLE(box.xmin, 4);
  buf.writeDoubleLE(box.ymin, 12);
  buf.writeDoubleLE(box.xmax, 20);
  buf.writeDoubleLE(box.ymax, 28);
  buf.writeInt32LE(ps.length, 36);
  buf.writeInt32LE(points.length, 40);
  let offset = 44;
  let start = 0;
  for (const part of ps) {
    buf.writeInt32LE(start, offset);
    offset += 4;
    start += part.length;
  }
  for (const [x, y] of points) {
    buf.writeDoubleLE(x, offset);
    buf.writeDoubleLE(y, offset + 8);
    offset += 16;
  }
  return buf;
}

function header(fileLengthBytes: number, shapeType: number, box: Box): Buffer {
  const buf = Buffer.alloc(100);
  buf.writeInt32BE(9994, 0);
  buf.writeInt32BE(fileLengthBytes / 2, 24); // em palavras de 16 bits
  buf.writeInt32LE(1000, 28);
  buf.writeInt32LE(shapeType, 32);
  buf.writeDoubleLE(box.xmin, 36);
  buf.writeDoubleLE(box.ymin, 44);
  buf.writeDoubleLE(box.xmax, 52);
  buf.writeDoubleLE(box.ymax, 60);
  return buf;
}

// Corta o texto em `max` bytes UTF-8 sem partir um caractere.
function utf8Fit(text: string, max: number): Buffer {
  let out = Buffer.from(text, 'utf8');
  if (out.length <= max) return out;
  let chars = Array.from(text);
  while (out.length > max) {
    chars = chars.slice(0, -1);
    out = Buffer.from(chars.join(''), 'utf8');
  }
  return out;
}

function writeDbf(fields: DbfField[], rows: DbfValue[][]): Buffer {
  const headerLength = 32 + 32 * fields.length + 1;
  const recordLength = 1 + fields.reduce((sum, f) => sum + f.length, 0);
  const buf = Buffer.alloc(headerLength + recordLength * rows.length + 1, 0x20);
  buf.fill(0, 0, headerLength);
  const now = new Date();
  buf.writeUInt8(0x03, 0);
  buf.writeUInt8(now.getUTCFullYear() - 1900, 1);
  buf.writeUInt8(now.getUTCMonth() + 1, 2);
  buf.writeUInt8(now.getUTCDate(), 3);
  buf.writeUInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerLength, 8);
  buf.writeUInt16LE(recordLength, 10);
  fields.forEach((f, i) => {
    const at = 32 + 32 * i;
    buf.write(f.name.slice(0, 10), at, 'ascii');
    buf.write(f.type, at + 11, 'ascii');
    buf.writeUInt8(f.length, at + 16);
    buf.writeUInt8(f.decimals ?? 0, at + 17);
  });
  buf.writeUInt8(0x0d, headerLength - 1);

  let offset = headerLength;
  for (const row of rows) {
    buf.write(' ', offset, 'ascii'); // registro ativo
    let at = offset + 1;
    fields.forEach((f, i) => {
      const value = row[i];
      if (value !== null && value !== undefined) {
        if (f.type === 'N') {
          const text = Number(value).toFixed(f.decimals ?? 0).slice(-f.length);
          buf.write(text.padStart(f.length, ' '), at, 'ascii');
        } else {
          utf8Fit(String(value), f.length).copy(buf, at);
        }
      }
      at += f.length;
    });
    offset += recordLength;
  }
  buf.writeUInt8(0x1a, buf.length - 1);
  return buf;
}

// Todos os registros precisam ter o mesmo tipo de geometria.
export function writeShapefile(records: { geometry: NormalizedGeometry; values: DbfValue[] }[], fields: DbfField[]): ShapefileFiles {
  if (!records.length) throw new Error('Shapefile sem registros.');
  const kinds = new Set(records.map((r) => r.geometry.type));
  if (kinds.size !== 1) throw new Error('Um shapefile só pode ter um tipo de geometria.');
  const shapeType = SHAPE_TYPE[records[0].geometry.type];

  const contents = records.map((r) => recordContent(r.geometry));
  const allPoints = records.flatMap((r) => (r.geometry.type === 'Point' ? [r.geometry.coordinates] : parts(r.geometry).flat()));
  const box = boxOf(allPoints);

  const shpLength = 100 + contents.reduce((sum, c) => sum + 8 + c.length, 0);
  const shxLength = 100 + 8 * contents.length;
  const shp = Buffer.alloc(shpLength);
  const shx = Buffer.alloc(shxLength);
  header(shpLength, shapeType, box).copy(shp, 0);
  header(shxLength, shapeType, box).copy(shx, 0);

  let offset = 100;
  contents.forEach((content, i) => {
    shp.writeInt32BE(i + 1, offset);
    shp.writeInt32BE(content.length / 2, offset + 4);
    content.copy(shp, offset + 8);
    shx.writeInt32BE(offset / 2, 100 + 8 * i);
    shx.writeInt32BE(content.length / 2, 100 + 8 * i + 4);
    offset += 8 + content.length;
  });

  return { shp, shx, dbf: writeDbf(fields, records.map((r) => r.values)), prj: SIRGAS_2000_PRJ, cpg: 'UTF-8' };
}
