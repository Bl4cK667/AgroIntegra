import { formatPercent } from '@/lib/format';

// Barra de execução (0 a 100%). O número vem sempre escrito ao lado; a barra só reforça.
export function Meter({ percent, label, compact = false }: { percent: number; label?: string; compact?: boolean }) {
  const shown = Math.min(100, Math.max(0, percent));
  return (
    <span style={{ display: 'grid', gap: 4, minWidth: compact ? 90 : 0 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: compact ? '0.9rem' : '0.95rem' }}>
        {label && <span className="muted">{label}</span>}
        <strong className="num" style={{ marginLeft: 'auto' }}>
          {formatPercent(percent)}
        </strong>
      </span>
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        style={{ display: 'block', height: compact ? 5 : 8, borderRadius: 2, background: 'var(--linha)', overflow: 'hidden' }}
      >
        <span style={{ display: 'block', height: '100%', width: `${shown}%`, background: 'var(--mata-3)', borderRadius: 2 }} />
      </span>
    </span>
  );
}
