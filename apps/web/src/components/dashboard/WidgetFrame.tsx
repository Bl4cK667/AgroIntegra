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

// Casca de todo widget: cabeçalho com título, controles de edição e o corpo vindo do catálogo.
export function WidgetFrame({ def, item, data, editing, dragHandle, onRemove, onResizeStart, onResizeKey }: Props) {
  const props = { data, size: { w: item.w, h: item.h }, editing };
  const titleId = `w-${item.id}-title`;

  return (
    <section className={styles.frame} aria-labelledby={titleId}>
      <header className={styles.frameHead}>
        {editing && (
          <button type="button" className={styles.dragHandle} aria-label={`Mover ${def.title}. Use as setas para reposicionar.`} {...dragHandle}>
            Mover
          </button>
        )}
        <h2 id={titleId} className={styles.frameTitle}>{def.title}</h2>
        {!editing && def.headerExtra && <div className={styles.frameExtra}>{def.headerExtra(props)}</div>}
        {!editing && def.href && (
          <Link href={def.href} className={styles.frameLink} aria-label={`Abrir ${def.title}`}>
            Abrir
          </Link>
        )}
        {editing && (
          <div className={styles.editBar}>
            <span className={`${styles.sizeLabel} num`} aria-label={`Tamanho ${item.w} por ${item.h}`}>
              {item.w} x {item.h}
            </span>
            <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`} onClick={onRemove} aria-label={`Remover ${def.title}`}>
              Remover
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
          Tamanho
        </span>
      )}
    </section>
  );
}
