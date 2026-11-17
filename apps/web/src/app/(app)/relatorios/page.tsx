'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import form from '@/components/form.module.css';
import { ProducerSearch } from '@/components/ProducerSearch';
import { FieldEmpty, FieldHeading, FieldLoading, FieldIcon, FieldStats, SectionTitle } from '@/components/property/FieldUI';
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
    <Suspense fallback={<FieldLoading />}>
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
  const today = todayIso();
  const presets = [
    { key: 'year', label: 'Este ano', from: `${today.slice(0, 4)}-01-01` },
    { key: 'month', label: 'Este mês', from: `${today.slice(0, 7)}-01` },
    { key: '90', label: 'Últimos 90 dias', from: daysAgo(90) },
  ];
  const preset = presets.find((p) => p.from === from && to === today)?.key;

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
      <FieldHeading
        icon="report"
        eyebrow="Prestação de contas"
        title="Relatórios"
        description="Relatório de atendimento por produtor e período, em PDF. Cada PDF gerado fica registrado na auditoria."
      />

      <section className={`card enter ${styles.builder}`} style={{ '--i': 1 } as React.CSSProperties} aria-label="Montar relatório">
        <SectionTitle
          icon="note"
          actions={
            <button type="button" className="btn btn-primary" onClick={download} disabled={!report || !validPeriod || downloading || loading}>
              {downloading ? <span className={styles.spinner} aria-hidden="true" /> : <FieldIcon name="download" />}
              {downloading ? 'Gerando PDF…' : 'Baixar PDF'}
            </button>
          }
        >
          Montar relatório
        </SectionTitle>

        <div className={styles.controls}>
          <div className={styles.step}>
            <span className={styles.stepNum} data-done={!!(report && producerId) || undefined}>1</span>
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
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum} data-done={validPeriod || undefined}>2</span>
            <div className={styles.period}>
              <span className={styles.stepLabel}>Período</span>
              <div className="segmented" role="group" aria-label="Atalhos de período">
                {presets.map((p) => (
                  <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => (setFrom(p.from), setTo(today))}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className={styles.dates}>
                <label className="field">
                  <span>De</span>
                  <input className="input num" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="field">
                  <span>Até</span>
                  <input className="input num" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!validPeriod && <p className="alert" role="alert">O fim do período não pode ser antes do início.</p>}
      {error && <p className="alert" role="alert">{error}</p>}

      {!producerId && (
        <div className="enter" style={{ '--i': 2 } as React.CSSProperties}>
          <FieldEmpty icon="report" title="Escolha um produtor">
            A prévia do relatório aparece aqui, com os mesmos números do PDF.
          </FieldEmpty>
        </div>
      )}

      {report && producerId && <Preview r={report} loading={loading} />}
    </>
  );
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Preview({ r, loading }: { r: ProducerReport; loading: boolean }) {
  return (
    <div className={`${styles.preview} ${loading ? styles.loading : ''}`} aria-busy={loading}>
      <div className={`${styles.paperHead} enter`} style={{ '--i': 2 } as React.CSSProperties}>
        <div>
          <span className="eyebrow">Prévia do PDF</span>
          <h2>{r.producer.name}</h2>
          <p className="muted">
            {r.producer.community} · <span className="num">{formatDay(r.period.from)}</span> a{' '}
            <span className="num">{formatDay(r.period.to)}</span>
          </p>
        </div>
        <span className="badge badge-success">Mesmos números do PDF</span>
      </div>

      <FieldStats
        items={[
          { label: 'Visitas', value: formatInt(r.totals.visits), icon: 'visit', note: 'atendimentos técnicos' },
          { label: 'Solicitações abertas', value: formatInt(r.totals.requestsOpened), icon: 'inbox', note: `${formatInt(r.totals.requestsCompleted)} concluídas` },
          { label: 'Entregas de programas', value: formatInt(r.totals.deliveries), icon: 'sprout', note: formatMoney(r.totals.deliveredValueCents) },
        ]}
      />

      <div className={styles.sections}>
        <section className="card enter" style={{ '--i': 5 } as React.CSSProperties}>
          <SectionTitle icon="visit" actions={<span className="badge badge-neutral num">{r.totals.visits}</span>}>
            Visitas técnicas
          </SectionTitle>
          {r.visits.length === 0 ? (
            <p className="muted">Nenhuma visita no período.</p>
          ) : (
            <ol className={styles.timeline}>
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
                  <div className={styles.tags}>
                    <span className="badge badge-neutral">
                      <FieldIcon name="calendar" /> {v.returnOn ? `Retorno ${formatDay(v.returnOn)}` : 'Sem retorno previsto'}
                    </span>
                    <span className="badge badge-neutral num">{v.photoCount} {v.photoCount === 1 ? 'foto' : 'fotos'}</span>
                    <span className={v.hasSignature ? 'badge badge-success' : 'badge badge-warning'}>
                      Assinatura {v.hasSignature ? 'coletada' : 'não coletada'}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className={styles.side}>
          <section className="card enter" style={{ '--i': 6 } as React.CSSProperties}>
            <SectionTitle icon="land">Propriedades</SectionTitle>
            {r.properties.length === 0 ? (
              <p className="muted">Nenhuma cadastrada.</p>
            ) : (
              <ul className={styles.list}>
                {r.properties.map((p) => (
                  <li key={p.name}>
                    <span>{p.name}</span> <span className="area num">{formatArea(p.areaHa)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card enter" style={{ '--i': 7 } as React.CSSProperties}>
            <SectionTitle icon="inbox" actions={<span className="badge badge-neutral num">{r.totals.requestsOpened}</span>}>
              Solicitações no período
            </SectionTitle>
            {r.requests.length === 0 ? (
              <p className="muted">Nenhuma.</p>
            ) : (
              <ul className={styles.list}>
                {r.requests.map((q, i) => (
                  <li key={i} className={styles.stack}>
                    <span>{q.subject}</span>
                    <span className={styles.small}>
                      {formatDate(q.openedAt)} · {PRIORITY_LABEL[q.priority]} · {STATUS_LABEL[q.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card enter" style={{ '--i': 8 } as React.CSSProperties}>
            <SectionTitle icon="sprout">Programas</SectionTitle>
            {r.programs.length === 0 ? (
              <p className="muted">Sem inscrição em programas.</p>
            ) : (
              <ul className={styles.list}>
                {r.programs.map((p) => (
                  <li key={p.name}>
                    <span>{p.name}</span>
                    <span className={p.status === 'APPROVED' ? 'badge badge-success' : 'badge badge-neutral'}>{ENROLLMENT_LABEL[p.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.deliveries.length > 0 && (
              <ul className={`${styles.list} ${styles.deliveries}`}>
                {r.deliveries.map((d, i) => (
                  <li key={i} className="num">
                    <span>{formatDay(d.deliveredOn)} · {formatInt(d.quantity)} {d.unit}</span>
                    <strong>{formatMoney(d.valueCents)}</strong>
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
