'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Meter } from '@/components/Meter';
import { ApiError, ENROLLMENT_LABEL, getProgram, ProgramDetail } from '@/lib/api';
import { formatDay, formatInt, formatMoney } from '@/lib/format';
import styles from '@/components/figures.module.css';
import own from './programa.module.css';

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
        <p className="alert">{error}</p>
      </>
    );
  }
  if (!p) return <p className="muted">Carregando…</p>;

  return (
    <>
      <Link href="/programas" className="back">
        Programas
      </Link>
      <header className="page-head">
        <div>
          <h1>{p.name}</h1>
          <p>
            {p.description} Vigência de <span className="num">{formatDay(p.startsOn)}</span> a{' '}
            <span className="num">{formatDay(p.endsOn)}</span>.
          </p>
        </div>
      </header>

      <section className={styles.figures} aria-label="Indicadores do programa">
        <div className={styles.figure}>
          <span className={styles.label}>Vagas</span>
          <strong className="num">{formatInt(p.slots)}</strong>
          <span className={styles.note}>
            <b className="num">{formatInt(p.openSlots)}</b> ainda livres
          </span>
        </div>
        <div className={styles.figure}>
          <span className={styles.label}>Inscritos</span>
          <strong className="num">{formatInt(p.enrolled)}</strong>
          <span className={styles.note}>
            {p.pending} em análise, {p.rejected} não aprovados
          </span>
        </div>
        <div className={styles.figure}>
          <span className={styles.label}>Beneficiários aprovados</span>
          <strong className="num">{formatInt(p.approved)}</strong>
          <span className={styles.note}>inscrições aprovadas</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.label}>Entregas</span>
          <strong className="num">{formatInt(p.deliveryCount)}</strong>
          <span className={styles.note}>registros de entrega</span>
        </div>
      </section>

      <section className={own.execution} aria-label="Execução">
        <div>
          <h2>Execução física</h2>
          <p className="muted">
            <span className="num">
              {formatInt(p.deliveredQuantity)} de {formatInt(p.goalQuantity)}
            </span>{' '}
            {p.unit} entregues
          </p>
          <Meter percent={p.physicalPercent} />
        </div>
        <div>
          <h2>Execução financeira</h2>
          <p className="muted">
            <span className="num">
              {formatMoney(p.spentCents)} de {formatMoney(p.budgetCents)}
            </span>
          </p>
          <Meter percent={p.financialPercent} />
        </div>
      </section>

      <div className={own.tables}>
        <section>
          <h2 className={own.h2}>
            Inscrições <span className="muted num">{p.enrollments.length}</span>
          </h2>
          <div className="table-wrap">
            {p.enrollments.length === 0 ? (
              <div className="empty">Nenhuma inscrição.</div>
            ) : (
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
                      <td className={e.status === 'APPROVED' ? '' : 'muted'}>{ENROLLMENT_LABEL[e.status]}</td>
                      <td className="num hide-sm">{formatDay(e.enrolledOn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className={own.h2}>
            Entregas <span className="muted num">{p.deliveries.length}</span>
          </h2>
          <div className="table-wrap">
            {p.deliveries.length === 0 ? (
              <div className="empty">Nenhuma entrega registrada.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produtor</th>
                    <th className="right">Quantidade</th>
                    <th className="right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {p.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="num">{formatDay(d.deliveredOn)}</td>
                      <td>
                        <Link href={`/produtores/${d.producer.id}`}>{d.producer.name}</Link>
                      </td>
                      <td className="right num">
                        {formatInt(d.quantity)} {p.unit}
                      </td>
                      <td className="right num">{formatMoney(d.valueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
