'use client';

// Editor de geometria sobre satélite (MapLibre + terra-draw). Carregar SEMPRE via next/dynamic com
// { ssr: false }: depende de window/WebGL. Use os wrappers (PerimeterField, páginas do módulo geo).

import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibreWorker';
import { FEATURE_STYLES, featureLayers, KIND_LABELS, type FeatureType, type GeometryKind } from '@agrointegra/map-styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { AttributionControl, GeolocateControl, Layer, NavigationControl, ScaleControl, Source, type LayerProps, type MapRef } from 'react-map-gl/maplibre';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { GeoFeature, Geometry, Position } from '@/lib/geo';
import { uuidv4 } from '@/lib/geo';
import { bounds, formatHa, formatMeters, previewAreaHa, previewLengthM } from '@/lib/geoMeasure';
import { MAP_CONFIG, mapStyle } from './mapConfig';
import styles from './geo.module.css';

const DRAW_MODE: Record<GeometryKind, 'polygon' | 'linestring' | 'point'> = { polygon: 'polygon', line: 'linestring', point: 'point' };

export interface GeometryEditorProps {
  kind: GeometryKind;
  featureType: FeatureType;
  value: Geometry | null;
  onChange: (geometry: Geometry | null) => void;
  /** outras feições da propriedade, só para referência visual */
  context?: GeoFeature[];
  height?: number;
  disabled?: boolean;
  /** só visualização: sem barra de ferramentas nem desenho */
  readOnly?: boolean;
}

type Tool = 'draw' | 'edit' | 'pan';

// Separa a geometria em peças editáveis pelo terra-draw (Polygon, LineString, Point).
function pieces(g: Geometry | null): { type: 'Polygon' | 'LineString' | 'Point'; coordinates: unknown }[] {
  if (!g) return [];
  if (g.type === 'MultiPolygon') return g.coordinates.map((c) => ({ type: 'Polygon' as const, coordinates: c }));
  if (g.type === 'MultiLineString') return g.coordinates.map((c) => ({ type: 'LineString' as const, coordinates: c }));
  return [g as { type: 'Polygon' | 'LineString' | 'Point'; coordinates: unknown }];
}

function assemble(kind: GeometryKind, features: GeoJSONStoreFeatures[], locked: Position[][][]): Geometry | null {
  if (kind === 'polygon') {
    const polys = [...features.map((f) => f.geometry.coordinates as Position[][]), ...locked];
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  if (kind === 'line') {
    const lines = features.map((f) => f.geometry.coordinates as Position[]);
    return lines.length ? { type: 'MultiLineString', coordinates: lines } : null;
  }
  const last = features[features.length - 1];
  return last ? { type: 'Point', coordinates: last.geometry.coordinates as Position } : null;
}

export default function GeometryEditor({ kind, featureType, value, onChange, context = [], height = 420, disabled, readOnly }: GeometryEditorProps) {
  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const emitted = useRef<Geometry | null>(value);
  const lockedRef = useRef<Position[][][]>([]);
  // true enquanto o próprio editor limpa/recarrega o terra-draw: o clear() dispara 'change'/'delete'
  // e, sem isto, emit() devolveria ao pai a geometria antiga (ou null) por cima do valor novo.
  const silentRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>('pan');
  // Polígonos com recorte (furo) que o terra-draw não aceita: desenhados numa camada própria.
  const [locked, setLocked] = useState<Position[][][]>([]);
  const lockedCount = locked.length;
  const [gps, setGps] = useState<number | null>(null);

  const style = FEATURE_STYLES[featureType];
  const drawMode = DRAW_MODE[kind];
  const color = style.color as HexColor;

  const contextData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: context.map((f) => ({ type: 'Feature' as const, id: f.id, geometry: f.geometry, properties: { featureType: f.properties.featureType } })),
    }),
    [context],
  );

  const lockedData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: locked.map((coordinates, i) => ({
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Polygon' as const, coordinates },
        properties: { featureType },
      })),
    }),
    [locked, featureType],
  );

  // Recalcula a geometria a partir do que está desenhado e avisa o pai.
  const emit = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || silentRef.current) return;
    const geomType = kind === 'polygon' ? 'Polygon' : kind === 'line' ? 'LineString' : 'Point';
    let features = draw.getSnapshot().filter((f) => f.properties.mode === drawMode && f.geometry.type === geomType);
    if (kind === 'point' && features.length > 1) {
      // Ponto: vale só o último marcado.
      draw.removeFeatures(features.slice(0, -1).map((f) => f.id!));
      features = features.slice(-1);
    }
    const g = assemble(kind, features, lockedRef.current);
    emitted.current = g;
    onChangeRef.current(g);
  }, [kind, drawMode]);

  // Carrega uma geometria vinda de fora (edição, arquivo importado, correção sugerida).
  const load = useCallback(
    (g: Geometry | null) => {
      const draw = drawRef.current;
      if (!draw) return;
      const feats = pieces(g).map(
        (p) => ({ id: uuidv4(), type: 'Feature', geometry: p, properties: { mode: drawMode } }) as GeoJSONStoreFeatures,
      );
      silentRef.current = true;
      let results: ReturnType<TerraDraw['addFeatures']> = [];
      try {
        draw.clear();
        results = feats.length ? draw.addFeatures(feats) : [];
      } finally {
        silentRef.current = false;
      }
      // Polígonos com recorte (furo) não são editáveis no terra-draw: ficam travados, mas continuam valendo.
      lockedRef.current = results
        .map((r, i) => (r.valid ? null : (feats[i].geometry.coordinates as Position[][])))
        .filter((x): x is Position[][] => x !== null && kind === 'polygon');
      setLocked(lockedRef.current);
      emitted.current = g;
    },
    [drawMode, kind],
  );

  // Cria o terra-draw depois que o mapa e as camadas de contexto existem (assim o desenho fica por cima).
  useEffect(() => {
    if (!loaded || !mapRef.current || readOnly) return;
    const map = mapRef.current.getMap();
    const noSelfIntersection = (feature: GeoJSONStoreFeatures, ctx: { updateType: string }) =>
      ctx.updateType === 'finish' || ctx.updateType === 'commit' ? ValidateNotSelfIntersecting(feature) : { valid: true };
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 7 }),
      modes: [
        new TerraDrawPolygonMode({
          validation: noSelfIntersection,
          styles: { fillColor: color, fillOpacity: 0.25, outlineColor: color, outlineWidth: 3, closingPointColor: color, closingPointWidth: 6 },
        }),
        new TerraDrawLineStringMode({ validation: noSelfIntersection, styles: { lineStringColor: color, lineStringWidth: 4 } }),
        new TerraDrawPointMode({ styles: { pointColor: color, pointWidth: 8, pointOutlineColor: '#18211c', pointOutlineWidth: 2 } }),
        new TerraDrawSelectMode({
          flags: {
            polygon: { feature: { draggable: true, validation: noSelfIntersection, coordinates: { midpoints: true, draggable: true, deletable: true } } },
            linestring: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
            point: { feature: { draggable: true } },
          },
          styles: { selectedPolygonColor: color, selectedPolygonOutlineColor: color, selectedLineStringColor: color, selectionPointColor: '#ffffff', midPointColor: color },
        }),
      ],
    });
    draw.start();
    drawRef.current = draw;
    load(value);
    draw.setMode('static');
    draw.on('finish', () => emit());
    draw.on('change', (_ids, type) => {
      if (type === 'delete') emit();
    });
    return () => {
      drawRef.current = null;
      // Ao sair da página, o react-map-gl pode destruir o mapa antes desta limpeza; aí o stop()
      // tentaria mexer em fontes que não existem mais e derrubaria a navegação. O mapa está sendo
      // descartado inteiro, então não sobra nada para limpar.
      try {
        draw.stop();
      } catch {
        /* mapa já removido */
      }
    };
    // value entra só na carga inicial; mudanças externas são tratadas no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, color, emit, load, readOnly]);

  // Valor trocado por fora (ex.: arquivo importado): recarrega o desenho e enquadra.
  useEffect(() => {
    if (!drawRef.current || value === emitted.current) return;
    load(value);
    const b = value ? bounds([value]) : null;
    if (b) mapRef.current?.fitBounds(b, { padding: 48, maxZoom: 17, duration: 600 });
  }, [value, load]);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    if (disabled) {
      draw.setMode('static');
      return;
    }
    draw.setMode(tool === 'draw' ? drawMode : tool === 'edit' ? 'select' : 'static');
  }, [tool, drawMode, disabled, loaded]);

  const initialBounds = useMemo(() => bounds([...(value ? [value] : []), ...context.map((f) => f.geometry)]), []); // eslint-disable-line react-hooks/exhaustive-deps

  function clearAll() {
    lockedRef.current = [];
    setLocked([]);
    silentRef.current = true;
    try {
      drawRef.current?.clear();
    } finally {
      silentRef.current = false;
    }
    emitted.current = null;
    onChangeRef.current(null);
    setTool('draw');
  }

  const areaHa = previewAreaHa(value);
  const lengthM = previewLengthM(value);
  const parts = pieces(value).length;

  return (
    <div className={styles.editor}>
      {!readOnly && (
      <div className={styles.toolbar} role="toolbar" aria-label="Ferramentas do mapa">
        <button type="button" className={`btn btn-secondary ${tool === 'draw' ? styles.active : ''}`} onClick={() => setTool('draw')} disabled={disabled} aria-pressed={tool === 'draw'}>
          {kind === 'point' ? 'Marcar ponto' : `Desenhar ${KIND_LABELS[kind]}`}
        </button>
        <button type="button" className={`btn btn-secondary ${tool === 'edit' ? styles.active : ''}`} onClick={() => setTool('edit')} disabled={disabled || !value} aria-pressed={tool === 'edit'}>
          Editar vértices
        </button>
        <button type="button" className={`btn btn-secondary ${tool === 'pan' ? styles.active : ''}`} onClick={() => setTool('pan')} disabled={disabled} aria-pressed={tool === 'pan'}>
          Mover mapa
        </button>
        <button type="button" className="btn-link" onClick={clearAll} disabled={disabled || !value}>
          Apagar desenho
        </button>
      </div>
      )}

      <div className={styles.mapBox} style={{ height }}>
        <MapGL
          ref={mapRef}
          mapStyle={mapStyle() as never}
          initialViewState={
            initialBounds
              ? { bounds: initialBounds, fitBoundsOptions: { padding: 48, maxZoom: 17 } }
              : { longitude: MAP_CONFIG.center[0], latitude: MAP_CONFIG.center[1], zoom: MAP_CONFIG.zoom }
          }
          attributionControl={false}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl
            position="top-right"
            positionOptions={{ enableHighAccuracy: true }}
            onGeolocate={(e) => setGps(e.coords.accuracy)}
          />
          <ScaleControl position="bottom-left" unit="metric" />
          <AttributionControl position="bottom-right" compact={false} />
          {context.length > 0 && (
            <Source id="context" type="geojson" data={contextData as never}>
              {featureLayers('context').map((l) => (
                <Layer key={l.id} {...(l as unknown as LayerProps)} />
              ))}
            </Source>
          )}
          {/* Sempre montada (mesmo vazia) para ficar abaixo das camadas do terra-draw, criadas depois do load. */}
          <Source id="locked" type="geojson" data={lockedData as never}>
            {featureLayers('locked').map((l) => (
              <Layer key={l.id} {...(l as unknown as LayerProps)} />
            ))}
          </Source>
        </MapGL>
      </div>

      {!readOnly && (<>
      <div className={styles.statusbar} aria-live="polite">
        {kind === 'polygon' && (
          <span>
            {areaHa !== null ? (
              <>Área desenhada: <strong className="num">{formatHa(areaHa)}</strong> <span className="muted">(prévia; o valor oficial é calculado ao salvar)</span></>
            ) : (
              <span className="muted">Nenhum polígono desenhado.</span>
            )}
            {parts > 1 && <span className="muted"> · {parts} partes</span>}
          </span>
        )}
        {kind === 'line' && <span>{lengthM !== null ? <>Comprimento: <strong className="num">{formatMeters(lengthM)}</strong></> : <span className="muted">Nenhuma linha desenhada.</span>}</span>}
        {kind === 'point' && <span>{value ? 'Ponto marcado.' : <span className="muted">Nenhum ponto marcado.</span>}</span>}
        {gps !== null && (
          <span className={gps > 10 ? styles.warn : 'muted'}>
            Precisão do GPS: {Math.round(gps)} m{gps > 10 ? ' — pior que 10 m: confira os vértices na imagem' : ''}
          </span>
        )}
        {lockedCount > 0 && <span className="muted">{lockedCount} polígono(s) com recorte: aparecem e são salvos, mas os vértices não são editáveis aqui.</span>}
      </div>

      <p className={styles.help}>
        {tool === 'draw' && kind === 'polygon' && 'Clique em cada canto da área sobre a imagem. Para fechar, clique no primeiro ponto ou dê dois cliques.'}
        {tool === 'draw' && kind === 'line' && 'Clique ao longo do traçado. Dê dois cliques para terminar a linha.'}
        {tool === 'draw' && kind === 'point' && 'Clique no mapa para marcar o ponto.'}
        {tool === 'edit' && 'Clique no desenho para selecionar. Arraste os vértices; arraste o ponto do meio de um lado para criar um vértice; clique com o botão direito num vértice para apagá-lo.'}
        {tool === 'pan' && 'Arraste para mover o mapa e use a roda do mouse (ou dois dedos) para aproximar.'}
      </p>
      </>)}
    </div>
  );
}
