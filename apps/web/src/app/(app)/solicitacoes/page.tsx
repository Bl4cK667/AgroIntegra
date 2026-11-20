'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Toast } from '@/components/feedback/Toast';
import { FieldHeading, FieldIcon, FieldLoading, FieldStats, fieldStyles as ui } from '@/components/property/FieldUI';
import { PriorityTag } from '@/components/request/PriorityTag';
import {
  ApiError,
  listRequests,
  moveRequest,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  RequestPriority,
  RequestStatus,
  ServiceRequest,
  setRequestPriority,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/lib/api';
import { formatDate, formatDay, todayIso } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import styles from './quadro.module.css';

const PAGE_SIZE = 20;

type StatusFilter = 'OPEN' | RequestStatus | 'ALL';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'OPEN', label: 'Em aberto' },
  ...STATUS_ORDER.map((s) => ({ key: s as StatusFilter, label: s === 'DONE' ? 'Concluídas' : STATUS_LABEL[s] })),
  { key: 'ALL', label: 'Todas' },
];

// Cor do badge de situação: concluída = sucesso, agendada = destaque, as demais neutras.
const STATUS_BADGE: Record<RequestStatus, string> = {
  NEW: 'badge badge-neutral',
  IN_REVIEW: 'badge badge-warning',
  SCHEDULED: 'badge badge-info',
  DONE: 'badge badge-success',
};

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function SolicitacoesPage() {
  const [items, setItems] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [filter, setFilter] = useState<RequestPriority | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const term = normalize(useDebounced(search.trim()));
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<string | null>(null);

  // Volta de "Nova solicitação" com ?salvo=1: confirma e limpa o endereço.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('salvo') !== '1') return;
    setSaved('Solicitação registrada com sucesso. Ela já está na lista, com a situação Nova.');
    url.searchParams.delete('salvo');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, []);

  const load = useCallback(() => {
    listRequests()
      .then((d) => (setItems(d.items), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as solicitações.'));
  }, []);

  useEffect(load, [load]);

  // Filtro mudou: volta para a primeira página.
  useEffect(() => setPage(1), [status, filter, term]);

  // Troca a solicitação na tela na hora e confirma com a API; se falhar, recarrega.
  async function apply(id: string, change: () => Promise<ServiceRequest>, optimistic: Partial<ServiceRequest>) {
    setItems((list) => list?.map((r) => (r.id === id ? { ...r, ...optimistic } : r)) ?? list);
    try {
      const saved = await change();
      setItems((list) => list?.map((r) => (r.id === id ? saved : r)) ?? list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar a mudança.');
      load();
    }
  }

  const move = (r: ServiceRequest, next: RequestStatus, scheduledFor?: string) =>
    r.status === next && !scheduledFor
      ? undefined
      : apply(r.id, () => moveRequest(r.id, next, scheduledFor), { status: next, ...(scheduledFor ? { scheduledFor } : {}) });

  const prioritize = (r: ServiceRequest, priority: RequestPriority) =>
    apply(r.id, () => setRequestPriority(r.id, priority), { priority });

  const openItems = (items ?? []).filter((r) => r.status !== 'DONE');

  // Em aberto: prioridade e depois a mais antiga. Concluídas: a mais recente primeiro. Todas: pela ordem do fluxo.
  const byPriority = (a: ServiceRequest, b: ServiceRequest) =>
    PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.createdAt.localeCompare(b.createdAt);
  const byDone = (a: ServiceRequest, b: ServiceRequest) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
  const rows = (items ?? [])
    .filter((r) => (status === 'ALL' ? true : status === 'OPEN' ? r.status !== 'DONE' : r.status === status))
    .filter((r) => filter === 'ALL' || r.priority === filter)
    .filter((r) => !term || normalize(`${r.subject} ${r.producer.name} ${r.producer.community}`).includes(term))
    .sort((a, b) =>
      a.status === 'DONE' && b.status === 'DONE'
        ? byDone(a, b)
        : STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byPriority(a, b),
    );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const first = rows.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;

  return (
    <>
      <FieldHeading
        icon="inbox"
        eyebrow="Fluxo de atendimento"
        title="Solicitações"
        description="Pedidos de atendimento dos produtores, da chegada à visita. Selecione uma linha para ver os detalhes e mudar a situação."
        actions={
          <Link href="/solicitacoes/nova" className="btn btn-primary">
            <FieldIcon name="plus" /> Nova solicitação
          </Link>
        }
      />

      {items && (
        <FieldStats
          items={[
            { label: 'Em aberto', value: openItems.length, icon: 'inbox', note: 'Novas, em análise e agendadas' },
            { label: 'Alta prioridade', value: openItems.filter((r) => r.priority === 'HIGH').length, icon: 'flag', note: 'Pedem atenção primeiro' },
            { label: 'Agendadas', value: openItems.filter((r) => r.status === 'SCHEDULED').length, icon: 'calendar', note: 'Com visita marcada' },
          ]}
        />
      )}

      <Toast message={saved} onClose={() => setSaved(null)} />

      <section className={`card enter ${ui.listCard}`} style={{ '--i': 4 } as React.CSSProperties}>
        <div className="toolbar">
          <div className={ui.search}>
            <FieldIcon name="search" />
            <input
              className="input"
              type="search"
              placeholder="Buscar por assunto, produtor ou comunidade"
              aria-label="Buscar por assunto, produtor ou comunidade"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {items && (
            <span className="count num">
              {rows.length} {rows.length === 1 ? 'solicitação' : 'solicitações'}
            </span>
          )}
        </div>

        <div className={styles.filters}>
          <div className="segmented" role="group" aria-label="Filtrar por situação">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Filtrar por prioridade">
            {(['ALL', ...PRIORITY_ORDER] as const).map((p) => (
              <button key={p} type="button" aria-pressed={filter === p} onClick={() => setFilter(p)}>
                {p === 'ALL' ? 'Todas as prioridades' : PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="alert" role="alert">{error}</p>}
        {!items && !error && <FieldLoading />}

        {items && (
          <div className="table-wrap">
            {rows.length === 0 ? (
              <div className="empty">
                <span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="inbox" /></span>
                <strong>Nenhuma solicitação encontrada</strong>
                {term || filter !== 'ALL' || status !== 'OPEN' ? 'Ajuste a busca ou os filtros.' : <Link href="/solicitacoes/nova">Registrar uma solicitação</Link>}
              </div>
            ) : (
              <table className={`table ${ui.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>Assunto</th>
                    <th>Produtor</th>
                    <th>Prioridade</th>
                    <th>Situação</th>
                    <th className="hide-sm">Data</th>
                    <th className="hide-sm">Aberta em</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const expanded = open === r.id;
                    const toggle = () => setOpen((o) => (o === r.id ? null : r.id));
                    return (
                      <Fragment key={r.id}>
                        <tr className={`clickable ${expanded ? styles.rowOpen : ''}`} onClick={toggle}>
                          <td data-label="Assunto">
                            <button
                              type="button"
                              className={styles.rowButton}
                              aria-expanded={expanded}
                              aria-controls={`req-${r.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle();
                              }}
                            >
                              {r.subject}
                            </button>
                          </td>
                          <td data-label="Produtor">
                            <span className={ui.person}>
                              <span className={ui.avatar} aria-hidden="true">
                                {r.producer.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('')}
                              </span>
                              <span>
                                {r.producer.name}
                                <small>{r.producer.community}</small>
                              </span>
                            </span>
                          </td>
                          <td data-label="Prioridade"><PriorityTag priority={r.priority} /></td>
                          <td data-label="Situação"><span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                          <td className="hide-sm num nowrap" data-label="Data">
                            {r.status === 'SCHEDULED' && r.scheduledFor
                              ? `Visita ${formatDay(r.scheduledFor)}`
                              : r.status === 'DONE' && r.completedAt
                                ? `Concluída ${formatDate(r.completedAt)}`
                                : <span className="muted">—</span>}
                          </td>
                          <td className="hide-sm num nowrap muted" data-label="Aberta em">{formatDate(r.createdAt)}</td>
                        </tr>
                        {expanded && (
                          <tr className={styles.detailRow}>
                            <td colSpan={6} id={`req-${r.id}`}>
                              <RequestDetail r={r} onMove={move} onPriority={prioritize} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
            {rows.length > 0 && (
              <div className="table-foot">
                <span>
                  Mostrando {first} a {first + visible.length - 1} de {rows.length}
                </span>
                {pages > 1 && (
                  <nav className="pager" aria-label="Páginas">
                    <button type="button" onClick={() => setPage(1)} disabled={current === 1}>Primeira</button>
                    <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1}>Anterior</button>
                    <button type="button" aria-current="page">{current} de {pages}</button>
                    <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages}>Seguinte</button>
                    <button type="button" onClick={() => setPage(pages)} disabled={current === pages}>Última</button>
                  </nav>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function RequestDetail({
  r,
  onMove,
  onPriority,
}: {
  r: ServiceRequest;
  onMove: (r: ServiceRequest, s: RequestStatus, scheduledFor?: string) => void;
  onPriority: (r: ServiceRequest, p: RequestPriority) => void;
}) {
  const [date, setDate] = useState(r.scheduledFor ?? '');

  return (
    <div className={styles.detail}>
      {r.description && <p className={styles.description}>{r.description}</p>}
      <dl className={styles.meta}>
        {r.property && (
          <div>
            <dt>Propriedade</dt>
            <dd>{r.property.name}</dd>
          </div>
        )}
        <div>
          <dt>Aberta em</dt>
          <dd>
            <span className="num">{formatDate(r.createdAt)}</span>, por {r.createdBy.name}
          </dd>
        </div>
        {r.visitCount > 0 && (
          <div>
            <dt>Visitas</dt>
            <dd className="num">{r.visitCount}</dd>
          </div>
        )}
      </dl>

      <div className={styles.controls}>
        <label className="field">
          <span>Situação</span>
          <select className="input" value={r.status} onChange={(e) => onMove(r, e.target.value as RequestStatus)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prioridade</span>
          <select className="input" value={r.priority} onChange={(e) => onPriority(r, e.target.value as RequestPriority)}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        {r.status === 'SCHEDULED' && (
          <form
            className={styles.schedule}
            onSubmit={(e) => {
              e.preventDefault();
              if (date) onMove(r, 'SCHEDULED', date);
            }}
          >
            <label className="field">
              <span>Data da visita</span>
              <input className="input num" type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-secondary" disabled={!date || date === r.scheduledFor}>
              Salvar data
            </button>
          </form>
        )}
      </div>

      <div className={styles.links}>
        {r.status !== 'DONE' && (
          <Link href={`/visitas/nova?produtor=${r.producer.id}&solicitacao=${r.id}`} className="btn btn-primary">
            Registrar visita
          </Link>
        )}
        <Link href={`/produtores/${r.producer.id}`}>Ver produtor</Link>
      </div>
    </div>
  );
}
