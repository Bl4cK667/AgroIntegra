'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { WidgetCatalog } from '@/components/dashboard/WidgetCatalog';
import { useDashboardLayout } from '@/components/dashboard/useDashboardLayout';
import { ApiError, Dashboard, getDashboard } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import styles from '@/components/dashboard/dashboard.module.css';

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Esqueleto com o mesmo desenho do layout padrão, para a página não "pular" ao carregar.
const SKELETON = [3, 3, 3, 3, 8, 4, 8, 4].map((w, i) => ({ w, h: i < 4 ? 2 : 4 }));

// Todos os números vêm da API, calculados do banco a cada carregamento.
// A disposição dos widgets é do usuário e fica salva neste navegador.
export default function PainelPage() {
  const user = useSession();
  const { theme, toggle } = useTheme();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const board = useDashboardLayout(user?.id);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o painel.'));
  }, []);

  useEffect(() => {
    if (!editing || catalog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, catalog]);

  const closeCatalog = useCallback(() => setCatalog(false), []);

  function add(type: string) {
    board.add(type);
    setCatalog(false);
    setEditing(true);
    // O novo widget entra no fim da grade: leva a tela até ele.
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  }

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div>
          <h1 className={styles.toolbarTitle}>
            Painel de indicadores
          </h1>
          <p className={styles.toolbarSub}>
            {data ? `Números de ${MONTHS[data.month - 1]} de ${data.year}, calculados agora.` : 'Carregando indicadores…'}
          </p>
        </div>

        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>

          {editing ? (
            <>
              <button type="button" className={styles.toolBtn} onClick={() => setCatalog(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Adicionar widget
              </button>
              <button type="button" className={styles.toolBtnPrimary} onClick={() => setEditing(false)}>
                Concluir
              </button>
            </>
          ) : (
            <button type="button" className={styles.toolBtn} onClick={() => setEditing(true)} disabled={!data}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" />
                <rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" />
              </svg>
              Personalizar
            </button>
          )}
        </div>
      </header>

      {editing && (
        <p className={styles.editHint} role="status">
          <span>
            Arraste pela alça ⠿ para reorganizar, puxe o canto inferior direito para redimensionar e use × para
            remover. Tudo é salvo automaticamente.
          </span>
        </p>
      )}

      {error && <p className="alert">{error}</p>}

      {!data && !error && (
        <div className={styles.grid} aria-busy="true" aria-label="Carregando indicadores">
          {SKELETON.map((s, i) => (
            <div key={i} className={styles.item} style={{ '--w': s.w, '--h': s.h, '--i': i } as React.CSSProperties}>
              <div className={styles.skeleton} />
            </div>
          ))}
        </div>
      )}

      {data && board.loaded && board.layout.length > 0 && (
        <DashboardGrid
          layout={board.layout}
          data={data}
          editing={editing}
          onMove={board.move}
          onShift={board.shift}
          onResize={board.resize}
          onRemove={board.remove}
        />
      )}

      {data && board.loaded && board.layout.length === 0 && (
        <div className={styles.empty}>
          <strong>Seu painel está vazio</strong>
          <p className="muted">Adicione os indicadores que você quer acompanhar.</p>
          <div className={styles.toolbarActions}>
            <button type="button" className={styles.toolBtnPrimary} onClick={() => { setEditing(true); setCatalog(true); }}>
              Adicionar widget
            </button>
            <button type="button" className={styles.toolBtn} onClick={board.reset}>
              Restaurar padrão
            </button>
          </div>
        </div>
      )}

      {catalog && (
        <WidgetCatalog
          layout={board.layout}
          onAdd={add}
          onReset={() => { board.reset(); setCatalog(false); }}
          onClose={closeCatalog}
        />
      )}
    </div>
  );
}
