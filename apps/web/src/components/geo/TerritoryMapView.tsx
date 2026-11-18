'use client';

// Mapa territorial (carregar via next/dynamic com { ssr: false }).

import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibreWorker';
import { TERRITORY_COLORS } from '@agrointegra/map-styles';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MapGL, { AttributionControl, Layer, NavigationControl, Popup, ScaleControl, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
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

  const initial = bounds(data.features.map((f) => f.geometry));
  // O id vai também em properties: a MapLibre só aceita ids numéricos na raiz da feature.
  const source = { ...data, features: data.features.map((f) => ({ ...f, properties: { ...f.properties, id: f.id } })) };

  return (
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
        </Source>
        {selected && (
          <Popup longitude={selected.lng} latitude={selected.lat} onClose={() => setSelected(null)} closeOnClick={false} maxWidth="300px">
            <div className={styles.popup}>
              <strong>{selected.feature.properties.name}</strong>
              <Link href={`/produtores/${selected.feature.properties.producerId}`}>{selected.feature.properties.producerName}</Link>
              <span>{selected.feature.properties.community} · {selected.feature.properties.locality}</span>
              {selected.feature.properties.mainActivity && <span>{selected.feature.properties.mainActivity}</span>}
              <span>
                Área declarada: <span className="num">{formatHa(selected.feature.properties.declaredAreaHa)}</span>
              </span>
              <span>
                Área demarcada:{' '}
                {selected.feature.properties.calculatedAreaHa !== null ? <span className="num">{formatHa(selected.feature.properties.calculatedAreaHa)}</span> : 'não demarcada'}
              </span>
              <span>Solicitações abertas: <span className="num">{selected.feature.properties.openRequests}</span></span>
              <span>Última visita: {selected.feature.properties.lastVisitOn ? formatDay(selected.feature.properties.lastVisitOn) : 'nenhuma'}</span>
              <Link href={`/propriedades/${selected.feature.id}/mapa`}>Abrir o mapa da propriedade</Link>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}
