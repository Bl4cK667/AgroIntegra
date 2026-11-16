'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { clearSession, fetchMe, getToken, ROLE_LABEL, SessionUser } from '@/lib/api';
import { SessionContext } from '@/lib/session';
import styles from './shell.module.css';

// O menu mostra só o que já existe. Os demais módulos entram conforme ficam prontos.
const MENU = [
  { href: '/painel', label: 'Painel' },
  { href: '/produtores', label: 'Produtores' },
  { href: '/propriedades', label: 'Propriedades' },
  { href: '/solicitacoes', label: 'Solicitações' },
  { href: '/visitas', label: 'Visitas' },
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
          <Link href="/painel" className={styles.brand}>
            <BrandSymbol size={34} />
            <span>AgroIntegra</span>
          </Link>
          <nav className={styles.nav} aria-label="Principal">
            {MENU.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? styles.navActive : styles.navLink}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className={styles.userBox}>
            <span className={styles.userName}>{user.name}</span>
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
