'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { Location, LocationField } from '@/components/visit/LocationField';
import { PhotoPicker } from '@/components/visit/PhotoPicker';
import { SignaturePad, SignaturePadHandle } from '@/components/visit/SignaturePad';
import { ApiError, createVisit, getProducer, listProducers, ProducerDetail, ProducerSummary } from '@/lib/api';
import { formatArea, todayIso } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import styles from './nova.module.css';

export default function NovaVisitaPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando…</p>}>
      <NovaVisita />
    </Suspense>
  );
}

function NovaVisita() {
  const router = useRouter();
  const params = useSearchParams();
  const fromProducer = params.get('produtor');

  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [propertyId, setPropertyId] = useState('');
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

  function choose(id: string) {
    getProducer(id)
      .then((p) => {
        setProducer(p);
        // Com uma só propriedade, ela já vem escolhida.
        setPropertyId(p.properties.length === 1 ? p.properties[0].id : '');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }

  useEffect(() => {
    if (fromProducer) choose(fromProducer);
  }, [fromProducer]);

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

  const back = fromProducer ? `/produtores/${fromProducer}` : '/visitas';

  return (
    <>
      <Link href={back} className="back">
        {fromProducer ? (producer?.name ?? 'Produtor') : 'Visitas'}
      </Link>
      <header className="page-head">
        <div>
          <h1>Registrar visita</h1>
          <p>Depois de salva, a visita não é alterada: vale como registro do atendimento.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.group}>
          <legend>Atendimento</legend>
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

        <fieldset className={styles.group} disabled={!producer}>
          <legend>Avaliação técnica</legend>
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

        <fieldset className={styles.group} disabled={!producer}>
          <legend>Registro em campo</legend>
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

function ProducerSearch({ onPick }: { onPick: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [items, setItems] = useState<ProducerSummary[] | null>(null);

  useEffect(() => {
    if (!term) {
      setItems(null);
      return;
    }
    let alive = true;
    listProducers(term)
      .then((d) => alive && setItems(d.items.slice(0, 8)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [term]);

  return (
    <div className="field">
      <span>Produtor atendido</span>
      <input
        className="input"
        type="search"
        placeholder="Digite o nome ou o CPF"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {items && (
        <ul className={styles.results}>
          {items.length === 0 ? (
            <li className="muted">Nenhum produtor encontrado.</li>
          ) : (
            items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(p.id)}>
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {p.community} · <span className="num">{p.cpf}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
