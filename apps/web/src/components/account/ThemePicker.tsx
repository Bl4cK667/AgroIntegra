'use client';

import { CSSProperties, useState } from 'react';
import { ApiError } from '@/lib/api';
import { saveTheme, ThemeId, THEMES, useTheme } from '@/lib/theme';
import s from './themePicker.module.css';

// Miniatura viva do tema: aplica data-palette e data-theme para herdar os tokens reais de themes.css.
function Preview({ id, mode }: { id: ThemeId; mode: 'light' | 'dark' }) {
  return (
    <span className={s.preview} data-palette={id} data-theme={mode} aria-hidden="true">
      <span className={s.previewTop}>
        <span className={s.previewLogo} />
        <span className={s.previewNav}>
          <span className={s.previewNavItem} data-on />
          <span className={s.previewNavItem} />
          <span className={s.previewNavItem} />
        </span>
        <span className={s.previewAvatar} />
      </span>
      <span className={s.previewBody}>
        <span className={s.previewCard}>
          <span className={s.previewLine} />
          <span className={s.previewSubline} />
        </span>
        <span className={s.previewCard}>
          <span className={s.previewLine} />
          <span className={s.previewSubline} />
        </span>
        <span className={s.previewChart}>
          <span className={s.previewBar} style={{ height: '48%' }} />
          <span className={s.previewBar} style={{ height: '78%' }} />
          <span className={s.previewBar} style={{ height: '62%' }} />
          <span className={s.previewBar} style={{ height: '92%' }} />
        </span>
      </span>
    </span>
  );
}

export function ThemePicker({ index = 5 }: { index?: number }) {
  const { themeId } = useTheme();
  const [saving, setSaving] = useState<ThemeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function choose(id: ThemeId, label: string) {
    if (id === themeId || saving) return;
    setError(null);
    setNotice(null);
    setSaving(id);
    try {
      await saveTheme(id);
      setNotice(`Tema alterado para ${label}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o tema. Tente novamente.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className={`card enter ${s.section}`} style={{ '--i': index } as CSSProperties} aria-labelledby="sec-aparencia">
      <div className="card-head">
        <h2 id="sec-aparencia" className="card-title">
          Aparência
        </h2>
      </div>
      <p className={s.lead}>Escolha o tema visual do sistema. A mudança é imediata, vale em todas as páginas e fica salva na sua conta.</p>

      <div className={s.options} role="radiogroup" aria-labelledby="sec-aparencia">
        {THEMES.map((item) => {
          const selected = item.id === themeId;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={s.option}
              data-selected={selected || undefined}
              disabled={saving !== null}
              onClick={() => choose(item.id, item.label)}
            >
              <Preview id={item.id} mode={item.mode} />
              <span className={s.meta}>
                <span className={s.radio} aria-hidden="true" />
                <span className={s.text}>
                  <strong>
                    {item.label}
                    <span className={s.badge}>{item.mode === 'light' ? 'Claro' : 'Escuro'}</span>
                  </strong>
                  <small>{saving === item.id ? 'Aplicando…' : item.description}</small>
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
