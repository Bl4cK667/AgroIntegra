// Cliente da API do AgroIntegra. A sessão da demo fica no navegador (sessionStorage).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Role = 'COORDINATION' | 'TECHNICIAN';
export type NavStyle = 'topbar' | 'sidebar';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** estilo de navegação salvo no perfil (padrão: topbar) */
  navStyle?: NavStyle;
  /** tema salvo na conta (Configurações → Aparência); null = nunca escolheu */
  theme?: string | null;
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

// Exportada para os clientes de cada módulo (lib/account.ts, lib/notifications.ts...).
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new ApiError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
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
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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
  address: string | null;
  city: string | null;
  state: string | null; // sigla da UF
  coordinates: Coordinates | null;
  createdAt: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Localização digitada. Na edição, null (ou texto vazio) apaga o valor salvo.
export interface PropertyLocationInput {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  coordinates?: Coordinates | null;
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
  visits: VisitRow[];
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
  data: { name: string; areaHa: number; locality: string; mainActivity?: string } & PropertyLocationInput,
) => request<Property>(`/producers/${producerId}/properties`, { method: 'POST', body: JSON.stringify(data) });

export const updateProperty = (
  id: string,
  data: { name?: string; areaHa?: number; locality?: string; mainActivity?: string } & PropertyLocationInput,
) => request<Property>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listProperties = (search?: string) =>
  request<{ items: PropertyRow[]; total: number }>(`/properties${qs(search)}`);

// ---------- Visitas ----------

export interface VisitRow {
  id: string;
  producer: { id: string; name: string };
  property: { id: string; name: string } | null;
  technician: { name: string };
  visitedOn: string; // AAAA-MM-DD
  returnOn: string | null;
  diagnosis: string;
  photoCount: number;
}

export interface VisitDetail {
  id: string;
  producer: { id: string; name: string };
  property: { id: string; name: string } | null;
  technician: { name: string };
  visitedOn: string;
  diagnosis: string;
  actionPlan: string;
  returnOn: string | null;
  impact: string | null;
  hasSignature: boolean;
  location: { latitude: number; longitude: number; accuracy: number | null } | null;
  photos: { id: string; position: number; mimeType: string }[];
  request: { id: string; subject: string } | null;
  createdAt: string;
}

export interface NewVisit {
  producerId: string;
  requestId?: string;
  propertyId?: string;
  visitedOn: string;
  diagnosis: string;
  actionPlan: string;
  returnOn?: string;
  impact?: string;
  photos?: string[]; // data URLs
  signature?: string; // data URL PNG
  location?: { latitude: number; longitude: number; accuracy?: number };
}

export const listVisits = (producerId?: string) =>
  request<{ items: VisitRow[]; total: number }>(`/visits${producerId ? `?producerId=${encodeURIComponent(producerId)}` : ''}`);

export const getVisit = (id: string) => request<VisitDetail>(`/visits/${id}`);

export const createVisit = (data: NewVisit) =>
  request<VisitDetail>('/visits', { method: 'POST', body: JSON.stringify(data) });

// Fotos e assinatura exigem o token, então não dá para usar a URL direto no <img>.
export async function fetchImage(path: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'Imagem indisponível.');
  return URL.createObjectURL(await res.blob());
}

// ---------- Solicitações ----------

export type RequestStatus = 'NEW' | 'IN_REVIEW' | 'SCHEDULED' | 'DONE';
export type RequestPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export const STATUS_ORDER: RequestStatus[] = ['NEW', 'IN_REVIEW', 'SCHEDULED', 'DONE'];
export const STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: 'Nova',
  IN_REVIEW: 'Em análise',
  SCHEDULED: 'Agendada',
  DONE: 'Concluída',
};
export const PRIORITY_ORDER: RequestPriority[] = ['HIGH', 'MEDIUM', 'LOW'];
export const PRIORITY_LABEL: Record<RequestPriority, string> = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

export interface ServiceRequest {
  id: string;
  producer: { id: string; name: string; community: string };
  property: { id: string; name: string } | null;
  subject: string;
  description: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  scheduledFor: string | null; // AAAA-MM-DD
  completedAt: string | null;
  createdBy: { name: string };
  createdAt: string;
  visitCount: number;
}

export const listRequests = (filter: { producerId?: string; open?: boolean } = {}) => {
  const q = new URLSearchParams();
  if (filter.producerId) q.set('producerId', filter.producerId);
  if (filter.open) q.set('open', 'true');
  const s = q.toString();
  return request<{ items: ServiceRequest[]; total: number }>(`/requests${s ? `?${s}` : ''}`);
};

export const createRequest = (data: {
  producerId: string;
  propertyId?: string;
  subject: string;
  description?: string;
  priority: RequestPriority;
}) => request<ServiceRequest>('/requests', { method: 'POST', body: JSON.stringify(data) });

export const moveRequest = (id: string, status: RequestStatus, scheduledFor?: string) =>
  request<ServiceRequest>(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, scheduledFor }) });

export const setRequestPriority = (id: string, priority: RequestPriority) =>
  request<ServiceRequest>(`/requests/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) });

// ---------- Painel ----------

export interface Dashboard {
  year: number;
  month: number;
  openRequests: number;
  openByStatus: { NEW: number; IN_REVIEW: number; SCHEDULED: number };
  highPriorityOpen: number;
  completedThisMonth: number;
  visitsThisYear: number;
  producersServed: number;
  producersTotal: number;
  visitsByMonth: number[];
  visitsByCommunity: { community: string; visits: number; producers: number }[];
}

export const getDashboard = () => request<Dashboard>('/dashboard');

// ---------- Programas (somente leitura) ----------

export type EnrollmentStatus = 'ENROLLED' | 'APPROVED' | 'REJECTED';
export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  ENROLLED: 'Inscrito',
  APPROVED: 'Beneficiário',
  REJECTED: 'Não aprovado',
};

export interface ProgramSummary {
  id: string;
  name: string;
  description: string;
  startsOn: string;
  endsOn: string;
  unit: string;
  unitSingular: string;
  slots: number;
  enrolled: number;
  approved: number;
  rejected: number;
  pending: number;
  openSlots: number;
  deliveryCount: number;
  goalQuantity: number;
  deliveredQuantity: number;
  physicalPercent: number;
  budgetCents: number;
  spentCents: number;
  financialPercent: number;
}

type ProducerRef = { id: string; name: string; community: string };

export interface ProgramDetail extends ProgramSummary {
  enrollments: { id: string; producer: ProducerRef; status: EnrollmentStatus; enrolledOn: string }[];
  deliveries: { id: string; producer: ProducerRef; deliveredOn: string; quantity: number; valueCents: number; note: string | null }[];
}

export const listPrograms = () => request<{ items: ProgramSummary[]; total: number }>('/programs');
export const getProgram = (id: string) => request<ProgramDetail>(`/programs/${id}`);

// ---------- Relatório do produtor ----------

export interface ProducerReport {
  period: { from: string; to: string };
  producer: { id: string; name: string; cpf: string; community: string; phone: string | null; consentAt: string | null };
  properties: { name: string; locality: string; areaHa: number; mainActivity: string | null }[];
  totals: { visits: number; requestsOpened: number; requestsCompleted: number; deliveries: number; deliveredValueCents: number };
  visits: {
    id: string;
    visitedOn: string;
    property: string | null;
    technician: string;
    request: string | null;
    diagnosis: string;
    actionPlan: string;
    returnOn: string | null;
    impact: string | null;
    photoCount: number;
    hasSignature: boolean;
    hasLocation: boolean;
  }[];
  requests: { subject: string; priority: RequestPriority; status: RequestStatus; openedAt: string; completedAt: string | null }[];
  programs: { name: string; status: EnrollmentStatus; enrolledOn: string }[];
  deliveries: { program: string; deliveredOn: string; quantity: number; unit: string; valueCents: number; note: string | null }[];
}

const periodQs = (from: string, to: string) => `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

export const getProducerReport = (producerId: string, from: string, to: string) =>
  request<ProducerReport>(`/reports/producer/${producerId}?${periodQs(from, to)}`);

// O PDF exige o token, então é baixado como arquivo e aberto pelo navegador.
export async function fetchProducerReportPdf(producerId: string, from: string, to: string) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/reports/producer/${producerId}/pdf?${periodQs(from, to)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Erro ao gerar o PDF.');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'relatorio.pdf';
  return { blob: await res.blob(), name };
}
