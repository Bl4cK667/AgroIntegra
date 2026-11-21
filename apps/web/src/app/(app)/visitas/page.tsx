'use client';

import Link from 'next/link';
import { Pager, usePager } from '@/components/Pager';
import { FieldHeading, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';

import { useEffect, useState } from 'react';
import { VisitTable } from '@/components/visit/VisitTable';
import { ApiError, listVisits, VisitRow } from '@/lib/api';

export default function VisitasPage() {
  const [data, setData] = useState<{ items: VisitRow[]; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVisits()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as visitas.'));
  }, []);

  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = (data?.items ?? []).filter(v => [v.producer.name, v.property?.name, v.diagnosis, v.technician.name].some(value => value?.toLocaleLowerCase('pt-BR').includes(term)));
  const pager = usePager(visible, term);

  return (
    <>
      <FieldHeading eyebrow="Produtores" title="Visitas de todos os produtores" description={<>Histórico dos atendimentos técnicos realizados em campo. As visitas de um produtor também ficam na aba Visitas da <Link href="/produtores">ficha do produtor</Link>.</>} />
      {data && <FieldStats items={[
        { label: 'Visitas registradas', value: data.total.toLocaleString('pt-BR'), note: 'Histórico de atendimentos' },
        { label: 'Produtores na lista', value: new Set(data.items.map(v => v.producer.id)).size, note: 'Nesta consulta de visitas' },
        { label: 'Com retorno previsto', value: data.items.filter(v => v.returnOn).length, note: 'Entre os registros listados' },
      ]} /> }

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <FieldLoading />}

      {data && (
        <>
          <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
          <div className="toolbar">
            <div className={ui.search}><span className={ui.searchLabel} aria-hidden="true">Buscar:</span><input className="input" type="search" placeholder="Buscar nos registros carregados" aria-label="Buscar por produtor, propriedade, diagnóstico ou técnico nos registros carregados" value={search} onChange={event => setSearch(event.target.value)} /></div>
            <span className="count num">
              {term ? `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'} nos registros carregados` : `${data.total} ${data.total === 1 ? 'visita registrada' : 'visitas registradas'}`}
              {!term && data.total > data.items.length && `, mostrando as ${data.items.length} mais recentes`}
            </span>
          </div>
          <div className="table-wrap">
            {visible.length === 0 ? (
              <div className="empty">
                <strong>{term ? 'Nenhuma visita encontrada' : 'Nenhuma visita registrada'}</strong>
                {term ? <button type="button" className="btn-link" onClick={() => setSearch('')}>Limpar busca</button> : <Link href="/visitas/nova">Registrar a primeira visita</Link>}
              </div>
            ) : (
              <VisitTable visits={pager.pageItems} />
            )}
            {visible.length > 0 && (
              <div className="table-foot">
                <Pager {...pager} shown={pager.pageItems.length} total={visible.length} />
              </div>
            )}
          </div>
          {visible.length > 0 && <p className="muted">Selecione uma linha para abrir a visita.</p>}
          <div className="table-actions">
            <Link href="/visitas/nova" className="btn btn-primary">Registrar visita</Link>
          </div>
          </section>
        </>
      )}
    </>
  );
}
