// Dados puros dos temas (sem React): usados pelo cliente (lib/theme.ts) e pelo layout raiz no servidor.

// Temas visuais do AgroIntegra. As cores ficam nos tokens CSS (app/themes.css), um bloco
// [data-palette="<id>"] por tema; aqui só escolhemos qual paleta está ativa.
export type ThemeId = 'midnight-black' | 'forest-dark' | 'pure-light' | 'sand-earth' | 'ocean-blue' | 'graphite';
/** Modo claro/escuro da paleta ativa (mantido para quem já usava light/dark). */
export type Theme = 'light' | 'dark';

export const THEMES: { id: ThemeId; label: string; description: string; mode: Theme }[] = [
  { id: 'pure-light', label: 'Pure Light', description: 'Claro, branco e verde. O visual padrão.', mode: 'light' },
  { id: 'midnight-black', label: 'Midnight Black', description: 'Preto profundo, cards cinza-escuro e verde-limão.', mode: 'dark' },
  { id: 'forest-dark', label: 'Forest Dark', description: 'Verde-floresta escuro em tons naturais.', mode: 'dark' },
  { id: 'sand-earth', label: 'Sand & Earth', description: 'Areia, bege e terracota.', mode: 'light' },
  { id: 'ocean-blue', label: 'Ocean Blue', description: 'Azul profundo com detalhes azuis.', mode: 'dark' },
  { id: 'graphite', label: 'Graphite', description: 'Cinza grafite com detalhes neutros.', mode: 'dark' },
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
