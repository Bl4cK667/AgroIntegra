'use client';

import { useState } from 'react';
import { Coordinates, Property, PropertyLocationInput } from '@/lib/api';
import { formatCoord, formatPlace, mapUrl, parseCoord } from '@/lib/format';
import styles from './property.module.css';

export const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export interface LocationDraft {
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
}

const coordText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

export function locationDraft(p?: Property): LocationDraft {
  return {
    address: p?.address ?? '',
    city: p?.city ?? '',
    state: p?.state ?? '',
    latitude: coordText(p?.coordinates?.latitude),
    longitude: coordText(p?.coordinates?.longitude),
  };
}

// Converte o rascunho para a API. Devolve uma mensagem quando as coordenadas estão erradas.
export function locationInput(d: LocationDraft): PropertyLocationInput | string {
  const hasLat = d.latitude.trim() !== '';
  const hasLon = d.longitude.trim() !== '';
  let coordinates: Coordinates | null = null;
  if (hasLat || hasLon) {
    const latitude = parseCoord(d.latitude);
    const longitude = parseCoord(d.longitude);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return 'Informe latitude e longitude em graus decimais. Exemplo: -8,12345 e -36,65432';
    }
    coordinates = { latitude, longitude };
  }
  // Texto vazio vai como null: na edição, apaga o valor salvo.
  return { address: d.address.trim() || null, city: d.city.trim() || null, state: d.state || null, coordinates };
}

const GEO_ERRORS: Record<number, string> = {
  1: 'O navegador não tem permissão para usar a localização.',
  2: 'O aparelho não conseguiu obter a localização.',
  3: 'A localização demorou demais. Tente de novo ao ar livre.',
};

// Endereço, município, UF e coordenadas da propriedade. Tudo opcional; sem mapa na demo.
export function LocationFields({ value, onChange }: { value: LocationDraft; onChange: (v: LocationDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const set = (field: keyof LocationDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [field]: e.target.value });

  function useDevice() {
    if (!('geolocation' in navigator)) {
      setGeoError('Este navegador não informa a localização.');
      return;
    }
    setBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...value,
          latitude: coordText(Number(pos.coords.latitude.toFixed(6))),
          longitude: coordText(Number(pos.coords.longitude.toFixed(6))),
        });
        setBusy(false);
      },
      (err) => {
        setGeoError(GEO_ERRORS[err.code] ?? 'Não foi possível obter a localização.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  const lat = parseCoord(value.latitude);
  const lon = parseCoord(value.longitude);

  return (
    <fieldset className={styles.location}>
      <legend>
        Localização <span className="muted">opcional</span>
      </legend>
      <label className="field">
        <span>Endereço ou acesso</span>
        <input
          className="input"
          placeholder="Ex.: estrada vicinal, km 4, depois da escola"
          value={value.address}
          onChange={set('address')}
          maxLength={160}
        />
      </label>
      <div className={styles.placeRow}>
        <label className="field">
          <span>Município</span>
          <input className="input" value={value.city} onChange={set('city')} maxLength={80} />
        </label>
        <label className="field">
          <span>Estado</span>
          <select className="input" value={value.state} onChange={set('state')}>
            <option value="">—</option>
            {STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Latitude</span>
          <input className="input num" inputMode="decimal" placeholder="-8,12345" value={value.latitude} onChange={set('latitude')} />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input className="input num" inputMode="decimal" placeholder="-36,65432" value={value.longitude} onChange={set('longitude')} />
        </label>
      </div>
      <div className={styles.coordActions}>
        <button type="button" className="btn btn-secondary" onClick={useDevice} disabled={busy}>
          {busy ? 'Obtendo localização…' : 'Usar localização do aparelho'}
        </button>
        {lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (
          <a href={mapUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
            Conferir no mapa
          </a>
        )}
      </div>
      {geoError && <span className="field-error">{geoError}</span>}
    </fieldset>
  );
}

// Como a localização aparece nas tabelas: município/UF, endereço e o link para o mapa.
export function LocationSummary({ property }: { property: Property }) {
  const place = formatPlace(property.city, property.state);
  const c = property.coordinates;
  if (!place && !property.address && !c) return <span className="muted">Não informada</span>;
  return (
    <div className={styles.summary}>
      {place && <span>{place}</span>}
      {property.address && <span className="muted">{property.address}</span>}
      {c && (
        <a
          href={mapUrl(c.latitude, c.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="num"
          title="Abre o OpenStreetMap em outra aba"
        >
          {formatCoord(c.latitude)}, {formatCoord(c.longitude)} · ver no mapa
        </a>
      )}
    </div>
  );
}
