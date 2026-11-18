'use client';

// Previsão do tempo da propriedade (módulo clima). Mostra sempre a fonte, o local, a data/hora do dado
// e o crédito; se a fonte falhou, o último valor com aviso de desatualizado.

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatDay, formatFetchedAt, formatMm, formatTemp, getPropertyWeather, type Forecast, type PropertyWeather } from '@/lib/clima';
import styles from './clima.module.css';

const PERIOD_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' } as const;
const MAX_DAYS = 7;

function ForecastBlock({ forecast }: { forecast: Forecast }) {
  const [showAll, setShowAll] = useState(false);
  const days = showAll ? forecast.days : forecast.days.slice(0, MAX_DAYS);
  const hasRain = forecast.days.some((d) => d.precipitationMm !== null);
  const hasHumidity = forecast.days.some((d) => d.humidityMaxPct !== null);

  return (
    <section className={styles.block} aria-label={`Previsão ${forecast.sourceLabel}`}>
      <header className={styles.blockHead}>
        <div>
          <strong>{forecast.place}</strong>
          <span className={styles.meta}>
            {forecast.sourceLabel} · dado de <span className="num">{formatFetchedAt(forecast.fetchedAt)}</span>
          </span>
        </div>
        {forecast.stale && <span className="badge badge-warning">Desatualizada</span>}
      </header>
      {forecast.warning && <p className={styles.staleNote}>{forecast.warning}</p>}

      <div className={styles.days} role="list">
        {days.map((d) => (
          <div key={d.date} className={styles.day} role="listitem">
            <div className={styles.dayDate}>{formatDay(d.date)}</div>
            <div className={styles.temps}>
              <span className={styles.max}>{formatTemp(d.tempMaxC)}</span>
              <span className={styles.min}>{formatTemp(d.tempMinC)}</span>
            </div>
            {d.summary && <div className={styles.summary}>{d.summary}</div>}
            {hasRain && (
              <div className={styles.line}>
                Chuva <span className="num">{formatMm(d.precipitationMm)}</span>
                {d.precipitationProbabilityPct !== null && <span className="num"> · {d.precipitationProbabilityPct}%</span>}
              </div>
            )}
            {hasHumidity && d.humidityMinPct !== null && (
              <div className={styles.line}>
                Umidade <span className="num">{d.humidityMinPct}–{d.humidityMaxPct}%</span>
              </div>
            )}
            {(d.windIntensity || d.windMaxKmh !== null) && (
              <div className={styles.line}>
                {/* O INMET descreve a intensidade no plural ("Fracos", "Moderados"); o Open-Meteo dá a velocidade máxima do dia. */}
                {d.windIntensity ? (
                  `Ventos ${d.windIntensity.toLowerCase()}${d.windDirection ? ` (${d.windDirection})` : ''}`
                ) : (
                  <>Vento até <span className="num">{d.windMaxKmh?.toLocaleString('pt-BR')} km/h</span></>
                )}
              </div>
            )}
            {d.periods.length > 0 && (
              <details className={styles.periods}>
                <summary>Por período</summary>
                <ul>
                  {d.periods.map((p) => (
                    <li key={p.period}>
                      <strong>{PERIOD_LABEL[p.period]}:</strong> {p.summary ?? '—'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <footer className={styles.blockFoot}>
        <span className={styles.meta}>{forecast.attribution}</span>
        {forecast.days.length > MAX_DAYS && (
          <button type="button" className="btn-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? `Mostrar ${MAX_DAYS} dias` : `Mostrar os ${forecast.days.length} dias`}
          </button>
        )}
      </footer>
    </section>
  );
}

export function WeatherCard({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<PropertyWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getPropertyWeather(propertyId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a previsão do tempo.'));
    return () => {
      alive = false;
    };
  }, [propertyId]);

  return (
    <div className={`card ${styles.card}`}>
      <h3 className={styles.title}>Previsão do tempo</h3>
      {error ? (
        <p className={styles.staleNote} role="alert">{error}</p>
      ) : !data ? (
        <p className="muted">Consultando a previsão…</p>
      ) : (
        <>
          {data.warnings.length > 0 && (
            <ul className={styles.warnings}>
              {data.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          {data.forecasts.map((f) => <ForecastBlock key={f.source} forecast={f} />)}
        </>
      )}
    </div>
  );
}
