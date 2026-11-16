// Minúsculas, sem acentos e com espaços simples. Usado para gravar e para buscar.
export function normalizeSearch(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Palavras da busca, já normalizadas. Cada palavra precisa aparecer (em qualquer ordem).
export function searchWords(value: string): string[] {
  return normalizeSearch(value).split(' ').filter(Boolean).slice(0, 8);
}

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
