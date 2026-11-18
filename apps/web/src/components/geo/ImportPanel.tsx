'use client';

// Importação de KML/KMZ/Shapefile/GeoJSON para uma propriedade: lê no navegador, confere na API
// (dryRun, sem gravar) e só então grava tudo de uma vez.

import { FEATURE_STYLES, FEATURE_TYPES, type FeatureType, type GeometryKind } from '@agrointegra/map-styles';
import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { importFeatures, type Geometry, type ImportReportItem } from '@/lib/geo';
import { ACCEPTED_FILES, readGeoFile } from '@/lib/geoFiles';
import { formatHa, formatMeters } from '@/lib/geoMeasure';
import styles from './geo.module.css';

interface Row {
  include: boolean;
  layer: string;
  name: string;
  type: FeatureType;
  geometry: Geometry;
  report: ImportReportItem | null;
}

const kindOf = (g: Geometry): GeometryKind =>
  g.type === 'Point' ? 'point' : g.type === 'LineString' || g.type === 'MultiLineString' ? 'line' : 'polygon';

const DEFAULT_TYPE: Record<GeometryKind, FeatureType> = { polygon: 'PLOT', line: 'ROAD', point: 'IMPROVEMENT' };

const STATUS: Record<ImportReportItem['status'], string> = { ok: 'Pronta', invalid: 'Com problema', conflict: 'Conflito' };

export function ImportPanel({ propertyId, onImported, onClose }: { propertyId: string; onImported: (count: number) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setChecked(false);
    try {
      const items = await readGeoFile(file);
      setFileName(file.name);
      setRows(
        items.map((i) => {
          const kind = kindOf(i.geometry);
          const suggested = i.suggestedType && FEATURE_STYLES[i.suggestedType].kinds.includes(kind) ? i.suggestedType : DEFAULT_TYPE[kind];
          return { include: true, layer: i.layer, name: i.name ?? '', type: suggested, geometry: i.geometry, report: null };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  const update = (i: number, patch: Partial<Row>) => {
    setChecked(false);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch, report: null } : r)));
  };

  async function run(dryRun: boolean) {
    const chosen = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.include);
    if (!chosen.length) {
      setError('Marque pelo menos uma feição para importar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await importFeatures(
        propertyId,
        chosen.map(({ r }) => ({ type: r.type, name: r.name.trim() || null, geometry: r.geometry })),
        dryRun,
      );
      const byRow = new Map(report.items.map((item) => [chosen[item.index].i, item]));
      setRows((rs) => rs.map((r, i) => ({ ...r, report: byRow.get(i) ?? null })));
      setChecked(true);
      if (!dryRun && report.summary.ok === report.summary.total && report.items.every((it) => it.featureId)) {
        onImported(report.summary.total);
      } else if (!dryRun) {
        setError('Nada foi importado: corrija ou desmarque as feições com problema e confira de novo.');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível conferir o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  const included = rows.filter((r) => r.include);
  const allOk = checked && included.length > 0 && included.every((r) => r.report?.status === 'ok');

  return (
    <div className={`card ${styles.panel}`}>
      <div className={styles.perimeterHead}>
        <div>
          <h3 className={styles.perimeterTitle}>Importar arquivo</h3>
          <p className="muted">KML, KMZ, Shapefile (.zip com .shp, .shx, .dbf e .prj) ou GeoJSON, como os baixados do CAR ou do SIGEF.</p>
        </div>
        <button type="button" className="btn-link" onClick={onClose}>Fechar</button>
      </div>
      <input ref={input} type="file" accept={ACCEPTED_FILES} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <div>
        <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy}>
          {fileName ? 'Escolher outro arquivo' : 'Escolher arquivo'}
        </button>
        {fileName && <span className="muted"> {fileName}: {rows.length} feição(ões)</span>}
      </div>
      {error && <p role="alert" className="alert">{error}</p>}

      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className={styles.report}>
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const kind = kindOf(r.geometry);
                  return (
                    <tr key={i}>
                      <td>
                        <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} aria-label={`Importar feição ${i + 1}`} />
                      </td>
                      <td>
                        <select className="input" value={r.type} onChange={(e) => update(i, { type: e.target.value as FeatureType })} disabled={!r.include}>
                          {FEATURE_TYPES.filter((t) => FEATURE_STYLES[t].kinds.includes(kind)).map((t) => (
                            <option key={t} value={t}>{FEATURE_STYLES[t].label}</option>
                          ))}
                        </select>
                        <div className="muted">{r.layer}</div>
                      </td>
                      <td>
                        <input className="input" value={r.name} maxLength={120} onChange={(e) => update(i, { name: e.target.value })} disabled={!r.include} placeholder="Sem nome" />
                      </td>
                      <td>
                        {!r.include ? (
                          <span className="muted">Não será importada</span>
                        ) : !r.report ? (
                          <span className="muted">Ainda não conferida</span>
                        ) : (
                          <>
                            <span className={`badge ${r.report.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>{STATUS[r.report.status]}</span>
                            {r.report.areaHa !== null && <div className="num">{formatHa(r.report.areaHa)}</div>}
                            {r.report.lengthM !== null && <div className="num">{formatMeters(r.report.lengthM)}</div>}
                            {r.report.message && <div>{r.report.message}</div>}
                            {r.report.suggestion && (
                              <button type="button" className="btn-link" onClick={() => update(i, { geometry: r.report!.suggestion! })}>
                                Aplicar a correção sugerida
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => run(true)} disabled={busy}>
              {busy && !allOk ? 'Conferindo…' : 'Conferir'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => run(false)} disabled={busy || !allOk}>
              {busy && allOk ? 'Importando…' : `Importar ${included.length} feição(ões)`}
            </button>
          </div>
          {!allOk && <p className="muted">Confira antes de importar. Só dá para importar quando todas as feições marcadas estiverem prontas.</p>}
        </>
      )}
    </div>
  );
}
