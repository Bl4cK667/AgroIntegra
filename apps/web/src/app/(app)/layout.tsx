'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, fetchMe, getToken, ROLE_LABEL, SessionUser } from '@/lib/api';
import { SessionContext } from '@/lib/session';
import styles from './shell.module.css';

// Itens do menu. Os marcados como "soon" chegam nas próximas fases.
const MENU = [
  { href: '/painel', label: 'Painel' },
  { href: '/produtores', label: 'Produtores', soon: true },
  { href: '/propriedades', label: 'Propriedades', soon: true },
  { href: '/solicitacoes', label: 'Solicitações', soon: true },
  { href: '/visitas', label: 'Visitas', soon: true },
  { href: '/programas', label: 'Programas', soon: true },
  { href: '/relatorios', label: 'Relatórios', soon: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  if (!user) {
    return <div className={styles.loading}>Carregando…</div>;
  }

  return (
    <SessionContext.Provider value={user}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span aria-hidden>🌱</span> AgroIntegra
          </div>
          <nav className={styles.nav}>
            {MENU.map((item) =>
              item.soon ? (
                <span key={item.href} className={styles.navSoon} title="Disponível em breve">
                  {item.label}
                  <small>em breve</small>
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={pathname === item.href ? styles.navActive : styles.navLink}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className={styles.userBox}>
            <strong>{user.name}</strong>
            <span className={styles.role}>{ROLE_LABEL[user.role]}</span>
            <button onClick={logout} className={styles.logout}>
              Sair
            </button>
          </div>
        </aside>
        <main className={styles.content}>{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
