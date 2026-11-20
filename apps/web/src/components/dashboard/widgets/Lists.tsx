'use client';

// Widgets do painel no padrão de referência (docs/design-system.md): "Situação geral" em linhas
// e listas em tabela. Os números vêm de GET /dashboard; as listas, das rotas que já existem
// (/requests e /visits), sem nada fixo.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PriorityTag } from '@/components/request/PriorityTag';
import { listRequests, listVisits, STATUS_LABEL, type ServiceRequest, type VisitRow } from '@/lib/api';
import { formatDate, formatDay, todayIso } from '@/lib/format';
import type { WidgetProps } from '../types';
import { Empty, number } from './Widgets';
import s from './widgets.module.css';

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

// ---------- Situação geral ----------

interface Row {
  label: string;
  value: number | string;
  href?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}

export function Overview({ data }: WidgetProps) {
  const monthVisits = data.visitsByMonth[data.month - 1] ?? 0;
  const coverage = pct(data.producersServed, data.producersTotal);
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Produtores',
      rows: [
        { label: 'Cadastrados', value: data.producersTotal, href: '/produtores' },
        { label: `Atendidos em ${data.year}`, value: data.producersServed, tone: 'success' },
        { label: 'Aguardando a primeira visita do ano', value: Math.max(0, data.producersTotal - data.producersServed), tone: 'warning' },
      ],
    },
    {
      title: 'Demandas',
      rows: [
        { label: 'Em aberto', value: data.openRequests, href: '/solicitacoes' },
        { label: 'Novas', value: data.openByStatus.NEW },
        { label: 'Em análise', value: data.openByStatus.IN_REVIEW, tone: 'warning' },
        { label: 'Agendadas', value: data.openByStatus.SCHEDULED, tone: 'info' },
        { label: 'Alta prioridade em aberto', value: data.highPriorityOpen, tone: 'danger' },
        { label: 'Concluídas no mês', value: data.completedThisMonth, tone: 'success' },
      ],
    },
    {
      title: 'Visitas',
      rows: [
        { label: `No ano (${data.year})`, value: data.visitsThisYear, href: '/visitas' },
        { label: 'No mês', value: monthVisits },
        { label: 'Comunidades atendidas no ano', value: data.visitsByCommunity.length },
      ],
    },
  ];

  return (
    <div className={s.overview}>
      <div className={s.coverageLine}>
        <span>Cobertura de produtores</span>
        <strong className="num">{coverage}%</strong>
        <span className={s.coverageTrack} role="img" aria-label={`${coverage}% dos produtores atendidos em ${data.year}`}>
          <i style={{ width: `${coverage}%` }} />
        </span>
      </div>
      {groups.map((g) => (
        <section key={g.title} className={s.overviewGroup} aria-label={g.title}>
          <h3>{g.title}</h3>
          <dl>
            {g.rows.map((r) => (
              <div key={r.label} className={s.overviewRow} data-tone={r.tone}>
                <dt>{r.label}</dt>
                <dd className="num">
                  {r.href ? <Link href={r.href}>{typeof r.value === 'number' ? number.format(r.value) : r.value}</Link> : typeof r.value === 'number' ? number.format(r.value) : r.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// ---------- Dados das listas (uma busca por carregamento do painel) ----------

// Dois widgets usam as solicitações: a busca é feita uma vez e reaproveitada por 30 s.
const MAX_AGE = 30_000;
// A API devolve uma página de itens e o total geral: o rodapé usa o total, não o tamanho da página.
type Page = { items: unknown[]; total: number };
const cache = new Map<string, { at: number; promise: Promise<Page> }>();
const LOADERS: Record<'requests' | 'visits', () => Promise<Page>> = {
  requests: () => listRequests({ open: true }),
  visits: () => listVisits(),
};

function load(kind: 'requests' | 'visits') {
  const hit = cache.get(kind);
  if (hit && Date.now() - hit.at < MAX_AGE) return hit.promise;
  const promise = LOADERS[kind]();
  cache.set(kind, { at: Date.now(), promise });
  promise.catch(() => cache.get(kind)?.promise === promise && cache.delete(kind)); // falhou: a próxima montagem tenta de novo
  return promise;
}

function useList<T>(kind: 'requests' | 'visits') {
  const [page, setPage] = useState<{ items: T[]; total: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    load(kind)
      .then((p) => alive && setPage(p as { items: T[]; total: number }))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [kind]);
  return { items: page?.items ?? null, total: page?.total ?? 0, error };
}

// Quantas linhas cabem no widget: altura da linha da grade menos a faixa de título e o rodapé.
const rowsFor = (h: number) => Math.max(2, Math.floor((h * 84 + (h - 1) * 16 - 38 - 34 - 32) / 34));

function ListState({ error, loading }: { error: boolean; loading: boolean }) {
  if (error) return <p className={s.listNote} role="alert">Não foi possível carregar a lista.</p>;
  if (loading) return <p className={s.listNote}>Carregando…</p>;
  return null;
}

function ListFoot({ shown, total, href, label }: { shown: number; total: number; href: string; label: string }) {
  return (
    <div className={`table-foot ${s.listFoot}`}>
      <span>
        Mostrando {number.format(shown)} de {number.format(total)}
      </span>
      <Link href={href}>{label}</Link>
    </div>
  );
}

// ---------- Alta prioridade em aberto ----------

export function HighPriority({ size }: WidgetProps) {
  const { items, error } = useList<ServiceRequest>('requests');
  if (!items) return <ListState error={error} loading={!error} />;
  const list = items
    .filter((r) => r.priority === 'HIGH' && r.status !== 'DONE')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!list.length) return <Empty>Nenhuma solicitação de alta prioridade em aberto.</Empty>;
  const shown = list.slice(0, rowsFor(size.h));
  return (
    <div className={s.listBody}>
      <div className={s.listScroll}>
        <table className="table">
          <thead>
            <tr>
              <th>Assunto</th>
              <th>Produtor</th>
              <th>Situação</th>
              <th className="hide-sm">Aberta em</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="clip">{r.subject}</td>
                <td className="nowrap">
                  <Link href={`/produtores/${r.producer.id}`}>{r.producer.name}</Link>
                </td>
                <td className="nowrap">
                  <span className={r.status === 'SCHEDULED' ? 'badge badge-info' : r.status === 'IN_REVIEW' ? 'badge badge-warning' : 'badge badge-neutral'}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="hide-sm num nowrap muted">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListFoot shown={shown.length} total={list.length} href="/solicitacoes" label="Ver solicitações" />
    </div>
  );
}

// ---------- Próximas visitas agendadas ----------

export function Upcoming({ size }: WidgetProps) {
  const { items, error } = useList<ServiceRequest>('requests');
  if (!items) return <ListState error={error} loading={!error} />;
  const today = todayIso();
  const list = items
    .filter((r) => r.status === 'SCHEDULED' && r.scheduledFor && r.scheduledFor >= today)
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '') || a.createdAt.localeCompare(b.createdAt));
  if (!list.length) return <Empty>Nenhuma visita agendada a partir de hoje.</Empty>;
  const shown = list.slice(0, rowsFor(size.h));
  return (
    <div className={s.listBody}>
      <div className={s.listScroll}>
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Produtor</th>
              <th>Assunto</th>
              <th>Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="num nowrap">{r.scheduledFor === today ? <strong>Hoje</strong> : formatDay(r.scheduledFor!)}</td>
                <td className="nowrap">
                  <Link href={`/produtores/${r.producer.id}`}>{r.producer.name}</Link>
                </td>
                <td className="clip">{r.subject}</td>
                <td className="nowrap"><PriorityTag priority={r.priority} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListFoot shown={shown.length} total={list.length} href="/solicitacoes" label="Ver solicitações" />
    </div>
  );
}

// ---------- Últimas visitas ----------

export function RecentVisits({ size }: WidgetProps) {
  const { items, total, error } = useList<VisitRow>('visits');
  if (!items) return <ListState error={error} loading={!error} />;
  const list = [...items].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
  if (!list.length) return <Empty>As visitas registradas aparecem aqui.</Empty>;
  const shown = list.slice(0, rowsFor(size.h));
  const all = Math.max(total, list.length);
  return (
    <div className={s.listBody}>
      <div className={s.listScroll}>
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Produtor</th>
              <th className="hide-sm">Propriedade</th>
              <th>Técnico</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td className="num nowrap">
                  <Link href={`/visitas/${v.id}`}>{formatDay(v.visitedOn)}</Link>
                </td>
                <td className="nowrap">{v.producer.name}</td>
                <td className="hide-sm clip">{v.property?.name ?? <span className="muted">—</span>}</td>
                <td className="nowrap">{v.technician.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListFoot shown={shown.length} total={all} href="/visitas" label="Ver visitas" />
    </div>
  );
}
