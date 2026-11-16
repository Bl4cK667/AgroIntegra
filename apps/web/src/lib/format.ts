const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const areaFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatArea = (ha: number) => `${areaFmt.format(ha)} ha`;

// Aplica a pontuação do CPF enquanto a pessoa digita.
export function cpfInput(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

// Aceita "12,5", "1.250,75" ou "12.5".
export function parseArea(value: string): number | null {
  const v = value.trim();
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Datas sem hora ("2026-11-16") são formatadas sem passar por fuso horário.
export function formatDay(day: string) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

// Hoje no relógio do aparelho, no formato AAAA-MM-DD.
export function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const coordFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
export const formatCoord = (n: number) => coordFmt.format(n);
