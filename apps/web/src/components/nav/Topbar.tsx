'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { listProducers, ROLE_LABEL, type ProducerSummary, type SessionUser } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useDebounced } from '@/lib/useDebounced';
import { activeGroupHref, MENU, MENU_GROUPS } from './menu';
import s from './topbar.module.css';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Cabeçalho em duas faixas (referência: docs/design-system.md, seção 4).
   Faixa superior: marca, consulta rápida de produtor, ações e usuário.
   Faixa do menu: grupos com submenu; no celular vira um botão "Menu". */
export function Topbar({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const header = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = activeGroupHref(pathname);
  const results = MENU.filter((item) => normalize(item.label).includes(normalize(query.trim())));

  function openSearch() {
    if (profile.current) profile.current.open = false;
    setQuery('');
    if (!search.current?.open) search.current?.showModal();
    requestAnimationFrame(() => search.current?.querySelector('input')?.focus());
  }

  // Mudou de página: fecha tudo.
  useEffect(() => {
    search.current?.close();
    if (profile.current) profile.current.open = false;
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'Escape') {
        if (profile.current?.open) {
          profile.current.open = false;
          profile.current.querySelector('summary')?.focus();
        }
        setOpenGroup((group) => {
          if (group) header.current?.querySelector<HTMLElement>(`[data-group="${group}"]`)?.focus();
          return null;
        });
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (profile.current && !profile.current.contains(target)) profile.current.open = false;
      if (header.current && !header.current.contains(target)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  // Hover só abre submenu em dispositivos com mouse; no toque, o clique decide.
  const hoverable = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (min-width: 901px)').matches;

  return (
    <header ref={header} className={s.topbar}>
      <div className={s.top}>
        <Link href="/painel" className={s.brand} aria-label="AgroIntegra — Painel">
          <BrandSymbol size={38} />
          <span className={s.brandText}>
            <span className={s.brandName}>AgroIntegra</span>
            <span className={s.brandTag}>Gestão integrada para o desenvolvimento rural</span>
          </span>
        </Link>

        <QuickProducerSearch className={s.quickDesktop} onPick={(id) => router.push(`/produtores/${id}`)} />

        <div className={s.actions}>
          <button type="button" className={`${s.textButton} ${s.pageSearch}`} onClick={openSearch} aria-keyshortcuts="Control+k Meta+k" title="Atalho: Ctrl + K">
            Ir para página
          </button>
          <span className={s.bell}><NotificationBell variant="topbar" /></span>
          <button type="button" className={`${s.textButton} ${s.theme}`} onClick={toggle}>
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <details ref={profile} className={s.profile}>
            <summary className={s.profileTrigger}>
              <span className={s.userText}>
                <span className={s.userLabel}>Usuário:</span> <strong>{user.name}</strong>
              </span>
              <span className={s.userShort}>Minha conta</span>
            </summary>
            <div className={s.profileMenu}>
              <div className={s.user}><strong>{user.name}</strong><small>{ROLE_LABEL[user.role]}</small></div>
              <Link href="/configuracoes">Configurações da conta</Link>
              <button type="button" className={s.mobileTheme} onClick={openSearch}>Ir para página</button>
              <button type="button" className={s.mobileTheme} onClick={toggle}>{theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}</button>
              <button type="button" onClick={onLogout}>Sair da conta</button>
            </div>
          </details>
          <button type="button" className={s.logout} onClick={onLogout}>Sair</button>
        </div>
      </div>

      <nav className={s.menu} aria-label="Principal">
        <button type="button" className={s.menuToggle} aria-expanded={mobileOpen} aria-controls="topbar-menu" onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? 'Fechar menu' : 'Menu'}
        </button>
        <ul id="topbar-menu" className={s.groups} data-open={mobileOpen || undefined}>
          <li className={s.quickMobile}>
            <QuickProducerSearch onPick={(id) => router.push(`/produtores/${id}`)} />
          </li>
          {MENU_GROUPS.map((group) => {
            if (group.href) {
              return (
                <li key={group.label}>
                  <Link href={group.href} className={s.item} aria-current={current === group.href ? 'page' : undefined}>
                    {group.label}
                  </Link>
                </li>
              );
            }
            const open = openGroup === group.label;
            const groupActive = group.items?.some((item) => item.href === current);
            const submenuId = `submenu-${normalize(group.label)}`;
            return (
              <li
                key={group.label}
                className={s.group}
                onMouseEnter={() => hoverable() && setOpenGroup(group.label)}
                onMouseLeave={() => hoverable() && setOpenGroup((g) => (g === group.label ? null : g))}
              >
                <button
                  type="button"
                  className={s.item}
                  data-group={group.label}
                  data-active={groupActive || undefined}
                  aria-expanded={open}
                  aria-controls={submenuId}
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setOpenGroup(group.label);
                      requestAnimationFrame(() => document.getElementById(submenuId)?.querySelector<HTMLElement>('a')?.focus());
                    }
                  }}
                >
                  {group.label}
                </button>
                <ul id={submenuId} className={s.submenu} hidden={!open}>
                  {group.items?.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={current === item.href ? 'page' : undefined} onClick={() => { setOpenGroup(null); setMobileOpen(false); }}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <Link href="/configuracoes" className={`${s.item} ${s.settings}`} aria-current={pathname.startsWith('/configuracoes') ? 'page' : undefined}>
          Configurações
        </Link>
      </nav>

      <dialog ref={search} className={s.search} aria-labelledby="nav-search-title" onClick={(event) => { if (event.target === event.currentTarget) search.current?.close(); }}>
        <div className={s.searchHead}>
          <h2 id="nav-search-title">Ir para uma página</h2>
          <button type="button" className={s.closeButton} onClick={() => search.current?.close()} >Fechar</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (results[0]) { search.current?.close(); router.push(results[0].href); } }}>
          <label className={s.searchField}>
            <span className={s.searchLabel}>Nome da página</span>
            <input placeholder="Ex.: Produtores, Visitas, Mapa" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </form>
        <nav className={s.results} aria-label="Resultados da pesquisa">
          {results.map((item) => <Link key={item.href} href={item.href} onClick={() => search.current?.close()}>{item.label}</Link>)}
          {!results.length && <p role="status">Nenhuma página encontrada.</p>}
        </nav>
        <div className={s.searchFoot}>Enter para abrir a primeira página · Esc para fechar</div>
      </dialog>
    </header>
  );
}

/* "Consultar produtor": busca por nome ou CPF com a mesma rota da lista de produtores. */
function QuickProducerSearch({ onPick, className }: { onPick: (id: string) => void; className?: string }) {
  const id = useId();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const term = useDebounced(text.trim());
  const [items, setItems] = useState<ProducerSummary[] | null>(null);

  useEffect(() => {
    if (!term) {
      setItems(null);
      return;
    }
    let alive = true;
    listProducers(term)
      .then((d) => alive && setItems(d.items.slice(0, 6)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [term]);

  const show = focused && items !== null;

  return (
    <div className={`${s.quick} ${className ?? ''}`} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}>
      <label htmlFor={id} className={s.srOnly}>Consultar produtor</label>
      <input
        id={id}
        type="search"
        className={s.quickInput}
        placeholder="Consultar produtor (nome ou CPF)"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        aria-controls={`${id}-results`}
        aria-expanded={show}
      />
      {show && (
        <ul id={`${id}-results`} className={s.quickResults}>
          {items.length === 0 ? (
            <li className={s.quickEmpty}>Nenhum produtor encontrado.</li>
          ) : (
            items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setText(''); setFocused(false); onPick(p.id); }}>
                  <strong>{p.name}</strong>
                  <span>{p.community} · <span className="num">{p.cpf}</span></span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
