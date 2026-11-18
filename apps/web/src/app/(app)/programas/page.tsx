'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Meter } from '@/components/Meter';
import { FieldEmpty, FieldHeading, FieldIcon, FieldLoading, FieldStats } from '@/components/property/FieldUI';
import { ApiError, listPrograms, ProgramSummary } from '@/lib/api';
import { formatDay, formatInt, todayIso } from '@/lib/format';
import styles from './programas.module.css';

export default function ProgramasPage() {
  const [data, setData] = useState<{ items: ProgramSummary[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPrograms()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os programas.'));
  }, []);

  const today = todayIso();
  const phase = (p: ProgramSummary) =>
    p.endsOn < today ? { label: 'Encerrado', cls: 'badge badge-neutral' }
    : p.startsOn > today ? { label: 'Em breve', cls: 'badge badge-info' }
    : { label: 'Em andamento', cls: 'badge badge-success' };

  return (
    <>
      <FieldHeading
        icon="sprout"
        eyebrow="Fomento"
        title="Programas"
        description="Programas de fomento da secretaria. Consulta: os números vêm das inscrições e entregas registradas."
      />

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <FieldLoading />}

      {data && data.items.length > 0 && (
        <FieldStats
          items={[
            { label: 'Programas', value: formatInt(data.items.length), icon: 'sprout', note: `${data.items.filter((p) => phase(p).label === 'Em andamento').length} em andamento` },
            { label: 'Beneficiários', value: formatInt(data.items.reduce((a, p) => a + p.approved, 0)), icon: 'people', note: `de ${formatInt(data.items.reduce((a, p) => a + p.slots, 0))} vagas` },
            { label: 'Entregas', value: formatInt(data.items.reduce((a, p) => a + p.deliveryCount, 0)), icon: 'check', note: 'registradas nos programas' },
          ]}
        />
      )}

      {data && data.items.length === 0 && (
        <FieldEmpty icon="sprout" title="Nenhum programa cadastrado">
          Os programas entram pela carga de dados da secretaria.
        </FieldEmpty>
      )}

      {data && data.items.length > 0 && (
        <ul className={styles.grid}>
          {data.items.map((p, i) => {
            const ph = phase(p);
            const fill = p.slots > 0 ? Math.min(100, (p.approved / p.slots) * 100) : 0;
            return (
              <li key={p.id} className="enter" style={{ '--i': i + 4 } as React.CSSProperties}>
                <Link href={`/programas/${p.id}`} className={`card ${styles.program}`}>
                  <div className={styles.head}>
                    <span className="card-icon">
                      <FieldIcon name="sprout" />
                    </span>
                    <span className={ph.cls}>{ph.label}</span>
                    <span className={styles.arrow} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7M8 7h9v9" />
                      </svg>
                    </span>
                  </div>
                  <h2 className={styles.name}>{p.name}</h2>
                  <p className={`${styles.period} num`}>
                    <FieldIcon name="calendar" /> {formatDay(p.startsOn)} a {formatDay(p.endsOn)}
                  </p>

                  <div className={styles.slots}>
                    <div>
                      <strong className="num">{formatInt(p.approved)}</strong>
                      <span>beneficiários</span>
                    </div>
                    <div>
                      <strong className="num">{formatInt(p.enrolled)}</strong>
                      <span>inscritos</span>
                    </div>
                    <div>
                      <strong className="num">{formatInt(p.openSlots)}</strong>
                      <span>vagas livres</span>
                    </div>
                  </div>
                  <span className={styles.slotBar} aria-label={`${formatInt(p.approved)} de ${formatInt(p.slots)} vagas ocupadas`} role="img">
                    <span style={{ width: `${fill}%` }} />
                  </span>

                  <div className={styles.meters}>
                    <span className={styles.metersTitle}>Execução</span>
                    <Meter percent={p.physicalPercent} label="Física" compact />
                    <Meter percent={p.financialPercent} label="Financeira" compact />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
