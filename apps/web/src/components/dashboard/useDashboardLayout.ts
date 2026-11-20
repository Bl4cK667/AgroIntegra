'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Layout, LayoutItem, WidgetDef } from './types';
import { DEFAULT_LAYOUT, WIDGETS } from './widgets';

// Layout salvo por usuário neste navegador. Versão no nome da chave: se o formato mudar, cada um volta ao padrão.
// v2 (20/11/2026): novo padrão com "Situação geral" e listas; quem tinha um layout salvo recebe o padrão novo uma vez.
const KEY = (userId: string) => `agrointegra.painel.layout.v2.${userId}`;

export const widgetByType = new Map<string, WidgetDef>(WIDGETS.map((w) => [w.type, w]));

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

export function clampSize(item: Pick<LayoutItem, 'type' | 'w' | 'h'>) {
  const def = widgetByType.get(item.type);
  if (!def) return { w: item.w, h: item.h };
  return {
    w: clamp(item.w, def.minSize.w, Math.min(12, def.maxSize.w)),
    h: clamp(item.h, def.minSize.h, def.maxSize.h),
  };
}

// Descarta o que não existe mais (widget removido do catálogo) e corrige tamanhos fora dos limites.
function sanitize(raw: unknown): Layout | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Layout = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const { id, type, w, h } = it as Record<string, unknown>;
    if (typeof id !== 'string' || typeof type !== 'string' || seen.has(id) || !widgetByType.has(type)) continue;
    if (typeof w !== 'number' || typeof h !== 'number') continue;
    seen.add(id);
    out.push({ id, type, ...clampSize({ type, w, h }) });
  }
  return out;
}

function read(userId: string): Layout {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (raw) return sanitize(JSON.parse(raw)) ?? DEFAULT_LAYOUT;
  } catch {
    // armazenamento indisponível (aba anônima, bloqueio): segue com o padrão
  }
  return DEFAULT_LAYOUT;
}

export function useDashboardLayout(userId: string | undefined) {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

  // Lê só no cliente, depois de montar, para não divergir da renderização do servidor.
  useEffect(() => {
    if (!userId) return;
    setLayout(read(userId));
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!userId || !loaded) return;
    try {
      localStorage.setItem(KEY(userId), JSON.stringify(layout));
    } catch {
      // sem persistência; o layout continua valendo nesta sessão
    }
  }, [layout, loaded, userId]);

  const move = useCallback((id: string, targetId: string, place: 'before' | 'after') => {
    setLayout((cur) => {
      if (id === targetId) return cur;
      const item = cur.find((i) => i.id === id);
      if (!item) return cur;
      const rest = cur.filter((i) => i.id !== id);
      const t = rest.findIndex((i) => i.id === targetId);
      if (t < 0) return cur;
      rest.splice(place === 'before' ? t : t + 1, 0, item);
      return rest;
    });
  }, []);

  const shift = useCallback((id: string, delta: number) => {
    setLayout((cur) => {
      const from = cur.findIndex((i) => i.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const resize = useCallback((id: string, w: number, h: number) => {
    setLayout((cur) =>
      cur.map((i) => {
        if (i.id !== id) return i;
        const s = clampSize({ type: i.type, w, h });
        return s.w === i.w && s.h === i.h ? i : { ...i, ...s };
      }),
    );
  }, []);

  const remove = useCallback((id: string) => setLayout((cur) => cur.filter((i) => i.id !== id)), []);

  const add = useCallback((type: string) => {
    const def = widgetByType.get(type);
    if (!def) return;
    const id = `${type}-${Date.now().toString(36)}`;
    setLayout((cur) => [...cur, { id, type, ...def.defaultSize }]);
    return id;
  }, []);

  const reset = useCallback(() => setLayout(DEFAULT_LAYOUT), []);

  return { layout, loaded, move, shift, resize, remove, add, reset };
}
