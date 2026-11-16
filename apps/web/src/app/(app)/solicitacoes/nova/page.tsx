'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import styles from '@/components/form.module.css';
import { ProducerSearch } from '@/components/ProducerSearch';
import { ApiError, createRequest, getProducer, PRIORITY_LABEL, PRIORITY_ORDER, ProducerDetail, RequestPriority } from '@/lib/api';
import { formatArea } from '@/lib/format';

export default function NovaSolicitacaoPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <NovaSolicitacao />
    </Suspense>
  );
}

function NovaSolicitacao() {
  const router = useRouter();
  const fromProducer = useSearchParams().get('produtor');

  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function choose(id: string) {
    getProducer(id)
      .then((p) => {
        setProducer(p);
        setPropertyId(p.properties.length === 1 ? p.properties[0].id : '');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }

  useEffect(() => {
    if (fromProducer) choose(fromProducer);
  }, [fromProducer]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!producer) return setError('Escolha o produtor que fez o pedido.');
    if (!subject.trim()) return setError('Informe o assunto da solicitação.');
    setError(null);
    setSaving(true);
    try {
      await createRequest({
        producerId: producer.id,
        propertyId: propertyId || undefined,
        subject,
        description: description || undefined,
        priority,
      });
      router.replace(fromProducer ? `/produtores/${producer.id}` : '/solicitacoes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a solicitação.');
      setSaving(false);
    }
  }

  const back = fromProducer ? `/produtores/${fromProducer}` : '/solicitacoes';

  return (
    <>
      <Link href={back} className="back">
        {fromProducer ? (producer?.name ?? 'Produtor') : 'Solicitações'}
      </Link>
      <header className="page-head">
        <div>
          <h1>Nova solicitação</h1>
          <p>Entra no quadro na coluna Nova.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.group}>
          <legend>Produtor</legend>
          {producer ? (
            <div className={styles.chosen}>
              <div>
                <strong>{producer.name}</strong>
                <span className="muted">
                  {producer.community} · <span className="num">{producer.cpf}</span>
                </span>
              </div>
              {!fromProducer && (
                <button type="button" className="btn-link" onClick={() => setProducer(null)}>
                  Trocar produtor
                </button>
              )}
            </div>
          ) : (
            <ProducerSearch onPick={choose} />
          )}
          {producer && (
            <label className="field">
              <span>Propriedade</span>
              <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">{producer.properties.length ? 'Não se aplica' : 'Produtor sem propriedade cadastrada'}</option>
                {producer.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatArea(p.areaHa)})
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        <fieldset className={styles.group} disabled={!producer}>
          <legend>Pedido</legend>
          <label className="field">
            <span>Assunto</span>
            <input
              className="input"
              maxLength={120}
              placeholder="Ex.: orientação sobre silagem de milho"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Descrição <span className="muted">opcional</span>
            </span>
            <textarea
              className="input"
              rows={4}
              maxLength={2000}
              placeholder="O que o produtor relatou."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="field" role="radiogroup" aria-label="Prioridade">
            <span>Prioridade</span>
            <div className={styles.segmented}>
              {PRIORITY_ORDER.map((p) => (
                <label key={p} className={priority === p ? styles.segOn : styles.seg}>
                  <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                  {PRIORITY_LABEL[p]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !producer}>
            {saving ? 'Salvando…' : 'Abrir solicitação'}
          </button>
          <Link href={back} className="btn btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
