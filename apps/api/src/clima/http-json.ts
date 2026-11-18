import { Logger } from '@nestjs/common';

// Chamada HTTP a fonte externa (INMET, Open-Meteo, IBGE): timeout, novas tentativas com espera
// progressiva só para falhas temporárias (rede, timeout, 429, 5xx) e log estruturado em JSON.

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const CLIMA_FETCH = Symbol('CLIMA_FETCH');

export interface HttpJsonOptions {
  source: string; // nome da fonte nos logs
  timeoutMs: number;
  retryDelaysMs: number[]; // ex.: [500, 1500] = até 3 tentativas
}

export class ExternalSourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const transient = (status: number) => status === 429 || status >= 500;

// Esconde parâmetros sensíveis (apikey) do log.
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:apikey|api_key|key|token)=)[^&]*/gi, '$1***');
}

export async function fetchJson(fetchFn: FetchLike, url: string, opts: HttpJsonOptions, logger: Logger): Promise<unknown> {
  const attempts = opts.retryDelaysMs.length + 1;
  let lastError: ExternalSourceError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    try {
      const res = await fetchFn(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(opts.timeoutMs) });
      const log = { event: 'external_call', source: opts.source, url: redactUrl(url), status: res.status, attempt, ms: Date.now() - started };
      if (res.ok) {
        logger.log(JSON.stringify(log));
        return await res.json();
      }
      logger.warn(JSON.stringify(log));
      lastError = new ExternalSourceError(opts.source, `${opts.source} respondeu HTTP ${res.status}.`, res.status);
      if (!transient(res.status)) throw lastError;
    } catch (e) {
      if (e instanceof ExternalSourceError && e.status !== undefined && !transient(e.status)) throw e;
      if (!(e instanceof ExternalSourceError)) {
        // O timeout do AbortSignal é um DOMException, que nem sempre é instanceof Error: olha só o nome.
        const name = e && typeof e === 'object' ? (e as { name?: unknown }).name : undefined;
        const timedOut = name === 'TimeoutError' || name === 'AbortError';
        logger.warn(JSON.stringify({ event: 'external_call_failed', source: opts.source, url: redactUrl(url), attempt, ms: Date.now() - started, error: timedOut ? 'timeout' : String((e as Error)?.message ?? e) }));
        lastError = new ExternalSourceError(opts.source, timedOut ? `${opts.source} não respondeu a tempo.` : `Falha de rede ao consultar ${opts.source}.`);
      }
    }
    if (attempt < attempts) await sleep(opts.retryDelaysMs[attempt - 1]);
  }
  throw lastError ?? new ExternalSourceError(opts.source, `Falha ao consultar ${opts.source}.`);
}
