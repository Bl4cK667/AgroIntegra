'use client';

import { useSyncExternalStore } from 'react';
import { updateAccount } from './account';

export { THEMES, DEFAULT_THEME, isThemeId, themeMode, THEME_STORAGE_KEY } from './themes';
export type { Theme, ThemeId } from './themes';
import { DEFAULT_THEME, isThemeId, themeMode, THEME_STORAGE_KEY, type Theme, type ThemeId } from './themes';

const DEFAULT_DARK: ThemeId = 'midnight-black';
const KEY = THEME_STORAGE_KEY;
const LAST_KEY = (mode: Theme) => `agrointegra.theme.last-${mode}`; // usado pelo atalho claro/escuro
const SWITCH_MS = 450;

/** Valores antigos (light/dark) viram os temas equivalentes. */
function fromStored(v: string | null): ThemeId | null {
  if (isThemeId(v)) return v;
  if (v === 'light') return DEFAULT_THEME;
  if (v === 'dark') return DEFAULT_DARK;
  return null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sem armazenamento: vale até recarregar
  }
}

// Um único estado para o app inteiro: menus, painel e Configurações mostram sempre o mesmo tema.
const listeners = new Set<() => void>();
let current: ThemeId | null = null;
let switchTimer: ReturnType<typeof setTimeout> | undefined;

function initial(): ThemeId {
  const stored = fromStored(read(KEY));
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK : DEFAULT_THEME;
}

function apply(id: ThemeId, animate: boolean) {
  const root = document.documentElement;
  if (animate && current !== null && current !== id) {
    // A transição suave do CSS só vale durante a troca, para não animar cada hover.
    root.setAttribute('data-theme-switching', '');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.removeAttribute('data-theme-switching'), SWITCH_MS);
  }
  current = id;
  root.dataset.palette = id;
  root.dataset.theme = themeMode(id);
  write(KEY, id);
  write(LAST_KEY(themeMode(id)), id);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (current === null) apply(initial(), false);
  return () => {
    listeners.delete(listener);
  };
}

/** Aplica o tema salvo na conta (chamado pelo layout após /auth/me). Sem escolha na conta, mantém o do dispositivo. */
export function syncTheme(fromProfile: unknown) {
  if (isThemeId(fromProfile)) apply(fromProfile, current !== null);
}

/** Troca o tema na hora e salva na conta; volta ao anterior e lança o erro se o servidor recusar. */
export async function saveTheme(id: ThemeId) {
  const previous = current ?? initial();
  apply(id, true);
  try {
    const saved = await updateAccount({ theme: id });
    if (isThemeId(saved.theme) && saved.theme !== id) apply(saved.theme, true);
  } catch (err) {
    apply(previous, true);
    throw err;
  }
}

/** Atalho claro/escuro dos menus: vai para o último tema usado do modo oposto. */
function toggleMode(themeId: ThemeId) {
  const target: Theme = themeMode(themeId) === 'dark' ? 'light' : 'dark';
  const last = fromStored(read(LAST_KEY(target)));
  const next = last && themeMode(last) === target ? last : target === 'dark' ? DEFAULT_DARK : DEFAULT_THEME;
  saveTheme(next).catch(() => undefined); // offline: a troca vale neste dispositivo até a próxima sincronização
}

export function useTheme() {
  const themeId = useSyncExternalStore(subscribe, () => current ?? DEFAULT_THEME, () => DEFAULT_THEME);
  return {
    theme: themeMode(themeId),
    themeId,
    toggle: () => toggleMode(themeId),
    setThemeId: (id: ThemeId) => saveTheme(id).catch(() => undefined),
  };
}
