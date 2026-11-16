'use client';

import { useState } from 'react';
import styles from './MonthlyBars.module.css';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const W = 640;
const H = 220;
const PAD = { top: 22, right: 8, bottom: 32, left: 40 };
const GAP = 2; // espaço mínimo entre barras vizinhas

// Escala "redonda" para o eixo: 1, 2, 5, 10, 20, 50...
function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= v)! * pow;
  return step * 4;
}

// Barra com os cantos de cima arredondados (4 px) e a base reta, apoiada no eixo.
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// Visitas por mês do ano corrente. Série única: uma cor, sem legenda; o título diz o que é.
export function MonthlyBars({ values, currentMonth, year }: { values: number[]; currentMonth: number; year: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...values, 0));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / 12;
  const barW = Math.min(28, slot * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const peak = values.indexOf(Math.max(...values));

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`Visitas por mês em ${year}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? styles.base : styles.grid} />
            <text x={PAD.left - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {Number.isInteger(t) ? t : t.toFixed(1).replace('.', ',')}
            </text>
          </g>
        ))}

        {values.map((v, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const future = i + 1 > currentMonth;
          const h = Math.max(0, y(0) - y(v) - GAP / 2);
          return (
            <g key={i}>
              {v > 0 && (
                <path
                  d={barPath(cx - barW / 2, y(v), barW, h)}
                  className={hover === i ? styles.barHover : i + 1 === currentMonth ? styles.barCurrent : styles.bar}
                />
              )}
              {i === peak && v > 0 && hover !== i && (
                <text x={cx} y={y(v) - 6} textAnchor="middle" className={styles.value}>
                  {v}
                </text>
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className={i + 1 === currentMonth ? styles.monthCurrent : future ? styles.monthFuture : styles.month}
              >
                {MONTHS[i]}
              </text>
              {/* Área de toque maior que a barra, para o valor aparecer ao passar o mouse. */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`,
            top: `${(y(values[hover]) / H) * 100}%`,
          }}
          role="status"
        >
          <span>
            {MONTHS_FULL[hover]} de {year}
          </span>
          <strong className="num">
            {values[hover]} {values[hover] === 1 ? 'visita' : 'visitas'}
          </strong>
        </div>
      )}

      {/* Os mesmos números em tabela, para leitor de tela. */}
      <table className={styles.srOnly}>
        <caption>Visitas por mês em {year}</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <th scope="row">{MONTHS_FULL[i]}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
