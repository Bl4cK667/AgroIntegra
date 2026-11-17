import type { FormEvent } from 'react';

// Mesma regra de dígitos verificadores usada pela API; a API continua validando ao salvar.
export function validCpf(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = [...digits.slice(0, length)].reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    const rest = sum * 10 % 11;
    return (rest === 10 ? 0 : rest) === Number(digits[length]);
  };
  return check(9) && check(10);
}

export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function propertyArea(value: string): number | null {
  const text = value.trim();
  // Aceita 12,5 / 12.5 / 1.250,75, sem arredondar silenciosamente o valor informado.
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text) && !/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) return null;
  const area = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  return Number.isFinite(area) && area > 0 && area <= 99999999 && Math.abs(area * 100 - Math.round(area * 100)) < .00001 ? area : null;
}

export function reportFieldError(form: HTMLFormElement, name: string, message: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.setCustomValidity(message);
    field.setAttribute('aria-invalid', 'true');
    field.reportValidity();
    field.focus();
  }
}

export function clearFieldError(event: FormEvent<HTMLFormElement>) {
  const field = event.target;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.setCustomValidity('');
    field.removeAttribute('aria-invalid');
  }
}

export function checkRequiredFields(form: HTMLFormElement) {
  for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[required]')) {
    if (field.matches(':disabled')) continue;
    if (!field.value.trim()) {
      field.setCustomValidity(field.dataset.requiredMessage ?? 'Preencha este campo.');
    }
  }
  const invalid = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')]
    .filter(field => field.willValidate && !field.validity.valid);
  invalid.forEach(field => field.reportValidity());
  invalid[0]?.focus();
  return invalid.length === 0;
}
