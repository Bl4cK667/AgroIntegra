'use client';

import Link from 'next/link';
import { Pager, usePager } from '@/components/Pager';
import { FieldHeading, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, listProperties, PropertyRow } from '@/lib/api';
import { formatArea, formatPlace } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function PropriedadesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [data, setData] = useState<{ items: PropertyRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listProperties(term)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a lista.'));
    return () => {
      alive = false;
    };
  }, [term]);
  const pager = usePager(data?.items ?? [], term);

  return (
    <>
      <FieldHeading eyebrow="Cadastro" title="Propriedades" description="Propriedades rurais cadastradas, com área, atividade principal e produtor responsável." />
      {data && !term && <FieldStats items={[
        { label: 'Propriedades cadastradas', value: data.total.toLocaleString('pt-BR'), note: 'Base de propriedades rurais' },
        { label: 'Área nesta consulta', value: formatArea(data.items.reduce((sum, p) => sum + p.areaHa, 0)), note: 'Soma das propriedades listadas' },
        { label: 'Produtores na lista', value: new Set(data.items.map(p => p.producer.id)).size, note: 'Vinculados às propriedades' },
      ]} /> }

      <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
      <div className="toolbar">
        <div className={ui.search}><span className={ui.searchLabel} aria-hidden="true">Buscar:</span>
        <input
          className="input"
          type="search"
          placeholder="Buscar por propriedade, localidade, município ou produtor"
          aria-label="Buscar por propriedade, localidade ou produtor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        </div>
        {data && (
          <span className="count num">
            {data.total} {data.total === 1 ? 'propriedade' : 'propriedades'}
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
                  <strong>Nenhuma propriedade encontrada</strong>
                  Tente outro nome, localidade, município ou produtor.
                </>
              ) : (
                <>
                  <strong>Nenhuma propriedade cadastrada</strong>
                  <Link href="/produtores">Escolha um produtor para cadastrar a propriedade</Link>
                </>
              )}
            </div>
          ) : (
            <table className={`table ${ui.responsiveTable}`}>
              <thead>
                <tr>
                  <th>Propriedade</th>
                  <th>Produtor</th>
                  <th className="hide-sm">Localidade</th>
                  <th className="hide-sm">Município</th>
                  <th className="hide-sm">Atividade principal</th>
                  <th className="right">Área declarada</th>
                  <th className="right">Área demarcada</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/propriedades/${p.id}/mapa`)}>
                    <td data-label="Propriedade">
                      <Link href={`/propriedades/${p.id}/mapa`} onClick={(e) => e.stopPropagation()}>
                        <span className={ui.person}>
                          <span>{p.name}<small>{p.locality}</small></span>
                        </span>
                      </Link>
                    </td>
                    <td data-label="Produtor">
                      <Link href={`/produtores/${p.producer.id}`} onClick={(e) => e.stopPropagation()}>{p.producer.name}</Link>
                    </td>
                    <td className="hide-sm" data-label="Localidade">{p.locality}</td>
                    <td className="hide-sm" data-label="Município">{formatPlace(p.city, p.state) || <span className="muted">Não informado</span>}</td>
                    <td className="hide-sm" data-label="Atividade principal">{p.mainActivity || <span className="muted">Não informada</span>}</td>
                    <td className="right area" data-label="Área declarada">{formatArea(p.areaHa)}</td>
                    <td className="right area" data-label="Área demarcada">
                      {p.calculatedAreaHa != null ? (
                        formatArea(p.calculatedAreaHa)
                      ) : (
                        <span className="badge badge-soft badge-warning">Não demarcada</span>
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
        <p className="muted">A lista mostra as {data.items.length.toLocaleString('pt-BR')} primeiras de {data.total.toLocaleString('pt-BR')} propriedades. Use a busca para encontrar as demais.</p>
      )}
      {data && data.items.length > 0 && <p className="muted">Selecione uma linha para abrir o mapa da propriedade.</p>}
      <div className="table-actions">
        <Link href="/produtores" className="btn btn-secondary">Cadastrar propriedade pela ficha do produtor</Link>
      </div>
      </section>
    </>
  );
}
