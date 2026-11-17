'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'agrointegra.theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Tema do app: escolha salva no navegador; sem escolha, segue o sistema operacional.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initial = stored() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // sem persistência: vale até recarregar
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
