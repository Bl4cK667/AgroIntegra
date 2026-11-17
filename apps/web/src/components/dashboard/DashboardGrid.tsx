'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Dashboard } from '@/lib/api';
import type { Layout } from './types';
import { widgetByType } from './useDashboardLayout';
import { WidgetFrame } from './WidgetFrame';
import styles from './dashboard.module.css';

interface Props {
  layout: Layout;
  data: Dashboard;
  editing: boolean;
  onMove: (id: string, targetId: string, place: 'before' | 'after') => void;
  onShift: (id: string, delta: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onRemove: (id: string) => void;
}

type Drag = { id: string; x0: number; y0: number; dx: number; dy: number };
type Drop = { id: string; place: 'before' | 'after' } | null;
type Resize = { id: string; x0: number; y0: number; w0: number; h0: number; colUnit: number; rowStep: number };

const visuallyHidden: CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mede a grade real (as colunas mudam com a largura da tela) para converter pixels em colunas/linhas.
function gridMetrics(grid: HTMLElement) {
  const cs = getComputedStyle(grid);
  const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length || 12;
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const rowH = parseFloat(cs.gridAutoRows) || 84;
  const colW = (grid.clientWidth - colGap * (cols - 1)) / cols;
  // A largura salva é sempre em 12 colunas; em telas com menos colunas, cada passo vale proporcionalmente mais.
  return { cols, colUnit: ((colW + colGap) * cols) / 12, rowStep: rowH + rowGap };
}

export function DashboardGrid({ layout, data, editing, onMove, onShift, onResize, onRemove }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const signature = useRef('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [resizing, setResizing] = useState<Resize | null>(null);
  const [announce, setAnnounce] = useState('');

  // FLIP: quando a ordem ou o tamanho mudam, cada card desliza da posição antiga para a nova.
  useLayoutEffect(() => {
    const sig = layout.map((i) => `${i.id}:${i.w}x${i.h}`).join('|');
    const changed = signature.current !== '' && sig !== signature.current;
    signature.current = sig;
    const next = new Map<string, DOMRect>();
    nodes.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next.set(id, r);
      const prev = rects.current.get(id);
      if (!changed || !prev || reducedMotion() || id === resizing?.id) return;
      const dx = prev.left - r.left;
      const dy = prev.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 320,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    });
    rects.current = next;
  });

  // ---------- arrastar para reordenar ----------
  function dragHandle(id: string) {
    return {
      onPointerDown(e: PointerEvent<HTMLButtonElement>) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
      },
      onPointerMove(e: PointerEvent<HTMLButtonElement>) {
        if (!drag || drag.id !== id) return;
        setDrag({ ...drag, dx: e.clientX - drag.x0, dy: e.clientY - drag.y0 });
        const grid = gridRef.current;
        const target = document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-item-id]'))
          .find((el) => el && el.dataset.itemId !== id);
        if (!target || !grid) return setDrop(null);
        const r = target.getBoundingClientRect();
        // Card que ocupa a linha inteira (ou celular): decide por cima/baixo; senão, esquerda/direita.
        const fullRow = r.width > grid.clientWidth * 0.9;
        const before = fullRow ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
        setDrop({ id: target.dataset.itemId!, place: before ? 'before' : 'after' });
      },
      onPointerUp() {
        if (drop && drag?.id === id) onMove(id, drop.id, drop.place);
        setDrag(null);
        setDrop(null);
      },
      onPointerCancel() {
        setDrag(null);
        setDrop(null);
      },
      onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
        const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
        if (!delta) return;
        e.preventDefault();
        const idx = layout.findIndex((i) => i.id === id);
        const to = idx + delta;
        if (to < 0 || to >= layout.length) return;
        onShift(id, delta);
        setAnnounce(`${widgetByType.get(layout[idx].type)?.title} movido para a posição ${to + 1} de ${layout.length}.`);
        // O botão é recriado na nova posição; devolve o foco a ele.
        requestAnimationFrame(() =>
          nodes.current.get(id)?.querySelector<HTMLButtonElement>(`.${styles.dragHandle}`)?.focus(),
        );
      },
    };
  }

  // ---------- redimensionar ----------
  function resizeStart(id: string, w: number, h: number) {
    return (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !gridRef.current) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const { colUnit, rowStep } = gridMetrics(gridRef.current);
      const state: Resize = { id, x0: e.clientX, y0: e.clientY, w0: w, h0: h, colUnit, rowStep };
      setResizing(state);
      const move = (ev: globalThis.PointerEvent) =>
        onResize(id, state.w0 + Math.round((ev.clientX - state.x0) / state.colUnit), state.h0 + Math.round((ev.clientY - state.y0) / state.rowStep));
      const end = () => {
        setResizing(null);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
  }

  function resizeKey(id: string, w: number, h: number) {
    return (e: KeyboardEvent<HTMLElement>) => {
      const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      onResize(id, w + d[0], h + d[1]);
    };
  }

  return (
    <>
      <div ref={gridRef} className={styles.grid} data-editing={editing ? 'true' : undefined}>
        {layout.map((item, i) => {
          const def = widgetByType.get(item.type);
          if (!def) return null;
          const isDrag = drag?.id === item.id;
          const style = {
            '--w': item.w,
            '--h': item.h,
            '--i': i,
            ...(isDrag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 20 } : null),
          } as CSSProperties;
          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) nodes.current.set(item.id, el);
                else nodes.current.delete(item.id);
              }}
              className={styles.item}
              style={style}
              data-item-id={item.id}
              data-dragging={isDrag ? 'true' : undefined}
              data-drop={drop?.id === item.id ? drop.place : undefined}
              data-resizing={resizing?.id === item.id ? 'true' : undefined}
            >
              <WidgetFrame
                def={def}
                item={item}
                data={data}
                editing={editing}
                dragHandle={dragHandle(item.id)}
                onRemove={() => onRemove(item.id)}
                onResizeStart={resizeStart(item.id, item.w, item.h)}
                onResizeKey={resizeKey(item.id, item.w, item.h)}
              />
              {resizing?.id === item.id && <div className={styles.ghost} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <p style={visuallyHidden} aria-live="polite">{announce}</p>
    </>
  );
}
