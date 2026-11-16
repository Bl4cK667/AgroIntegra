'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import styles from './quadro.module.css';

// Concluídas mostram só as mais recentes, para o quadro não crescer sem fim.
const DONE_LIMIT = 8;

export default function SolicitacoesPage() {
  const [items, setItems] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<RequestStatus | null>(null);

  const load = useCallback(() => {
    listRequests()
      .then((d) => (setItems(d.items), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as solicitações.'));
  }, []);

  useEffect(load, [load]);

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

  const move = (r: ServiceRequest, status: RequestStatus, scheduledFor?: string) =>
    r.status === status && !scheduledFor
      ? undefined
      : apply(r.id, () => moveRequest(r.id, status, scheduledFor), { status, ...(scheduledFor ? { scheduledFor } : {}) });

  const prioritize = (r: ServiceRequest, priority: RequestPriority) =>
    apply(r.id, () => setRequestPriority(r.id, priority), { priority });

  const columns = STATUS_ORDER.map((status) => {
    let list = (items ?? []).filter((r) => r.status === status);
    if (status === 'DONE') {
      list = list.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    } else {
      list = list.sort(
        (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.createdAt.localeCompare(b.createdAt),
      );
    }
    return { status, total: list.length, list: status === 'DONE' ? list.slice(0, DONE_LIMIT) : list };
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Solicitações</h1>
          <p>Pedidos de atendimento dos produtores, da chegada à visita.</p>
        </div>
        <Link href="/solicitacoes/nova" className="btn btn-primary">
          Nova solicitação
        </Link>
      </header>

      {error && <p className="alert">{error}</p>}
      {!items && !error && <p className="muted">Carregando…</p>}

      {items && (
        <div className={styles.board}>
          {columns.map((col) => (
            <section
              key={col.status}
              className={`${styles.column} ${over === col.status ? styles.dropTarget : ''}`}
              aria-label={STATUS_LABEL[col.status]}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(col.status);
              }}
              onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const r = items.find((x) => x.id === dragging);
                if (r) move(r, col.status);
                setDragging(null);
                setOver(null);
              }}
            >
              <header className={styles.columnHead}>
                <h2>{STATUS_LABEL[col.status]}</h2>
                <span className="num">{col.total}</span>
              </header>

              {col.list.length === 0 ? (
                <p className={styles.columnEmpty}>Nenhuma</p>
              ) : (
                <ul className={styles.cards}>
                  {col.list.map((r) => (
                    <li
                      key={r.id}
                      className={`${styles.card} ${dragging === r.id ? styles.dragging : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragging(r.id);
                      }}
                      onDragEnd={() => (setDragging(null), setOver(null))}
                    >
                      <button
                        type="button"
                        className={styles.cardMain}
                        aria-expanded={open === r.id}
                        onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                      >
                        <span className={styles.cardTop}>
                          <PriorityTag priority={r.priority} />
                          {r.status === 'SCHEDULED' && r.scheduledFor && (
                            <span className={`${styles.when} num`}>{formatDay(r.scheduledFor)}</span>
                          )}
                          {r.status === 'DONE' && r.completedAt && (
                            <span className={`${styles.when} num`}>{formatDate(r.completedAt)}</span>
                          )}
                        </span>
                        <strong className={styles.subject}>{r.subject}</strong>
                        <span className={styles.who}>
                          {r.producer.name} · {r.producer.community}
                        </span>
                      </button>

                      {open === r.id && <CardDetail r={r} onMove={move} onPriority={prioritize} />}
                    </li>
                  ))}
                </ul>
              )}
              {col.total > col.list.length && (
                <p className={styles.columnEmpty}>
                  Mostrando as {col.list.length} mais recentes de {col.total}.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function CardDetail({
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
      </div>

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
