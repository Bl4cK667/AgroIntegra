'use client';

import { checkRequiredFields, clearFieldError } from '@/components/property/formValidation';
import { FormFeedback } from '@/components/property/FormFeedback';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { BrandLogo } from '@/components/Brand';
import { ApiError, login } from '@/lib/api';
import styles from './login.module.css';

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

  // Cartão estreito e centralizado: logo em destaque, faixa de título e formulário com rótulos claros.
  return (
    <main className={styles.page}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <BrandLogo width={260} />
        </div>

        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.cardHead}>
            <h1 id="login-title" className={styles.title}>Acesso ao sistema</h1>
          </div>

          <form onSubmit={onSubmit} className={styles.form} onInput={clearFieldError} noValidate>
            <p className={styles.legend}>Campos marcados com <span className={styles.star}>*</span> são obrigatórios.</p>
            <FormFeedback />
            <label className="field req">
              <span>E-mail</span>
              <input
                className="input"
                type="email" name="email" required data-required-message="Informe o e-mail da sua conta." disabled={loading} placeholder="seuemail@exemplo.com"
                autoComplete="username"
                aria-describedby="login-email-help"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <small id="login-email-help">O mesmo e-mail usado no convite de acesso.</small>
            </label>
            <label className="field req">
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
            <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </section>

        <p className={styles.org}>
          Secretaria Municipal de Agricultura
          <br />
          Assistência técnica e extensão rural, do cadastro do produtor ao relatório da visita.
        </p>
      </div>
    </main>
  );
}
