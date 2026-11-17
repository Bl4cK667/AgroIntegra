'use client';

import { checkRequiredFields, clearFieldError } from '@/components/property/formValidation';
import { FormFeedback } from '@/components/property/FormFeedback';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { BrandLogo } from '@/components/Brand';
import { contourPaths } from '@/components/contours';
import { ApiError, login } from '@/lib/api';
import styles from './login.module.css';

// Dois "morros" de curvas de nível, como numa carta topográfica.
const HILL_A = contourPaths({ cx: 180, cy: 620, rings: 16, baseRadius: 26, step: 30, seed: 11 });
const HILL_B = contourPaths({ cx: 560, cy: 170, rings: 11, baseRadius: 18, step: 28, seed: 23, wobble: 0.22 });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !checkRequiredFields(e.currentTarget)) return;
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.land} aria-hidden="true">
        <svg className={styles.contours} viewBox="0 0 720 800" preserveAspectRatio="xMidYMid slice">
          {HILL_A.map((d, i) => (
            <path key={`a${i}`} d={d} className={i % 5 === 4 ? styles.index : styles.line} />
          ))}
          {HILL_B.map((d, i) => (
            <path key={`b${i}`} d={d} className={i % 5 === 4 ? styles.index : styles.line} />
          ))}
        </svg>
        <div className={`${styles.landText} enter`}>
          <p className={styles.org}>Secretaria Municipal de Agricultura</p>
          <p className={styles.tagline}>Assistência técnica e extensão rural, do cadastro do produtor ao relatório da visita.</p>
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={`${styles.formBox} enter`} style={{ '--i': 1 } as React.CSSProperties}>
          <div className={styles.brand}>
            <BrandLogo width={236} />
          </div>

          <span className="eyebrow">Acesso ao sistema</span>
          <h1 className={styles.title}>Entrar</h1>

          <form onSubmit={onSubmit} className={styles.form} onInput={clearFieldError} noValidate>
            <FormFeedback />
            <label className="field">
              <span>E-mail</span>
              <input
                className="input"
                type="email" name="email" required data-required-message="Informe o e-mail da sua conta." disabled={loading} placeholder="seuemail@exemplo.com"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                className="input"
                type="password" name="password" required data-required-message="Informe sua senha." disabled={loading}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
