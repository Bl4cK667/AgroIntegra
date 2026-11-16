'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VisitRow } from '@/lib/api';
import { formatDay } from '@/lib/format';

// Tabela de visitas usada na lista geral e na página do produtor.
export function VisitTable({ visits, showProducer = true }: { visits: VisitRow[]; showProducer?: boolean }) {
  const router = useRouter();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Data</th>
          {showProducer && <th>Produtor</th>}
          <th className="hide-sm">Propriedade</th>
          <th>Diagnóstico</th>
          <th className="hide-sm">Técnico</th>
          <th className="hide-sm">Retorno</th>
        </tr>
      </thead>
      <tbody>
        {visits.map((v) => (
          <tr key={v.id} className="clickable" onClick={() => router.push(`/visitas/${v.id}`)}>
            <td className="num">
              <Link href={`/visitas/${v.id}`} onClick={(e) => e.stopPropagation()}>
                {formatDay(v.visitedOn)}
              </Link>
            </td>
            {showProducer && <td className="nowrap">{v.producer.name}</td>}
            <td className="hide-sm nowrap">{v.property?.name ?? <span className="muted">Não informada</span>}</td>
            <td className="clip">{v.diagnosis}</td>
            <td className="hide-sm nowrap">{v.technician.name}</td>
            <td className="hide-sm num">{v.returnOn ? formatDay(v.returnOn) : <span className="muted">Sem retorno</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
