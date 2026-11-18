import { escapeXml, writeKml } from '../src/geo/formats/kml';
import { SIRGAS_2000_PRJ, writeShapefile } from '../src/geo/formats/shapefile';
import { fileSlug } from '../src/geo/geo-export.service';
import { NormalizedGeometry, Position } from '../src/geo/geometry';

// Anel externo em sentido anti-horário (como recomenda a RFC 7946) e um furo em sentido horário.
const OUTER: Position[] = [[-38.5, -12.972], [-38.498, -12.972], [-38.498, -12.97], [-38.5, -12.97], [-38.5, -12.972]];
const HOLE: Position[] = [[-38.4995, -12.9705], [-38.4985, -12.9705], [-38.4985, -12.9715], [-38.4995, -12.9715], [-38.4995, -12.9705]];
const WITH_HOLE: NormalizedGeometry = { type: 'MultiPolygon', coordinates: [[OUTER, HOLE]] };

// Lê os anéis do primeiro registro de um .shp de polígonos, direto dos bytes.
function readFirstPolygon(shp: Buffer) {
  const contentAt = 100 + 8;
  const numParts = shp.readInt32LE(contentAt + 36);
  const numPoints = shp.readInt32LE(contentAt + 40);
  const starts = Array.from({ length: numParts }, (_, i) => shp.readInt32LE(contentAt + 44 + 4 * i));
  const pointsAt = contentAt + 44 + 4 * numParts;
  const points: Position[] = Array.from({ length: numPoints }, (_, i) => [
    shp.readDoubleLE(pointsAt + 16 * i),
    shp.readDoubleLE(pointsAt + 16 * i + 8),
  ]);
  return starts.map((s, i) => points.slice(s, starts[i + 1] ?? numPoints));
}

const signedArea = (ring: Position[]) =>
  ring.slice(0, -1).reduce((sum, [x, y], i) => sum + x * ring[i + 1][1] - ring[i + 1][0] * y, 0) / 2;

describe('Geo: gravador de Shapefile (ESRI, 1998)', () => {
  const files = writeShapefile(
    [{ geometry: WITH_HOLE, values: ['id-1', 'PERIMETER', 'Sítio São José', 12.3456, 438.26, null, 2] }],
    [
      { name: 'ID', type: 'C', length: 36 },
      { name: 'TIPO', type: 'C', length: 20 },
      { name: 'NOME', type: 'C', length: 9 },
      { name: 'AREA_HA', type: 'N', length: 14, decimals: 4 },
      { name: 'PERIM_M', type: 'N', length: 14, decimals: 2 },
      { name: 'COMPR_M', type: 'N', length: 14, decimals: 2 },
      { name: 'VERSAO', type: 'N', length: 6, decimals: 0 },
    ],
  );

  it('cabeçalho do .shp e do .shx: código 9994, versão 1000, tipo Polygon (5), tamanhos em palavras de 16 bits', () => {
    expect(files.shp.readInt32BE(0)).toBe(9994);
    expect(files.shp.readInt32LE(28)).toBe(1000);
    expect(files.shp.readInt32LE(32)).toBe(5);
    expect(files.shp.readInt32BE(24) * 2).toBe(files.shp.length);
    expect(files.shx.readInt32BE(24) * 2).toBe(files.shx.length);
    expect(files.shx.length).toBe(100 + 8);
    expect(files.shx.readInt32BE(100)).toBe(50); // registro 1 começa logo após o cabeçalho
    // Caixa envolvente do arquivo.
    expect([files.shp.readDoubleLE(36), files.shp.readDoubleLE(44), files.shp.readDoubleLE(52), files.shp.readDoubleLE(60)]).toEqual([
      -38.5, -12.972, -38.498, -12.97,
    ]);
  });

  it('anel externo em sentido horário e furo em anti-horário, como exige o formato', () => {
    const [outer, hole] = readFirstPolygon(files.shp);
    expect(outer).toHaveLength(5);
    expect(hole).toHaveLength(5);
    expect(signedArea(outer)).toBeLessThan(0); // horário
    expect(signedArea(hole)).toBeGreaterThan(0); // anti-horário
  });

  it('.dbf dBase III com os campos, texto em UTF-8 cortado sem partir acento e nulo em branco', () => {
    const dbf = files.dbf;
    expect(dbf.readUInt8(0)).toBe(0x03);
    expect(dbf.readUInt32LE(4)).toBe(1);
    const headerLength = dbf.readUInt16LE(8);
    expect(headerLength).toBe(32 + 32 * 7 + 1);
    expect(dbf.toString('ascii', 32, 34)).toBe('ID');
    const record = dbf.subarray(headerLength + 1, headerLength + dbf.readUInt16LE(10));
    // 9 bytes: "Sítio S" ocupa 8 ("í" tem 2 bytes); o "ã" (2 bytes) não cabe e não é partido ao meio.
    const nome = record.subarray(36 + 20, 36 + 20 + 9).toString('utf8');
    expect(nome).toBe('Sítio S ');
    const numbers = record.subarray(36 + 20 + 9).toString('ascii');
    expect(numbers).toBe(`${'12.3456'.padStart(14)}${'438.26'.padStart(14)}${' '.repeat(14)}${'2'.padStart(6)}`);
    expect(dbf.readUInt8(dbf.length - 1)).toBe(0x1a);
  });

  it('.prj em SIRGAS 2000 geográfico e .cpg em UTF-8', () => {
    expect(files.prj).toBe(SIRGAS_2000_PRJ);
    expect(files.prj).toContain('GCS_SIRGAS_2000');
    expect(files.cpg).toBe('UTF-8');
  });

  it('não mistura tipos de geometria num mesmo arquivo', () => {
    expect(() =>
      writeShapefile(
        [
          { geometry: WITH_HOLE, values: [] },
          { geometry: { type: 'Point', coordinates: [-38.5, -12.97] }, values: [] },
        ],
        [],
      ),
    ).toThrow('um tipo de geometria');
  });
});

describe('Geo: KML e nome de arquivo', () => {
  it('escapa texto e escreve polígono com furo, linha e ponto', () => {
    const kml = writeKml('Sítio <Teste> & Cia', [
      { id: 'a', type: 'PERIMETER', name: null, geometry: WITH_HOLE, data: { area_ha: 1.5 } },
      { id: 'b', type: 'ROAD', name: 'Estrada "velha"', geometry: { type: 'MultiLineString', coordinates: [[[-38.5, -12.97], [-38.499, -12.97]]] }, data: {} },
      { id: 'c', type: 'HEADQUARTERS', name: 'Sede', geometry: { type: 'Point', coordinates: [-38.4995, -12.9705] }, data: {} },
    ]);
    expect(kml).toContain('<name>Sítio &lt;Teste&gt; &amp; Cia</name>');
    expect(kml).toContain('<innerBoundaryIs>');
    expect(kml).toContain('<name>Perímetro</name>'); // sem nome, usa o tipo
    expect(kml).toContain('<name>Estrada &quot;velha&quot;</name>');
    expect(kml).toContain('<Point><coordinates>-38.4995,-12.9705</coordinates></Point>');
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });

  it('nome de arquivo sem acento nem espaço', () => {
    expect(fileSlug('Sítio São José / Lote 3')).toBe('sitio_sao_jose_lote_3');
    expect(fileSlug('***')).toBe('propriedade');
  });
});
