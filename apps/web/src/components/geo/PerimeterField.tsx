'use client';

// Campo "Demarcação do perímetro" para formulários de propriedade (cadastro do produtor,
// nova propriedade, edição). O pai guarda o rascunho (PerimeterDraft) e salva com savePerimeter().

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  listFeatures,
  validateGeometry,
  type GeoFeature,
  type Geometry,
  type MultiPolygonGeometry,
  type PerimeterDraft,
  type ValidationResult,
} from '@/lib/geo';
import { ACCEPTED_FILES, polygonsOf, readGeoFile } from '@/lib/geoFiles';
import { formatHa, previewAreaHa, toMultiPolygon } from '@/lib/geoMeasure';
import styles from './geo.module.css';

const GeometryEditor = dynamic(() => import('./GeometryEditor'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Carregando mapa…</div>,
});

interface Props {
  /** propriedade já salva: carrega o perímetro atual para editar */
  propertyId?: string;
  value: PerimeterDraft;
  onChange: (draft: PerimeterDraft) => void;
  /** preenche a área declarada com a área desenhada */
  onUseArea?: (ha: number) => void;
  disabled?: boolean;
}

export function PerimeterField({ propertyId, value, onChange, onUseArea, disabled }: Props) {
  const [context, setContext] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [check, setCheck] = useState<ValidationResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Edição: busca o perímetro salvo e as demais feições (só para referência no mapa).
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    listFeatures(propertyId)
      .then((fc) => {
        if (cancelled) return;
        const perimeter = fc.features.find((f) => f.properties.featureType === 'PERIMETER');
        setContext(fc.features.filter((f) => f !== perimeter));
        onChange({
          original: perimeter ? { id: perimeter.id, version: perimeter.properties.version } : null,
          geometry: perimeter ? (perimeter.geometry as MultiPolygonGeometry) : null,
          dirty: false,
        });
      })
      .catch((e) => !cancelled && setLoadError(e instanceof ApiError ? e.message : 'Não foi possível carregar a demarcação.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Confere o desenho na API (auto-intersecção etc.) pouco depois de cada mudança.
  useEffect(() => {
    setCheck(null);
    if (!value.geometry || !value.dirty) return;
    const g = value.geometry;
    const t = setTimeout(() => {
      validateGeometry('PERIMETER', g)
        .then((r) => valueRef.current.geometry === g && setCheck(r.valid ? null : r))
        .catch(() => undefined); // sem conexão: a validação acontece de novo ao salvar
    }, 600);
    return () => clearTimeout(t);
  }, [value.geometry, value.dirty]);

  function setGeometry(geometry: Geometry | null) {
    onChange({ ...valueRef.current, geometry: (geometry as MultiPolygonGeometry | null) ?? null, dirty: true });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileMsg(null);
    try {
      const items = await readGeoFile(file);
      const polygons = items.filter((i) => i.geometry.type === 'Polygon' || i.geometry.type === 'MultiPolygon');
      if (!polygons.length) throw new Error('O arquivo não tem nenhum polígono para usar como perímetro.');
      // Preferência: camada/tipo de perímetro (ex.: AREA_IMOVEL do CAR). Senão, o único ou o maior polígono.
      const marked = polygons.filter((i) => i.suggestedType === 'PERIMETER');
      let chosen = marked.length ? marked : polygons;
      let note = '';
      if (!marked.length && polygons.length > 1) {
        const largest = polygons.reduce((a, b) => ((previewAreaHa(b.geometry) ?? 0) > (previewAreaHa(a.geometry) ?? 0) ? b : a));
        chosen = [largest];
        note = ` O arquivo tinha ${polygons.length} polígonos; usei o maior. Para importar os outros temas (APP, reserva legal...), use o mapa da propriedade.`;
      }
      const geometry = toMultiPolygon(polygonsOf(chosen.map((c) => c.geometry)));
      setGeometry(geometry);
      setFileMsg({ text: `Perímetro importado de "${file.name}".${note} Confira o desenho no mapa antes de salvar.`, error: false });
    } catch (e) {
      setFileMsg({ text: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.', error: true });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const areaHa = previewAreaHa(value.geometry);

  return (
    <section className={styles.perimeter} aria-labelledby="perimetro-titulo">
      <div className={styles.perimeterHead}>
        <div>
          <h3 id="perimetro-titulo" className={styles.perimeterTitle}>Demarcação do perímetro</h3>
          <p className="muted">
            Desenhe o contorno da propriedade sobre a imagem de satélite ou importe o arquivo do CAR (KML, KMZ ou Shapefile em .zip). Opcional:
            dá para demarcar depois.
          </p>
        </div>
        <div className={styles.perimeterActions}>
          <input ref={fileInput} type="file" accept={ACCEPTED_FILES} hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={disabled || loading}>
            Importar arquivo
          </button>
        </div>
      </div>

      {loadError && <p role="alert" className="alert">{loadError}</p>}
      {fileMsg && <p role={fileMsg.error ? 'alert' : 'status'} className={fileMsg.error ? 'alert' : styles.note}>{fileMsg.text}</p>}

      {loading ? (
        <div className={styles.mapLoading}>Carregando demarcação…</div>
      ) : (
        <GeometryEditor kind="polygon" featureType="PERIMETER" value={value.geometry} onChange={setGeometry} context={context} height={380} disabled={disabled} />
      )}

      {check && (
        <div role="alert" className="alert">
          {check.message}
          {check.suggestion && (
            <button type="button" className="btn-link" onClick={() => setGeometry(check.suggestion as Geometry)}>
              Aplicar a correção sugerida
            </button>
          )}
        </div>
      )}

      {onUseArea && areaHa !== null && (
        <button type="button" className="btn-link" onClick={() => onUseArea(Math.round(areaHa * 100) / 100)} disabled={disabled}>
          Usar a área desenhada ({formatHa(areaHa)}) como área declarada
        </button>
      )}
    </section>
  );
}
