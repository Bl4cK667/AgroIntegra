'use client';

import Link from 'next/link';
import { FieldHeading, FieldIcon, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';

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

  return (
    <>
      <FieldHeading icon="visit" eyebrow="Assistência técnica" title="Visitas" description="Histórico dos atendimentos técnicos realizados em campo." actions={<Link href="/visitas/nova" className="btn btn-primary"><FieldIcon name="plus" /> Registrar visita</Link>} />
      {data && <FieldStats items={[
        { label: 'Visitas registradas', value: data.total.toLocaleString('pt-BR'), icon: 'visit', note: 'Histórico de atendimentos' },
        { label: 'Produtores na lista', value: new Set(data.items.map(v => v.producer.id)).size, icon: 'people', note: 'Nesta consulta de visitas' },
        { label: 'Com retorno previsto', value: data.items.filter(v => v.returnOn).length, icon: 'note', note: 'Entre os registros listados' },
      ]} /> }

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <FieldLoading />}

      {data && (
        <>
          <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
          <div className="toolbar">
            <div className={ui.search}><FieldIcon name="search" /><input className="input" type="search" placeholder="Buscar nos registros carregados" aria-label="Buscar por produtor, propriedade, diagnóstico ou técnico nos registros carregados" value={search} onChange={event => setSearch(event.target.value)} /></div>
            <span className="count num">
              {term ? `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'} nos registros carregados` : `${data.total} ${data.total === 1 ? 'visita registrada' : 'visitas registradas'}`}
              {!term && data.total > data.items.length && `, mostrando as ${data.items.length} mais recentes`}
            </span>
          </div>
          <div className="table-wrap">
            {visible.length === 0 ? (
              <div className="empty"><span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="visit" /></span>
                <strong>{term ? 'Nenhuma visita encontrada' : 'Nenhuma visita registrada'}</strong>
                {term ? <button type="button" className="btn-link" onClick={() => setSearch('')}>Limpar busca</button> : <Link href="/visitas/nova">Registrar a primeira visita</Link>}
              </div>
            ) : (
              <VisitTable visits={visible} />
            )}
            {visible.length > 0 && (
              <div className="table-foot">
                <span>
                  Mostrando {visible.length.toLocaleString('pt-BR')} de {(term ? data.items.length : data.total).toLocaleString('pt-BR')}
                  {term ? ' carregadas' : ''}
                </span>
                <span>Selecione uma linha para abrir a visita.</span>
              </div>
            )}
          </div>
          </section>
        </>
      )}
    </>
  );
}
