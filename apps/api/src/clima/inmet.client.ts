import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLIMA_CONFIG, ClimaConfig } from './clima.config';
import { CLIMA_FETCH, ExternalSourceError, fetchJson, FetchLike } from './http-json';
import { SourceForecast, WeatherDay, WeatherPeriod } from './weather.types';

// INMET: previsão oficial por município (código IBGE). Endpoint público, sem chave e sem
// documentação publicada: o formato foi conferido em 18/11/2026 e é validado aqui; se mudar,
// a consulta falha com mensagem clara e a tela usa o último valor guardado.
//
// Formato: { "<ibge>": { "DD/MM/AAAA": { manha: {...}, tarde: {...}, noite: {...} } | {...} } }.
// Os primeiros dias vêm por período; os seguintes, com um bloco só.

type Raw = Record<string, unknown>;
const PERIODS = ['manha', 'tarde', 'noite'] as const;

const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const textOrNull = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const minOf = (vals: (number | null)[]) => (vals.some((v) => v !== null) ? Math.min(...(vals.filter((v) => v !== null) as number[])) : null);
const maxOf = (vals: (number | null)[]) => (vals.some((v) => v !== null) ? Math.max(...(vals.filter((v) => v !== null) as number[])) : null);

function period(name: WeatherPeriod['period'], raw: Raw): WeatherPeriod {
  return {
    period: name,
    summary: textOrNull(raw.resumo),
    tempMinC: numOrNull(raw.temp_min),
    tempMaxC: numOrNull(raw.temp_max),
    humidityMinPct: numOrNull(raw.umidade_min),
    humidityMaxPct: numOrNull(raw.umidade_max),
    windDirection: textOrNull(raw.dir_vento),
    windIntensity: textOrNull(raw.int_vento),
  };
}

function isoDate(ddmmyyyy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function parseInmet(json: unknown, ibgeCode: string): SourceForecast {
  const invalid = () => new ExternalSourceError('INMET', 'O INMET respondeu num formato inesperado.');
  if (!json || typeof json !== 'object') throw invalid();
  const byDate = (json as Raw)[ibgeCode];
  if (!byDate || typeof byDate !== 'object') throw invalid();

  let placeName: string | null = null;
  const days: WeatherDay[] = [];
  for (const [rawDate, value] of Object.entries(byDate as Raw)) {
    const date = isoDate(rawDate);
    if (!date || !value || typeof value !== 'object') continue;
    const v = value as Raw;
    const periods = PERIODS.filter((p) => v[p] && typeof v[p] === 'object').map((p) => period(p, v[p] as Raw));
    const single = periods.length ? null : period('tarde', v);
    const parts = periods.length ? periods : [single!];
    const first = (periods.length ? (v[periods[0].period] as Raw) : v) ?? {};
    placeName ??= textOrNull(first.entidade) && textOrNull(first.uf) ? `${textOrNull(first.entidade)}/${textOrNull(first.uf)}` : null;
    // Resumo, vento do dia: os da tarde quando houver períodos; senão, os do bloco único.
    const main = periods.find((p) => p.period === 'tarde') ?? parts[0];
    days.push({
      date,
      summary: main.summary,
      tempMinC: minOf(parts.map((p) => p.tempMinC)),
      tempMaxC: maxOf(parts.map((p) => p.tempMaxC)),
      humidityMinPct: minOf(parts.map((p) => p.humidityMinPct)),
      humidityMaxPct: maxOf(parts.map((p) => p.humidityMaxPct)),
      precipitationMm: null,
      precipitationProbabilityPct: null,
      windDirection: main.windDirection,
      windIntensity: main.windIntensity,
      windMaxKmh: null,
      periods,
    });
  }
  if (!days.length) throw invalid();
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { placeName: placeName ?? ibgeCode, days };
}

@Injectable()
export class InmetClient {
  private readonly logger = new Logger(InmetClient.name);

  constructor(
    @Inject(CLIMA_CONFIG) private readonly config: ClimaConfig,
    @Inject(CLIMA_FETCH) private readonly fetchFn: FetchLike,
  ) {}

  async forecast(ibgeCode: string): Promise<SourceForecast> {
    const url = `${this.config.inmetBaseUrl}/previsao/${encodeURIComponent(ibgeCode)}`;
    const json = await fetchJson(this.fetchFn, url, { source: 'INMET', timeoutMs: this.config.timeoutMs, retryDelaysMs: this.config.retryDelaysMs }, this.logger);
    return parseInmet(json, ibgeCode);
  }
}
