'use client';

import { CSSProperties, useState } from 'react';
import { ApiError } from '@/lib/api';
import { NavStyle, saveNavStyle, useNavStyle } from '@/lib/navStyle';
import s from './navStylePicker.module.css';

const OPTIONS: { value: NavStyle; title: string; hint: string; badge?: string }[] = [
  {
    value: 'topbar',
    title: 'Topbar horizontal',
    hint: 'Menu no topo da tela, mais espaço para o conteúdo.',
    badge: 'Recomendada',
  },
  {
    value: 'sidebar',
    title: 'Sidebar lateral',
    hint: 'Menu fixo à esquerda, que pode ser recolhido.',
  },
];

// Miniatura da tela com cada estilo, desenhada só com CSS (sem imagens).
function Preview({ style }: { style: NavStyle }) {
  return (
    <span className={s.preview} data-style={style} aria-hidden="true">
      <span className={s.bar}>
        <span className={s.logo} />
        <span className={s.links}>
          {Array.from({ length: style === 'topbar' ? 5 : 6 }, (_, i) => (
            <span key={i} className={s.linkDot} data-on={i === 1 || undefined} />
          ))}
        </span>
        <span className={s.avatar} />
      </span>
      <span className={s.body}>
        <span className={s.block} />
        <span className={s.block} />
        <span className={`${s.block} ${s.wide}`} />
      </span>
    </span>
  );
}

export function NavStylePicker({ index = 5 }: { index?: number }) {
  const current = useNavStyle();
  const [saving, setSaving] = useState<NavStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function choose(value: NavStyle) {
    if (value === current || saving) return;
    setError(null);
    setNotice(null);
    setSaving(value);
    try {
      await saveNavStyle(value);
      setNotice(value === 'topbar' ? 'Navegação alterada para Topbar horizontal.' : 'Navegação alterada para Sidebar lateral.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar sua preferência. Tente novamente.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className={`card enter ${s.section}`} style={{ '--i': index } as CSSProperties} aria-labelledby="sec-interface">
      <div className="card-head">
        <span className="card-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M3 9h18M8 9v11" />
          </svg>
        </span>
        <h2 id="sec-interface" className="card-title">
          Personalização da interface
        </h2>
      </div>
      <p className={s.lead}>Escolha como o menu de navegação aparece. A mudança vale na hora, em todas as páginas, e fica salva no seu perfil.</p>

      <div className={s.options} role="radiogroup" aria-labelledby="sec-interface">
        {OPTIONS.map((opt) => {
          const selected = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={s.option}
              data-selected={selected || undefined}
              disabled={saving !== null}
              onClick={() => choose(opt.value)}
            >
              <Preview style={opt.value} />
              <span className={s.meta}>
                <span className={s.radio} aria-hidden="true" />
                <span className={s.text}>
                  <strong>
                    {opt.title}
                    {opt.badge && <span className={s.badge}>{opt.badge}</span>}
                  </strong>
                  <small>{saving === opt.value ? 'Aplicando…' : opt.hint}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="alert" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </p>
      )}
      <p role="status" className={s.status}>
        {notice}
      </p>
    </section>
  );
}
