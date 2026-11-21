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
export function NotificationBell({ variant = 'sidebar' }: { variant?: 'sidebar' | 'mobile' | 'topbar' }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const last = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    try {
      const { unread: n } = await unreadCount();
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
        className={`${s.bell} ${variant === 'mobile' ? s.bellMobile : variant === 'topbar' ? s.bellTopbar : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notificações: ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Notificações'}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tip="Notificações"
      >
        <span className={s.bellLabel}>Avisos</span>
        {unread > 0 && (
          <span className={s.badge} aria-hidden="true">
            ({unread > 99 ? '99+' : unread})
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
          <button type="button" className={s.close} onClick={close}>
            Fechar
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
              <strong>{filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</strong>
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
                    <span className={s.text}>
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                      <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
                    </span>
                    {!n.readAt && <span className={s.unreadTag}>Não lida</span>}
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
