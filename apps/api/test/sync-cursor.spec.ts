import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '../src/sync/sync-cursor';

const ID = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('Sync: cursor do pull', () => {
  it('sem since começa do zero', () => {
    expect(decodeCursor(undefined)).toEqual({});
    expect(decodeCursor('')).toEqual({});
  });

  it('ida e volta preserva a posição de cada entidade, com milissegundos', () => {
    const at = new Date('2026-11-18T12:34:56.789Z');
    const cursor = decodeCursor(encodeCursor({ producers: { updatedAt: at, id: ID }, features: { updatedAt: at, id: ID } }));
    expect(cursor.producers).toEqual({ updatedAt: at, id: ID });
    expect(cursor.features).toEqual({ updatedAt: at, id: ID });
    expect(cursor.visits).toBeUndefined();
  });

  it('o cursor é seguro para URL', () => {
    expect(encodeCursor({ visits: { updatedAt: new Date(), id: ID } })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['texto qualquer', 'não-é-base64!!'],
    ['JSON que não é objeto', b64(42)],
    ['versão desconhecida', b64({ v: 2, p: {} })],
    ['entidade desconhecida', b64({ v: 1, p: { users: ['2026-11-18T00:00:00.000Z', ID] } })],
    ['data inválida', b64({ v: 1, p: { producers: ['ontem', ID] } })],
    ['id que não é UUID', b64({ v: 1, p: { producers: ['2026-11-18T00:00:00.000Z', "x' OR 1=1"] } })],
  ])('recusa %s com mensagem em português', (_label, value) => {
    expect(() => decodeCursor(value)).toThrow(BadRequestException);
    expect(() => decodeCursor(value)).toThrow(/sincronização completa/);
  });
});
