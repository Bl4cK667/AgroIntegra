import { formatPercent } from '@/lib/format';
import styles from './Meter.module.css';

// Barra de execução (0 a 100%). O número vem sempre escrito ao lado; a barra só reforça.
// Acima de 100% a barra fica cheia e muda de cor, mas o número mostra o valor real.
export function Meter({ percent, label, compact = false }: { percent: number; label?: string; compact?: boolean }) {
  const shown = Math.min(100, Math.max(0, percent));
  return (
    <span className={`${styles.meter} ${compact ? styles.compact : ''}`}>
      <span className={styles.top}>
        {label && <span className={styles.label}>{label}</span>}
        <strong className={`${styles.value} num`}>{formatPercent(percent)}</strong>
      </span>
      <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label} className={styles.track}>
        <span className={styles.fill} data-full={percent >= 100 || undefined} style={{ '--p': `${shown}%` } as React.CSSProperties} />
      </span>
    </span>
  );
}
