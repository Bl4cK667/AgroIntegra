import { BadRequestException } from '@nestjs/common';
import { MAX_VERTICES, normalizeGeometry, translateInvalidReason } from '../src/geo/geometry';

const SQUARE = [[-38.5, -12.97], [-38.499, -12.97], [-38.499, -12.971], [-38.5, -12.971], [-38.5, -12.97]];

describe('Geo: validação estrutural de GeoJSON', () => {
  it('converte Polygon em MultiPolygon e mantém o anel fechado', () => {
    expect(normalizeGeometry('PERIMETER', { type: 'Polygon', coordinates: [SQUARE] })).toEqual({
      type: 'MultiPolygon',
      coordinates: [[SQUARE]],
    });
  });

  it('fecha anel aberto, remove vértice repetido em sequência e descarta altitude', () => {
    const open = [[-38.5, -12.97, 30], [-38.499, -12.97, 31], [-38.499, -12.97, 31], [-38.499, -12.971], [-38.5, -12.971]];
    expect(normalizeGeometry('PLOT', { type: 'Polygon', coordinates: [open] })).toEqual({
      type: 'MultiPolygon',
      coordinates: [[SQUARE]],
    });
  });

  it('aceita MultiPolygon (propriedade com glebas separadas)', () => {
    const other = SQUARE.map(([x, y]) => [x + 0.01, y]);
    const g = normalizeGeometry('PERIMETER', { type: 'MultiPolygon', coordinates: [[SQUARE], [other]] });
    expect(g.type).toBe('MultiPolygon');
    expect(g.coordinates).toHaveLength(2);
  });

  it('recusa polígono com menos de 3 vértices diferentes', () => {
    const flat = [[-38.5, -12.97], [-38.499, -12.97], [-38.5, -12.97]];
    expect(() => normalizeGeometry('PLOT', { type: 'Polygon', coordinates: [flat] })).toThrow('pelo menos 3 vértices diferentes');
  });

  it('detecta latitude e longitude trocadas (coordenada fora do Brasil)', () => {
    const swapped = SQUARE.map(([lng, lat]) => [lat, lng]);
    expect(() => normalizeGeometry('PERIMETER', { type: 'Polygon', coordinates: [swapped] })).toThrow(/fora do Brasil.*\[longitude, latitude\]/);
  });

  it('recusa coordenada que não é número', () => {
    expect(() => normalizeGeometry('HEADQUARTERS', { type: 'Point', coordinates: ['-38.5', '-12.97'] })).toThrow(BadRequestException);
    expect(() => normalizeGeometry('HEADQUARTERS', { type: 'Point', coordinates: [-38.5] })).toThrow('Coordenada inválida');
  });

  it('confere a forma permitida para cada tipo de feição', () => {
    expect(() => normalizeGeometry('ROAD', { type: 'Polygon', coordinates: [SQUARE] })).toThrow(
      'Estrada aceita apenas linha; a geometria enviada é polígono.',
    );
    expect(() => normalizeGeometry('PERIMETER', { type: 'Point', coordinates: [-38.5, -12.97] })).toThrow(
      'Perímetro aceita apenas polígono; a geometria enviada é ponto.',
    );
    expect(normalizeGeometry('HEADQUARTERS', { type: 'Point', coordinates: [-38.5, -12.97] })).toEqual({
      type: 'Point',
      coordinates: [-38.5, -12.97],
    });
    expect(normalizeGeometry('WATER', { type: 'LineString', coordinates: [[-38.5, -12.97], [-38.499, -12.97]] }).type).toBe('MultiLineString');
  });

  it('linha precisa de 2 pontos diferentes', () => {
    expect(() => normalizeGeometry('ROAD', { type: 'LineString', coordinates: [[-38.5, -12.97], [-38.5, -12.97]] })).toThrow(
      'pelo menos 2 pontos diferentes',
    );
  });

  it('recusa tipo de feição desconhecido, GeoJSON mal formado e geometria grande demais', () => {
    expect(() => normalizeGeometry('POOL' as never, { type: 'Point', coordinates: [-38.5, -12.97] })).toThrow('Tipo de feição inválido');
    expect(() => normalizeGeometry('PLOT', null)).toThrow('GeoJSON');
    expect(() => normalizeGeometry('PLOT', { type: 'Polygon', coordinates: [] })).toThrow('mal formada');
    expect(() => normalizeGeometry('PLOT', { type: 'Circle', coordinates: [] })).toThrow('não suportado');
    const huge = Array.from({ length: MAX_VERTICES + 1 }, (_, i) => [-38.5 + i * 1e-7, -12.97 - (i % 2) * 1e-7]);
    expect(() => normalizeGeometry('ROAD', { type: 'LineString', coordinates: huge })).toThrow(`mais de ${MAX_VERTICES} vértices`);
  });
});

describe('Geo: motivo de geometria inválida em português', () => {
  it('traduz auto-intersecção e informa onde, em latitude e longitude', () => {
    expect(translateInvalidReason('Self-intersection[-38.4995 -12.9705]')).toBe(
      'O contorno do polígono se cruza (forma de laço) perto de latitude -12,970500, longitude -38,499500. Ajuste os vértices e tente de novo.',
    );
  });

  it('diferencia anel que encosta em si mesmo e cai no genérico quando não conhece o motivo', () => {
    expect(translateInvalidReason('Ring Self-intersection[-38.5 -12.97]')).toMatch(/^O contorno do polígono encosta em si mesmo/);
    expect(translateInvalidReason('Something new')).toBe('A geometria é inválida. Ajuste os vértices e tente de novo.');
  });
});
