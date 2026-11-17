'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'agrointegra.theme';

// Um único estado de tema para o app inteiro: o menu e o painel mostram sempre o mesmo valor.
const listeners = new Set<() => void>();
let current: Theme | null = null;

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // armazenamento indisponível
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (current === null) apply(initial());
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // sem persistência: vale até recarregar
  }
  apply(theme);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current ?? 'light', () => 'light' as Theme);
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
