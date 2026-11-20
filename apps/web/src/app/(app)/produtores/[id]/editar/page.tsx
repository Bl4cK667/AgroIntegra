'use client';

import Link from 'next/link';
import { FormFeedback } from '@/components/property/FormFeedback';
import { checkRequiredFields, clearFieldError, reportFieldError } from '@/components/property/formValidation';
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !checkRequiredFields(e.currentTarget)) return;
    setError(null);
    setSaving(true);
    try {
      await updateProducer(id, { name: name.trim(), phone: phone.trim(), community: community.trim() });
      router.replace(`/produtores/${id}?cadastro=atualizado`);
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
        <form className={`${ui.form} form-h`} onSubmit={onSubmit} onInput={clearFieldError} noValidate>
          <FormFeedback />
          <fieldset disabled={saving} className={`card enter ${ui.formSection}`}><legend><FieldIcon name="people" /> Identificação e contato</legend>
          <label className="field">
            <span>Nome completo *</span>
            <input className="input" name="name" required data-required-message="Informe o nome completo do produtor." autoComplete="name" placeholder="Ex.: Maria da Silva" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>CPF</span>
              <input className="input num" value={producer.cpf} disabled />
              <small>O CPF não pode ser alterado.</small>
            </label>
            <label className="field">
              <span>Telefone</span>
              <input className="input" name="phone" autoComplete="tel" placeholder="Ex.: (91) 99999-9999" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </label>
          </div>
          <label className="field">
            <span>Comunidade *</span>
            <input className="input" name="community" required data-required-message="Informe a comunidade onde o produtor mora." placeholder="Ex.: Comunidade Riacho Verde" value={community} onChange={(e) => setCommunity(e.target.value)} maxLength={80} />
          </label>
          </fieldset>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="form-bar">
            <Link href={`/produtores/${id}`} className="btn btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      )}

      {!producer && error && <p className="alert">{error}</p>}
    </>
  );
}
