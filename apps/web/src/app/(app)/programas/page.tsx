'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FieldEmpty, FieldHeading, FieldIcon, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';
import { ApiError, listPrograms, ProgramSummary } from '@/lib/api';
import { formatDay, formatInt, todayIso } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import styles from './programas.module.css';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ProgramasPage() {
  const router = useRouter();
  const [data, setData] = useState<{ items: ProgramSummary[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const term = normalize(useDebounced(search.trim()));

  useEffect(() => {
    listPrograms()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os programas.'));
  }, []);

  const today = todayIso();
  const phase = (p: ProgramSummary) =>
    p.endsOn < today ? { label: 'Encerrado', cls: 'badge badge-neutral' }
    : p.startsOn > today ? { label: 'Em breve', cls: 'badge badge-info' }
    : { label: 'Em andamento', cls: 'badge badge-success' };

  const rows = (data?.items ?? []).filter((p) => !term || normalize(p.name).includes(term));

  return (
    <>
      <FieldHeading
        icon="sprout"
        eyebrow="Fomento"
        title="Programas"
        description="Programas de fomento da secretaria. Consulta: os números vêm das inscrições e entregas registradas."
      />

      {data && data.items.length > 0 && (
        <FieldStats
          items={[
            { label: 'Programas', value: formatInt(data.items.length), icon: 'sprout', note: `${data.items.filter((p) => phase(p).label === 'Em andamento').length} em andamento` },
            { label: 'Beneficiários', value: formatInt(data.items.reduce((a, p) => a + p.approved, 0)), icon: 'people', note: `de ${formatInt(data.items.reduce((a, p) => a + p.slots, 0))} vagas` },
            { label: 'Entregas', value: formatInt(data.items.reduce((a, p) => a + p.deliveryCount, 0)), icon: 'check', note: 'registradas nos programas' },
          ]}
        />
      )}

      {data && data.items.length === 0 && (
        <FieldEmpty icon="sprout" title="Nenhum programa cadastrado">
          Os programas entram pela carga de dados da secretaria.
        </FieldEmpty>
      )}

      {(!data || data.items.length > 0) && (
        <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
          <div className="toolbar">
            <div className={ui.search}>
              <FieldIcon name="search" />
              <input
                className="input"
                type="search"
                placeholder="Buscar programa"
                aria-label="Buscar programa pelo nome"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {data && (
              <span className="count num">
                {rows.length} {rows.length === 1 ? 'programa' : 'programas'}
              </span>
            )}
          </div>

          {error && <p className="alert" role="alert">{error}</p>}
          {!data && !error && <FieldLoading />}

          {data && (
            <div className="table-wrap">
              {rows.length === 0 ? (
                <div className="empty">
                  <span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="sprout" /></span>
                  <strong>Nenhum programa encontrado</strong>
                  Confira a grafia do nome.
                </div>
              ) : (
                <table className={`table ${ui.responsiveTable}`}>
                  <thead>
                    <tr>
                      <th>Programa</th>
                      <th>Situação</th>
                      <th className="right">Beneficiários</th>
                      <th className="right hide-sm">Inscritos</th>
                      <th className="right hide-sm">Vagas livres</th>
                      <th className="right">Execução física</th>
                      <th className="right">Execução financeira</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const ph = phase(p);
                      return (
                        <tr key={p.id} className="clickable" onClick={() => router.push(`/programas/${p.id}`)}>
                          <td data-label="Programa">
                            <Link href={`/programas/${p.id}`} onClick={(e) => e.stopPropagation()}>
                              <span className={ui.person}>
                                <span className={ui.avatar} aria-hidden="true"><FieldIcon name="sprout" /></span>
                                <span>
                                  {p.name}
                                  <small className="num">{formatDay(p.startsOn)} a {formatDay(p.endsOn)}</small>
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td data-label="Situação"><span className={ph.cls}>{ph.label}</span></td>
                          <td className="right num" data-label="Beneficiários">
                            {formatInt(p.approved)} <span className="muted">de {formatInt(p.slots)}</span>
                          </td>
                          <td className="right num hide-sm" data-label="Inscritos">{formatInt(p.enrolled)}</td>
                          <td className="right num hide-sm" data-label="Vagas livres">{formatInt(p.openSlots)}</td>
                          <td className="right num" data-label="Execução física"><Percent value={p.physicalPercent} /></td>
                          <td className="right num" data-label="Execução financeira"><Percent value={p.financialPercent} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

// Percentual com barra fina ao lado; o número é a informação, a barra só reforça.
function Percent({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className={styles.percent}>
      <span className={styles.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      {pct}%
    </span>
  );
}
