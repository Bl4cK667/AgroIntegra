import { BadRequestException } from '@nestjs/common';

// Entidades que o aparelho recebe no pull, na ordem em que devem ser aplicadas localmente
// (pais antes dos filhos).
export const PULL_ENTITIES = ['producers', 'properties', 'requests', 'visits', 'features'] as const;
export type PullEntity = (typeof PULL_ENTITIES)[number];

// Posição na ordem (updatedAt, id) de uma entidade: o próximo pull começa depois dela.
export interface Position {
  updatedAt: Date;
  id: string;
}
export type Cursor = Partial<Record<PullEntity, Position>>;

const VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INVALID_CURSOR =
  'Marcador de sincronização inválido. Faça uma sincronização completa (sem o parâmetro since).';

// Cursor opaco para o aparelho: base64url de {"v":1,"p":{"producers":["2026-11-18T10:00:00.000Z","<id>"],...}}.
export function encodeCursor(cursor: Cursor): string {
  const p: Record<string, [string, string]> = {};
  for (const entity of PULL_ENTITIES) {
    const pos = cursor[entity];
    if (pos) p[entity] = [pos.updatedAt.toISOString(), pos.id];
  }
  return Buffer.from(JSON.stringify({ v: VERSION, p }), 'utf8').toString('base64url');
}

export function decodeCursor(value: string | undefined): Cursor {
  if (value === undefined || value === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException(INVALID_CURSOR);
  }
  if (!parsed || typeof parsed !== 'object') throw new BadRequestException(INVALID_CURSOR);
  const { v, p } = parsed as { v?: unknown; p?: unknown };
  if (v !== VERSION || !p || typeof p !== 'object' || Array.isArray(p)) throw new BadRequestException(INVALID_CURSOR);

  const cursor: Cursor = {};
  for (const [key, pos] of Object.entries(p as Record<string, unknown>)) {
    if (!(PULL_ENTITIES as readonly string[]).includes(key)) throw new BadRequestException(INVALID_CURSOR);
    if (!Array.isArray(pos) || pos.length !== 2) throw new BadRequestException(INVALID_CURSOR);
    const [iso, id] = pos as unknown[];
    const updatedAt = typeof iso === 'string' ? new Date(iso) : new Date(NaN);
    if (Number.isNaN(updatedAt.getTime()) || typeof id !== 'string' || !UUID.test(id)) {
      throw new BadRequestException(INVALID_CURSOR);
    }
    cursor[key as PullEntity] = { updatedAt, id };
  }
  return cursor;
}
