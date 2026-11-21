'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string | null;
  onClose?: () => void;
  duration?: number;
  tone?: 'success' | 'error';
}

export function Toast({ message, onClose, duration = 6000, tone = 'success' }: ToastProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const closeHandler = useRef(onClose);
  useEffect(() => { closeHandler.current = onClose; }, [onClose]);
  useEffect(() => {
    setDismissed(null);
    if (!message || duration <= 0) return;
    const timer = window.setTimeout(() => { setDismissed(message); closeHandler.current?.(); }, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);
  if (!message || message === dismissed) return null;
  return <div className={styles.toast} data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <span>{message}</span>
    <button type="button" onClick={() => { setDismissed(message); onClose?.(); }}>Fechar</button>
  </div>;
}

export default Toast;
