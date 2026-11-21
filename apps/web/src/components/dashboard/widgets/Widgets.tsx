'use client';

import { useId, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { WidgetProps } from '../types';
import { useCountUp } from './useCountUp';
import s from './widgets.module.css';

export const number = new Intl.NumberFormat('pt-BR');
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fullMonths = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ratio = (value: number, total: number) => total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0;
const pct = (value: number) => `${number.format(Math.round(value))}%`;
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className={s.empty}><strong>Sem dados no período</strong><span>{children}</span></div>;
}

export function Ring({ value, label, small = false }: { value: number; label: string; small?: boolean }) {
  const progress = ratio(value, 100);
  return <svg className={small ? s.miniRing : s.ring} viewBox="0 0 120 120" role="img" aria-label={label}>
    <circle cx="60" cy="60" r="49" className={s.ringTrack} />
    <circle cx="60" cy="60" r="49" pathLength="100" className={s.ringValue} strokeDasharray={`${progress} 100`} transform="rotate(-90 60 60)" />
    {!small && <><text x="60" y="59" textAnchor="middle" className={s.ringNumber}>{pct(progress)}</text><text x="60" y="77" textAnchor="middle" className={s.ringLabel}>de cobertura</text></>}
  </svg>;
}

export function Kpi({ data, size, kind }: WidgetProps & { kind: 'open' | 'completed' | 'visits' | 'producers' }) {
  const value = kind === 'open' ? data.openRequests : kind === 'completed' ? data.completedThisMonth : kind === 'visits' ? data.visitsThisYear : data.producersServed;
  const animated = useCountUp(value);
  const coverage = ratio(data.producersServed, data.producersTotal);
  return <div className={`${s.kpi} ${size.w < 3 ? s.compact : ''}`}>
    <div className={s.kpiMain}><strong className={s.kpiValue} aria-label={number.format(value)}><span aria-hidden="true">{number.format(animated)}</span></strong>
      {kind === 'producers' && <Ring small value={coverage} label={`${pct(coverage)} dos produtores atendidos`} />}
    </div>
    <div className={s.kpiNote}>{kind === 'open' ? <><span className={data.highPriorityOpen ? s.priority : s.badge}>{number.format(data.highPriorityOpen)} alta prioridade</span><span>aguardando atendimento</span></> : kind === 'completed' ? <><span className={s.badge}>{fullMonths[data.month - 1]}</span><span>solicitações encerradas</span></> : kind === 'visits' ? <><span className={s.badge}>{data.year}</span><span>atendimentos técnicos</span></> : <><span className={s.badge}>{pct(coverage)} de cobertura</span><span>de {number.format(data.producersTotal)} cadastrados</span></>}</div>
  </div>;
}

// As duas instâncias (cabeçalho e corpo) compartilham a preferência de visualização.
let chartMode: 'area' | 'bars' = 'area';
const modeListeners = new Set<() => void>();
const subscribe = (listener: () => void) => { modeListeners.add(listener); return () => { modeListeners.delete(listener); }; };
const snapshot = () => chartMode;
const serverSnapshot = () => 'area' as const;
function useChartMode() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
export function VisitsMode() {
  const mode = useChartMode();
  return <div className={s.segmented} role="group" aria-label="Visualização das visitas">{(['area', 'bars'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { chartMode = value; modeListeners.forEach(listener => listener()); }}>{value === 'area' ? 'Área' : 'Barras'}</button>)}</div>;
}

export function VisitsChart({ data, size }: WidgetProps) {
  const mode = useChartMode();
  const [active, setActive] = useState<number | null>(null);
  const gradient = `visits-${useId().replace(/:/g, '')}`;
  const elapsedMonths = Math.max(1, Math.min(12, data.month));
  const values = Array.from({ length: elapsedMonths }, (_, i) => Math.max(0, data.visitsByMonth[i] ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(...values, 1);
  const scale = Math.max(1, Math.ceil(maximum / 4)) * 4;
  const points = values.map((value, i) => ({ x: 44 + i * 44, y: 180 - value / scale * 152 }));
  // Controles horizontais mantêm a curva dentro dos valores de cada intervalo.
  const line = points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `C ${points[i - 1].x + 22} ${points[i - 1].y}, ${p.x - 22} ${p.y}, ${p.x} ${p.y}`).join(' ');
  const selected = Math.min(active ?? elapsedMonths - 1, elapsedMonths - 1);
  if (!total) return <Empty>As visitas registradas em {data.year} aparecerão aqui.</Empty>;
  return <div className={`${s.chartBody} ${size.h < 4 ? s.short : ''}`}>
    <div className={s.chartSummary}><div><strong>{number.format(total)}</strong><span> visitas em {data.year}</span></div><span className={s.chartReading} aria-live="polite">{months[selected]} · <b>{number.format(values[selected])}</b> visitas</span></div>
    <svg viewBox="0 0 560 215" className={s.chart} role="img" aria-label={`Visitas por mês em ${data.year}: ${values.map((value, i) => `${fullMonths[i]}: ${value}`).join('; ')}`} onPointerLeave={() => setActive(null)}>
      <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-fill-top, #3f6b5540)" /><stop offset="100%" stopColor="var(--chart-fill-bottom, #3f6b5500)" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="44" x2="540" y1={180 - i * 38} y2={180 - i * 38} className={s.gridLine} /><text x="32" y={184 - i * 38} textAnchor="end" className={s.axis}>{number.format(scale * i / 4)}</text></g>)}
      {mode === 'area' ? <g key="area"><path d={`${line} L ${points[points.length - 1].x} 180 L 44 180 Z`} fill={`url(#${gradient})`} /><path d={line} className={s.areaLine} pathLength="1" />{points.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r={selected === i ? 5 : 2.5} className={selected === i ? s.activeDot : s.dot} />)}</g> : <g key="bars">{points.map((point, i) => <rect key={i} x={point.x - 13} y={point.y} width="26" height={180 - point.y} rx="5" className={`${s.bar} ${i === selected ? s.barActive : ''}`} style={{ animationDelay: `${i * 25}ms` }} />)}</g>}
      {months.map((month, i) => <text key={month} x={44 + i * 44} y="204" textAnchor="middle" className={i >= elapsedMonths ? `${s.axis} ${s.futureMonth}` : i === elapsedMonths - 1 ? s.currentMonth : s.axis}>{month}</text>)}
      {points.map((point, i) => <g key={i}><rect x={point.x - 21} y="20" width="42" height="166" fill="transparent" className={s.hitTarget} tabIndex={0} role="button" aria-label={`${fullMonths[i]}: ${number.format(values[i])} visitas`} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(i); } }}><title>{fullMonths[i]}: {number.format(values[i])} visitas</title></rect></g>)}
    </svg>
    <p className={s.footnote}>Selecione um mês no gráfico para ver o total.</p>
  </div>;
}

export function RequestsStatus({ data }: WidgetProps) {
  const segments = [{ label: 'Novas', value: data.openByStatus.NEW, color: 'var(--chart-1, #3f6b55)' }, { label: 'Em análise', value: data.openByStatus.IN_REVIEW, color: 'var(--chart-2, #b08a2e)' }, { label: 'Agendadas', value: data.openByStatus.SCHEDULED, color: 'var(--chart-3, #9abf99)' }];
  const total = segments.reduce((sum, entry) => sum + entry.value, 0);
  if (!total) return <Empty>Nenhuma demanda aberta no momento.</Empty>;
  return <div className={s.statusBody}><div className={s.chartSummary}><div><strong>{number.format(total)}</strong><span> em andamento</span></div></div>
    <div className={s.stacked} role="img" aria-label={segments.map(entry => `${entry.label}: ${entry.value}, ${pct(ratio(entry.value, total))}`).join('; ')}>{segments.filter(entry => entry.value > 0).map(entry => <div key={entry.label} style={{ flex: entry.value, '--segment': entry.color } as CSSProperties}><span>{pct(ratio(entry.value, total))}</span><i /></div>)}</div>
    <div className={s.legend}>{segments.map(entry => <div key={entry.label}><span><i style={{ background: entry.color }} />{entry.label}</span><strong>{number.format(entry.value)}</strong><small>{pct(ratio(entry.value, total))}</small></div>)}</div>
    <p className={s.footnote}>Distribuição das solicitações abertas.</p>
  </div>;
}

export function Communities({ data, size }: WidgetProps) {
  const sorted = [...data.visitsByCommunity].sort((a, b) => b.visits - a.visits);
  const max = Math.max(...sorted.map(entry => entry.visits), 1);
  if (!sorted.length) return <Empty>As comunidades aparecem com os primeiros atendimentos.</Empty>;
  return <div className={s.rankingBody}><div className={s.rankingHead}><span>Comunidade</span><span>Produtores / visitas</span></div><ol className={`${s.ranking} ${size.w < 5 ? s.compact : ''}`}>{sorted.map((entry, i) => <li key={entry.community} style={{ '--delay': `${i * 45}ms` } as CSSProperties}><span className={s.rank}>{String(i + 1).padStart(2, '0')}</span><div className={s.community}><div><strong>{entry.community}</strong><span><small>{number.format(entry.producers)} prod.</small><b>{number.format(entry.visits)}</b></span></div><div className={s.track}><i style={{ width: `${ratio(entry.visits, max)}%` }} /></div></div></li>)}</ol><p className={s.footnote}>{sorted.length} comunidades com visitas em {data.year}.</p></div>;
}

export function Coverage({ data, size }: WidgetProps) {
  const coverage = ratio(data.producersServed, data.producersTotal);
  if (!data.producersTotal) return <Empty>Cadastre produtores para acompanhar a cobertura.</Empty>;
  return <div className={`${s.coverageBody} ${size.h < 4 ? s.coverageCompact : ''}`}><Ring value={coverage} label={`${number.format(data.producersServed)} de ${number.format(data.producersTotal)} produtores atendidos, ${pct(coverage)}`} /><div className={s.coverageDetail}><strong>{number.format(data.producersServed)} <span>de {number.format(data.producersTotal)}</span></strong><p>produtores com visita em {data.year}</p><span className={s.badge}>{number.format(Math.max(0, data.producersTotal - data.producersServed))} aguardando a primeira visita do ano</span></div></div>;
}
