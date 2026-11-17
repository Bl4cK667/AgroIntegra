import { createHash, randomBytes } from 'node:crypto';

// Token do convite: 32 bytes aleatórios em base64url (43 caracteres). Só o SHA-256 é guardado no banco.
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

// ID determinístico da conta Supabase para um convite: retries e retomadas após falha
// encontram a mesma conta remota em vez de criar outra (idempotência). Formato UUID v5-like.
export function deriveAuthUserId(invitationId: string): string {
  const b = createHash('sha256').update(`agrointegra:invitation:${invitationId}`, 'utf8').digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// O link vai para o painel; o token fica no fragmento (#), que o navegador não envia ao servidor
// nem em Referer. O painel lê o fragmento e chama POST /auth/registration { token }.
export const REGISTRATION_PATH = '/cadastro';

export function buildRegistrationUrl(webOrigin: string, token: string): string {
  return `${webOrigin}${REGISTRATION_PATH}#token=${token}`;
}
