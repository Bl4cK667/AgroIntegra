'use client';

import { useSyncExternalStore } from 'react';
import { NavStyle } from './api';
import { updateAccount } from './account';

export type { NavStyle };
export const DEFAULT_NAV_STYLE: NavStyle = 'topbar';

// Estado único do estilo de navegação para o app inteiro (mesmo padrão de lib/theme.ts).
// A fonte da verdade é o perfil no servidor; aqui só espelhamos para trocar na hora.
const listeners = new Set<() => void>();
let current: NavStyle = DEFAULT_NAV_STYLE;

const normalize = (v: unknown): NavStyle => (v === 'sidebar' ? 'sidebar' : 'topbar');

function apply(style: NavStyle) {
  if (style === current) return;
  current = style;
  listeners.forEach((l) => l());
}

/** Chamado pelo layout ao carregar o usuário: aplica a preferência salva no perfil. */
export function syncNavStyle(fromProfile: unknown) {
  apply(normalize(fromProfile));
}

/** Troca a navegação imediatamente e salva no perfil; volta atrás se o servidor recusar. */
export async function saveNavStyle(style: NavStyle) {
  const previous = current;
  apply(style);
  try {
    const saved = await updateAccount({ navStyle: style });
    apply(normalize(saved.navStyle));
  } catch (err) {
    apply(previous);
    throw err;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNavStyle(): NavStyle {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_NAV_STYLE);
}
