// O cliente HTTP das fontes externas fica em common/external-http.ts (usado também pelo módulo cotacoes).
export { ExternalSourceError, fetchJson, redactUrl } from '../common/external-http';
export type { FetchLike, ExternalCallOptions as HttpJsonOptions } from '../common/external-http';

export const CLIMA_FETCH = Symbol('CLIMA_FETCH');
