'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandSymbol } from '@/components/Brand';
import { Sidebar, useNavCollapsed } from '@/components/nav/AppNav';
import { Topbar } from '@/components/nav/Topbar';
import { ACCOUNT_UPDATED_EVENT } from '@/lib/account';
import { clearSession, fetchMe, getToken, SessionUser } from '@/lib/api';
import { syncNavStyle, useNavStyle } from '@/lib/navStyle';
import { SessionContext } from '@/lib/session';
import { syncTheme, useTheme } from '@/lib/theme';
import styles from './shell.module.css';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [collapsed, setCollapsed] = useNavCollapsed();
  useTheme(); // aplica o tema salvo em qualquer página do app, não só no painel
  const navStyle = useNavStyle(); // Topbar (padrão) ou Sidebar, escolhido em Configurações

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then((me) => {
        syncNavStyle(me.navStyle); // aplica a preferência do perfil antes de desenhar o menu
        syncTheme(me.theme); // o tema da conta vale em qualquer dispositivo
        setUser(me);
      })
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  // Nome ou foto alterados em Configurações aparecem no menu sem recarregar a página.
  useEffect(() => {
    const onUpdate = () => fetchMe().then(setUser).catch(() => undefined);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ACCOUNT_UPDATED_EVENT, onUpdate);
  }, []);

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
      {/* Os dois estilos usam as mesmas rotas e páginas; só a moldura muda. */}
      <div className={styles.shell} data-nav={navStyle} data-collapsed={(navStyle === 'sidebar' && collapsed) || undefined}>
        {navStyle === 'topbar' ? (
          <Topbar user={user} onLogout={logout} />
        ) : (
          <Sidebar user={user} onLogout={logout} collapsed={collapsed} onCollapsedChange={setCollapsed} />
        )}
        <main className={styles.content}>{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
