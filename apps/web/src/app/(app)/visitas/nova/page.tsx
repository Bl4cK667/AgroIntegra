'use client';

import Link from 'next/link';
import { FormFeedback } from '@/components/property/FormFeedback';
import { checkRequiredFields, clearFieldError, reportFieldError, validDay } from '@/components/property/formValidation';
import { FieldHeading, FieldLoading } from '@/components/property/FieldUI';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
  const [choosing, setChoosing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const choiceVersion = useRef(0);

  const resetProducer = useCallback(() => {
    choiceVersion.current += 1;
    setProducer(null); setOpenRequests([]); setRequestId(''); setPropertyId('');
    setDiagnosis(''); setActionPlan(''); setReturnOn(''); setImpact('');
    setPhotos([]); setLocation(null); setPhotoBusy(false); setError(null); setChoosing(false);
  }, []);

  const choose = useCallback((id: string, preselectRequest?: string | null) => {
    resetProducer();
    const version = choiceVersion.current;
    setChoosing(true);
    Promise.all([getProducer(id), listRequests({ producerId: id, open: true })])
      .then(([p, reqs]) => {
        if (version !== choiceVersion.current) return;
        setProducer(p);
        setOpenRequests(reqs.items);
        // Vindo do quadro, a solicitação já vem marcada e traz a propriedade dela.
        const pre = reqs.items.find((r) => r.id === preselectRequest);
        setRequestId(pre?.id ?? '');
        setPropertyId(pre?.property?.id ?? (p.properties.length === 1 ? p.properties[0].id : ''));
      })
      .catch((e) => { if (version === choiceVersion.current) setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'); })
      .finally(() => { if (version === choiceVersion.current) setChoosing(false); });
  }, [resetProducer]);

  useEffect(() => {
    if (fromProducer) choose(fromProducer, fromRequest);
    return () => { choiceVersion.current += 1; };
  }, [fromProducer, fromRequest, choose]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || choosing || photoBusy) return;
    if (!producer) return setError('Escolha o produtor atendido.');
    if (!validDay(visitedOn) || visitedOn > todayIso()) { reportFieldError(e.currentTarget, 'visitedOn', 'Escolha a data da visita. Ela deve ser hoje ou uma data anterior.'); return; }
    if (returnOn && (!validDay(returnOn) || returnOn < visitedOn)) { reportFieldError(e.currentTarget, 'returnOn', 'Escolha uma data de retorno igual ou posterior à visita.'); return; }
    if (!checkRequiredFields(e.currentTarget)) return;
    setError(null);
    setSaving(true);
    try {
      const v = await createVisit({
        producerId: producer.id,
        propertyId: propertyId || undefined,
        requestId: requestId || undefined,
        visitedOn,
        diagnosis: diagnosis.trim(),
        actionPlan: actionPlan.trim(),
        returnOn: returnOn || undefined,
        impact: impact.trim() || undefined,
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
      <FieldHeading eyebrow="Novo atendimento" title="Registrar visita" description="Da avaliação ao registro em campo, reúna as informações do atendimento. Após salva, a visita fica como registro definitivo." />

      <p className="muted">Os campos com * são obrigatórios. Fotos, localização e assinatura são opcionais.</p>
      <form className={`${styles.form} form-h`} onSubmit={onSubmit} onInput={clearFieldError} noValidate>
          <FormFeedback />
        <fieldset className={`${styles.group} enter`} style={{ '--i': 0 } as React.CSSProperties} disabled={saving || choosing}>
          <legend>01 · Atendimento</legend>
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
                <button type="button" className="btn-link" onClick={resetProducer}>
                  Trocar produtor
                </button>
              )}
            </div>
          ) : (
            <ProducerSearch onPick={choose} />
          )}

          {choosing && <p role="status" className="muted">Carregando os dados do produtor…</p>}
        {producer && openRequests.length > 0 && (
            <label className="field">
              <span>Solicitação atendida</span>
              <select className="input" value={requestId} onChange={(e) => { setRequestId(e.target.value); const request = openRequests.find(r => r.id === e.target.value); if (request?.property) setPropertyId(request.property.id); }}>
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
                <span>Data da visita *</span>
                <input
                  className="input num"
                  type="date"
                  name="visitedOn"
                  required
                  data-required-message="Informe a data em que a visita aconteceu."
                  value={visitedOn}
                  max={todayIso()}
                  onChange={(e) => setVisitedOn(e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className={`${styles.group} enter`} style={{ '--i': 1 } as React.CSSProperties} disabled={!producer || saving || choosing}>
          <legend>02 · Avaliação técnica</legend>
          <label className="field">
            <span>O que foi observado? *</span>
            <textarea
              className="input"
              rows={4}
              maxLength={5000}
              name="diagnosis" required data-required-message="Conte o que foi observado na propriedade." placeholder="Ex.: A horta apresenta folhas amareladas e precisa de adubação."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </label>
          <label className="field">
            <span>O que foi recomendado? *</span>
            <textarea
              className="input"
              rows={4}
              maxLength={5000}
              name="actionPlan" required data-required-message="Descreva o que foi recomendado ao produtor." placeholder="Ex.: Aplicar o adubo indicado e acompanhar a horta por 15 dias."
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
                name="returnOn"
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

        <fieldset className={`${styles.group} enter`} style={{ '--i': 2 } as React.CSSProperties} disabled={!producer || saving || choosing}>
          <legend>03 · Registro em campo</legend>
          <p className="muted" style={{ margin: 0 }}>Complete o atendimento com fotos, localização e assinatura. Estes registros são opcionais.</p>
          {/* A key reinicia cada campo ao trocar de produtor; precisa ser única entre irmãos, senão o React duplica componentes. */}
          <PhotoPicker key={`photos-${producer?.id ?? 'none'}`} value={photos} onChange={setPhotos} onBusyChange={setPhotoBusy} />
          <LocationField key={`location-${producer?.id ?? 'none'}`} value={location} onChange={setLocation} />
          <SignaturePad key={`signature-${producer?.id ?? 'none'}`} ref={signature} />
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
          <button type="submit" className="btn btn-primary" disabled={saving || !producer || choosing || photoBusy}>
            {saving ? 'Salvando…' : photoBusy ? 'Preparando fotos…' : 'Salvar visita'}
          </button>
        </div>
      </form>
    </>
  );
}
