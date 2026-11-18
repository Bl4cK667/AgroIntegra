import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { climaConfigFromEnv } from '../src/clima/clima.config';
import { ExternalSourceError, fetchJson, FetchLike, redactUrl } from '../src/clima/http-json';
import { parseInmet } from '../src/clima/inmet.client';
import { gridPoint, parseOpenMeteo, wmoSummary } from '../src/clima/open-meteo.client';

// Respostas reais (18/11/2026) de Canaã dos Carajás/PA, sem os ícones em base64.
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', 'clima', name), 'utf8'));
const silent = new Logger('teste');
silent.log = () => undefined;
silent.warn = () => undefined;

describe('Clima: INMET', () => {
  const forecast = parseInmet(fixture('inmet-1502152.json'), '1502152');

  it('lê os 5 dias, em ordem, com datas ISO e o nome do município', () => {
    expect(forecast.placeName).toBe('Canaã dos Carajás/PA');
    expect(forecast.days.map((d) => d.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  });

  it('os primeiros dias trazem manhã, tarde e noite; o resumo do dia é o da tarde', () => {
    const day = forecast.days[0];
    expect(day.periods.map((p) => p.period)).toEqual(['manha', 'tarde', 'noite']);
    expect(day.summary).toBe(day.periods[1].summary);
    expect(day.tempMinC).toBe(Math.min(...day.periods.map((p) => p.tempMinC!)));
    expect(day.tempMaxC).toBe(Math.max(...day.periods.map((p) => p.tempMaxC!)));
    expect(day.precipitationMm).toBeNull(); // o INMET não traz chuva em mm
  });

  it('os dias seguintes vêm num bloco só (sem períodos)', () => {
    const day = forecast.days[4];
    expect(day.periods).toEqual([]);
    expect(day).toMatchObject({ tempMinC: 23, tempMaxC: 32, humidityMinPct: 60, humidityMaxPct: 100, windDirection: 'NE-SE', windIntensity: 'Fracos' });
    expect(day.summary).toContain('pancadas de chuva');
  });

  it('formato inesperado vira erro claro (e não dados vazios)', () => {
    expect(() => parseInmet({}, '1502152')).toThrow(ExternalSourceError);
    expect(() => parseInmet({ '1502152': { ontem: {} } }, '1502152')).toThrow('formato inesperado');
    expect(() => parseInmet(fixture('inmet-1502152.json'), '1500107')).toThrow('formato inesperado');
  });
});

describe('Clima: Open-Meteo', () => {
  const forecast = parseOpenMeteo(fixture('open-meteo-daily.json'), 'Ponto');

  it('lê 16 dias com chuva em mm, probabilidade e vento', () => {
    expect(forecast.days).toHaveLength(16);
    expect(forecast.days[0].date).toBe('2026-11-18');
    for (const d of forecast.days) {
      expect(typeof d.precipitationMm).toBe('number');
      expect(d.tempMaxC!).toBeGreaterThanOrEqual(d.tempMinC!);
    }
    expect(forecast.days[0].precipitationMm).toBe(2.5);
  });

  it('códigos WMO em português', () => {
    expect(wmoSummary(0)).toBe('Céu limpo');
    expect(wmoSummary(63)).toBe('Chuva');
    expect(wmoSummary(95)).toBe('Trovoadas');
    expect(wmoSummary(null)).toBeNull();
  });

  it('a coordenada vai arredondada a 0,01° (~1 km), que também é a chave do cache', () => {
    expect(gridPoint(-6.496612, -49.878634)).toEqual({ lat: -6.5, lng: -49.88, key: '-6.50,-49.88' });
  });

  it('formato inesperado vira erro claro', () => {
    expect(() => parseOpenMeteo({ daily: {} }, 'x')).toThrow('formato inesperado');
  });
});

describe('Clima: configuração', () => {
  it('em produção, sem chave do plano comercial, o Open-Meteo fica desligado', () => {
    expect(climaConfigFromEnv({ NODE_ENV: 'production' }).openMeteo.enabled).toBe(false);
    expect(climaConfigFromEnv({ NODE_ENV: 'development' }).openMeteo.enabled).toBe(true);
  });

  it('com chave, usa o endereço comercial; OPEN_METEO_ENABLED=false desliga', () => {
    const cfg = climaConfigFromEnv({ NODE_ENV: 'production', OPEN_METEO_API_KEY: 'k' });
    expect(cfg.openMeteo).toEqual({ enabled: true, baseUrl: 'https://customer-api.open-meteo.com', apiKey: 'k' });
    expect(climaConfigFromEnv({ OPEN_METEO_ENABLED: 'false', OPEN_METEO_API_KEY: 'k' }).openMeteo.enabled).toBe(false);
  });

  it('município padrão só com código IBGE de 7 dígitos', () => {
    expect(climaConfigFromEnv({ CLIMA_DEFAULT_IBGE: '1502152', CLIMA_DEFAULT_PLACE: 'Canaã dos Carajás/PA' }).defaultMunicipality).toEqual({ ibgeCode: '1502152', name: 'Canaã dos Carajás/PA' });
    expect(climaConfigFromEnv({ CLIMA_DEFAULT_IBGE: '15021' }).defaultMunicipality).toBeNull();
  });
});

describe('Clima: chamada HTTP às fontes', () => {
  const opts = { source: 'Fonte', timeoutMs: 1000, retryDelaysMs: [0, 0] };
  const reply = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body });

  it('tenta de novo em falha temporária (503) e devolve a resposta boa', async () => {
    const calls: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      calls.push(url);
      return calls.length < 3 ? reply(503) : reply(200, { ok: 1 });
    };
    await expect(fetchJson(fetchFn, 'https://x/y', opts, silent)).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(3);
  });

  it('não insiste em erro definitivo (404)', async () => {
    let n = 0;
    const fetchFn: FetchLike = async () => {
      n++;
      return reply(404);
    };
    await expect(fetchJson(fetchFn, 'https://x/y', opts, silent)).rejects.toThrow('HTTP 404');
    expect(n).toBe(1);
  });

  it('falha de rede em todas as tentativas vira erro em português', async () => {
    let n = 0;
    const fetchFn: FetchLike = async () => {
      n++;
      throw new TypeError('fetch failed');
    };
    await expect(fetchJson(fetchFn, 'https://x/y', opts, silent)).rejects.toThrow('Falha de rede ao consultar Fonte.');
    expect(n).toBe(3);
  });

  it('timeout de verdade (AbortSignal) é reconhecido', async () => {
    const fetchFn: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    await expect(fetchJson(fetchFn, 'https://x/y', { ...opts, timeoutMs: 20, retryDelaysMs: [] }, silent)).rejects.toThrow('não respondeu a tempo');
  });

  it('a chave da API não aparece no log', () => {
    expect(redactUrl('https://customer-api.open-meteo.com/v1/forecast?latitude=1&apikey=SEGREDO&x=2')).toBe(
      'https://customer-api.open-meteo.com/v1/forecast?latitude=1&apikey=***&x=2',
    );
  });
});
