'use client';

import Link from 'next/link';
import { FieldHeading, FieldIcon, FieldLoading, fieldStyles as ui } from '@/components/property/FieldUI';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError, getProducer, ProducerDetail, updateProducer } from '@/lib/api';

export default function EditarProdutorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [community, setCommunity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProducer(id)
      .then((p) => {
        setProducer(p);
        setName(p.name);
        setPhone(p.phone ?? '');
        setCommunity(p.community);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateProducer(id, { name, phone, community });
      router.replace(`/produtores/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar as alterações.');
      setSaving(false);
    }
  }

  return (
    <>
      <Link href={`/produtores/${id}`} className="back">
        {producer?.name ?? 'Produtor'}
      </Link>
      <FieldHeading icon="people" eyebrow="Cadastro de produtores" title="Editar dados do produtor" description="Mantenha os dados de contato e a comunidade atualizados." />

      {!producer && !error && <FieldLoading />}

      {producer && (
        <form className={ui.form} onSubmit={onSubmit} noValidate>
          <fieldset className={`card enter ${ui.formSection}`}><legend><FieldIcon name="people" /> Identificação e contato</legend>
          <label className="field">
            <span>Nome completo</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>CPF</span>
              <input className="input num" value={producer.cpf} disabled />
              <small>O CPF não pode ser alterado.</small>
            </label>
            <label className="field">
              <span>Telefone</span>
              <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </label>
          </div>
          <label className="field">
            <span>Comunidade</span>
            <input className="input" value={community} onChange={(e) => setCommunity(e.target.value)} maxLength={80} />
          </label>
          </fieldset>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <Link href={`/produtores/${id}`} className="btn btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      )}

      {!producer && error && <p className="alert">{error}</p>}
    </>
  );
}
