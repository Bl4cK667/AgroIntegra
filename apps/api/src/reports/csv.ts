// Planilha CSV para o Excel em português: UTF-8 com BOM, separador ";" e quebra de linha CRLF.
// Os números chegam já formatados (vírgula decimal) por quem monta as linhas.

export type CsvValue = string | number | null | undefined;

const BOM = '﻿';

// Célula que começa com = + - @ (ou tab/CR) seria lida como fórmula pelo Excel: sai com apóstrofo na frente.
const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(';'));
  return BOM + lines.join('\r\n') + '\r\n';
}
