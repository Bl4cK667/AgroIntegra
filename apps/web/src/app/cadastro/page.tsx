'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { BrandLogo } from '@/components/Brand';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { RegistrationInviteInfo, registerWithInvitation, validateRegistrationToken } from '@/lib/invitations';
import {
  extractInviteToken,
  isValidBrPhone,
  isValidFullName,
  isValidRegistrationPassword,
  phoneInput,
} from '@/lib/invite-token';
import styles from './cadastro.module.css';


type PagePhase = 'validating' | 'invalid' | 'ready' | 'success';

export default function CadastroPage() {
  const tokenRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<PagePhase>('validating');
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<RegistrationInviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Formulário em 2 etapas para facilitar o preenchimento
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenRef.current) {
      const extracted = extractInviteToken(window.location.hash);
      // Limpa o fragmento/query da barra de endereços e do histórico sem perder o estado em memória.
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      tokenRef.current = extracted;
    }

    const activeToken = tokenRef.current;
    if (!activeToken) {
      setInviteError(
        'O acesso ao AgroIntegra é restrito a usuários convidados pela coordenação. Abra o link completo enviado no seu convite.',
      );
      setPhase('invalid');
      return;
    }

    let cancelled = false;
    setToken(activeToken);
    validateRegistrationToken(activeToken)
      .then((info) => {
        if (cancelled) return;
        setInvite(info);
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível validar o convite. Solicite um novo link à coordenação.',
        );
        setPhase('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function onNextStep(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isValidFullName(name)) {
      setFormError('Informe seu nome completo (nome e sobrenome).');
      return;
    }
    if (!isValidBrPhone(phone)) {
      setFormError('Informe um telefone válido com DDD (10 ou 11 dígitos).');
      return;
    }
    setStep(2);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !token || !invite) return;
    setFormError(null);

    if (!isValidRegistrationPassword(password)) {
      setFormError('A senha precisa ter de 8 a 72 caracteres, com letras e números.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('A confirmação não confere com a senha digitada.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerWithInvitation({
        token,
        name,
        email: invite.email,
        phone,
        password,
      });
      setSuccessMessage(res.message || 'Sua conta foi criada com sucesso. Você já pode entrar no sistema.');
      setPassword('');
      setConfirmPassword('');
      tokenRef.current = null;
      setToken(null);
      setPhase('success');
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível concluir seu cadastro. Confira os dados e tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.formSide}>
        <div className={styles.brand}>
          <BrandLogo width={260} />
        </div>
        <div className={styles.formBox}>

          {phase === 'validating' && (
            <div className={styles.stateBox} role="status" aria-label="Validando convite">
              <span className="eyebrow">Acesso por convite</span>
              <h1 className={styles.title}>Validando seu convite…</h1>
              <p>Aguarde um instante enquanto confirmamos a autorização do seu acesso.</p>
              <div className={styles.loadingSkeleton} aria-hidden="true">
                <div className={`skeleton ${styles.skelLine}`} />
                <div className={`skeleton ${styles.skelLine}`} />
              </div>
            </div>
          )}

          {phase === 'invalid' && (
            <div className={styles.stateBox}>
              <span className="eyebrow">Acesso restrito</span>
              <h1 className={styles.title}>Convite necessário</h1>
              <p role="alert" className="alert">
                {inviteError}
              </p>
              <Link href="/login" className="btn btn-secondary">
                Ir para o login
              </Link>
            </div>
          )}

          {phase === 'ready' && invite && (
            <>
              <span className="eyebrow">Cadastro por convite</span>
              <h1 className={styles.title}>Criar sua conta</h1>
              <p className={styles.subtitle}>Preencha seus dados em duas etapas rápidas para liberar seu acesso.</p>

              <div className={styles.inviteBanner}>
                <strong>{invite.organizationName}</strong>
                <span>Convite válido até {formatDate(invite.expiresAt)}</span>
              </div>

              <div className={styles.steps} aria-label="Etapas do cadastro">
                <div className={`${styles.step} ${step === 1 ? styles.stepActive : styles.stepDone}`}>
                  <span className={styles.stepNum}>Etapa 1</span>
                  <span>Seus dados{step === 2 ? ' (concluída)' : ''}</span>
                </div>
                <div className={`${styles.step} ${step === 2 ? styles.stepActive : ''}`}>
                  <span className={styles.stepNum}>Etapa 2</span>
                  <span>Senha de acesso</span>
                </div>
              </div>

              {step === 1 ? (
                <form onSubmit={onNextStep} className={styles.form} noValidate>
                  <p className={styles.hint}>Campos marcados com <span className={styles.star}>*</span> são obrigatórios.</p>
                  <label className="field">
                    <span>E-mail autorizado</span>
                    <input
                      className={`input ${styles.readonlyInput}`}
                      type="email"
                      value={invite.email}
                      readOnly
                      aria-readonly="true"
                    />
                    <span className={styles.hint}>Definido pelo convite da coordenação.</span>
                  </label>

                  <label className="field req">
                    <span>Nome completo</span>
                    <input
                      className="input"
                      type="text"
                      name="name"
                      required
                      autoComplete="name"
                      placeholder="Ex.: Maria Aparecida Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label className="field req">
                    <span>Telefone (WhatsApp)</span>
                    <input
                      className="input"
                      type="tel"
                      name="phone"
                      required
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(phoneInput(e.target.value))}
                    />
                    <span className={styles.hint}>Usado pela coordenação para combinar visitas.</span>
                  </label>

                  {formError && (
                    <p role="alert" className="alert">
                      {formError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button type="submit" className="btn btn-primary">
                      Continuar
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={onSubmit} className={styles.form} noValidate>
                  <label className="field req">
                    <span>Crie uma senha</span>
                    <div className={styles.passwordWrap}>
                      <input
                        className="input"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        required
                        autoComplete="new-password"
                        disabled={submitting}
                        placeholder="Mínimo de 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.togglePass}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    <span className={styles.hint}>De 8 a 72 caracteres, com letras e números.</span>
                  </label>

                  <label className="field req">
                    <span>Confirmar senha</span>
                    <input
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      required
                      autoComplete="new-password"
                      disabled={submitting}
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </label>

                  {formError && (
                    <p role="alert" className="alert">
                      {formError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={submitting}
                      onClick={() => {
                        setFormError(null);
                        setStep(1);
                      }}
                    >
                      Voltar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Criando conta…' : 'Concluir cadastro'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {phase === 'success' && (
            <div className={styles.stateBox}>
              <span className="eyebrow">Conta ativada</span>
              <h1 className={styles.title}>Cadastro concluído</h1>
              <p role="status" className="notice">
                {successMessage}
              </p>
              <Link href="/login" className="btn btn-primary">
                Entrar no AgroIntegra
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
