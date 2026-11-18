// Dados puros dos temas (sem React): usados pelo cliente (lib/theme.ts) e pelo layout raiz no servidor.

// Temas visuais do AgroIntegra. As cores ficam nos tokens CSS (app/themes.css), um bloco
// [data-palette="<id>"] por tema; aqui só escolhemos qual paleta está ativa.
export type ThemeId = 'midnight-black' | 'forest-dark' | 'pure-light' | 'sand-earth' | 'ocean-blue' | 'graphite';
/** Modo claro/escuro da paleta ativa (mantido para quem já usava light/dark). */
export type Theme = 'light' | 'dark';

export const THEMES: { id: ThemeId; label: string; description: string; mode: Theme }[] = [
  { id: 'pure-light', label: 'Claro (padrão)', description: 'Fundo claro, texto escuro e verde institucional.', mode: 'light' },
  { id: 'midnight-black', label: 'Escuro', description: 'Fundo quase preto, para pouca luz.', mode: 'dark' },
  { id: 'forest-dark', label: 'Escuro esverdeado', description: 'Fundo escuro com leve tom de verde.', mode: 'dark' },
  { id: 'sand-earth', label: 'Claro areia', description: 'Fundo claro levemente amarelado, mais suave para os olhos.', mode: 'light' },
  { id: 'ocean-blue', label: 'Escuro azulado', description: 'Fundo escuro com leve tom de azul.', mode: 'dark' },
  { id: 'graphite', label: 'Grafite', description: 'Fundo cinza-escuro neutro.', mode: 'dark' },
];

export const DEFAULT_THEME: ThemeId = 'pure-light';
const DEFAULT_DARK: ThemeId = 'midnight-black';
export const THEME_STORAGE_KEY = 'agrointegra.theme'; // tema deste dispositivo (abre sem piscar)
const KEY = THEME_STORAGE_KEY;

const byId = new Map(THEMES.map((t) => [t.id, t]));
export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && byId.has(v as ThemeId);
export const themeMode = (id: ThemeId): Theme => byId.get(id)?.mode ?? 'light';

/**
 * Script inline do layout raiz: aplica o tema do dispositivo antes da primeira pintura (sem piscar).
 * Fica em string porque roda antes do React; mantenha alinhado com THEMES.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=${JSON.stringify(
  Object.fromEntries(THEMES.map((t) => [t.id, t.mode])),
)};var v=localStorage.getItem('${KEY}');if(v==='light')v='${DEFAULT_THEME}';if(v==='dark')v='${DEFAULT_DARK}';if(!m[v])v=matchMedia('(prefers-color-scheme: dark)').matches?'${DEFAULT_DARK}':'${DEFAULT_THEME}';var r=document.documentElement;r.dataset.palette=v;r.dataset.theme=m[v];}catch(e){}})();`;
