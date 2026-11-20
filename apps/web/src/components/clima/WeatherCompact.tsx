'use client';

// Previsão compacta da propriedade (módulo clima), para o painel lateral do mapa territorial.
// Mesmas regras do WeatherCard: fonte, local, data/hora do dado e crédito sempre visíveis;
// aviso de desatualizado quando a fonte falhou e o valor é o último válido.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatDay, formatFetchedAt, formatMm, formatTemp, getPropertyWeather, type Forecast, type PropertyWeather } from '@/lib/clima';
import { todayIso } from '@/lib/format';
import styles from './clima.module.css';

const NEXT_DAYS = 5;

function CompactForecast({ forecast }: { forecast: Forecast }) {
  const today = todayIso();
  const upcoming = forecast.days.filter((d) => d.date >= today);
  const [first, ...rest] = upcoming.length ? upcoming : forecast.days;
  if (!first) return null;
  // O INMET não traz chuva em mm nem probabilidade por dia: sem dado, a coluna não aparece.
  const hasRain = rest.some((d) => d.precipitationMm !== null || d.precipitationProbabilityPct !== null);
  const rain =(mm: number | null, pct: number | null) =>
    mm === null && pct === null ? null : `${mm !== null ? formatMm(mm) : ''}${mm !== null && pct !== null ? ' · ' : ''}${pct !== null ? `${pct}%` : ''}`;

  return (
    <section className={styles.compact} aria-label={`Previsão ${forecast.sourceLabel}`}>
      <header className={styles.compactHead}>
        <div>
          <strong>{forecast.place}</strong>
          <span className={styles.meta}>
            {forecast.sourceLabel} · dado de <span className="num">{formatFetchedAt(forecast.fetchedAt)}</span>
          </span>
        </div>
        {forecast.stale && <span className="badge badge-warning">Desatualizada</span>}
      </header>
      {forecast.warning && <p className={styles.staleNote}>{forecast.warning}</p>}

      <div className={styles.today}>
        <span className={styles.todayLabel}>{first.date === today ? 'Hoje' : formatDay(first.date)}</span>
        <span className={styles.todayTemps}>
          <strong className="num">{formatTemp(first.tempMaxC)}</strong>
          <span className="num">{formatTemp(first.tempMinC)}</span>
        </span>
        {first.summary && <span className={styles.todaySummary}>{first.summary}</span>}
        {rain(first.precipitationMm, first.precipitationProbabilityPct) && (
          <span className={styles.todayRain}>Chuva <span className="num">{rain(first.precipitationMm, first.precipitationProbabilityPct)}</span></span>
        )}
      </div>

      {rest.length > 0 && (
        <table className={`table ${styles.compactTable}`}>
          <caption className={styles.srOnly}>Próximos dias</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col" className="right">Máx.</th>
              <th scope="col" className="right">Mín.</th>
              {hasRain && <th scope="col" className="right">Chuva</th>}
            </tr>
          </thead>
          <tbody>
            {rest.slice(0, NEXT_DAYS).map((d) => (
              <tr key={d.date} title={d.summary ?? undefined}>
                <td className="nowrap">{formatDay(d.date)}</td>
                <td className="right num nowrap">{formatTemp(d.tempMaxC)}</td>
                <td className="right num nowrap muted">{formatTemp(d.tempMinC)}</td>
                {hasRain && <td className="right num nowrap">{rain(d.precipitationMm, d.precipitationProbabilityPct) ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.meta}>{forecast.attribution}</p>
    </section>
  );
}

export function WeatherCompact({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<PropertyWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trocar de propriedade descarta a resposta anterior: a previsão de uma nunca aparece na outra.
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

  if (error) return <p className={styles.staleNote} role="alert">{error}</p>;
  if (!data) return <p className="muted" role="status">Consultando a previsão…</p>;

  return (
    <div className={styles.compactWrap}>
      {data.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {data.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {data.forecasts.length === 0 && data.warnings.length === 0 && <p className="muted">Sem previsão disponível para esta propriedade.</p>}
      {data.forecasts.map((f) => <CompactForecast key={f.source} forecast={f} />)}
      <Link href={`/propriedades/${propertyId}/mapa`} className={styles.fullLink}>Previsão completa</Link>
    </div>
  );
}
