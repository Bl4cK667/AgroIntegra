'use client';

import { useEffect, useState } from 'react';
import { fetchImage } from '@/lib/api';
import styles from './visit.module.css';

// Carrega uma imagem que exige login e mostra como <img>.
export function ProtectedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetchImage(path)
      .then((u) => {
        url = u;
        if (alive) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) return <span className="muted">Imagem indisponível.</span>;
  if (!src) return <span className={`${styles.stored} ${className ?? ''}`} style={{ display: 'block', aspectRatio: '4 / 3' }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`${styles.stored} ${className ?? ''}`} />;
}
