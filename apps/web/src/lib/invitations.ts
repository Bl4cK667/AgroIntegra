import { request, Role } from './api';

export interface InvitationSummary {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  registrationUrl: string;
}

export interface RegistrationInviteInfo {
  email: string;
  organizationName: string;
  expiresAt: string;
}

export type InvitationStatus = 'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED';

export function getInvitationStatus(item: InvitationSummary, now = Date.now()): InvitationStatus {
  if (item.revokedAt) return 'REVOKED';
  if (item.usedAt) return 'USED';
  if (new Date(item.expiresAt).getTime() <= now) return 'EXPIRED';
  return 'PENDING';
}

export function listInvitations(): Promise<{ items: InvitationSummary[] }> {
  return request<{ items: InvitationSummary[] }>('/invitations');
}

export function createInvitation(input: {
  email: string;
  role: Role;
  expiresInHours?: number;
}): Promise<CreatedInvitation> {
  return request<CreatedInvitation>('/invitations', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      ...(input.expiresInHours ? { expiresInHours: input.expiresInHours } : {}),
    }),
  });
}

export function revokeInvitation(id: string): Promise<void> {
  return request<void>(`/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function validateRegistrationToken(token: string): Promise<RegistrationInviteInfo> {
  return request<RegistrationInviteInfo>('/auth/registration', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function registerWithInvitation(input: {
  token: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      token: input.token,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      password: input.password,
    }),
  });
}
