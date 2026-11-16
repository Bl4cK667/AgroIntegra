'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VisitTable } from '@/components/visit/VisitTable';
import { ApiError, listVisits, VisitRow } from '@/lib/api';

export default function VisitasPage() {
  const [data, setData] = useState<{ items: VisitRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVisits()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as visitas.'));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visitas</h1>
          <p>Atendimentos técnicos registrados, do mais recente para o mais antigo.</p>
        </div>
        <Link href="/visitas/nova" className="btn btn-primary">
          Registrar visita
        </Link>
      </header>

      {error && <p className="alert">{error}</p>}

      {data && (
        <>
          <div className="toolbar">
            <span className="count num">
              {data.total} {data.total === 1 ? 'visita registrada' : 'visitas registradas'}
              {data.total > data.items.length && `, mostrando as ${data.items.length} mais recentes`}
            </span>
          </div>
          <div className="table-wrap">
            {data.items.length === 0 ? (
              <div className="empty">
                <strong>Nenhuma visita registrada</strong>
                <Link href="/visitas/nova">Registrar a primeira visita</Link>
              </div>
            ) : (
              <VisitTable visits={data.items} />
            )}
          </div>
        </>
      )}
    </>
  );
}
