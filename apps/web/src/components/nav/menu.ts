// Fonte única das rotas do app: Topbar e Sidebar leem daqui, então os dois estilos
// sempre mostram as mesmas páginas, na mesma ordem.
export interface MenuItem {
  href: string;
  label: string;
  /** aparece direto na barra de abas do celular (os demais ficam em "Mais") */
  mobile: boolean;
  /** fora do menu: a página continua existindo e abre pela busca de páginas e pelos links das telas */
  hidden?: boolean;
}

export const MENU: MenuItem[] = [
  { href: '/painel', label: 'Painel', mobile: true },
  { href: '/produtores', label: 'Produtores', mobile: true },
  { href: '/propriedades', label: 'Propriedades', mobile: false },
  { href: '/mapa', label: 'Mapa', mobile: false },
  { href: '/cotacoes', label: 'Cotações', mobile: false },
  { href: '/solicitacoes', label: 'Solicitações', mobile: true },
  { href: '/visitas', label: 'Visitas (todas)', mobile: false, hidden: true },
  { href: '/programas', label: 'Programas', mobile: false },
  { href: '/relatorios', label: 'Relatórios', mobile: false },
];

// Itens que aparecem nos menus (Sidebar e celular). A busca de páginas usa MENU inteiro.
export const NAV_MENU = MENU.filter((m) => !m.hidden);

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Visitas fazem parte da ficha do produtor: no menu, quem fica marcado é Produtores.
const menuPath = (pathname: string) => (isActive(pathname, '/visitas') ? '/produtores' : pathname);

export const activeHref = (pathname: string) => NAV_MENU.find((m) => isActive(menuPath(pathname), m.href))?.href;

// Menu da Topbar agrupado em submenus (faixa inferior do cabeçalho). Usa só rotas que já existem.
// Visitas não é item do menu: ficam na aba Visitas da ficha do produtor, que leva à lista geral.
export interface MenuLink {
  href: string;
  label: string;
}

export interface MenuGroup {
  label: string;
  /** link direto, sem submenu */
  href?: string;
  items?: MenuLink[];
}

export const MENU_GROUPS: MenuGroup[] = [
  { label: 'Painel', href: '/painel' },
  {
    label: 'Cadastros',
    items: [
      { href: '/produtores', label: 'Produtores' },
      { href: '/produtores/novo', label: 'Novo produtor' },
      { href: '/propriedades', label: 'Propriedades' },
    ],
  },
  {
    label: 'Atendimento',
    items: [
      { href: '/solicitacoes', label: 'Solicitações' },
      { href: '/solicitacoes/nova', label: 'Nova solicitação' },
    ],
  },
  {
    label: 'Território',
    items: [
      { href: '/mapa', label: 'Mapa territorial' },
      { href: '/cotacoes', label: 'Cotações' },
    ],
  },
  { label: 'Programas', href: '/programas' },
  {
    label: 'Relatórios',
    items: [
      { href: '/relatorios', label: 'Relatório do produtor' },
      { href: '/relatorios?aba=massa', label: 'Exportação em massa' },
    ],
  },
];

const GROUP_LINKS = MENU_GROUPS.flatMap((g) => (g.href ? [g.href] : (g.items ?? []).map((i) => i.href)));

/** Link do menu agrupado que corresponde à página atual: o mais específico (ex.: /produtores/novo antes de /produtores). */
export const activeGroupHref = (pathname: string) =>
  GROUP_LINKS.filter((href) => isActive(menuPath(pathname), href)).sort((a, b) => b.length - a.length)[0];
