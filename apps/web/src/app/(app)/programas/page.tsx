'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Meter } from '@/components/Meter';
import { ApiError, listPrograms, ProgramSummary } from '@/lib/api';
import { formatDay, formatInt } from '@/lib/format';

export default function ProgramasPage() {
  const router = useRouter();
  const [data, setData] = useState<{ items: ProgramSummary[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPrograms()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os programas.'));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Programas</h1>
          <p>Programas de fomento da secretaria. Consulta: os números vêm das inscrições e entregas registradas.</p>
        </div>
      </header>

      {error && <p className="alert">{error}</p>}

      {data && (
        <div className="table-wrap">
          {data.items.length === 0 ? (
            <div className="empty">
              <strong>Nenhum programa cadastrado</strong>
              Os programas entram pela carga de dados da secretaria.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th className="right">Vagas</th>
                  <th className="right hide-sm">Inscritos</th>
                  <th className="right">Beneficiários</th>
                  <th className="right hide-sm">Entregas</th>
                  <th className="hide-sm">Execução física</th>
                  <th className="hide-sm">Execução financeira</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/programas/${p.id}`)}>
                    <td>
                      <Link href={`/programas/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        {p.name}
                      </Link>
                      <div className="muted num" style={{ fontSize: '0.85rem' }}>
                        {formatDay(p.startsOn)} a {formatDay(p.endsOn)}
                      </div>
                    </td>
                    <td className="right num">{formatInt(p.slots)}</td>
                    <td className="right num hide-sm">{formatInt(p.enrolled)}</td>
                    <td className="right num">{formatInt(p.approved)}</td>
                    <td className="right num hide-sm">{formatInt(p.deliveryCount)}</td>
                    <td className="hide-sm" style={{ minWidth: 130 }}>
                      <Meter percent={p.physicalPercent} compact />
                    </td>
                    <td className="hide-sm" style={{ minWidth: 130 }}>
                      <Meter percent={p.financialPercent} compact />
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
