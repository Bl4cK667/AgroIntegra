// Módulo clima: previsão do tempo da propriedade (API /clima). Ver README, seção "Clima".
import { request } from './api';

export interface WeatherPeriod {
  period: 'manha' | 'tarde' | 'noite';
  summary: string | null;
  tempMinC: number | null;
  tempMaxC: number | null;
}

export interface WeatherDay {
  date: string; // AAAA-MM-DD
  summary: string | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windDirection: string | null;
  windIntensity: string | null;
  windMaxKmh: number | null;
  periods: WeatherPeriod[];
}

export interface Forecast {
  source: 'INMET' | 'OPEN_METEO';
  sourceLabel: string;
  attribution: string;
  place: string;
  fetchedAt: string;
  stale: boolean;
  warning: string | null;
  days: WeatherDay[];
}

export interface PropertyWeather {
  property: { id: string; name: string };
  municipality: { ibgeCode: string; name: string; fromRegistration: boolean } | null;
  forecasts: Forecast[];
  warnings: string[];
}

export const getPropertyWeather = (propertyId: string) => request<PropertyWeather>(`/clima/properties/${propertyId}`);

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const formatTemp = (c: number | null) => (c === null ? '—' : `${fmt1(c)} °C`);
export const formatMm = (mm: number | null) => (mm === null ? '—' : `${fmt1(mm)} mm`);

// "qua 18/11" a partir de "2026-11-18" (data sem hora: não converte fuso).
export function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export const formatFetchedAt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
