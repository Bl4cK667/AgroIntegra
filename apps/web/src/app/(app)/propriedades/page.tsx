'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, listProperties, PropertyRow } from '@/lib/api';
import { formatArea } from '@/lib/format';
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
      <header className="page-head">
        <div>
          <h1>Propriedades</h1>
          <p>Para cadastrar uma propriedade, abra a página do produtor.</p>
        </div>
      </header>

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Buscar por propriedade, localidade ou produtor"
          aria-label="Buscar por propriedade, localidade ou produtor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {data && (
          <span className="count num">
            {data.total} {data.total === 1 ? 'propriedade' : 'propriedades'}
          </span>
        )}
      </div>

      {error && <p className="alert">{error}</p>}

      {data && (
        <div className="table-wrap">
          {data.items.length === 0 ? (
            <div className="empty">
              {term ? (
                <>
                  <strong>Nenhuma propriedade encontrada</strong>
                  Tente outro nome, localidade ou produtor.
                </>
              ) : (
                <>
                  <strong>Nenhuma propriedade cadastrada</strong>
                  <Link href="/produtores">Escolha um produtor para cadastrar a propriedade</Link>
                </>
              )}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Propriedade</th>
                  <th>Produtor</th>
                  <th className="hide-sm">Localidade</th>
                  <th className="hide-sm">Atividade principal</th>
                  <th className="right">Área</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <Link href={`/produtores/${p.producer.id}`}>{p.producer.name}</Link>
                    </td>
                    <td className="hide-sm">{p.locality}</td>
                    <td className="hide-sm">{p.mainActivity || <span className="muted">Não informada</span>}</td>
                    <td className="right area">{formatArea(p.areaHa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
