'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './form-feedback.module.css';

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldError = { field: FormField; message: string; id: string };

// Usa a validação do formulário e mantém a explicação visível junto ao campo.
export function FormFeedback() {
  const anchor = useRef<HTMLSpanElement>(null);
  const prefix = useId();
  const [errors, setErrors] = useState<FieldError[]>([]);

  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;
    const touched = new Map<FormField, string>();
    const clear = (field: FormField, id: string) => {
      const descriptions = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(value => value && value !== id);
      if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
      else field.removeAttribute('aria-describedby');
      field.removeAttribute('aria-invalid');
    };
    const invalid = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      event.preventDefault();
      const id = touched.get(field) ?? `${prefix}-error-${touched.size}`;
      touched.set(field, id);
      field.setAttribute('aria-invalid', 'true');
      const descriptions = new Set((field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
      descriptions.add(id);
      field.setAttribute('aria-describedby', [...descriptions].join(' '));
      setErrors(previous => [...previous.filter(error => error.field !== field), { field, message: field.validationMessage, id }]);
    };
    const input = (event: Event) => {
      const field = event.target as FormField;
      const id = touched.get(field);
      if (!id) return;
      clear(field, id);
      setErrors(previous => previous.filter(error => error.field !== field));
    };
    form.addEventListener('invalid', invalid, true);
    form.addEventListener('input', input);
    return () => {
      form.removeEventListener('invalid', invalid, true);
      form.removeEventListener('input', input);
      touched.forEach((id, field) => clear(field, id));
    };
  }, [prefix]);

  const visible = errors.filter(error => error.field.isConnected);
  const labels = visible.map(({ field }) => {
    const label = field.labels?.[0];
    return (label?.querySelector('span')?.textContent ?? label?.textContent ?? field.name).replace(/\s*\*\s*$/, '').trim();
  });
  const names = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}` : labels[0];
  return <><span hidden ref={anchor} />{visible.length > 0 && <div className={styles.summary} role="alert"><span className={styles.icon} aria-hidden="true">!</span><span>{visible.every(error => !error.field.value.trim()) ? `Falta${visible.length === 1 ? '' : 'm'}` : 'Confira'} {visible.length} {visible.length === 1 ? 'informação' : 'informações'}: {names}.</span></div>}{visible.map(error => createPortal(<span className={`field-error ${styles.error}`} id={error.id}><span className={styles.icon} aria-hidden="true">!</span>{error.message}</span>, error.field.closest('.field') ?? error.field.parentElement!, error.id))}</>;
}
