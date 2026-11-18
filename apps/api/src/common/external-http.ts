import { Logger } from '@nestjs/common';

// Chamada HTTP a fonte externa (INMET, Open-Meteo, IBGE, CONAB): timeout, novas tentativas com espera
// progressiva só para falhas temporárias (rede, timeout, 429, 5xx) e log estruturado em JSON.
// Usado pelos módulos clima e cotacoes; cada um injeta o próprio `fetch` (os testes trocam por um falso).

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer?(): Promise<ArrayBuffer>;
  headers?: { get(name: string): string | null };
}

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<FetchResponseLike>;

export interface ExternalCallOptions {
  source: string; // nome da fonte nos logs e nas mensagens
  timeoutMs: number;
  retryDelaysMs: number[]; // ex.: [500, 1500] = até 3 tentativas
  headers?: Record<string, string>;
  // Respostas aceitas além de 2xx (ex.: 304 Not Modified num download condicional).
  acceptStatus?: number[];
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

export async function fetchExternal(fetchFn: FetchLike, url: string, opts: ExternalCallOptions, logger: Logger): Promise<FetchResponseLike> {
  const attempts = opts.retryDelaysMs.length + 1;
  let lastError: ExternalSourceError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    try {
      const res = await fetchFn(url, { headers: { accept: 'application/json', ...opts.headers }, signal: AbortSignal.timeout(opts.timeoutMs) });
      const log = { event: 'external_call', source: opts.source, url: redactUrl(url), status: res.status, attempt, ms: Date.now() - started };
      if (res.ok || opts.acceptStatus?.includes(res.status)) {
        logger.log(JSON.stringify(log));
        return res;
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

export async function fetchJson(fetchFn: FetchLike, url: string, opts: ExternalCallOptions, logger: Logger): Promise<unknown> {
  const res = await fetchExternal(fetchFn, url, opts, logger);
  try {
    return await res.json();
  } catch {
    throw new ExternalSourceError(opts.source, `${opts.source} respondeu num formato inesperado.`);
  }
}
