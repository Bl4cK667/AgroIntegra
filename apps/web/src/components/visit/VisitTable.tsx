'use client';

import Link from 'next/link';
import { fieldStyles as ui } from '@/components/property/FieldUI';
import { useRouter } from 'next/navigation';
import { VisitRow } from '@/lib/api';
import { formatDay } from '@/lib/format';

// Tabela de visitas usada na lista geral e na página do produtor.
export function VisitTable({ visits, showProducer = true }: { visits: VisitRow[]; showProducer?: boolean }) {
  const router = useRouter();
  return (
    <table className={`table ${ui.responsiveTable}`}>
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
            <td className="num" data-label="Data">
              <Link href={`/visitas/${v.id}`} onClick={(e) => e.stopPropagation()}>
                {formatDay(v.visitedOn)}
              </Link>
            </td>
            {showProducer && (
              <td className="nowrap" data-label="Produtor">
                <span className={ui.person}>
                  <span className={ui.avatar} aria-hidden="true">{v.producer.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('')}</span>
                  <span>{v.producer.name}</span>
                </span>
              </td>
            )}
            <td className="hide-sm nowrap" data-label="Propriedade">{v.property?.name ?? <span className="muted">Não informada</span>}</td>
            <td className="clip" data-label="Diagnóstico">{v.diagnosis}</td>
            <td className="hide-sm nowrap" data-label="Técnico">{v.technician.name}</td>
            <td className="hide-sm num nowrap" data-label="Retorno">
              {v.returnOn ? <span className="badge badge-soft badge-info">{formatDay(v.returnOn)}</span> : <span className="muted">Sem retorno</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
