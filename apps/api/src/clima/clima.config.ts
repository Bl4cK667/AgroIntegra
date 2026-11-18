import { Logger } from '@nestjs/common';

// Configuração do módulo clima, lida do .env (ver .env.example e README).
export interface ClimaConfig {
  inmetBaseUrl: string;
  ibgeBaseUrl: string;
  openMeteo: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string | null;
  };
  defaultMunicipality: { ibgeCode: string; name: string } | null;
  cacheMinutes: number; // validade da previsão guardada
  failureBackoffMinutes: number; // depois de uma falha, quanto esperar para tentar a fonte de novo
  timeoutMs: number;
  retryDelaysMs: number[];
  timezone: string; // fuso dos dias da previsão (Open-Meteo)
}

export const CLIMA_CONFIG = Symbol('CLIMA_CONFIG');

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function climaConfigFromEnv(env: Record<string, string | undefined> = process.env): ClimaConfig {
  const logger = new Logger('ClimaConfig');
  const apiKey = env.OPEN_METEO_API_KEY?.trim() || null;
  // Plano grátis do Open-Meteo é só para uso não comercial (avaliação e protótipo).
  // Em produção, o Open-Meteo só liga com a chave do plano comercial.
  let enabled = (env.OPEN_METEO_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (enabled && !apiKey && env.NODE_ENV === 'production') {
    logger.warn('Open-Meteo desligado: em produção é preciso OPEN_METEO_API_KEY (plano comercial).');
    enabled = false;
  }
  const code = env.CLIMA_DEFAULT_IBGE?.trim();
  return {
    inmetBaseUrl: (env.INMET_BASE_URL || 'https://apiprevmet3.inmet.gov.br').replace(/\/+$/, ''),
    ibgeBaseUrl: (env.IBGE_BASE_URL || 'https://servicodados.ibge.gov.br').replace(/\/+$/, ''),
    openMeteo: {
      enabled,
      baseUrl: (env.OPEN_METEO_BASE_URL || (apiKey ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com')).replace(/\/+$/, ''),
      apiKey,
    },
    defaultMunicipality: code && /^\d{7}$/.test(code) ? { ibgeCode: code, name: env.CLIMA_DEFAULT_PLACE?.trim() || code } : null,
    cacheMinutes: num(env.CLIMA_CACHE_MINUTES, 180),
    failureBackoffMinutes: num(env.CLIMA_FAILURE_BACKOFF_MINUTES, 10),
    // A consulta acontece durante a requisição do usuário: no pior caso ~3 × 6 s + 1,6 s de espera.
    timeoutMs: num(env.CLIMA_TIMEOUT_MS, 6000),
    retryDelaysMs: [400, 1200],
    timezone: env.CLIMA_TIMEZONE?.trim() || 'America/Belem',
  };
}
