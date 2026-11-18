import type { FeatureType } from '@agrointegra/map-styles';
import { API_URL, ApiError, getToken, request } from './api';

// Cliente do módulo geo (dono: João Pedro). Usa o `request` comum; nenhuma regra de permissão
// fica aqui: a API decide e devolve a mensagem em português.

export type { FeatureType };
export type Position = [number, number];
export type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] };
export type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: Position[][][] };
export type LineGeometry = { type: 'LineString'; coordinates: Position[] } | { type: 'MultiLineString'; coordinates: Position[][] };
export type PointGeometry = { type: 'Point'; coordinates: Position };
export type Geometry = PolygonGeometry | MultiPolygonGeometry | LineGeometry | PointGeometry;

export interface GeoFeature {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: {
    propertyId: string;
    featureType: FeatureType;
    name: string | null;
    areaHa: number | null;
    perimeterM: number | null;
    lengthM: number | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PropertySummary {
  id: string;
  name: string;
  locality: string;
  producer: { id: string; name: string };
  declaredAreaHa: number;
  calculatedAreaHa: number | null;
  calculatedPerimeterM: number | null;
  coordinates: { latitude: number; longitude: number } | null;
}

export interface PropertyFeatures {
  type: 'FeatureCollection';
  features: GeoFeature[];
  property: PropertySummary;
}

export interface FeatureVersion {
  version: number;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
  name: string | null;
  geometry: Geometry;
  areaHa: number | null;
  perimeterM: number | null;
  lengthM: number | null;
  changedAt: string;
  changedBy: { id: string; name: string };
}

export interface ValidationResult {
  valid: boolean;
  message: string | null;
  suggestion: MultiPolygonGeometry | LineGeometry | null;
}

export interface ImportItem {
  id?: string;
  type: FeatureType;
  name?: string | null;
  geometry: Geometry;
}

export interface ImportReportItem {
  index: number;
  featureType: string;
  name: string | null;
  status: 'ok' | 'invalid' | 'conflict';
  message: string | null;
  suggestion: Geometry | null;
  areaHa: number | null;
  perimeterM: number | null;
  lengthM: number | null;
  featureId: string | null;
}

export interface ImportReport {
  dryRun: boolean;
  property: { id: string; name: string };
  summary: { total: number; ok: number; invalid: number; conflict: number };
  items: ImportReportItem[];
}

export interface TerritoryFeature {
  type: 'Feature';
  id: string;
  geometry: MultiPolygonGeometry | PointGeometry;
  properties: {
    name: string;
    producerId: string;
    producerName: string;
    community: string;
    locality: string;
    mainActivity: string | null;
    declaredAreaHa: number;
    calculatedAreaHa: number | null;
    demarcated: boolean;
    openRequests: number;
    lastVisitOn: string | null;
  };
}

export interface TerritoryMap {
  type: 'FeatureCollection';
  features: TerritoryFeature[];
  meta: { count: number; truncated: boolean; limit: number; withoutLocation: number };
}

export interface TerritoryFilters {
  community?: string;
  mainActivity?: string;
  programId?: string;
  technicianId?: string;
  requestStatus?: string;
}

export interface TerritoryFilterOptions {
  communities: string[];
  mainActivities: string[];
  programs: { id: string; name: string }[];
  technicians: { id: string; name: string }[];
  requestStatuses: string[];
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const listFeatures = (propertyId: string) => request<PropertyFeatures>(`/properties/${propertyId}/features`);

export const createFeature = (propertyId: string, data: ImportItem) =>
  request<GeoFeature>(`/properties/${propertyId}/features`, { method: 'POST', ...json(data) });

export const updateFeature = (id: string, data: { name?: string | null; geometry?: Geometry; expectedVersion?: number }) =>
  request<GeoFeature>(`/features/${id}`, { method: 'PATCH', ...json(data) });

export const deleteFeature = (id: string) => request<{ id: string; deleted: true }>(`/features/${id}`, { method: 'DELETE' });

export const featureHistory = (id: string) => request<FeatureVersion[]>(`/features/${id}/history`);

export const validateGeometry = (type: FeatureType, geometry: Geometry) =>
  request<ValidationResult>('/features/validate', { method: 'POST', ...json({ type, geometry }) });

export const getTerritoryMap = (filters: TerritoryFilters) => {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return request<TerritoryMap>(`/properties/geojson${qs ? `?${qs}` : ''}`);
};

export const getTerritoryFilters = () => request<TerritoryFilterOptions>('/properties/geojson/filters');

// A importação devolve o relatório também quando falha (422): por isso não usa `request`.
export async function importFeatures(propertyId: string, features: ImportItem[], dryRun: boolean): Promise<ImportReport> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/properties/${propertyId}/features/import${dryRun ? '?dryRun=true' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ features }),
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as ImportReport;
  if (res.status === 422 && Array.isArray(body.items)) return { dryRun: false, property: { id: propertyId, name: '' }, summary: body.summary, items: body.items };
  const msg = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  throw new ApiError(res.status, msg ?? 'Não foi possível importar.');
}

export type ExportFormat = 'geojson' | 'kml' | 'kmz' | 'shp';

// Exportar exige o token: baixa como arquivo e entrega ao navegador.
export async function downloadExport(propertyId: string, format: ExportFormat) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/properties/${propertyId}/features/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Não foi possível exportar.');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `demarcacao.${format}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Perímetro no cadastro de propriedade ----------

export interface PerimeterDraft {
  /** perímetro já salvo (edição) */
  original: { id: string; version: number } | null;
  geometry: MultiPolygonGeometry | null;
  dirty: boolean;
}

export const emptyPerimeter = (): PerimeterDraft => ({ original: null, geometry: null, dirty: false });

/** Valida antes de salvar qualquer coisa: evita criar produtor/propriedade e falhar no desenho. */
export async function checkPerimeter(draft: PerimeterDraft): Promise<ValidationResult | null> {
  if (!draft.geometry || !draft.dirty) return null;
  const result = await validateGeometry('PERIMETER', draft.geometry);
  return result.valid ? null : result;
}

// UUID v4 no aparelho. crypto.randomUUID só existe em HTTPS/localhost; getRandomValues funciona sempre.
export function uuidv4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Cria, altera ou exclui o perímetro conforme o rascunho. O UUID é gerado aqui (pronto para offline). */
export async function savePerimeter(propertyId: string, draft: PerimeterDraft) {
  if (!draft.dirty) return;
  if (draft.geometry && !draft.original) {
    await createFeature(propertyId, { id: uuidv4(), type: 'PERIMETER', geometry: draft.geometry });
  } else if (draft.geometry && draft.original) {
    await updateFeature(draft.original.id, { geometry: draft.geometry, expectedVersion: draft.original.version });
  } else if (!draft.geometry && draft.original) {
    await deleteFeature(draft.original.id);
  }
}
