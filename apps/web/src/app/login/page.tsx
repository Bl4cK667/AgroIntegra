'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, login } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado.');
      setLoading(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            🌱
          </span>
          <div>
            <h1>AgroIntegra</h1>
            <p>Assistência técnica rural</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className={styles.form} noValidate>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className={styles.hint}>
          Demonstração: <code>coordenacao@agrointegra.demo</code> ou <code>tecnico@agrointegra.demo</code>, senha{' '}
          <code>demo1234</code>.
        </p>
      </section>
    </main>
  );
}
