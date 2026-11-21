'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Meter } from '@/components/Meter';
import { FieldEmpty, FieldHeading, FieldLoading, FieldStats, SectionTitle } from '@/components/property/FieldUI';
import { ApiError, ENROLLMENT_LABEL, EnrollmentStatus, getProgram, ProgramDetail } from '@/lib/api';
import { formatDay, formatInt, formatMoney } from '@/lib/format';
import own from './programa.module.css';

const ENROLLMENT_BADGE: Record<EnrollmentStatus, string> = {
  APPROVED: 'badge badge-success',
  ENROLLED: 'badge badge-info',
  REJECTED: 'badge badge-neutral',
};

export default function ProgramaPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<ProgramDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgram(id)
      .then(setP)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o programa.'));
  }, [id]);

  if (error) {
    return (
      <>
        <Link href="/programas" className="back">
          Programas
        </Link>
        <p className="alert" role="alert">{error}</p>
      </>
    );
  }
  if (!p) return <FieldLoading />;

  return (
    <>
      <Link href="/programas" className="back">
        Programas
      </Link>
      <FieldHeading
        eyebrow={`Vigência ${formatDay(p.startsOn)} a ${formatDay(p.endsOn)}`}
        title={p.name}
        description={p.description}
      />

      <FieldStats
        items={[
          { label: 'Vagas', value: formatInt(p.slots), note: `${formatInt(p.openSlots)} ainda livres` },
          { label: 'Inscritos', value: formatInt(p.enrolled), note: `${p.pending} em análise, ${p.rejected} não aprovados` },
          { label: 'Beneficiários', value: formatInt(p.approved), note: 'inscrições aprovadas' },
          { label: 'Entregas', value: formatInt(p.deliveryCount), note: 'registros de entrega' },
        ]}
      />

      <section className={own.execution} aria-label="Execução">
        <div className="card enter" style={{ '--i': 5 } as React.CSSProperties}>
          <SectionTitle>Execução física</SectionTitle>
          <p className={own.big}>
            <strong className="num">{formatInt(p.deliveredQuantity)}</strong>
            <span className="num">
              de {formatInt(p.goalQuantity)} {p.unit} entregues
            </span>
          </p>
          <Meter percent={p.physicalPercent} />
        </div>
        <div className="card enter" style={{ '--i': 6 } as React.CSSProperties}>
          <SectionTitle>Execução financeira</SectionTitle>
          <p className={own.big}>
            <strong className="num">{formatMoney(p.spentCents)}</strong>
            <span className="num">de {formatMoney(p.budgetCents)} do orçamento</span>
          </p>
          <Meter percent={p.financialPercent} />
        </div>
      </section>

      <div className={own.tables}>
        <section className="card enter" style={{ '--i': 7 } as React.CSSProperties}>
          <SectionTitle actions={<span className="badge badge-neutral num">{p.enrollments.length}</span>}>
            Inscrições
          </SectionTitle>
          {p.enrollments.length === 0 ? (
            <FieldEmpty title="Nenhuma inscrição">
              As inscrições aparecem aqui assim que forem registradas.
            </FieldEmpty>
          ) : (
            <div className={`table-wrap ${own.flush}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Produtor</th>
                    <th className="hide-sm">Comunidade</th>
                    <th>Situação</th>
                    <th className="hide-sm">Inscrição</th>
                  </tr>
                </thead>
                <tbody>
                  {p.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/produtores/${e.producer.id}`}>{e.producer.name}</Link>
                      </td>
                      <td className="hide-sm">{e.producer.community}</td>
                      <td>
                        <span className={ENROLLMENT_BADGE[e.status]}>{ENROLLMENT_LABEL[e.status]}</span>
                      </td>
                      <td className="num hide-sm">{formatDay(e.enrolledOn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card enter" style={{ '--i': 8 } as React.CSSProperties}>
          <SectionTitle actions={<span className="badge badge-neutral num">{p.deliveries.length}</span>}>
            Entregas
          </SectionTitle>
          {p.deliveries.length === 0 ? (
            <FieldEmpty title="Nenhuma entrega registrada">
              Cada entrega registrada soma na execução física e financeira.
            </FieldEmpty>
          ) : (
            <div className={`table-wrap ${own.flush}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produtor</th>
                    <th className="right">Quantidade</th>
                    <th className="right hide-sm">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {p.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="num nowrap">{formatDay(d.deliveredOn)}</td>
                      <td>
                        <Link href={`/produtores/${d.producer.id}`}>{d.producer.name}</Link>
                      </td>
                      <td className="right num nowrap">
                        {formatInt(d.quantity)} {d.quantity === 1 ? p.unitSingular : p.unit}
                      </td>
                      <td className="right num hide-sm">{formatMoney(d.valueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
