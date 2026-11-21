'use client';

import Link from 'next/link';
import { Pager, usePager } from '@/components/Pager';
import { FieldHeading, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, listProducers, ProducerSummary } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function ProdutoresPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [data, setData] = useState<{ items: ProducerSummary[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listProducers(term)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a lista.'));
    return () => {
      alive = false;
    };
  }, [term]);
  const pager = usePager(data?.items ?? [], term);

  return (
    <>
      <FieldHeading eyebrow="Cadastro" title="Produtores" description="Produtores rurais cadastrados, com suas propriedades e atendimentos." />
      {data && !term && <FieldStats items={[
        { label: 'Produtores cadastrados', value: data.total.toLocaleString('pt-BR'), note: 'Base de assistência técnica' },
        { label: 'Comunidades na lista', value: new Set(data.items.map(p => p.community)).size, note: 'Representadas nesta consulta' },
        { label: 'Consentimentos na lista', value: data.items.filter(p => p.consentAt).length, note: 'Uso de dados autorizado' },
      ]} /> }

      <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
      <div className="toolbar">
        <div className={ui.search}><span className={ui.searchLabel} aria-hidden="true">Buscar:</span>
        <input
          className="input"
          type="search"
          placeholder="Buscar por nome ou CPF"
          aria-label="Buscar por nome ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        </div>
        {data && (
          <span className="count num">
            {term
              ? `${data.total} ${data.total === 1 ? 'encontrado' : 'encontrados'}`
              : `${data.total} ${data.total === 1 ? 'cadastrado' : 'cadastrados'}`}
          </span>
        )}
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <FieldLoading />}

      {data && (
        <div className="table-wrap">
          {data.items.length === 0 ? (
            <div className="empty">
              {term ? (
                <>
                  <strong>Nenhum produtor encontrado</strong>
                  Confira a grafia do nome ou digite o CPF completo.
                </>
              ) : (
                <>
                  <strong>Nenhum produtor cadastrado</strong>
                  <Link href="/produtores/novo">Cadastrar o primeiro produtor</Link>
                </>
              )}
            </div>
          ) : (
            <table className={`table ${ui.responsiveTable}`}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th className="hide-sm">Comunidade</th>
                  <th className="right">Propriedades</th>
                  <th className="hide-sm">Consentimento LGPD</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/produtores/${p.id}`)}>
                    <td data-label="Nome">
                      <Link href={`/produtores/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        <span className={ui.person}><span>{p.name}<small>{p.community}</small></span></span>
                      </Link>
                    </td>
                    <td className="num muted" data-label="CPF">{p.cpf}</td>
                    <td className="hide-sm" data-label="Comunidade">{p.community}</td>
                    <td className="right num" data-label="Propriedades">{p.propertyCount}</td>
                    <td className="hide-sm" data-label="Consentimento LGPD">
                      {p.consentAt ? (
                        <span className="badge badge-success num">{formatDate(p.consentAt)}</span>
                      ) : (
                        <span className="badge badge-warning">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.items.length > 0 && (
            <div className="table-foot">
              <Pager {...pager} shown={pager.pageItems.length} total={data.items.length} />
            </div>
          )}
        </div>
      )}
      {data && data.total > data.items.length && (
        <p className="muted">A lista mostra os {data.items.length.toLocaleString('pt-BR')} primeiros de {data.total.toLocaleString('pt-BR')} produtores. Use a busca para encontrar os demais.</p>
      )}
      {data && data.items.length > 0 && <p className="muted">Selecione uma linha para abrir a ficha do produtor.</p>}
      <div className="table-actions">
        <Link href="/produtores/novo" className="btn btn-primary">Novo produtor</Link>
      </div>
      </section>
    </>
  );
}
