'use client';

// Mapa da propriedade (módulo geo): todas as feições (perímetro, talhões, APP, reserva legal, sede,
// benfeitorias, água, estradas), edição uma a uma, histórico, importação e exportação.

import { FEATURE_STYLES, FEATURE_TYPES, KIND_LABELS, type FeatureType, type GeometryKind } from '@agrointegra/map-styles';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WeatherCard } from '@/components/clima/WeatherCard';
import { FieldHeading, FieldLoading } from '@/components/property/FieldUI';
import { Toast } from '@/components/feedback/Toast';
import { ImportPanel } from '@/components/geo/ImportPanel';
import styles from '@/components/geo/geo.module.css';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  createFeature,
  deleteFeature,
  downloadExport,
  featureHistory,
  listFeatures,
  updateFeature,
  uuidv4,
  validateGeometry,
  type ExportFormat,
  type FeatureVersion,
  type GeoFeature,
  type Geometry,
  type PropertyFeatures,
} from '@/lib/geo';
import { formatHa, formatMeters } from '@/lib/geoMeasure';

const GeometryEditor = dynamic(() => import('@/components/geo/GeometryEditor'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Carregando mapa…</div>,
});

type Editing =
  | { mode: 'view' }
  | { mode: 'edit'; feature: GeoFeature; geometry: Geometry | null; name: string }
  | { mode: 'new'; type: FeatureType; kind: GeometryKind; geometry: Geometry | null; name: string };

const kindOf = (g: Geometry): GeometryKind =>
  g.type === 'Point' ? 'point' : g.type === 'LineString' || g.type === 'MultiLineString' ? 'line' : 'polygon';

const CHANGE_LABEL: Record<FeatureVersion['change'], string> = { CREATED: 'Criada', UPDATED: 'Alterada', DELETED: 'Excluída' };

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: 'shp', label: 'Shapefile (CAR/SICAR)' },
  { format: 'kml', label: 'KML' },
  { format: 'kmz', label: 'KMZ' },
  { format: 'geojson', label: 'GeoJSON' },
];

function measure(f: GeoFeature) {
  const p = f.properties;
  if (p.areaHa !== null) return formatHa(p.areaHa);
  if (p.lengthM !== null) return formatMeters(p.lengthM);
  return 'ponto';
}

export default function MapaDaPropriedadePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PropertyFeatures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>({ mode: 'view' });
  const [newType, setNewType] = useState<FeatureType>('PLOT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [history, setHistory] = useState<FeatureVersion[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const load = useCallback(() => {
    listFeatures(id)
      .then((fc) => (setData(fc), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o mapa da propriedade.'));
  }, [id]);
  useEffect(load, [load]);

  const features = data?.features ?? [];
  const hasPerimeter = features.some((f) => f.properties.featureType === 'PERIMETER');
  const currentId = editing.mode === 'edit' ? editing.feature.id : null;
  const context = useMemo(() => features.filter((f) => f.id !== currentId), [features, currentId]);

  useEffect(() => {
    setHistory(null);
    setFormError(null);
    if (editing.mode !== 'edit') return;
    featureHistory(editing.feature.id).then(setHistory).catch(() => setHistory([]));
  }, [editing.mode, currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNew(type: FeatureType) {
    if (type === 'PERIMETER' && hasPerimeter) {
      setFormError('A propriedade já tem perímetro. Edite o atual na lista.');
      return;
    }
    const kinds = FEATURE_STYLES[type].kinds;
    setEditing({ mode: 'new', type, kind: kinds[0], geometry: null, name: '' });
  }

  async function save() {
    if (editing.mode === 'view') return;
    if (!editing.geometry) {
      setFormError('Desenhe a feição no mapa antes de salvar.');
      return;
    }
    const type = editing.mode === 'edit' ? editing.feature.properties.featureType : editing.type;
    setSaving(true);
    setFormError(null);
    try {
      const check = await validateGeometry(type, editing.geometry);
      if (!check.valid) {
        setFormError(check.message);
        if (check.suggestion) setEditing({ ...editing, geometry: check.suggestion as Geometry });
        return;
      }
      if (editing.mode === 'new') {
        await createFeature(id, { id: uuidv4(), type, name: editing.name.trim() || null, geometry: editing.geometry });
        setSuccess(`${FEATURE_STYLES[type].label} salvo(a).`);
      } else {
        await updateFeature(editing.feature.id, {
          name: editing.name.trim() || null,
          geometry: editing.geometry,
          expectedVersion: editing.feature.properties.version,
        });
        setSuccess('Alterações salvas. Uma nova versão entrou no histórico.');
      }
      setEditing({ mode: 'view' });
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: GeoFeature) {
    const label = f.properties.name ?? FEATURE_STYLES[f.properties.featureType].label;
    if (!window.confirm(`Excluir "${label}"? Ela sai do mapa, mas continua no histórico.`)) return;
    setSaving(true);
    setFormError(null);
    try {
      await deleteFeature(f.id);
      setSuccess(`"${label}" excluída.`);
      setEditing({ mode: 'view' });
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
    } finally {
      setSaving(false);
    }
  }

  async function onExport(format: ExportFormat) {
    setExporting(format);
    setFormError(null);
    try {
      await downloadExport(id, format);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Não foi possível exportar.');
    } finally {
      setExporting(null);
    }
  }

  if (error && !data) {
    return (
      <>
        <Link href="/propriedades" className="back">Propriedades</Link>
        <p className="alert">{error}</p>
      </>
    );
  }
  if (!data) return <FieldLoading />;

  const p = data.property;
  const editorKey = editing.mode === 'edit' ? `edit-${editing.feature.id}` : editing.mode === 'new' ? `new-${editing.type}-${editing.kind}` : 'view';

  return (
    <>
      <Link href={`/produtores/${p.producer.id}`} className="back">{p.producer.name}</Link>
      <FieldHeading eyebrow="Mapa da propriedade" title={p.name} description={`${p.producer.name} · ${p.locality}`} />
      <Toast message={success} onClose={() => setSuccess(null)} />

      <div className={styles.mapPage}>
        <dl className={`card ${styles.stats}`}>
          <div><dt>Área declarada</dt><dd className="num">{formatHa(p.declaredAreaHa)}</dd></div>
          <div><dt>Área demarcada</dt><dd className="num">{p.calculatedAreaHa !== null ? formatHa(p.calculatedAreaHa) : '—'}</dd></div>
          <div><dt>Perímetro</dt><dd className="num">{p.calculatedPerimeterM !== null ? formatMeters(p.calculatedPerimeterM) : '—'}</dd></div>
          {p.calculatedAreaHa !== null && (
            <div>
              <dt>Diferença</dt>
              <dd className="num">{(((p.calculatedAreaHa - p.declaredAreaHa) / p.declaredAreaHa) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'always' })}%</dd>
            </div>
          )}
          <div><dt>Feições</dt><dd className="num">{features.length}</dd></div>
        </dl>

        <div className={styles.split}>
          <div className={styles.panel}>
            {editing.mode === 'view' ? (
              <GeometryEditor key={editorKey} kind="polygon" featureType="PERIMETER" value={null} onChange={() => undefined} context={features} height={520} readOnly />
            ) : (
              <GeometryEditor
                key={editorKey}
                kind={editing.mode === 'edit' ? kindOf(editing.feature.geometry) : editing.kind}
                featureType={editing.mode === 'edit' ? editing.feature.properties.featureType : editing.type}
                value={editing.geometry}
                onChange={(g) => setEditing({ ...editing, geometry: g })}
                context={context}
                height={520}
                disabled={saving}
              />
            )}
            <div className={styles.legend}>
              {FEATURE_TYPES.map((t) => (
                <span key={t}><span className={styles.swatch} style={{ background: FEATURE_STYLES[t].color }} />{FEATURE_STYLES[t].label}</span>
              ))}
            </div>
          </div>

          <aside className={styles.panel}>
            {formError && <p role="alert" className="alert">{formError}</p>}

            {editing.mode !== 'view' ? (
              <div className={`card ${styles.panel}`}>
                <h3 className={styles.perimeterTitle}>
                  {editing.mode === 'new' ? `Nova feição: ${FEATURE_STYLES[editing.type].label}` : `Editando: ${FEATURE_STYLES[editing.feature.properties.featureType].label}`}
                </h3>
                {editing.mode === 'new' && FEATURE_STYLES[editing.type].kinds.length > 1 && (
                  <label className="field">
                    <span>Desenhar como</span>
                    <select className="input" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as GeometryKind, geometry: null })}>
                      {FEATURE_STYLES[editing.type].kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Nome</span>
                  <input className="input" value={editing.name} maxLength={120} placeholder="Ex.: Talhão 1, Açude grande" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </label>
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing({ mode: 'view' })} disabled={saving}>Cancelar</button>
                  {editing.mode === 'edit' && (
                    <button type="button" className="btn-link" onClick={() => remove(editing.feature)} disabled={saving}>Excluir</button>
                  )}
                </div>
                {editing.mode === 'edit' && (
                  <div>
                    <h4 className={styles.perimeterTitle}>Histórico</h4>
                    {!history ? (
                      <p className="muted">Carregando…</p>
                    ) : (
                      <ol className={styles.history}>
                        {history.map((h) => (
                          <li key={h.version}>
                            <strong>v{h.version}</strong> · {CHANGE_LABEL[h.change]} por {h.changedBy.name} em <span className="num">{formatDate(h.changedAt)}</span>
                            {h.areaHa !== null && <> · <span className="num">{formatHa(h.areaHa)}</span></>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            ) : importing ? (
              <ImportPanel
                propertyId={id}
                onClose={() => setImporting(false)}
                onImported={(n) => {
                  setImporting(false);
                  setSuccess(`${n} feição(ões) importada(s).`);
                  load();
                }}
              />
            ) : (
              <>
                <div className={`card ${styles.panel}`}>
                  <h3 className={styles.perimeterTitle}>Feições</h3>
                  {features.length === 0 ? (
                    <p className="muted">Nada demarcado ainda. Comece pelo perímetro ou importe o arquivo do CAR.</p>
                  ) : (
                    <ul className={styles.featureList}>
                      {features.map((f) => (
                        <li key={f.id} className={styles.featureItem}>
                          <span className={styles.swatch} style={{ background: FEATURE_STYLES[f.properties.featureType].color }} />
                          <span>
                            {f.properties.name ?? FEATURE_STYLES[f.properties.featureType].label}
                            <div className={styles.featureMeta}>{FEATURE_STYLES[f.properties.featureType].label} · <span className="num">{measure(f)}</span> · v{f.properties.version}</div>
                          </span>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setEditing({ mode: 'edit', feature: f, geometry: f.geometry, name: f.properties.name ?? '' })}
                          >
                            Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="form-row">
                    <label className="field">
                      <span>Adicionar</span>
                      <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as FeatureType)}>
                        {FEATURE_TYPES.filter((t) => t !== 'PERIMETER' || !hasPerimeter).map((t) => (
                          <option key={t} value={t}>{FEATURE_STYLES[t].label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-primary" onClick={() => startNew(newType)}>Desenhar</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Importar arquivo</button>
                  </div>
                </div>

                <div className={`card ${styles.panel}`}>
                  <h3 className={styles.perimeterTitle}>Exportar</h3>
                  <p className="muted">
                    Shapefile em SIRGAS 2000, um arquivo por tema (área do imóvel, APP, reserva legal...), para importar no SICAR. É apoio
                    técnico: não substitui o cadastro oficial.
                  </p>
                  <div className={styles.toolbar}>
                    {EXPORTS.map((e) => (
                      <button key={e.format} type="button" className="btn btn-secondary" onClick={() => onExport(e.format)} disabled={!features.length || exporting !== null}>
                        {exporting === e.format ? 'Gerando…' : e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>

        {/* Módulo clima: previsão do município (INMET) e do ponto da propriedade (Open-Meteo, quando ligado). */}
        <WeatherCard propertyId={id} />
      </div>
    </>
  );
}
