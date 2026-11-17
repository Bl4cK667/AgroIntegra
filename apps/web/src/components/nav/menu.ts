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
  { href: '/solicitacoes', label: 'Solicitações', icon: 'solicitacoes', mobile: true },
  { href: '/visitas', label: 'Visitas', icon: 'visitas', mobile: true },
  { href: '/programas', label: 'Programas', icon: 'programas', mobile: false },
  { href: '/relatorios', label: 'Relatórios', icon: 'relatorios', mobile: false },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export const activeHref = (pathname: string) => MENU.find((m) => isActive(pathname, m.href))?.href;
