'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AppNotification,
  listNotifications,
  markAllRead,
  markRead,
  timeAgo,
  unreadCount,
} from '@/lib/notifications';
import s from './notifications.module.css';

const POLL_MS = 30_000;

// Sino com contador de não lidas + painel com o histórico.
// O contador é consultado a cada 30 s e sempre que a janela volta ao foco.
export function NotificationBell({ variant = 'sidebar' }: { variant?: 'sidebar' | 'mobile' }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(0); // muda a cada chegada nova, reinicia a animação do sino
  const last = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    try {
      const { unread: n } = await unreadCount();
      if (last.current !== null && n > last.current) setRing((r) => r + 1);
      last.current = n;
      setUnread(n);
    } catch {
      // sem conexão: tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return (
    <>
      <button
        type="button"
        className={`${s.bell} ${variant === 'mobile' ? s.bellMobile : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notificações: ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Notificações'}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tip="Notificações"
      >
        <svg key={ring} className={ring ? s.ringing : undefined} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.2 2.5 7H3.5c.7-.8 2.5-2.5 2.5-7z" />
          <path className={s.clapper} d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span key={`b${unread}`} className={s.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <Panel
            onClose={() => setOpen(false)}
            onUnread={(n) => {
              last.current = n;
              setUnread(n);
            }}
            onGo={(href) => {
              setOpen(false);
              router.push(href);
            }}
          />,
          document.body,
        )}
    </>
  );
}

function Panel({ onClose, onUnread, onGo }: { onClose: () => void; onUnread: (n: number) => void; onGo: (href: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(onClose, reduce ? 0 : 220);
  }, [onClose]);

  const load = useCallback(
    async (before?: string) => {
      try {
        const page = await listNotifications({ before, unread: filter === 'unread' });
        setItems((cur) => (before && cur ? [...cur, ...page.items] : page.items));
        setHasMore(page.hasMore);
        onUnread(page.unread);
        setError(null);
      } catch {
        setError('Não foi possível carregar as notificações.');
      }
    },
    [filter, onUnread],
  );

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  // Atualiza a lista aberta quando chegam avisos novos.
  useEffect(() => {
    const t = window.setInterval(() => load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [close]);

  async function open(n: AppNotification) {
    if (!n.readAt) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? cur);
      markRead(n.id).then((r) => onUnread(r.unread)).catch(() => undefined);
    }
    if (n.href) onGo(n.href);
  }

  async function readAll() {
    setItems((cur) => (filter === 'unread' ? [] : cur?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? cur));
    onUnread(0);
    await markAllRead().catch(() => load());
  }

  async function more() {
    if (!items?.length) return;
    setLoadingMore(true);
    await load(items[items.length - 1].createdAt);
    setLoadingMore(false);
  }

  const anyUnread = items?.some((n) => !n.readAt);

  return (
    <>
      <div className={s.backdrop} data-closing={closing || undefined} onClick={close} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        className={s.panel}
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
      >
        <span className={s.grabber} aria-hidden="true" />
        <header className={s.head}>
          <h2 id="notif-title">Notificações</h2>
          <button type="button" className={s.close} onClick={close} aria-label="Fechar notificações">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={s.toolbar}>
          <div className="segmented" role="group" aria-label="Mostrar">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              Todas
            </button>
            <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
              Não lidas
            </button>
          </div>
          <button type="button" className={s.readAll} onClick={readAll} disabled={!anyUnread}>
            Marcar todas como lidas
          </button>
        </div>

        <div className={s.list} aria-live="polite">
          {error && <p className="alert">{error}</p>}
          {!items && !error && (
            <div className={s.loading} role="status" aria-label="Carregando notificações">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`skeleton ${s.skeletonRow}`} />
              ))}
            </div>
          )}
          {items && items.length === 0 && (
            <div className={s.empty}>
              <span className={s.emptyIcon} aria-hidden="true">
                <TypeIcon type="EMPTY" />
              </span>
              <strong>{filter === 'unread' ? 'Tudo em dia' : 'Nenhuma notificação ainda'}</strong>
              <span>
                {filter === 'unread'
                  ? 'Você já leu todas as notificações.'
                  : 'Avisos sobre pedidos, visitas e cadastros aparecem aqui.'}
              </span>
            </div>
          )}
          {items && items.length > 0 && (
            <ul className={s.items}>
              {items.map((n, i) => (
                <li key={n.id} style={{ '--i': Math.min(i, 10) } as React.CSSProperties}>
                  <button type="button" className={s.item} data-unread={!n.readAt || undefined} data-type={n.type} onClick={() => open(n)}>
                    <span className={s.icon} aria-hidden="true">
                      <TypeIcon type={n.type} />
                    </span>
                    <span className={s.text}>
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                      <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
                    </span>
                    {!n.readAt && <span className={s.dot} aria-label="Não lida" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <button type="button" className={`btn btn-secondary ${s.more}`} onClick={more} disabled={loadingMore}>
              {loadingMore ? 'Carregando…' : 'Ver notificações mais antigas'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function TypeIcon({ type }: { type: string }) {
  const p = {
    REQUEST_CREATED: 'M4 13.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7M4 13.5h4.2l1.6 2.5h4.4l1.6-2.5H20V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 7v5m-2.2-2.2L12 12l2.2-2.2',
    REQUEST_URGENT: 'M12 3 2.5 20h19zM12 10v4.5M12 17.5v.01',
    REQUEST_SCHEDULED: 'M8 2.5v4m8-4v4M3.5 10h17M5.5 4.5h13a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z',
    REQUEST_DONE: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l2.7 2.7L16 9.8',
    VISIT_CREATED: 'M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21zM12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
    PRODUCER_CREATED: 'M15 19.5c-.5-3-2.6-5-5.5-5s-5 2-5.5 5M9.5 4.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4M19 8v6M16 11h6',
    EMPTY: 'M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.2 2.5 7H3.5c.7-.8 2.5-2.5 2.5-7zM10 20a2.2 2.2 0 0 0 4 0',
  }[type] ?? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.01';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}
