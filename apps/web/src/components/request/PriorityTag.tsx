import { PRIORITY_LABEL, RequestPriority } from '@/lib/api';

// Prioridade sempre escrita por extenso; a cor só reforça (alta = perigo, média = atenção, baixa = neutra).
const BADGE: Record<RequestPriority, string> = {
  HIGH: 'badge badge-danger',
  MEDIUM: 'badge badge-warning',
  LOW: 'badge badge-neutral',
};

export function PriorityTag({ priority }: { priority: RequestPriority }) {
  return <span className={BADGE[priority]}>{PRIORITY_LABEL[priority]}</span>;
}
