import type { CSSProperties, ReactNode } from 'react';
import styles from './field-ui.module.css';

export const fieldStyles = styles;
export type FieldIconName = 'people' | 'land' | 'visit' | 'search' | 'plus' | 'check' | 'note' | 'pin' | 'inbox' | 'sprout' | 'report' | 'calendar' | 'flag' | 'clock' | 'download';
const paths: Record<FieldIconName, string> = {
  inbox: 'M12 3v10m-4-4 4 4 4-4M5 10l-3 7v4h20v-4l-3-7M2 17h6l2 2h4l2-2h6',
  sprout: 'M12 22V12M12 15C5 15 3 10 3 5c6 0 9 3 9 7m0 0c0-6 3-10 9-10 0 6-3 10-9 10',
  report: 'M14 2H4v20h16V8l-6-6v6h6M8 12h8m-8 4h8',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2',
  flag: 'M4 22V3m0 1c5-4 11 4 16 0v12c-5 4-11-4-16 0',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m7 .13a4 4 0 0 1 0 7.75',
  land: 'M3 21h18M5 21V10l7-7 7 7v11M9 21v-7h6v7',
  visit: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 11 3 3 5-5',
  search: 'M21 21l-5-5M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15',
  plus: 'M12 5v14M5 12h14', check: 'M5 12l4 4L19 6',
  note: 'M8 3h8l4 4v14H4V3h4m0 7h8m-8 4h8m-8 4h5',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};
export function FieldIcon({ name }: { name: FieldIconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function FieldHeading({ icon, eyebrow, title, description, actions }: { icon: FieldIconName; eyebrow: string; title: ReactNode; description: ReactNode; actions?: ReactNode }) {
  return <header className="page-head enter"><div className={styles.heading}><span className={`card-icon ${styles.headingIcon}`}><FieldIcon name={icon} /></span><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>{actions && <div className="form-actions">{actions}</div>}</header>;
}
export function SectionTitle({ icon, children, actions }: { icon: FieldIconName; children: ReactNode; actions?: ReactNode }) {
  return <div className="card-head"><span className="card-icon"><FieldIcon name={icon} /></span><h2 className="card-title">{children}</h2>{actions && <div className={styles.sectionActions}>{actions}</div>}</div>;
}
export function FieldStats({ items }: { items: { label: string; value: ReactNode; note?: string; icon: FieldIconName }[] }) {
  return <div className={styles.stats}>{items.map((item, i) => <div key={item.label} className={`card enter ${styles.stat}`} style={{ '--i': i + 1 } as CSSProperties}><span className="card-icon"><FieldIcon name={item.icon} /></span><div><span className={styles.statLabel}>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div></div>)}</div>;
}
export function FieldLoading() {
  return <div className={`card enter ${styles.loading}`} role="status" aria-label="Carregando informações"><span className="muted">Carregando informações…</span>{[0, 1, 2].map(i => <div key={i} className={`skeleton ${styles.skeleton}`} />)}</div>;
}
export function FieldEmpty({ icon, title, children }: { icon: FieldIconName; title: string; children: ReactNode }) {
  return <div className="empty"><span className={`card-icon ${styles.emptyIcon}`}><FieldIcon name={icon} /></span><strong>{title}</strong><div>{children}</div></div>;
}
