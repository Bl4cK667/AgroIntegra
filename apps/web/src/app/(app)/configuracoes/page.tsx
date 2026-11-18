'use client';

import Link from 'next/link';
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/account/Avatar';
import { NavStylePicker } from '@/components/account/NavStylePicker';
import { ThemePicker } from '@/components/account/ThemePicker';
import { Toast } from '@/components/feedback/Toast';
import {
  AccountProfile,
  changePassword,
  getAccount,
  notifyAccountUpdated,
  removeAvatar,
  updateAccount,
  uploadAvatar,
} from '@/lib/account';
import { ApiError, ROLE_LABEL } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from './configuracoes.module.css';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

export default function ConfiguracoesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dados pessoais
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Foto de perfil
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getAccount()
      .then((data) => {
        setAccount(data);
        setName(data.name);
        setPhone(data.phone ?? '');
        setJobTitle(data.jobTitle ?? '');
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar suas informações.');
      });
  }, []);

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setPhotoNotice(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Escolha uma imagem no formato JPG, PNG ou WebP.');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setPhotoError('A foto é muito grande. Escolha uma imagem de até 2 MB.');
      return;
    }

    setSavingPhoto(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const updated = await uploadAvatar(dataUrl);
      setAccount(updated);
      notifyAccountUpdated();
      setPhotoNotice('Foto de perfil atualizada com sucesso.');
      setToast('Foto de perfil atualizada com sucesso.');
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Não foi possível enviar a foto.');
    } finally {
      setSavingPhoto(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoError(null);
    setPhotoNotice(null);
    setSavingPhoto(true);
    try {
      const updated = await removeAvatar();
      setAccount(updated);
      notifyAccountUpdated();
      setPhotoNotice('Foto de perfil removida.');
      setToast('Foto de perfil removida.');
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Não foi possível remover a foto.');
    } finally {
      setSavingPhoto(false);
    }
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setProfileError('Informe seu nome completo.');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateAccount({
        name: trimmedName,
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
      });
      setAccount(updated);
      setName(updated.name);
      setPhone(updated.phone ?? '');
      setJobTitle(updated.jobTitle ?? '');
      notifyAccountUpdated();
      setProfileNotice('Seus dados foram salvos com sucesso.');
      setToast('Seus dados foram salvos com sucesso.');
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível salvar os dados.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);

    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não confere com a nova senha.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice('Sua senha foi alterada com sucesso.');
      setToast('Sua senha foi alterada com sucesso.');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <header className="page-head enter">
        <div>
          <span className="eyebrow">Sua conta</span>
          <h1>Configurações</h1>
          <p>Gerencie sua foto, seus dados de contato, a senha de acesso e a aparência do sistema.</p>
        </div>
      </header>

      {loadError && (
        <p role="alert" className="alert">
          {loadError}
        </p>
      )}

      {!account && !loadError && (
        <div className={styles.loadingGrid} role="status" aria-label="Carregando configurações da conta">
          <div className={`skeleton ${styles.loadingCard}`} />
          <div className={`skeleton ${styles.loadingCard}`} />
        </div>
      )}

      {account && (
        <div className={styles.grid}>
          <div className={styles.stack}>
            {/* Seção 1: Foto de perfil */}
            <section className="card enter" style={{ '--i': 1 } as CSSProperties} aria-labelledby="sec-foto">
              <div className="card-head">
                <span className="card-icon">
                  <Icon path="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                </span>
                <h2 id="sec-foto" className="card-title">
                  Foto de perfil
                </h2>
              </div>

              <div className={styles.profileRow}>
                <Avatar
                  name={account.name}
                  size={84}
                  hasAvatar={account.hasAvatar}
                  cacheKey={account.avatarUpdatedAt}
                />
                <div className={styles.profileMeta}>
                  <strong>{account.name}</strong>
                  <span>{account.jobTitle || ROLE_LABEL[account.role]}</span>
                  <span>Envie uma foto JPG, PNG ou WebP de até 2 MB.</span>
                </div>
              </div>

              <div className={styles.photoActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPickPhoto}
                  className={styles.fileInput}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {savingPhoto ? 'Enviando…' : account.hasAvatar ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {account.hasAvatar && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingPhoto}
                    onClick={onRemovePhoto}
                  >
                    Remover foto
                  </button>
                )}
              </div>

              {photoError && (
                <p role="alert" className="alert" style={{ marginTop: 14 }}>
                  {photoError}
                </p>
              )}
              {photoNotice && (
                <p role="status" className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
                  {photoNotice}
                </p>
              )}
            </section>

            {/* Seção 2: Dados pessoais */}
            <section className="card enter" style={{ '--i': 2 } as CSSProperties} aria-labelledby="sec-dados">
              <div className="card-head">
                <span className="card-icon">
                  <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                </span>
                <h2 id="sec-dados" className="card-title">
                  Dados pessoais
                </h2>
              </div>

              <form onSubmit={onSaveProfile} className={styles.form} noValidate>
                <label className="field">
                  <span>
                    Nome completo
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    className="input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Maria Aparecida Silva"
                  />
                  <small>Como seu nome aparece nos relatórios e atendimentos.</small>
                </label>

                <label className="field">
                  <span>Telefone para contato</span>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex.: (31) 99999-0000"
                  />
                  <small>Opcional. Facilita o contato da equipe em campo.</small>
                </label>

                <label className="field">
                  <span>Cargo ou função</span>
                  <input
                    className="input"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex.: Técnico agropecuário"
                  />
                </label>

                {profileError && (
                  <p role="alert" className="alert">
                    {profileError}
                  </p>
                )}
                {profileNotice && (
                  <p role="status" className="notice" style={{ marginBottom: 0 }}>
                    {profileNotice}
                  </p>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                    {savingProfile ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            </section>
          </div>

          <div className={styles.stack}>
            {/* Seção 3: Segurança da conta */}
            <section className="card enter" style={{ '--i': 3 } as CSSProperties} aria-labelledby="sec-senha">
              <div className="card-head">
                <span className="card-icon">
                  <Icon path="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />
                </span>
                <h2 id="sec-senha" className="card-title">
                  Segurança e senha
                </h2>
              </div>

              <form onSubmit={onChangePassword} className={styles.form} noValidate>
                <label className="field">
                  <span>
                    Senha atual
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                </label>

                <label className="field">
                  <span>
                    Nova senha
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                  />
                  <small>Use pelo menos 6 caracteres.</small>
                </label>

                <label className="field">
                  <span>
                    Confirmar nova senha
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a nova senha novamente"
                  />
                </label>

                {passwordError && (
                  <p role="alert" className="alert">
                    {passwordError}
                  </p>
                )}
                {passwordNotice && (
                  <p role="status" className="notice" style={{ marginBottom: 0 }}>
                    {passwordNotice}
                  </p>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                    {savingPassword ? 'Atualizando…' : 'Atualizar senha'}
                  </button>
                </div>
              </form>
            </section>

            {/* Seção 4: Sobre a conta */}
            <section className="card enter" style={{ '--i': 4 } as CSSProperties} aria-labelledby="sec-sobre">
              <div className="card-head">
                <span className="card-icon">
                  <Icon path="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4m0 4h.01" />
                </span>
                <h2 id="sec-sobre" className="card-title">
                  Sobre a conta
                </h2>
              </div>

              <dl className={styles.infoList}>
                <div className={styles.infoItem}>
                  <dt>E-mail de acesso</dt>
                  <dd>{account.email}</dd>
                </div>
                <div className={styles.infoItem}>
                  <dt>Perfil no sistema</dt>
                  <dd>
                    <span className="badge badge-success">{ROLE_LABEL[account.role]}</span>
                  </dd>
                </div>
                <div className={styles.infoItem}>
                  <dt>Membro desde</dt>
                  <dd>{formatDate(account.createdAt)}</dd>
                </div>
              </dl>
            </section>

            {/* Administração de convites: exibida apenas para Coordenação */}
            {account.role === 'COORDINATION' && (
              <section className="card enter" style={{ '--i': 5 } as CSSProperties} aria-labelledby="sec-convites">
                <div className="card-head">
                  <span className="card-icon">
                    <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </span>
                  <h2 id="sec-convites" className="card-title">
                    Equipe e convites
                  </h2>
                </div>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: '0.92rem' }}>
                  Gere e gerencie links de convite individuais para novos membros da organização.
                </p>
                <div className="form-actions">
                  <Link href="/configuracoes/usuarios" className="btn btn-secondary">
                    Gerenciar convites e usuários
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {/* Seção 5: Aparência (escolha do tema visual) */}
      {account && <ThemePicker index={5} />}
      {/* Seção 6: Personalização da interface (escolha da navegação) */}
      {account && <NavStylePicker index={6} />}
      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}
