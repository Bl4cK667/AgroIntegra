// Configuração do módulo cotacoes, lida do .env (ver .env.example e README).
export interface CotacoesConfig {
  conabBaseUrl: string;
  ufs: string[]; // UFs importadas (ex.: ["PA"])
  includeMunicipalities: boolean;
  scheduleEnabled: boolean;
  cron: string; // expressão cron (com segundos)
  timezone: string;
  importOnStart: boolean; // ao subir a API, importa se a última importação boa tiver mais de 7 dias
  staleDays: number; // preço mais antigo que isso aparece como desatualizado (municipal: nem aparece)
  timeoutMs: number;
  retryDelaysMs: number[];
}

export const COTACOES_CONFIG = Symbol('COTACOES_CONFIG');
export const COTACOES_FETCH = Symbol('COTACOES_FETCH');

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};
const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v === '' ? fallback : v.toLowerCase() !== 'false');

export function cotacoesConfigFromEnv(env: Record<string, string | undefined> = process.env): CotacoesConfig {
  const ufs = (env.COTACOES_UFS || 'PA')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
  return {
    conabBaseUrl: (env.CONAB_BASE_URL || 'https://portaldeinformacoes.conab.gov.br/downloads/arquivos').replace(/\/+$/, ''),
    ufs: ufs.length ? ufs : ['PA'],
    includeMunicipalities: flag(env.COTACOES_MUNICIPIOS, true),
    scheduleEnabled: flag(env.COTACOES_SCHEDULE_ENABLED, true),
    // A CONAB atualiza às quartas; uma consulta diária (download condicional) basta.
    cron: env.COTACOES_CRON?.trim() || '0 30 10 * * *',
    timezone: env.COTACOES_TIMEZONE?.trim() || 'America/Belem',
    importOnStart: flag(env.COTACOES_IMPORT_ON_START, true),
    staleDays: num(env.COTACOES_STALE_DAYS, 21),
    timeoutMs: num(env.COTACOES_TIMEOUT_MS, 120_000), // arquivos de ~25 MB
    retryDelaysMs: [5_000, 30_000],
  };
}
