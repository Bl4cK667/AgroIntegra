// Formato único da previsão, qualquer que seja a fonte. Unidades: °C, %, mm, km/h.
// Campo que a fonte não fornece fica null (o INMET não traz chuva em mm; o Open-Meteo não traz umidade diária).

export type WeatherSourceName = 'INMET' | 'OPEN_METEO';

export interface WeatherPeriod {
  period: 'manha' | 'tarde' | 'noite';
  summary: string | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  windDirection: string | null;
  windIntensity: string | null;
}

export interface WeatherDay {
  date: string; // AAAA-MM-DD, no fuso do local
  summary: string | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windDirection: string | null; // ex.: "NE-E" (INMET)
  windIntensity: string | null; // ex.: "Fracos" (INMET)
  windMaxKmh: number | null; // Open-Meteo
  periods: WeatherPeriod[]; // manhã/tarde/noite quando a fonte detalha (INMET, primeiros dias)
}

export interface SourceForecast {
  placeName: string;
  days: WeatherDay[];
}

export const SOURCE_LABEL: Record<WeatherSourceName, string> = {
  INMET: 'INMET',
  OPEN_METEO: 'Open-Meteo',
};

// Crédito exibido junto da previsão (o Open-Meteo exige, pela licença CC BY 4.0).
export const SOURCE_ATTRIBUTION: Record<WeatherSourceName, string> = {
  INMET: 'Fonte: INMET, Instituto Nacional de Meteorologia.',
  OPEN_METEO: 'Dados: Open-Meteo.com (licença CC BY 4.0).',
};
