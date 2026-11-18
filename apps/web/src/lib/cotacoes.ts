// Módulo cotacoes: preço recebido pelo produtor (CONAB) e preços locais (API /cotacoes).
import { request } from './api';

export interface MarketQuote {
  source: 'CONAB';
  scope: 'STATE' | 'MUNICIPALITY';
  place: string;
  weekStart: string;
  weekEnd: string;
  value: number;
  unit: string;
  previousValue: number | null;
  changePct: number | null;
  stale: boolean;
  warning: string | null;
}

export interface LocalQuote {
  id: string;
  source: 'LOCAL';
  productKey: string | null;
  productName: string;
  unit: string;
  price: number;
  place: string;
  observedOn: string;
  notes: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface ProductQuotes {
  key: string;
  label: string;
  unit: string;
  note: string | null;
  state: MarketQuote[];
  municipalities: MarketQuote[];
  local: LocalQuote | null;
}

export interface CotacoesOverview {
  products: ProductQuotes[];
  sources: { conab: string };
  staleDays: number;
  imports: { lastSuccessAt: string | null; lastAttemptAt: string | null; lastError: string | null };
}

export interface ProductHistory {
  product: { key: string; label: string; unit: string; note: string | null };
  series: { place: string; scope: string; points: { weekStart: string; weekEnd: string; value: number }[] }[];
  local: LocalQuote[];
  source: string;
}

export interface ImportResult {
  file: 'UF' | 'MUNICIPIO';
  status: 'SUCCESS' | 'NOT_MODIFIED' | 'FAILED';
  rows: number;
  message: string;
}

export interface NewLocalPrice {
  productKey?: string;
  productName?: string;
  unit?: string;
  price: number;
  place: string;
  observedOn: string;
  notes?: string;
}

export const getCotacoes = () => request<CotacoesOverview>('/cotacoes');
export const getProductHistory = (key: string, weeks = 26) => request<ProductHistory>(`/cotacoes/products/${key}/history?weeks=${weeks}`);
export const listLocalPrices = (page = 1, pageSize = 20) =>
  request<{ items: LocalQuote[]; total: number; page: number; pageSize: number }>(`/cotacoes/local?page=${page}&pageSize=${pageSize}`);
export const createLocalPrice = (data: NewLocalPrice) => request<LocalQuote>('/cotacoes/local', { method: 'POST', body: JSON.stringify(data) });
export const deleteLocalPrice = (id: string) => request<{ id: string; deleted: boolean }>(`/cotacoes/local/${id}`, { method: 'DELETE' });
export const importCotacoesNow = () => request<ImportResult[]>('/cotacoes/import', { method: 'POST' });

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// "R$ 378,30/@": o valor em reais e o que vem depois de "R$" na unidade.
export const formatPrice = (value: number, unit: string) => `${money.format(value)}${unit.replace(/^R\$/, '')}`;

// "309,9" ou "1.234,56" -> número; inválido -> null.
export function parsePrice(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return n > 0 ? n : null;
}
