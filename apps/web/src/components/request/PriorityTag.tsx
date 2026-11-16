import { PRIORITY_LABEL, RequestPriority } from '@/lib/api';

// Prioridade sempre escrita por extenso; a cor só reforça (alta = terra, média = dourado, baixa = contorno).
const STYLE: Record<RequestPriority, React.CSSProperties> = {
  HIGH: { background: 'var(--terra)', color: '#fff', borderColor: 'var(--terra)' },
  MEDIUM: { background: '#f3e7c4', color: '#5c4510', borderColor: '#e2cd8d' },
  LOW: { background: 'transparent', color: 'var(--sutil)', borderColor: 'var(--linha-forte)' },
};

export function PriorityTag({ priority }: { priority: RequestPriority }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        border: '1px solid',
        borderRadius: 3,
        fontSize: '0.76rem',
        fontWeight: 650,
        letterSpacing: '0.02em',
        lineHeight: 1.5,
        ...STYLE[priority],
      }}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
