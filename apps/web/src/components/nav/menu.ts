import type { NavIconName } from './NavIcon';

// Fonte única das rotas do app: Topbar e Sidebar leem daqui, então os dois estilos
// sempre mostram as mesmas páginas, na mesma ordem.
export interface MenuItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** aparece direto na barra de abas do celular (os demais ficam em "Mais") */
  mobile: boolean;
}

export const MENU: MenuItem[] = [
  { href: '/painel', label: 'Painel', icon: 'painel', mobile: true },
  { href: '/produtores', label: 'Produtores', icon: 'produtores', mobile: true },
  { href: '/propriedades', label: 'Propriedades', icon: 'propriedades', mobile: false },
  { href: '/mapa', label: 'Mapa', icon: 'mapa', mobile: false },
  { href: '/cotacoes', label: 'Cotações', icon: 'cotacoes', mobile: false },
  { href: '/solicitacoes', label: 'Solicitações', icon: 'solicitacoes', mobile: true },
  { href: '/visitas', label: 'Visitas', icon: 'visitas', mobile: true },
  { href: '/programas', label: 'Programas', icon: 'programas', mobile: false },
  { href: '/relatorios', label: 'Relatórios', icon: 'relatorios', mobile: false },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export const activeHref = (pathname: string) => MENU.find((m) => isActive(pathname, m.href))?.href;

// Menu da Topbar agrupado em submenus (faixa inferior do cabeçalho). Usa só rotas que já existem.
export interface MenuLink {
  href: string;
  label: string;
}

export interface MenuGroup {
  label: string;
  icon: NavIconName;
  /** link direto, sem submenu */
  href?: string;
  items?: MenuLink[];
}

export const MENU_GROUPS: MenuGroup[] = [
  { label: 'Painel', icon: 'painel', href: '/painel' },
  {
    label: 'Cadastros',
    icon: 'produtores',
    items: [
      { href: '/produtores', label: 'Produtores' },
      { href: '/produtores/novo', label: 'Novo produtor' },
      { href: '/propriedades', label: 'Propriedades' },
    ],
  },
  {
    label: 'Atendimento',
    icon: 'solicitacoes',
    items: [
      { href: '/solicitacoes', label: 'Solicitações' },
      { href: '/solicitacoes/nova', label: 'Nova solicitação' },
      { href: '/visitas', label: 'Visitas' },
      { href: '/visitas/nova', label: 'Nova visita' },
    ],
  },
  {
    label: 'Território',
    icon: 'mapa',
    items: [
      { href: '/mapa', label: 'Mapa territorial' },
      { href: '/cotacoes', label: 'Cotações' },
    ],
  },
  { label: 'Programas', icon: 'programas', href: '/programas' },
  {
    label: 'Relatórios',
    icon: 'relatorios',
    items: [
      { href: '/relatorios', label: 'Relatório do produtor' },
      { href: '/relatorios?aba=massa', label: 'Exportação em massa' },
    ],
  },
];

const GROUP_LINKS = MENU_GROUPS.flatMap((g) => (g.href ? [g.href] : (g.items ?? []).map((i) => i.href)));

/** Link do menu agrupado que corresponde à página atual: o mais específico (ex.: /produtores/novo antes de /produtores). */
export const activeGroupHref = (pathname: string) =>
  GROUP_LINKS.filter((href) => isActive(pathname, href)).sort((a, b) => b.length - a.length)[0];
