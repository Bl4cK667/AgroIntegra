'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { ROLE_LABEL, SessionUser } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Avatar } from '@/components/account/Avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NavIcon } from './NavIcon';
import { activeHref as getActiveHref, MENU } from './menu';
import s from './nav.module.css';

const COLLAPSE_KEY = 'agrointegra.nav.collapsed';

interface Props {
  user: SessionUser;
  onLogout: () => void;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}

export function useNavCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // sem armazenamento: menu aberto
    }
  }, []);
  const update = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      // vale até recarregar
    }
  };
  return [collapsed, update] as const;
}

export function Sidebar({ user, onLogout, collapsed, onCollapsedChange }: Props) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const activeHref = getActiveHref(pathname);

  // A pílula ativa desliza entre os itens em vez de pular.
  useLayoutEffect(() => {
    const navEl = navRef.current;
    const measure = () => {
      const el = navEl?.querySelector<HTMLElement>('[aria-current="page"]');
      setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver !== 'undefined' && navEl ? new ResizeObserver(measure) : null;
    if (observer && navEl) observer.observe(navEl);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [activeHref, collapsed]);

  useEffect(() => setSheet(false), [pathname]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const moreActive = MENU.some((m) => !m.mobile && m.href === activeHref);

  return (
    <>
      {/* ---------- desktop: barra lateral ---------- */}
      <aside className={s.sidebar} data-collapsed={collapsed || undefined}>
        <div className={s.top}>
          <Link href="/painel" className={s.brand} aria-label="AgroIntegra — Painel">
            <span className={s.brandMark}>
              <BrandSymbol size={32} />
            </span>
            <span className={s.brandName}>AgroIntegra</span>
          </Link>
          <div className={s.topActions}>
            <NotificationBell />
            <button
              type="button"
              className={s.collapse}
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-expanded={!collapsed}
              data-tip={collapsed ? 'Expandir menu' : undefined}
            >
              <NavIcon name="recolher" />
            </button>
          </div>
        </div>

        <nav ref={navRef} className={s.nav} aria-label="Principal">
          {pill && <span className={s.pill} style={{ transform: `translateY(${pill.top}px)`, height: pill.height }} aria-hidden="true" />}
          {MENU.map((item, i) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={s.link}
                data-active={active || undefined}
                aria-current={active ? 'page' : undefined}
                data-tip={item.label}
                style={{ '--i': i } as React.CSSProperties}
              >
                <NavIcon name={item.icon} />
                <span className={s.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={s.bottom}>
          <button type="button" className={s.link} onClick={toggle} data-tip={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            <NavIcon name={theme === 'dark' ? 'sol' : 'lua'} />
            <span className={s.label}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
          <div className={s.user}>
            <Link
              href="/configuracoes"
              className={s.profile}
              data-active={pathname.startsWith('/configuracoes') || undefined}
              aria-label={`${user.name} — configurações da conta`}
              data-tip="Configurações da conta"
            >
              <Avatar name={user.name} size={36} className={s.avatarRing} />
              <span className={s.userText}>
                <strong>{user.name}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </Link>
            <button type="button" className={s.logout} onClick={onLogout} aria-label="Sair" data-tip="Sair">
              <NavIcon name="sair" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- celular: barra superior + abas inferiores ---------- */}
      <header className={s.mobileTop}>
        <Link href="/painel" className={s.brand}>
          <span className={s.brandMark}>
            <BrandSymbol size={28} />
          </span>
          <span className={s.brandName}>AgroIntegra</span>
        </Link>
        <NotificationBell variant="mobile" />
        <button type="button" className={s.roundBtn} onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
          <NavIcon name={theme === 'dark' ? 'sol' : 'lua'} />
        </button>
        <Link href="/configuracoes" className={s.avatarLink} aria-label="Configurações da conta">
          <Avatar name={user.name} size={36} className={s.avatarRing} />
        </Link>
      </header>

      <nav className={s.tabbar} aria-label="Principal (celular)">
        {MENU.filter((m) => m.mobile).map((item) => {
          const active = item.href === activeHref;
          return (
            <Link key={item.href} href={item.href} className={s.tab} data-active={active || undefined} aria-current={active ? 'page' : undefined}>
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button type="button" className={s.tab} data-active={moreActive || sheet || undefined} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}>
          <NavIcon name="mais" />
          <span>Mais</span>
        </button>
      </nav>

      {sheet && (
        <>
          <div className={s.backdrop} onClick={() => setSheet(false)} aria-hidden="true" />
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Mais opções">
            <span className={s.grabber} aria-hidden="true" />
            <Link href="/configuracoes" className={s.sheetUser}>
              <Avatar name={user.name} size={36} className={s.avatarRing} />
              <span className={s.userText}>
                <strong>{user.name}</strong>
                <small>{ROLE_LABEL[user.role]} · Configurações da conta</small>
              </span>
              <NavIcon name="mais" />
            </Link>
            <div className={s.sheetGrid}>
              {MENU.filter((m) => !m.mobile).map((item, i) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={s.sheetItem}
                    data-active={active || undefined}
                    aria-current={active ? 'page' : undefined}
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <button type="button" className={s.sheetLogout} onClick={onLogout}>
              <NavIcon name="sair" />
              Sair da conta
            </button>
          </div>
        </>
      )}
    </>
  );
}

export { Sidebar as AppNav };
