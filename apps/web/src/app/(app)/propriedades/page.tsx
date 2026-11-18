'use client';

import Link from 'next/link';
import { FieldHeading, FieldIcon, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';

import { useEffect, useState } from 'react';
import { ApiError, listProperties, PropertyRow } from '@/lib/api';
import { formatArea, formatPlace } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function PropriedadesPage() {
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

  return (
    <>
      <FieldHeading icon="land" eyebrow="Cadastro" title="Propriedades" description="Propriedades rurais cadastradas, com área, atividade principal e produtor responsável." actions={<Link href="/produtores" className="btn btn-secondary"><FieldIcon name="plus" /> Cadastrar pelo produtor</Link>} />
      {data && !term && <FieldStats items={[
        { label: 'Propriedades cadastradas', value: data.total.toLocaleString('pt-BR'), icon: 'land', note: 'Base de propriedades rurais' },
        { label: 'Área nesta consulta', value: formatArea(data.items.reduce((sum, p) => sum + p.areaHa, 0)), icon: 'pin', note: 'Soma das propriedades listadas' },
        { label: 'Produtores na lista', value: new Set(data.items.map(p => p.producer.id)).size, icon: 'people', note: 'Vinculados às propriedades' },
      ]} /> }

      <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
      <div className="toolbar">
        <div className={ui.search}><FieldIcon name="search" />
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
            <div className="empty"><span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="land" /></span>
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
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Propriedade">{p.name}</td>
                    <td data-label="Produtor">
                      <Link href={`/produtores/${p.producer.id}`}>{p.producer.name}</Link>
                    </td>
                    <td className="hide-sm" data-label="Localidade">{p.locality}</td>
                    <td className="hide-sm" data-label="Município">{formatPlace(p.city, p.state) || <span className="muted">Não informado</span>}</td>
                    <td className="hide-sm" data-label="Atividade principal">{p.mainActivity || <span className="muted">Não informada</span>}</td>
                    <td className="right area" data-label="Área declarada">{formatArea(p.areaHa)}</td>
                    <td className="right area" data-label="Área demarcada">
                      {p.calculatedAreaHa != null ? (
                        <Link href={`/propriedades/${p.id}/mapa`}>{formatArea(p.calculatedAreaHa)}</Link>
                      ) : (
                        <Link href={`/propriedades/${p.id}/mapa`} className="muted">Demarcar</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </section>
    </>
  );
}
