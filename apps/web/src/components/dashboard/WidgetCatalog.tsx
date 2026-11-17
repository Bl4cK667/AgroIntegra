'use client';

import { useEffect, useRef } from 'react';
import type { Layout } from './types';
import { WIDGETS } from './widgets';
import styles from './dashboard.module.css';

interface Props {
  layout: Layout;
  onAdd: (type: string) => void;
  onReset: () => void;
  onClose: () => void;
}

// Catálogo de widgets: painel lateral no desktop, gaveta inferior no celular (o CSS decide).
export function WidgetCatalog({ layout, onAdd, onReset, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const count = (type: string) => layout.filter((i) => i.type === type).length;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <>
      <div className={styles.catalogBackdrop} onClick={onClose} aria-hidden="true" />
      <div ref={panel} className={styles.catalog} role="dialog" aria-modal="true" aria-labelledby="catalog-title">
        <div className={styles.catalogHead}>
          <div>
            <h2 id="catalog-title">Adicionar widget</h2>
            <p className="muted">Escolha o que acompanhar no seu painel.</p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Fechar catálogo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <ul className={styles.catalogList}>
          {WIDGETS.map((w) => {
            const n = count(w.type);
            return (
              <li key={w.type} className={styles.catalogItem}>
                <span className={styles.catalogIcon}>{w.icon}</span>
                <div className={styles.catalogMeta}>
                  <strong>{w.title}</strong>
                  <span>{w.description}</span>
                  {n > 0 && <small>{n === 1 ? 'Já está no painel' : `${n} no painel`}</small>}
                </div>
                <button type="button" className={styles.catalogAdd} onClick={() => onAdd(w.type)} aria-label={`Adicionar ${w.title}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>

        <button type="button" className={styles.toolBtn} onClick={onReset}>
          Restaurar layout padrão
        </button>
      </div>
    </>
  );
}
