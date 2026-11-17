// Utilitários puros para leitura segura do token de convite e validação do formulário de cadastro.

/**
 * Extrai o token de convite exclusivamente do fragmento (#token=...)
 * para evitar vazamento em logs de servidor/referrer.
 */
export function extractInviteToken(hash: string): string | null {
  if (!hash) return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const value = params.get('token')?.trim();
  return value ? value : null;
}

/**
 * Aplica máscara brasileira de telefone ((XX) XXXXX-XXXX ou (XX) XXXX-XXXX).
 */
export function phoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidBrPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /^(55)?\d{10,11}$/.test(digits);
}

export function isValidFullName(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= 3 && normalized.length <= 120 && /^\S+(\s\S+)+$/.test(normalized);
}

// Alinhado a apps/api/src/invitations/invitation.dto.ts (PASSWORD_RULE: 8..72 com letras e números).
export function isValidRegistrationPassword(value: string): boolean {
  return /^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).{8,72}$/s.test(value);
}
