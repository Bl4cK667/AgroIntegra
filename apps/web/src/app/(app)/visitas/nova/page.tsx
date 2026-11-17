'use client';

import Link from 'next/link';
import { FieldHeading, FieldIcon, FieldLoading } from '@/components/property/FieldUI';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { Location, LocationField } from '@/components/visit/LocationField';
import { PhotoPicker } from '@/components/visit/PhotoPicker';
import { SignaturePad, SignaturePadHandle } from '@/components/visit/SignaturePad';
import { ApiError, createVisit, getProducer, listRequests, ProducerDetail, ServiceRequest, STATUS_LABEL } from '@/lib/api';
import { formatArea, todayIso } from '@/lib/format';
import styles from '@/components/form.module.css';
import { ProducerSearch } from '@/components/ProducerSearch';

export default function NovaVisitaPage() {
  return (
    <Suspense fallback={<FieldLoading />}>
      <NovaVisita />
    </Suspense>
  );
}

function NovaVisita() {
  const router = useRouter();
  const params = useSearchParams();
  const fromProducer = params.get('produtor');
  const fromRequest = params.get('solicitacao');

  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [requestId, setRequestId] = useState('');
  const [visitedOn, setVisitedOn] = useState(todayIso());
  const [diagnosis, setDiagnosis] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [returnOn, setReturnOn] = useState('');
  const [impact, setImpact] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const signature = useRef<SignaturePadHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function choose(id: string, preselectRequest?: string | null) {
    Promise.all([getProducer(id), listRequests({ producerId: id, open: true })])
      .then(([p, reqs]) => {
        setProducer(p);
        setOpenRequests(reqs.items);
        // Vindo do quadro, a solicitação já vem marcada e traz a propriedade dela.
        const pre = reqs.items.find((r) => r.id === preselectRequest);
        setRequestId(pre?.id ?? '');
        setPropertyId(pre?.property?.id ?? (p.properties.length === 1 ? p.properties[0].id : ''));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }

  useEffect(() => {
    if (fromProducer) choose(fromProducer, fromRequest);
  }, [fromProducer, fromRequest]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!producer) return setError('Escolha o produtor atendido.');
    if (!diagnosis.trim()) return setError('Descreva o diagnóstico.');
    if (!actionPlan.trim()) return setError('Descreva o plano de ação.');
    if (returnOn && returnOn < visitedOn) return setError('A data de retorno não pode ser antes da visita.');
    setError(null);
    setSaving(true);
    try {
      const v = await createVisit({
        producerId: producer.id,
        propertyId: propertyId || undefined,
        requestId: requestId || undefined,
        visitedOn,
        diagnosis,
        actionPlan,
        returnOn: returnOn || undefined,
        impact: impact || undefined,
        photos: photos.length ? photos : undefined,
        signature: signature.current?.toDataUrl() ?? undefined,
        location: location ?? undefined,
      });
      router.replace(`/produtores/${v.producer.id}?visita=${v.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a visita.');
      setSaving(false);
    }
  }

  const back = fromRequest ? '/solicitacoes' : fromProducer ? `/produtores/${fromProducer}` : '/visitas';
  const backLabel = fromRequest ? 'Solicitações' : fromProducer ? (producer?.name ?? 'Produtor') : 'Visitas';

  return (
    <>
      <Link href={back} className="back">
        {backLabel}
      </Link>
      <FieldHeading icon="visit" eyebrow="Novo atendimento" title="Registrar visita" description="Da avaliação ao registro em campo, reúna as informações do atendimento. Após salva, a visita fica como registro definitivo." />

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={`${styles.group} enter`} style={{ '--i': 0 } as React.CSSProperties}>
          <legend><FieldIcon name="people" /> 01 · Atendimento</legend>
          <p className="muted" style={{ margin: 0 }}>Escolha quem foi atendido e vincule a propriedade e a solicitação, quando houver.</p>
          {producer ? (
            <div className={styles.chosen}>
              <div>
                <strong>{producer.name}</strong>
                <span className="muted">
                  {producer.community} · <span className="num">{producer.cpf}</span>
                </span>
              </div>
              {!fromProducer && (
                <button type="button" className="btn-link" onClick={() => (setProducer(null), setRequestId(''))}>
                  Trocar produtor
                </button>
              )}
            </div>
          ) : (
            <ProducerSearch onPick={choose} />
          )}

          {producer && openRequests.length > 0 && (
            <label className="field">
              <span>Solicitação atendida</span>
              <select className="input" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
                <option value="">Nenhuma: visita sem solicitação</option>
                {openRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.subject} ({STATUS_LABEL[r.status].toLowerCase()})
                  </option>
                ))}
              </select>
              <small>Ao salvar a visita, a solicitação marcada vai para Concluída.</small>
            </label>
          )}

          {producer && (
            <div className="form-row">
              <label className="field">
                <span>Propriedade</span>
                <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="">
                    {producer.properties.length ? 'Não se aplica' : 'Produtor sem propriedade cadastrada'}
                  </option>
                  {producer.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatArea(p.areaHa)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Data da visita</span>
                <input
                  className="input num"
                  type="date"
                  value={visitedOn}
                  max={todayIso()}
                  onChange={(e) => setVisitedOn(e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className={`${styles.group} enter`} style={{ '--i': 1 } as React.CSSProperties} disabled={!producer}>
          <legend><FieldIcon name="note" /> 02 · Avaliação técnica</legend>
          <label className="field">
            <span>Diagnóstico</span>
            <textarea
              className="input"
              rows={4}
              maxLength={5000}
              placeholder="O que foi observado na propriedade."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Plano de ação</span>
            <textarea
              className="input"
              rows={4}
              maxLength={5000}
              placeholder="O que foi recomendado ao produtor."
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Prazo de retorno</span>
              <input
                className="input num"
                type="date"
                value={returnOn}
                min={visitedOn}
                onChange={(e) => setReturnOn(e.target.value)}
              />
              <small>Deixe em branco se não houver retorno previsto.</small>
            </label>
            <label className="field">
              <span>Impacto esperado</span>
              <textarea
                className="input"
                rows={2}
                maxLength={2000}
                placeholder="Ex.: mais leite por vaca na seca."
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={`${styles.group} enter`} style={{ '--i': 2 } as React.CSSProperties} disabled={!producer}>
          <legend><FieldIcon name="pin" /> 03 · Registro em campo</legend>
          <p className="muted" style={{ margin: 0 }}>Complete o atendimento com fotos, localização e assinatura. Estes registros são opcionais.</p>
          <PhotoPicker value={photos} onChange={setPhotos} />
          <LocationField value={location} onChange={setLocation} />
          <SignaturePad ref={signature} />
        </fieldset>

        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !producer}>
            {saving ? 'Salvando…' : 'Salvar visita'}
          </button>
          <Link href={back} className="btn btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
