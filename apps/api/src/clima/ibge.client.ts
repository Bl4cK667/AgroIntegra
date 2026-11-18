import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeSearch } from '../common/search';
import { CLIMA_CONFIG, ClimaConfig } from './clima.config';
import { CLIMA_FETCH, fetchJson, FetchLike } from './http-json';

// IBGE (API pública de localidades): converte "cidade + UF" da propriedade no código do município,
// que é como o INMET identifica a previsão. A lista de municípios de cada UF fica em memória
// (muda raramente; a API reiniciada busca de novo).

export interface Municipality {
  ibgeCode: string;
  name: string; // "Canaã dos Carajás/PA"
}

@Injectable()
export class IbgeClient {
  private readonly logger = new Logger(IbgeClient.name);
  private readonly byState = new Map<string, Promise<Map<string, Municipality>>>();

  constructor(
    @Inject(CLIMA_CONFIG) private readonly config: ClimaConfig,
    @Inject(CLIMA_FETCH) private readonly fetchFn: FetchLike,
  ) {}

  // null = cidade não encontrada na UF (nome digitado diferente do IBGE).
  async resolve(city: string, state: string): Promise<Municipality | null> {
    const uf = state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) return null;
    const list = await this.municipalities(uf);
    return list.get(normalizeSearch(city).trim()) ?? null;
  }

  private municipalities(uf: string): Promise<Map<string, Municipality>> {
    let pending = this.byState.get(uf);
    if (!pending) {
      pending = this.load(uf).catch((e) => {
        this.byState.delete(uf); // falhou: a próxima consulta tenta de novo
        throw e;
      });
      this.byState.set(uf, pending);
    }
    return pending;
  }

  private async load(uf: string) {
    const url = `${this.config.ibgeBaseUrl}/api/v1/localidades/estados/${uf}/municipios?view=nivelado`;
    const json = await fetchJson(this.fetchFn, url, { source: 'IBGE', timeoutMs: this.config.timeoutMs, retryDelaysMs: this.config.retryDelaysMs }, this.logger);
    const map = new Map<string, Municipality>();
    for (const item of Array.isArray(json) ? json : []) {
      const id = (item as Record<string, unknown>)['municipio-id'];
      const name = (item as Record<string, unknown>)['municipio-nome'];
      if ((typeof id === 'number' || typeof id === 'string') && typeof name === 'string') {
        map.set(normalizeSearch(name).trim(), { ibgeCode: String(id), name: `${name}/${uf}` });
      }
    }
    return map;
  }
}
