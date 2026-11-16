'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, createProducer } from '@/lib/api';
import { cpfInput } from '@/lib/format';

export default function NovoProdutorPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [community, setCommunity] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const p = await createProducer({ name, cpf, phone: phone || undefined, community, consent });
      router.replace(`/produtores/${p.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o produtor.');
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/produtores" className="back">
        Produtores
      </Link>
      <header className="page-head">
        <h1>Novo produtor</h1>
      </header>

      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Nome completo</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>

        <div className="form-row">
          <label className="field">
            <span>CPF</span>
            <input
              className="input num"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(cpfInput(e.target.value))}
              required
            />
            <small>Depois do cadastro, o CPF aparece mascarado e não pode ser alterado.</small>
          </label>
          <label className="field">
            <span>Telefone</span>
            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
          </label>
        </div>

        <label className="field">
          <span>Comunidade</span>
          <input className="input" value={community} onChange={(e) => setCommunity(e.target.value)} required maxLength={80} />
        </label>

        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            O produtor autorizou o uso dos seus dados pela secretaria
            <small>Consentimento exigido pela LGPD. A data fica registrada. Se ainda não autorizou, dá para registrar depois.</small>
          </span>
        </label>

        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Cadastrando…' : 'Cadastrar produtor'}
          </button>
          <Link href="/produtores" className="btn btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
