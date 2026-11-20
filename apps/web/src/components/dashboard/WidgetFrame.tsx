'use client';

import Link from 'next/link';
import type { HTMLAttributes, KeyboardEvent, PointerEvent } from 'react';
import type { Dashboard } from '@/lib/api';
import type { LayoutItem, WidgetDef } from './types';
import styles from './dashboard.module.css';

interface Props {
  def: WidgetDef;
  item: LayoutItem;
  data: Dashboard;
  editing: boolean;
  dragHandle: HTMLAttributes<HTMLButtonElement>;
  onRemove: () => void;
  onResizeStart: (e: PointerEvent<HTMLElement>) => void;
  onResizeKey: (e: KeyboardEvent<HTMLElement>) => void;
}

// Casca de todo widget: cabeçalho com ícone e título, controles de edição e o corpo vindo do catálogo.
export function WidgetFrame({ def, item, data, editing, dragHandle, onRemove, onResizeStart, onResizeKey }: Props) {
  const props = { data, size: { w: item.w, h: item.h }, editing };
  const titleId = `w-${item.id}-title`;

  return (
    <section className={styles.frame} aria-labelledby={titleId}>
      <header className={styles.frameHead}>
        {editing && (
          <button type="button" className={styles.dragHandle} aria-label={`Mover ${def.title}. Use as setas para reposicionar.`} {...dragHandle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
            </svg>
          </button>
        )}
        <span className={styles.frameIcon}>{def.icon}</span>
        <h2 id={titleId} className={styles.frameTitle}>{def.title}</h2>
        {!editing && def.headerExtra && <div className={styles.frameExtra}>{def.headerExtra(props)}</div>}
        {!editing && def.href && (
          <Link href={def.href} className={styles.frameLink} aria-label={`Abrir ${def.title}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </Link>
        )}
        {editing && (
          <div className={styles.editBar}>
            <span className={`${styles.sizeLabel} num`} aria-label={`Tamanho ${item.w} por ${item.h}`}>
              {item.w}×{item.h}
            </span>
            <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`} onClick={onRemove} aria-label={`Remover ${def.title}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Em edição o corpo fica inerte: nada navega nem rouba o arraste. */}
      <div className={`${styles.frameBody} ${def.flush ? styles.frameBodyFlush : ''}`} inert={editing || undefined}>
        {def.render(props)}
      </div>

      {editing && (
        <span
          role="slider"
          tabIndex={0}
          className={styles.resizeHandle}
          aria-label={`Redimensionar ${def.title}. Setas mudam largura e altura.`}
          aria-valuetext={`${item.w} colunas por ${item.h} linhas`}
          aria-valuenow={item.w}
          aria-valuemin={def.minSize.w}
          aria-valuemax={def.maxSize.w}
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKey}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M13 5 5 13M13 9l-4 4" />
          </svg>
        </span>
      )}
    </section>
  );
}
