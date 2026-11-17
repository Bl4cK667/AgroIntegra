'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { Avatar } from '@/components/account/Avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ROLE_LABEL, type SessionUser } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { NavIcon } from './NavIcon';
import { activeHref, MENU } from './menu';
import s from './topbar.module.css';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function Topbar({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const nav = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const current = activeHref(pathname);
  const results = MENU.filter((item) => normalize(item.label).includes(normalize(query.trim())));

  function openSearch() {
    if (profile.current) profile.current.open = false;
    setQuery('');
    if (!search.current?.open) search.current?.showModal();
    search.current?.querySelector('input')?.focus();
    requestAnimationFrame(() => search.current?.querySelector('input')?.focus());
  }

  useLayoutEffect(() => {
    const measure = () => {
      const item = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      setPill(item ? { left: item.offsetLeft, width: item.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (nav.current) observer.observe(nav.current);
    nav.current?.querySelectorAll('a').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [current]);

  useEffect(() => {
    search.current?.close();
    if (profile.current) profile.current.open = false;
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'Escape' && profile.current?.open) {
        profile.current.open = false;
        profile.current.querySelector('summary')?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (profile.current && !profile.current.contains(event.target as Node)) profile.current.open = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return (
    <header className={s.topbar}>
      <div className={s.inner}>
        <Link href="/painel" className={s.brand} aria-label="AgroIntegra — Painel">
          <span className={s.brandMark}><BrandSymbol size={30} /></span>
          <span>Agro<span className={s.brandAccent}>Integra</span></span>
        </Link>

        <nav ref={nav} className={s.nav} aria-label="Principal">
          {pill && <span className={s.pill} style={{ width: pill.width, transform: `translateX(${pill.left}px)` }} aria-hidden="true" />}
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} className={s.link} aria-current={current === item.href ? 'page' : undefined} title={item.label}>
              <NavIcon name={item.icon} /><span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={s.actions}>
          <button type="button" className={s.iconButton} onClick={openSearch} aria-label="Pesquisar páginas" aria-keyshortcuts="Control+k Meta+k" title="Pesquisar páginas (Ctrl/⌘ K)">
            <NavIcon name="busca" />
          </button>
          <NotificationBell variant="topbar" />
          <button type="button" className={`${s.iconButton} ${s.theme}`} onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            <NavIcon name={theme === 'dark' ? 'sol' : 'lua'} />
          </button>
          <details ref={profile} className={s.profile}>
            <summary className={s.profileTrigger} aria-label={`${user.name} — opções da conta`}>
              <Avatar name={user.name} size={34} /><span className={s.chevron} aria-hidden="true">⌄</span>
            </summary>
            <div className={s.profileMenu}>
              <div className={s.user}><strong>{user.name}</strong><small>{ROLE_LABEL[user.role]}</small></div>
              <Link href="/configuracoes" onClick={() => { if (profile.current) profile.current.open = false; }}>Configurações da conta</Link>
              <button type="button" className={s.mobileTheme} onClick={toggle}><NavIcon name={theme === 'dark' ? 'sol' : 'lua'} />{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button>
              <button type="button" onClick={onLogout}><NavIcon name="sair" />Sair da conta</button>
            </div>
          </details>
        </div>
      </div>

      <dialog ref={search} className={s.search} aria-labelledby="nav-search-title" onClick={(event) => { if (event.target === event.currentTarget) search.current?.close(); }}>
        <div className={s.searchHead}>
          <h2 id="nav-search-title">Ir para uma página</h2>
          <button type="button" className={s.iconButton} onClick={() => search.current?.close()} aria-label="Fechar pesquisa"><NavIcon name="fechar" /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (results[0]) { search.current?.close(); router.push(results[0].href); } }}>
          <label className={s.searchField}>
            <NavIcon name="busca" />
            <input autoFocus aria-label="Pesquisar páginas" placeholder="Pesquisar páginas…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (results[0]) { search.current?.close(); router.push(results[0].href); }
              }
            }} />
          </label>
        </form>
        <nav className={s.results} aria-label="Resultados da pesquisa">
          {results.map((item) => <Link key={item.href} href={item.href} data-result onClick={() => search.current?.close()}><NavIcon name={item.icon} /><span>{item.label}</span><span className={s.resultArrow} aria-hidden="true">↗</span></Link>)}
          {!results.length && <p role="status">Nenhuma página encontrada.</p>}
        </nav>
        <div className={s.searchFoot}>Enter para abrir a primeira página · Esc para fechar</div>
      </dialog>
    </header>
  );
}
