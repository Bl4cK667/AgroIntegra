'use client';

import Link from 'next/link';
import { CSSProperties, FormEvent, useCallback, useEffect, useState } from 'react';
import { Toast } from '@/components/feedback/Toast';
import { ApiError, ROLE_LABEL, Role } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  CreatedInvitation,
  createInvitation,
  getInvitationStatus,
  InvitationStatus,
  InvitationSummary,
  listInvitations,
  revokeInvitation,
} from '@/lib/invitations';
import { useSession } from '@/lib/session';
import styles from './usuarios.module.css';

const STATUS_BADGE: Record<InvitationStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'badge badge-accent' },
  USED: { label: 'Utilizado', className: 'badge badge-success' },
  REVOKED: { label: 'Revogado', className: 'badge' },
  EXPIRED: { label: 'Expirado', className: 'badge badge-warn' },
};

export default function UsuariosConvitesPage() {
  const session = useSession();
  const isCoordination = session?.role === 'COORDINATION';

  const [items, setItems] = useState<InvitationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TECHNICIAN');
  const [expiresInHours, setExpiresInHours] = useState<number>(72);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Link de convite exibido uma única vez após a criação.
  const [createdInvite, setCreatedInvite] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await listInvitations();
      setItems(res.items);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Não foi possível carregar os convites.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!isCoordination) return;
    void loadInvitations();
  }, [isCoordination, loadInvitations]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setCreateError('Informe um e-mail válido.');
      return;
    }

    setCreating(true);
    try {
      const created = await createInvitation({
        email: normalizedEmail,
        role,
        expiresInHours,
      });
      setCreatedInvite(created);
      setCopied(false);
      setEmail('');
      setToast('Convite criado. Copie o link antes de sair desta tela.');
      await loadInvitations();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Não foi possível gerar o convite.');
    } finally {
      setCreating(false);
    }
  }

  async function onCopyLink() {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite.registrationUrl);
      setCopied(true);
      setToast('Link de convite copiado.');
    } catch {
      setToast('Não foi possível copiar automaticamente. Selecione e copie o link manualmente.');
    }
  }

  async function onRevoke(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    setListError(null);
    try {
      await revokeInvitation(id);
      setToast('Convite revogado com sucesso.');
      await loadInvitations();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Não foi possível revogar o convite.');
    } finally {
      setRevokingId(null);
    }
  }

  if (session && !isCoordination) {
    return (
      <>
        <header className="page-head enter">
          <div>
            <span className="eyebrow">Administração</span>
            <h1>Convites e usuários</h1>
          </div>
          <Link href="/configuracoes" className="btn btn-secondary">
            Voltar para Configurações
          </Link>
        </header>
        <section className="card">
          <p role="alert" className="alert">
            Acesso restrito. Apenas membros da Coordenação podem gerenciar convites de acesso.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <header className={`page-head enter ${styles.topBar}`}>
        <div>
          <span className="eyebrow">Administração · Coordenação</span>
          <h1>Convites de acesso</h1>
          <p>Gere links individuais com validade limitada para novos membros da sua organização.</p>
        </div>
        <Link href="/configuracoes" className="btn btn-secondary">
          Voltar para Configurações
        </Link>
      </header>

      <div className={styles.grid}>
        <section className="card enter" style={{ '--i': 1 } as CSSProperties} aria-labelledby="sec-novo-convite">
          <div className="card-head">
            <h2 id="sec-novo-convite" className="card-title">
              Novo convite
            </h2>
          </div>

          <form onSubmit={onCreate} className={styles.form} noValidate>
            <label className="field">
              <span>E-mail do convidado</span>
              <input
                className="input"
                type="email"
                name="email"
                required
                disabled={creating}
                placeholder="nome@secretaria.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Perfil de acesso</span>
              <select
                className="input"
                name="role"
                value={role}
                disabled={creating}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="TECHNICIAN">{ROLE_LABEL.TECHNICIAN}</option>
                <option value="COORDINATION">{ROLE_LABEL.COORDINATION}</option>
              </select>
            </label>

            <label className="field">
              <span>Validade do convite</span>
              <select
                className="input"
                name="expiresInHours"
                value={expiresInHours}
                disabled={creating}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
              >
                <option value={24}>24 horas</option>
                <option value={48}>48 horas (2 dias)</option>
                <option value={72}>72 horas (3 dias)</option>
                <option value={168}>7 dias</option>
              </select>
            </label>

            {createError && (
              <p role="alert" className="alert">
                {createError}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Gerando convite…' : 'Gerar link de convite'}
            </button>
          </form>

          {createdInvite && (
            <div className={styles.oneTimeBox} role="region" aria-label="Link de convite gerado">
              <strong>Convite pronto para {createdInvite.email}</strong>
              <p className={styles.oneTimeWarn}>
                Copie este link agora. Por segurança, ele é exibido uma única vez e não poderá ser recuperado depois.
              </p>
              <div className={styles.urlRow}>
                <input
                  className={`input ${styles.urlInput}`}
                  type="text"
                  readOnly
                  value={createdInvite.registrationUrl}
                  aria-label="Link de cadastro do convite"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              <div className={styles.oneTimeActions}>
                <button type="button" className="btn btn-primary" onClick={onCopyLink}>
                  {copied ? 'Link copiado' : 'Copiar link'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setCreatedInvite(null);
                    setCopied(false);
                  }}
                >
                  Ocultar link
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card enter" style={{ '--i': 2 } as CSSProperties} aria-labelledby="sec-lista-convites">
          <div className="card-head">
            <h2 id="sec-lista-convites" className="card-title">
              Convites emitidos
            </h2>
          </div>

          {listError && (
            <p role="alert" className="alert">
              {listError}
            </p>
          )}

          {loadingList ? (
            <div className={styles.loadingList} role="status" aria-label="Carregando convites">
              <div className={`skeleton ${styles.skelRow}`} />
              <div className={`skeleton ${styles.skelRow}`} />
            </div>
          ) : items.length === 0 ? (
            <p className={styles.empty}>Nenhum convite emitido até o momento.</p>
          ) : (
            <div className={styles.list}>
              {items.map((item) => {
                const status = getInvitationStatus(item);
                const badge = STATUS_BADGE[status];
                return (
                  <article key={item.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <span className={styles.itemEmail}>{item.email}</span>
                      <div className={styles.itemMeta}>
                        <span className={badge.className}>{badge.label}</span>
                        <span>{ROLE_LABEL[item.role]}</span>
                        <span>· Criado em {formatDate(item.createdAt)}</span>
                        <span>· Expira em {formatDate(item.expiresAt)}</span>
                      </div>
                    </div>
                    {status === 'PENDING' && (
                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={revokingId === item.id}
                          onClick={() => onRevoke(item.id)}
                        >
                          {revokingId === item.id ? 'Revogando…' : 'Revogar'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}
