// Cliente da API do AgroIntegra. A sessão da demo fica no navegador (sessionStorage).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Role = 'COORDINATION' | 'TECHNICIAN';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const ROLE_LABEL: Record<Role, string> = {
  COORDINATION: 'Coordenação',
  TECHNICIAN: 'Técnico',
};

const TOKEN_KEY = 'agrointegra.token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem armazenamento */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique se a API está rodando.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    throw new ApiError(res.status, msg ?? 'Erro inesperado.');
  }
  return body as T;
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const data = await request<{ accessToken: string; user: SessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  sessionStorage.setItem(TOKEN_KEY, data.accessToken);
  return data.user;
}

export function fetchMe() {
  return request<SessionUser>('/auth/me');
}

// ---------- Produtores e propriedades ----------

export interface Property {
  id: string;
  producerId: string;
  name: string;
  areaHa: number;
  locality: string;
  mainActivity: string | null;
  createdAt: string;
}

export interface ProducerSummary {
  id: string;
  name: string;
  cpf: string; // sempre mascarado pela API
  phone: string | null;
  community: string;
  consentAt: string | null;
  createdAt: string;
  propertyCount: number;
}

export interface ProducerDetail extends Omit<ProducerSummary, 'propertyCount'> {
  createdBy: { name: string };
  properties: Property[];
}

export interface PropertyRow extends Property {
  producer: { id: string; name: string };
}

const qs = (search?: string) => (search ? `?search=${encodeURIComponent(search)}` : '');

export const listProducers = (search?: string) =>
  request<{ items: ProducerSummary[]; total: number }>(`/producers${qs(search)}`);

export const getProducer = (id: string) => request<ProducerDetail>(`/producers/${id}`);

export const createProducer = (data: { name: string; cpf: string; phone?: string; community: string; consent: boolean }) =>
  request<ProducerSummary>('/producers', { method: 'POST', body: JSON.stringify(data) });

export const updateProducer = (id: string, data: { name?: string; phone?: string; community?: string }) =>
  request<ProducerSummary>(`/producers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const registerConsent = (id: string) =>
  request<ProducerSummary>(`/producers/${id}/consent`, { method: 'POST' });

export const addProperty = (
  producerId: string,
  data: { name: string; areaHa: number; locality: string; mainActivity?: string },
) => request<Property>(`/producers/${producerId}/properties`, { method: 'POST', body: JSON.stringify(data) });

export const listProperties = (search?: string) =>
  request<{ items: PropertyRow[]; total: number }>(`/properties${qs(search)}`);
