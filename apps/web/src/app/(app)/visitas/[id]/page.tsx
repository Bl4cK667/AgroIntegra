'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedImage } from '@/components/visit/ProtectedImage';
import { ApiError, getVisit, VisitDetail } from '@/lib/api';
import { formatCoord, formatDate, formatDay } from '@/lib/format';
import styles from './visita.module.css';

export default function VisitaPage() {
  const { id } = useParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVisit(id)
      .then(setVisit)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a visita.'));
  }, [id]);

  if (error) {
    return (
      <>
        <Link href="/visitas" className="back">
          Visitas
        </Link>
        <p className="alert">{error}</p>
      </>
    );
  }
  if (!visit) return <p className="muted">Carregando…</p>;

  return (
    <>
      <Link href={`/produtores/${visit.producer.id}`} className="back">
        {visit.producer.name}
      </Link>
      <header className="page-head">
        <div>
          <h1>
            Visita de <span className="num">{formatDay(visit.visitedOn)}</span>
          </h1>
          <p>
            <Link href={`/produtores/${visit.producer.id}`}>{visit.producer.name}</Link>
            {visit.property && <> · {visit.property.name}</>}
          </p>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section>
            <h2>Diagnóstico</h2>
            <p className={styles.text}>{visit.diagnosis}</p>
          </section>
          <section>
            <h2>Plano de ação</h2>
            <p className={styles.text}>{visit.actionPlan}</p>
          </section>
          {visit.impact && (
            <section>
              <h2>Impacto esperado</h2>
              <p className={styles.text}>{visit.impact}</p>
            </section>
          )}
          {visit.photos.length > 0 && (
            <section>
              <h2>Fotos</h2>
              <div className={styles.photos}>
                {visit.photos.map((p) => (
                  <ProtectedImage key={p.id} path={`/visits/${visit.id}/photos/${p.id}`} alt={`Foto ${p.position} da visita`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <dl className={styles.facts}>
          {visit.request && (
            <div>
              <dt>Solicitação atendida</dt>
              <dd>{visit.request.subject}</dd>
            </div>
          )}
          <div>
            <dt>Técnico responsável</dt>
            <dd>{visit.technician.name}</dd>
          </div>
          <div>
            <dt>Prazo de retorno</dt>
            <dd className="num">{visit.returnOn ? formatDay(visit.returnOn) : <span className="muted">Sem retorno previsto</span>}</dd>
          </div>
          <div>
            <dt>Localização</dt>
            <dd>
              {visit.location ? (
                <>
                  <span className="num">
                    {formatCoord(visit.location.latitude)}, {formatCoord(visit.location.longitude)}
                  </span>
                  {visit.location.accuracy != null && (
                    <span className={`muted num ${styles.small}`}>precisão de {Math.round(visit.location.accuracy)} m</span>
                  )}
                </>
              ) : (
                <span className="muted">Não registrada</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Assinatura do produtor</dt>
            <dd>
              {visit.hasSignature ? (
                <ProtectedImage path={`/visits/${visit.id}/signature`} alt={`Assinatura de ${visit.producer.name}`} />
              ) : (
                <span className="muted">Não coletada</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Registrada no sistema</dt>
            <dd className="num">{formatDate(visit.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
