'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { AppNav, useNavCollapsed } from '@/components/nav/AppNav';
import { clearSession, fetchMe, getToken, SessionUser } from '@/lib/api';
import { SessionContext } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import styles from './shell.module.css';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [collapsed, setCollapsed] = useNavCollapsed();
  useTheme(); // aplica o tema salvo em qualquer página do app, não só no painel

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
    return (
      <div className={styles.loading} role="status" aria-label="Carregando">
        <span className={styles.loadingMark}>
          <BrandSymbol size={44} />
        </span>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={user}>
      <div className={styles.shell} data-collapsed={collapsed || undefined}>
        <AppNav user={user} onLogout={logout} collapsed={collapsed} onCollapsedChange={setCollapsed} />
        <main className={styles.content}>{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
