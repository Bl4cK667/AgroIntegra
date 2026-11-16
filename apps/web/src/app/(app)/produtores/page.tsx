'use client';

import Link from 'next/link';
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

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Produtores</h1>
          <p>Cadastro dos produtores atendidos pela assistência técnica.</p>
        </div>
        <Link href="/produtores/novo" className="btn btn-primary">
          Novo produtor
        </Link>
      </header>

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Buscar por nome ou CPF"
          aria-label="Buscar por nome ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {data && (
          <span className="count num">
            {term
              ? `${data.total} ${data.total === 1 ? 'encontrado' : 'encontrados'}`
              : `${data.total} ${data.total === 1 ? 'cadastrado' : 'cadastrados'}`}
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
            <table className="table">
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
                {data.items.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/produtores/${p.id}`)}>
                    <td>
                      <Link href={`/produtores/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        {p.name}
                      </Link>
                    </td>
                    <td className="num muted">{p.cpf}</td>
                    <td className="hide-sm">{p.community}</td>
                    <td className="right num">{p.propertyCount}</td>
                    <td className="hide-sm">
                      {p.consentAt ? (
                        <span className="num">{formatDate(p.consentAt)}</span>
                      ) : (
                        <span className="pending">Pendente</span>
                      )}
                    </td>
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
