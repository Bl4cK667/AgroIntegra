import { ExternalSourceError } from '../common/external-http';

// Leitor dos arquivos semanais de preços da CONAB (Portal de Informações Agropecuárias):
//   PrecosSemanalUF.txt         produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg
//   PrecosSemanalMunicipio.txt  produto;classificao_produto;id_produto;nom_municipio;cod_ibge;uf;regiao;ano;mes;...
// Formato conferido em 18/11/2026: separador ";", vírgula decimal, campos com espaços à direita e
// texto em Latin-1 (o servidor anuncia UTF-8, mas não é). Só o nível "PREÇO RECEBIDO P/ PR" entra.

export type ConabFile = 'UF' | 'MUNICIPIO';

export interface ConabRow {
  productCode: string;
  productName: string;
  productClass: string;
  scope: 'STATE' | 'MUNICIPALITY';
  uf: string;
  ibgeCode: string | null;
  placeKey: string;
  placeName: string;
  weekStart: string; // AAAA-MM-DD
  weekEnd: string;
  value: number; // como publicado (R$ por kg na maioria dos produtos)
}

export const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const REQUIRED: Record<ConabFile, string[]> = {
  UF: ['produto', 'classificao_produto', 'id_produto', 'uf', 'data_inicial_final_semana', 'dsc_nivel_comercializacao', 'valor_produto_kg'],
  MUNICIPIO: ['produto', 'classificao_produto', 'id_produto', 'nom_municipio', 'cod_ibge', 'uf', 'data_inicial_final_semana', 'dsc_nivel_comercializacao', 'valor_produto_kg'],
};

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const isProducerReceived = (level: string) => stripAccents(level).toUpperCase().startsWith('PRECO RECEBIDO');
const LOWER_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);

// "MARABÁ-PA" -> "Marabá/PA"; "SÃO DOMINGOS DO ARAGUAIA-PA" -> "São Domingos do Araguaia/PA".
export function municipalityName(raw: string, uf: string): string {
  const name = raw.replace(new RegExp(`-${uf}$`), '').trim().toLowerCase();
  const title = name
    .split(/(\s+|-)/)
    .map((w, i) => (i > 0 && LOWER_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  return `${title}/${uf}`;
}

// "24-11-2025 - 28-11-2025" -> ["2025-11-24", "2025-11-28"]
export function parseWeek(raw: string): [string, string] | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s*-\s*(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim());
  return m ? [`${m[3]}-${m[2]}-${m[1]}`, `${m[6]}-${m[5]}-${m[4]}`] : null;
}

export function decodeConab(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? buf.toString('latin1') : utf8;
}

export function parseConabFile(buf: Buffer, file: ConabFile, ufs: Set<string>): { rows: ConabRow[]; skipped: number } {
  const lines = decodeConab(buf).split(/\r?\n/);
  const header = (lines[0] ?? '').split(';').map((h) => h.trim().replace(/^﻿/, ''));
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  if (REQUIRED[file].some((c) => col[c] === undefined)) {
    throw new ExternalSourceError('CONAB', 'O arquivo da CONAB veio num formato inesperado (colunas diferentes).');
  }

  const byKey = new Map<string, ConabRow>();
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = lines[i].split(';').map((v) => v.trim());
    const uf = (f[col.uf] ?? '').toUpperCase();
    if (!ufs.has(uf) || !isProducerReceived(f[col.dsc_nivel_comercializacao] ?? '')) continue;
    const week = parseWeek(f[col.data_inicial_final_semana] ?? '');
    const value = Number((f[col.valor_produto_kg] ?? '').replace(/\./g, '').replace(',', '.'));
    const ibge = file === 'MUNICIPIO' ? f[col.cod_ibge] : null;
    if (!week || !Number.isFinite(value) || value <= 0 || (file === 'MUNICIPIO' && !/^\d{7}$/.test(ibge ?? ''))) {
      skipped++;
      continue;
    }
    const row: ConabRow = {
      productCode: f[col.id_produto],
      productName: f[col.produto],
      productClass: f[col.classificao_produto],
      scope: file === 'UF' ? 'STATE' : 'MUNICIPALITY',
      uf,
      ibgeCode: ibge,
      placeKey: ibge ?? uf,
      placeName: ibge ? municipalityName(f[col.nom_municipio], uf) : (UF_NAMES[uf] ?? uf),
      weekStart: week[0],
      weekEnd: week[1],
      value,
    };
    // Mesma chave repetida no arquivo: fica a última linha (no preço recebido não houve repetição em 18/11/2026).
    byKey.set([row.scope, row.placeKey, row.productCode, row.weekStart].join('|'), row);
  }
  return { rows: [...byKey.values()], skipped };
}
