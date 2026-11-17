import { request } from './api';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  unread: number;
  hasMore: boolean;
}

export const listNotifications = (opts: { before?: string; unread?: boolean } = {}) => {
  const q = new URLSearchParams();
  if (opts.before) q.set('before', opts.before);
  if (opts.unread) q.set('unread', 'true');
  const qs = q.toString();
  return request<NotificationPage>(`/notifications${qs ? `?${qs}` : ''}`);
};

export const unreadCount = () => request<{ unread: number }>('/notifications/unread-count');

export const markRead = (id: string) => request<{ unread: number }>(`/notifications/${id}/read`, { method: 'PATCH' });

export const markAllRead = () => request<{ unread: number }>('/notifications/read-all', { method: 'PATCH' });

// "agora", "há 5 min", "há 2 h", "ontem", "12/11"
export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}
