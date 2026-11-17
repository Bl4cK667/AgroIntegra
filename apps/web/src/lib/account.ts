import { fetchImage, NavStyle, request, Role } from './api';

export const ACCOUNT_UPDATED_EVENT = 'agrointegra:account-updated';

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  jobTitle: string | null;
  avatarUpdatedAt: string | null;
  hasAvatar: boolean;
  navStyle: NavStyle;
  theme: string | null;
  createdAt: string;
}

export function getAccount(): Promise<AccountProfile> {
  return request<AccountProfile>('/account');
}

export function updateAccount(input: {
  name?: string;
  phone?: string;
  jobTitle?: string;
  navStyle?: NavStyle;
  theme?: string;
}): Promise<AccountProfile> {
  return request<AccountProfile>('/account', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function uploadAvatar(imageDataUrl: string): Promise<AccountProfile> {
  return request<AccountProfile>('/account/avatar', {
    method: 'PUT',
    body: JSON.stringify({ image: imageDataUrl }),
  });
}

export function removeAvatar(): Promise<AccountProfile> {
  return request<AccountProfile>('/account/avatar', {
    method: 'DELETE',
  });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/account/password', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchAvatarUrl(cacheKey?: string | null): Promise<string> {
  const query = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : '';
  return fetchImage(`/account/avatar${query}`);
}

export function notifyAccountUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT));
  }
}
