'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCoord } from '@/lib/format';
import styles from './visit.module.css';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const ERRORS: Record<number, string> = {
  1: 'O navegador não tem permissão para usar a localização.',
  2: 'O aparelho não conseguiu obter a localização.',
  3: 'A localização demorou demais. Tente de novo ao ar livre.',
};

// Registra as coordenadas do aparelho no momento da visita. Sem mapa (fica para o piloto).
export function LocationField({ value, onChange }: { value: Location | null; onChange: (v: Location | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  function capture() {
    if (!('geolocation' in navigator)) {
      setError('Este navegador não informa a localização.');
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return;
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setBusy(false);
      },
      (err) => {
        if (!alive.current) return;
        setError(ERRORS[err.code] ?? 'Não foi possível obter a localização.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <div className="field">
      <span>
        Localização <span className={styles.optional}>opcional</span>
      </span>
      {value ? (
        <div className={styles.location}>
          <span className="num">
            {formatCoord(value.latitude)}, {formatCoord(value.longitude)}
          </span>
          {value.accuracy != null && <span className="muted num">precisão de {value.accuracy} m</span>}
          <button type="button" className="btn-link" onClick={() => onChange(null)}>
            Remover
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={capture} disabled={busy} style={{ justifySelf: 'start' }}>
          {busy ? 'Obtendo localização…' : 'Registrar localização atual'}
        </button>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
