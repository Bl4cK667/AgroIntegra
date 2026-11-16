'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import fig from '@/components/figures.module.css';
import form from '@/components/form.module.css';
import { ProducerSearch } from '@/components/ProducerSearch';
import {
  ApiError,
  ENROLLMENT_LABEL,
  fetchProducerReportPdf,
  getProducerReport,
  PRIORITY_LABEL,
  ProducerReport,
  STATUS_LABEL,
} from '@/lib/api';
import { formatArea, formatDate, formatDay, formatInt, formatMoney, todayIso } from '@/lib/format';
import styles from './relatorios.module.css';

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <Relatorios />
    </Suspense>
  );
}

function Relatorios() {
  const fromProducer = useSearchParams().get('produtor');
  const [producerId, setProducerId] = useState<string | null>(fromProducer);
  const [from, setFrom] = useState(() => `${todayIso().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState<ProducerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const validPeriod = !!from && !!to && from <= to;

  // A prévia acompanha produtor e período.
  useEffect(() => {
    if (!producerId || !validPeriod) return;
    let alive = true;
    setLoading(true);
    getProducerReport(producerId, from, to)
      .then((r) => alive && (setReport(r), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Não foi possível montar o relatório.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [producerId, from, to, validPeriod]);

  async function download() {
    if (!producerId) return;
    setDownloading(true);
    try {
      const { blob, name } = await fetchProducerReportPdf(producerId, from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {fromProducer && (
        <Link href={`/produtores/${fromProducer}`} className="back">
          {report?.producer.name ?? 'Produtor'}
        </Link>
      )}
      <header className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p>Relatório de atendimento por produtor e período, em PDF. Cada PDF gerado fica registrado na auditoria.</p>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.who}>
          {report && producerId ? (
            <div className={form.chosen}>
              <div>
                <strong>{report.producer.name}</strong>
                <span className="muted">
                  {report.producer.community} · <span className="num">{report.producer.cpf}</span>
                </span>
              </div>
              <button type="button" className="btn-link" onClick={() => (setProducerId(null), setReport(null))}>
                Trocar produtor
              </button>
            </div>
          ) : (
            <ProducerSearch onPick={setProducerId} />
          )}
        </div>
        <label className="field">
          <span>De</span>
          <input className="input num" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>Até</span>
          <input className="input num" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={download}
          disabled={!report || !validPeriod || downloading || loading}
        >
          {downloading ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
      </div>

      {!validPeriod && <p className="alert">O fim do período não pode ser antes do início.</p>}
      {error && <p className="alert">{error}</p>}

      {!producerId && (
        <div className="table-wrap">
          <div className="empty">
            <strong>Escolha um produtor</strong>
            A prévia do relatório aparece aqui, com os mesmos números do PDF.
          </div>
        </div>
      )}

      {report && producerId && <Preview r={report} loading={loading} />}
    </>
  );
}

function Preview({ r, loading }: { r: ProducerReport; loading: boolean }) {
  return (
    <div className={loading ? styles.loading : undefined}>
      <h2 className={styles.title}>
        Prévia · <span className="num">{formatDay(r.period.from)}</span> a <span className="num">{formatDay(r.period.to)}</span>
      </h2>

      <section className={fig.figures} aria-label="Resumo do período">
        <div className={fig.figure}>
          <span className={fig.label}>Visitas</span>
          <strong className="num">{formatInt(r.totals.visits)}</strong>
        </div>
        <div className={fig.figure}>
          <span className={fig.label}>Solicitações abertas</span>
          <strong className="num">{formatInt(r.totals.requestsOpened)}</strong>
        </div>
        <div className={fig.figure}>
          <span className={fig.label}>Solicitações concluídas</span>
          <strong className="num">{formatInt(r.totals.requestsCompleted)}</strong>
        </div>
        <div className={fig.figure}>
          <span className={fig.label}>Entregas de programas</span>
          <strong className="num">{formatInt(r.totals.deliveries)}</strong>
          <span className={`${fig.note} num`}>{formatMoney(r.totals.deliveredValueCents)}</span>
        </div>
      </section>

      <div className={styles.sections}>
        <section>
          <h3>Visitas técnicas ({r.totals.visits})</h3>
          {r.visits.length === 0 ? (
            <p className="muted">Nenhuma visita no período.</p>
          ) : (
            <ol className={styles.visits}>
              {r.visits.map((v) => (
                <li key={v.id}>
                  <div className={styles.visitHead}>
                    <Link href={`/visitas/${v.id}`} className="num">
                      {formatDay(v.visitedOn)}
                    </Link>
                    <span className="muted">
                      {v.property ?? 'Sem propriedade'} · {v.technician}
                    </span>
                  </div>
                  {v.request && <p className={styles.small}>Atendeu à solicitação: {v.request}</p>}
                  <p>
                    <b>Diagnóstico.</b> {v.diagnosis}
                  </p>
                  <p>
                    <b>Plano de ação.</b> {v.actionPlan}
                  </p>
                  <p className={styles.small}>
                    Retorno: {v.returnOn ? formatDay(v.returnOn) : 'sem retorno previsto'} · Fotos: {v.photoCount} · Assinatura:{' '}
                    {v.hasSignature ? 'coletada' : 'não coletada'}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className={styles.side}>
          <section>
            <h3>Propriedades</h3>
            {r.properties.length === 0 ? (
              <p className="muted">Nenhuma cadastrada.</p>
            ) : (
              <ul>
                {r.properties.map((p) => (
                  <li key={p.name}>
                    {p.name} <span className="area">{formatArea(p.areaHa)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>Solicitações abertas no período ({r.totals.requestsOpened})</h3>
            {r.requests.length === 0 ? (
              <p className="muted">Nenhuma.</p>
            ) : (
              <ul>
                {r.requests.map((q, i) => (
                  <li key={i}>
                    {q.subject}
                    <span className={`muted ${styles.small}`}>
                      {' '}
                      · {formatDate(q.openedAt)} · {PRIORITY_LABEL[q.priority]} · {STATUS_LABEL[q.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>Programas</h3>
            {r.programs.length === 0 ? (
              <p className="muted">Sem inscrição em programas.</p>
            ) : (
              <ul>
                {r.programs.map((p) => (
                  <li key={p.name}>
                    {p.name} <span className="muted">· {ENROLLMENT_LABEL[p.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.deliveries.length > 0 && (
              <ul>
                {r.deliveries.map((d, i) => (
                  <li key={i} className="num">
                    {formatDay(d.deliveredOn)} · {formatInt(d.quantity)} {d.unit} · {formatMoney(d.valueCents)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
