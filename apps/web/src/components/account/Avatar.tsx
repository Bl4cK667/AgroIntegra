'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_UPDATED_EVENT, AccountProfile, fetchAvatarUrl, getAccount } from '@/lib/account';
import styles from './avatar.module.css';

interface AvatarProps {
  name?: string;
  size?: number;
  hasAvatar?: boolean;
  cacheKey?: string | null;
  className?: string;
}

function getInitials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ name, size = 36, hasAvatar, cacheKey, className }: AvatarProps) {
  const controlled = hasAvatar !== undefined;
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  const effectiveName = controlled ? name : (account?.name ?? name);
  const effectiveHasAvatar = controlled ? hasAvatar : account?.hasAvatar;
  const effectiveCacheKey = controlled ? cacheKey : account?.avatarUpdatedAt;

  useEffect(() => {
    if (controlled) return;

    let alive = true;

    function loadAccount() {
      getAccount()
        .then((data) => {
          if (alive) setAccount(data);
        })
        .catch(() => {
          /* mantém fallback por iniciais */
        });
    }

    loadAccount();
    const onUpdate = () => loadAccount();
    window.addEventListener(ACCOUNT_UPDATED_EVENT, onUpdate);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, onUpdate);
    };
  }, [controlled]);

  useEffect(() => {
    if (!effectiveHasAvatar) {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let alive = true;

    fetchAvatarUrl(effectiveCacheKey)
      .then((url) => {
        if (!alive) {
          URL.revokeObjectURL(url);
          return;
        }
        setSrc((prev) => {
          if (prev && prev !== url) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {
        /* mantém a imagem atual em caso de falha transitória */
      });

    return () => {
      alive = false;
    };
  }, [effectiveHasAvatar, effectiveCacheKey]);

  const fontSize = Math.max(11, Math.round(size * 0.36));

  return (
    <span
      className={`${styles.avatar} ${className ?? ''}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={effectiveName ? `Foto de ${effectiveName}` : 'Foto de perfil'}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={effectiveName ?? 'Foto de perfil'} className={styles.img} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {getInitials(effectiveName)}
        </span>
      )}
    </span>
  );
}
