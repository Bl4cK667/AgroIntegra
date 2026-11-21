'use client';

import Link from 'next/link';
import { FieldHeading, FieldLoading, FieldStats, SectionTitle } from '@/components/property/FieldUI';
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
  if (!visit) return <FieldLoading />;

  return (
    <>
      <Link href={`/produtores/${visit.producer.id}`} className="back">
        {visit.producer.name}
      </Link>
      <FieldHeading eyebrow="Registro de atendimento" title={<>Visita de <span className="num">{formatDay(visit.visitedOn)}</span></>} description={<><Link href={`/produtores/${visit.producer.id}`}>{visit.producer.name}</Link>{visit.property && <> · {visit.property.name}</>}</>} actions={<Link href={`/visitas/nova?produtor=${visit.producer.id}`} className="btn btn-primary">Registrar nova visita</Link>} />
      <FieldStats items={[
        { label: 'Técnico responsável', value: visit.technician.name },
        { label: 'Prazo de retorno', value: visit.returnOn ? formatDay(visit.returnOn) : 'Sem previsão' },
        { label: 'Registros fotográficos', value: visit.photos.length, note: visit.hasSignature ? 'Com assinatura do produtor' : 'Sem assinatura coletada' },
      ]} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className="card enter">
            <SectionTitle>Diagnóstico</SectionTitle>
            <p className={styles.text}>{visit.diagnosis}</p>
          </section>
          <section className="card enter">
            <SectionTitle>Plano de ação</SectionTitle>
            <p className={styles.text}>{visit.actionPlan}</p>
          </section>
          {visit.impact && (
            <section className="card enter">
              <SectionTitle>Impacto esperado</SectionTitle>
              <p className={styles.text}>{visit.impact}</p>
            </section>
          )}
          {visit.photos.length > 0 && (
            <section className="card enter">
              <SectionTitle>Fotos</SectionTitle>
              <div className={styles.photos}>
                {visit.photos.map((p) => (
                  <ProtectedImage key={p.id} path={`/visits/${visit.id}/photos/${p.id}`} alt={`Foto ${p.position} da visita`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <dl className={`card enter ${styles.facts}`}>
          <div className="card-head"><h2 className="card-title">Sobre o atendimento</h2></div>
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
