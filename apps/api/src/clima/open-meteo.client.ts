import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLIMA_CONFIG, ClimaConfig } from './clima.config';
import { CLIMA_FETCH, ExternalSourceError, fetchJson, FetchLike } from './http-json';
import { SourceForecast, WeatherDay } from './weather.types';

// Open-Meteo: previsão diária por coordenada (até 16 dias, com chuva em mm).
// Plano grátis só para uso não comercial; em produção exige OPEN_METEO_API_KEY (ver clima.config.ts).

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'weather_code',
] as const;

export const OPEN_METEO_DAYS = 16;

// Códigos WMO usados pelo Open-Meteo, em português.
export function wmoSummary(code: number | null): string | null {
  if (code === null) return null;
  if (code === 0) return 'Céu limpo';
  if (code <= 2) return 'Poucas nuvens';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Nevoeiro';
  if (code >= 51 && code <= 57) return 'Garoa';
  if (code >= 61 && code <= 67) return code >= 65 ? 'Chuva forte' : 'Chuva';
  if (code >= 80 && code <= 82) return code === 82 ? 'Pancadas de chuva fortes' : 'Pancadas de chuva';
  if (code >= 95) return 'Trovoadas';
  return null;
}

const at = (arr: unknown, i: number): number | null => {
  const v = Array.isArray(arr) ? arr[i] : null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

// Coordenada arredondada a 0,01° (~1 km): chave do cache e o que vai para a fonte (não expõe o ponto exato).
export function gridPoint(latitude: number, longitude: number) {
  const lat = Math.round(latitude * 100) / 100;
  const lng = Math.round(longitude * 100) / 100;
  return { lat, lng, key: `${lat.toFixed(2)},${lng.toFixed(2)}` };
}

export function parseOpenMeteo(json: unknown, placeName: string): SourceForecast {
  const daily = json && typeof json === 'object' ? (json as { daily?: Record<string, unknown> }).daily : undefined;
  const time = daily?.time;
  if (!daily || !Array.isArray(time) || !time.length) {
    throw new ExternalSourceError('Open-Meteo', 'O Open-Meteo respondeu num formato inesperado.');
  }
  const days: WeatherDay[] = time.map((date, i) => ({
    date: String(date),
    summary: wmoSummary(at(daily.weather_code, i)),
    tempMinC: at(daily.temperature_2m_min, i),
    tempMaxC: at(daily.temperature_2m_max, i),
    humidityMinPct: null,
    humidityMaxPct: null,
    precipitationMm: at(daily.precipitation_sum, i),
    precipitationProbabilityPct: at(daily.precipitation_probability_max, i),
    windDirection: null,
    windIntensity: null,
    windMaxKmh: at(daily.wind_speed_10m_max, i),
    periods: [],
  }));
  return { placeName, days };
}

@Injectable()
export class OpenMeteoClient {
  private readonly logger = new Logger(OpenMeteoClient.name);

  constructor(
    @Inject(CLIMA_CONFIG) private readonly config: ClimaConfig,
    @Inject(CLIMA_FETCH) private readonly fetchFn: FetchLike,
  ) {}

  get enabled() {
    return this.config.openMeteo.enabled;
  }

  async forecast(lat: number, lng: number, placeName: string): Promise<SourceForecast> {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: DAILY.join(','),
      timezone: this.config.timezone,
      forecast_days: String(OPEN_METEO_DAYS),
    });
    if (this.config.openMeteo.apiKey) params.set('apikey', this.config.openMeteo.apiKey);
    const url = `${this.config.openMeteo.baseUrl}/v1/forecast?${params.toString()}`;
    const json = await fetchJson(this.fetchFn, url, { source: 'Open-Meteo', timeoutMs: this.config.timeoutMs, retryDelaysMs: this.config.retryDelaysMs }, this.logger);
    return parseOpenMeteo(json, placeName);
  }
}
