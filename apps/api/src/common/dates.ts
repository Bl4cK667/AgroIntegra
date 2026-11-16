import { BadRequestException } from '@nestjs/common';

// Datas sem hora (colunas DATE) viajam como "AAAA-MM-DD" e ficam na meia-noite UTC.
export function parseDay(value: string, label: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label}: data inválida.`);
  }
  return d;
}

export const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Hoje no fuso do servidor (o da secretaria), no formato AAAA-MM-DD.
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Faixas de tempo usadas pelo painel, no fuso do servidor.
export function periods(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 a 11
  return {
    year,
    month: month + 1,
    // Colunas DATE: comparar com a meia-noite UTC do dia.
    yearStartDay: new Date(Date.UTC(year, 0, 1)),
    nextYearStartDay: new Date(Date.UTC(year + 1, 0, 1)),
    // Colunas com hora: início do mês no relógio local.
    monthStart: new Date(year, month, 1),
    nextMonthStart: new Date(year, month + 1, 1),
  };
}
