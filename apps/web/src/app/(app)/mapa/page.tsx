'use client';

// Mapa territorial (módulo geo): propriedades demarcadas e pontos, com filtros.

import { TERRITORY_COLORS } from '@agrointegra/map-styles';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FieldHeading, FieldLoading } from '@/components/property/FieldUI';
import styles from '@/components/geo/geo.module.css';
import { ApiError, STATUS_LABEL, type RequestStatus } from '@/lib/api';
import { getTerritoryFilters, getTerritoryMap, type TerritoryFilterOptions, type TerritoryFilters, type TerritoryMap } from '@/lib/geo';
import { formatInt } from '@/lib/format';

const TerritoryMapView = dynamic(() => import('@/components/geo/TerritoryMapView'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Carregando mapa…</div>,
});

const REQUEST_LABEL = (s: string) => (s === 'OPEN' ? 'Com solicitação aberta' : `Solicitação: ${STATUS_LABEL[s as RequestStatus]}`);

export default function MapaTerritorialPage() {
  const [options, setOptions] = useState<TerritoryFilterOptions | null>(null);
  const [filters, setFilters] = useState<TerritoryFilters>({});
  const [data, setData] = useState<TerritoryMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTerritoryFilters().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    getTerritoryMap(filters)
      .then((d) => (setData(d), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o mapa.'))
      .finally(() => setLoading(false));
  }, [filters]);

  const set = (key: keyof TerritoryFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value || undefined }));
  const active = Object.values(filters).some(Boolean);

  return (
    <>
      <FieldHeading icon="land" eyebrow="Mapa territorial" title="Propriedades no mapa" description="Onde estão as propriedades atendidas, com a demarcação feita pelos técnicos. Clique numa propriedade para ver o resumo." />

      <div className={styles.mapPage}>
        <div className={`card ${styles.filters}`}>
          <label className="field">
            <span>Comunidade</span>
            <select className="input" value={filters.community ?? ''} onChange={set('community')}>
              <option value="">Todas</option>
              {options?.communities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Produção</span>
            <select className="input" value={filters.mainActivity ?? ''} onChange={set('mainActivity')}>
              <option value="">Todas</option>
              {options?.mainActivities.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Programa</span>
            <select className="input" value={filters.programId ?? ''} onChange={set('programId')}>
              <option value="">Todos</option>
              {options?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Técnico que atendeu</span>
            <select className="input" value={filters.technicianId ?? ''} onChange={set('technicianId')}>
              <option value="">Todos</option>
              {options?.technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Atendimento</span>
            <select className="input" value={filters.requestStatus ?? ''} onChange={set('requestStatus')}>
              <option value="">Qualquer situação</option>
              {options?.requestStatuses.map((s) => <option key={s} value={s}>{REQUEST_LABEL(s)}</option>)}
            </select>
          </label>
          {active && (
            <button type="button" className="btn btn-secondary" onClick={() => setFilters({})}>Limpar filtros</button>
          )}
        </div>

        {error && <p role="alert" className="alert">{error}</p>}
        {!data && loading && <FieldLoading />}

        {data && (
          <>
            <div className={styles.legend} aria-live="polite">
              <span><strong className="num">{formatInt(data.meta.count)}</strong> no mapa{loading ? ' (atualizando…)' : ''}</span>
              <span><span className={styles.swatch} style={{ background: TERRITORY_COLORS.demarcated }} />Demarcada</span>
              <span><span className={`${styles.swatch} ${styles.dot}`} style={{ background: TERRITORY_COLORS.pointOnly }} />Só localização (sem demarcação)</span>
              <span><span className={styles.swatch} style={{ background: TERRITORY_COLORS.withOpenRequests }} />Com solicitação aberta</span>
              {data.meta.withoutLocation > 0 && (
                <span>{formatInt(data.meta.withoutLocation)} propriedade(s) sem localização não aparecem no mapa</span>
              )}
              {data.meta.truncated && <span className={styles.warn}>Mostrando só as {formatInt(data.meta.limit)} primeiras: use os filtros.</span>}
            </div>
            <TerritoryMapView data={data} />
          </>
        )}
      </div>
    </>
  );
}
