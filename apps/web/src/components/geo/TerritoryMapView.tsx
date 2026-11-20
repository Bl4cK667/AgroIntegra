'use client';

// Mapa territorial (carregar via next/dynamic com { ssr: false }).

import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibreWorker';
import { TERRITORY_COLORS } from '@agrointegra/map-styles';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MapGL, { AttributionControl, Layer, NavigationControl, Popup, ScaleControl, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { WeatherCompact } from '@/components/clima/WeatherCompact';
import { formatDay } from '@/lib/format';
import type { TerritoryFeature, TerritoryMap } from '@/lib/geo';
import { bounds, formatHa } from '@/lib/geoMeasure';
import { MAP_CONFIG, mapStyle } from './mapConfig';
import styles from './geo.module.css';

const hasOpen = ['>', ['get', 'openRequests'], 0];
const POLY = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const POINT = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];

export default function TerritoryMapView({ data, height = 560 }: { data: TerritoryMap; height?: number }) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<{ feature: TerritoryFeature; lng: number; lat: number } | null>(null);

  // Enquadra o que está no mapa sempre que o filtro muda.
  useEffect(() => {
    setSelected(null);
    const b = bounds(data.features.map((f) => f.geometry));
    if (b && mapRef.current) mapRef.current.fitBounds(b, { padding: 48, maxZoom: 15, duration: 600 });
  }, [data]);

  function onClick(e: MapLayerMouseEvent) {
    const hit = e.features?.[0];
    if (!hit) return setSelected(null);
    const feature = data.features.find((f) => f.id === (hit.properties as { id?: string })?.id || f.id === hit.id);
    if (feature) setSelected({ feature, lng: e.lngLat.lng, lat: e.lngLat.lat });
  }

  // O painel lateral muda a largura do mapa: avisa a MapLibre para redesenhar no tamanho novo.
  const hasSelection = selected !== null;
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [hasSelection]);

  const initial = bounds(data.features.map((f) => f.geometry));
  // O id vai também em properties: a MapLibre só aceita ids numéricos na raiz da feature.
  const source = { ...data, features: data.features.map((f) => ({ ...f, properties: { ...f.properties, id: f.id } })) };
  const selectedId = selected?.feature.id ?? '';
  const isSelected = ['==', ['get', 'id'], selectedId];
  const p = selected?.feature.properties;

  return (
    <div className={styles.territory} data-selected={hasSelection || undefined}>
    <div className={styles.mapBox} style={{ height }}>
      <MapGL
        ref={mapRef}
        mapStyle={mapStyle() as never}
        initialViewState={
          initial
            ? { bounds: initial, fitBoundsOptions: { padding: 48, maxZoom: 15 } }
            : { longitude: MAP_CONFIG.center[0], latitude: MAP_CONFIG.center[1], zoom: MAP_CONFIG.zoom }
        }
        attributionControl={false}
        interactiveLayerIds={['territory-fill', 'territory-point']}
        onClick={onClick}
        cursor="pointer"
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact={false} />
        <Source id="territory" type="geojson" data={source as never}>
          <Layer
            id="territory-fill"
            type="fill"
            filter={POLY as never}
            paint={{ 'fill-color': ['case', hasOpen, TERRITORY_COLORS.withOpenRequests, TERRITORY_COLORS.demarcated] as never, 'fill-opacity': 0.25 }}
          />
          <Layer
            id="territory-outline"
            type="line"
            filter={POLY as never}
            paint={{ 'line-color': ['case', hasOpen, TERRITORY_COLORS.withOpenRequests, TERRITORY_COLORS.demarcated] as never, 'line-width': 2 }}
          />
          <Layer
            id="territory-point"
            type="circle"
            filter={POINT as never}
            paint={{
              'circle-color': ['case', hasOpen, TERRITORY_COLORS.withOpenRequests, TERRITORY_COLORS.pointOnly] as never,
              'circle-radius': 7,
              'circle-stroke-color': '#18211c',
              'circle-stroke-width': 1.5,
            }}
          />
          {/* Destaque da propriedade selecionada (contorno claro por cima). */}
          <Layer
            id="territory-selected-outline"
            type="line"
            filter={['all', POLY, isSelected] as never}
            paint={{ 'line-color': '#ffffff', 'line-width': 4 }}
          />
          <Layer
            id="territory-selected-point"
            type="circle"
            filter={['all', POINT, isSelected] as never}
            paint={{ 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 }}
          />
        </Source>
        {selected && (
          <Popup longitude={selected.lng} latitude={selected.lat} closeButton={false} closeOnClick={false} maxWidth="240px">
            <strong className={styles.popupName}>{selected.feature.properties.name}</strong>
          </Popup>
        )}
      </MapGL>
    </div>

      {selected && p && (
        <aside className={`card card-flush ${styles.selPanel}`} style={{ maxHeight: height }} aria-labelledby="sel-title">
          <div className="card-head">
            <h2 id="sel-title" className="card-title">{p.name}</h2>
            <button type="button" className={`btn btn-icon ${styles.selClose}`} onClick={() => setSelected(null)} aria-label="Fechar o painel da propriedade">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className={styles.selBody}>
            <dl className={styles.selFacts}>
              <div><dt>Produtor</dt><dd><Link href={`/produtores/${p.producerId}`}>{p.producerName}</Link></dd></div>
              <div><dt>Comunidade</dt><dd>{p.community} · {p.locality}</dd></div>
              {p.mainActivity && <div><dt>Produção</dt><dd>{p.mainActivity}</dd></div>}
              <div><dt>Área declarada</dt><dd className="num">{formatHa(p.declaredAreaHa)}</dd></div>
              <div><dt>Área demarcada</dt><dd>{p.calculatedAreaHa !== null ? <span className="num">{formatHa(p.calculatedAreaHa)}</span> : 'não demarcada'}</dd></div>
              <div><dt>Solicitações abertas</dt><dd className="num">{p.openRequests}</dd></div>
              <div><dt>Última visita</dt><dd>{p.lastVisitOn ? formatDay(p.lastVisitOn) : 'nenhuma'}</dd></div>
            </dl>
            <Link href={`/propriedades/${selected.feature.id}/mapa`} className={styles.selLink}>Abrir o mapa da propriedade</Link>

            <h3 className="section-bar">Previsão do tempo</h3>
            <WeatherCompact propertyId={selected.feature.id} />
          </div>
        </aside>
      )}
    </div>
  );
}
