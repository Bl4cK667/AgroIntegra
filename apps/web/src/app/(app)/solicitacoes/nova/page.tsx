'use client';

import Link from 'next/link';
import { FormFeedback } from '@/components/property/FormFeedback';
import { checkRequiredFields, clearFieldError } from '@/components/property/formValidation';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/components/form.module.css';
import { ProducerSearch } from '@/components/ProducerSearch';
import { FieldHeading } from '@/components/property/FieldUI';
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

  const [choosing, setChoosing] = useState(false);
  const choiceVersion = useRef(0);
  const resetProducer = useCallback(() => {
    choiceVersion.current += 1; setProducer(null); setPropertyId(''); setSubject(''); setDescription(''); setPriority('MEDIUM'); setError(null); setChoosing(false);
  }, []);

  const choose = useCallback((id: string) => {
    resetProducer();
    const version = choiceVersion.current;
    setChoosing(true);
    getProducer(id)
      .then((p) => {
        if (version !== choiceVersion.current) return;
        setProducer(p);
        setPropertyId(p.properties.length === 1 ? p.properties[0].id : '');
      })
      .catch((e) => { if (version === choiceVersion.current) setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'); })
      .finally(() => { if (version === choiceVersion.current) setChoosing(false); });
  }, [resetProducer]);

  useEffect(() => {
    if (fromProducer) choose(fromProducer);
    return () => { choiceVersion.current += 1; };
  }, [fromProducer, choose]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || choosing || !checkRequiredFields(e.currentTarget)) return;
    if (!producer) return setError('Escolha o produtor que fez o pedido.');
    if (!subject.trim()) return setError('Informe o assunto da solicitação.');
    setError(null);
    setSaving(true);
    try {
      await createRequest({
        producerId: producer.id,
        propertyId: propertyId || undefined,
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
      });
      router.replace(fromProducer ? `/produtores/${producer.id}?solicitacao=criada` : '/solicitacoes?salvo=1');
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
      <FieldHeading icon="inbox" eyebrow="Fluxo de atendimento" title="Nova solicitação" description="Registre o pedido do produtor. Ele entra na lista de solicitações com a situação Nova." />

      <p className="muted">Os campos com * são obrigatórios. Você pode completar o pedido com uma descrição.</p>
      <form className={`${styles.form} form-h enter`} style={{ '--i': 1 } as React.CSSProperties} onSubmit={onSubmit} onInput={clearFieldError} noValidate>
          <FormFeedback />
        <fieldset className={styles.group} disabled={saving || choosing}>
          <legend>01 · Quem precisa de atendimento?</legend>
          {producer ? (
            <div className={styles.chosen}>
              <div>
                <strong>{producer.name}</strong>
                <span className="muted">
                  {producer.community} · <span className="num">{producer.cpf}</span>
                </span>
              </div>
              {!fromProducer && (
                <button type="button" className="btn-link" onClick={resetProducer}>
                  Trocar produtor
                </button>
              )}
            </div>
          ) : (
            <ProducerSearch onPick={choose} />
          )}
          {choosing && <p className="muted" role="status">Carregando os dados do produtor…</p>}
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

        <fieldset className={styles.group} disabled={!producer || saving || choosing}>
          <legend>02 · Como podemos ajudar?</legend>
          <label className="field">
            <span>Qual é o pedido? *</span>
            <input
              className="input"
              name="subject" required data-required-message="Conte em poucas palavras o que o produtor precisa." maxLength={120}
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
            <span>Com que urgência precisa de atendimento?</span>
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

        <div className="form-bar">
          <Link href={back} className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving || !producer || choosing}>
            {saving ? 'Salvando…' : 'Abrir solicitação'}
          </button>
        </div>
      </form>
    </>
  );
}
