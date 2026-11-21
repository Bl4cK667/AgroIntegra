import type { CSSProperties, ReactNode } from 'react';
import styles from './field-ui.module.css';

export const fieldStyles = styles;
// Componentes de página no padrão de referência: só texto, sem ícones.
export function FieldHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: ReactNode; description: ReactNode; actions?: ReactNode }) {
  return <header className="page-head enter"><div className={styles.heading}><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>{actions && <div className="form-actions">{actions}</div>}</header>;
}
export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="card-head"><h2 className="card-title">{children}</h2>{actions && <div className={styles.sectionActions}>{actions}</div>}</div>;
}
export function FieldStats({ items }: { items: { label: string; value: ReactNode; note?: string }[] }) {
  return <div className={styles.stats}>{items.map((item, i) => <div key={item.label} className={`card enter ${styles.stat}`} style={{ '--i': i + 1 } as CSSProperties}><div><span className={styles.statLabel}>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div></div>)}</div>;
}
export function FieldLoading() {
  return <div className={`card enter ${styles.loading}`} role="status" aria-label="Carregando informações"><span className="muted">Carregando informações…</span>{[0, 1, 2].map(i => <div key={i} className={`skeleton ${styles.skeleton}`} />)}</div>;
}
export function FieldEmpty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><strong>{title}</strong><div>{children}</div></div>;
}
