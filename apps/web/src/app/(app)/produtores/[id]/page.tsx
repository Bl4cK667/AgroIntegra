'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { VisitTable } from '@/components/visit/VisitTable';
import { addProperty, ApiError, getProducer, ProducerDetail, registerConsent } from '@/lib/api';
import { formatArea, formatDate, parseArea } from '@/lib/format';
import styles from './produtor.module.css';

export default function ProdutorPage() {
  const { id } = useParams<{ id: string }>();
  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  // Volta do formulário de visita com ?visita=<id>: mostra o aviso uma vez.
  const [savedVisit, setSavedVisit] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('visita')) {
      setSavedVisit(true);
      url.searchParams.delete('visita');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  const load = useCallback(() => {
    getProducer(id)
      .then((p) => (setProducer(p), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }, [id]);

  useEffect(load, [load]);

  async function onConsent() {
    setConsentSaving(true);
    try {
      await registerConsent(id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível registrar o consentimento.');
    } finally {
      setConsentSaving(false);
    }
  }

  if (error && !producer) {
    return (
      <>
        <Link href="/produtores" className="back">
          Produtores
        </Link>
        <p className="alert">{error}</p>
      </>
    );
  }
  if (!producer) return <p className="muted">Carregando…</p>;

  return (
    <>
      <Link href="/produtores" className="back">
        Produtores
      </Link>
      <header className="page-head">
        <div>
          <h1>{producer.name}</h1>
          <p>{producer.community}</p>
        </div>
        <Link href={`/produtores/${id}/editar`} className="btn btn-secondary">
          Editar dados
        </Link>
      </header>

      {error && <p className="alert">{error}</p>}
      {savedVisit && (
        <p className="notice" role="status">
          Visita salva. Ela já aparece na lista de visitas abaixo.
        </p>
      )}

      <div className={styles.layout}>
        <dl className={styles.facts}>
          <div>
            <dt>CPF</dt>
            <dd className="num">{producer.cpf}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{producer.phone || <span className="muted">Não informado</span>}</dd>
          </div>
          <div>
            <dt>Consentimento LGPD</dt>
            <dd>
              {producer.consentAt ? (
                <>Registrado em <span className="num">{formatDate(producer.consentAt)}</span></>
              ) : (
                <>
                  <span className="pending">Pendente</span>
                  <br />
                  <button type="button" className="btn-link" onClick={onConsent} disabled={consentSaving}>
                    {consentSaving ? 'Registrando…' : 'Registrar consentimento'}
                  </button>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Cadastro</dt>
            <dd>
              <span className="num">{formatDate(producer.createdAt)}</span>, por {producer.createdBy.name}
            </dd>
          </div>
        </dl>

        <section>
          <div className={styles.sectionHead}>
            <h2>Propriedades</h2>
            {!adding && (
              <button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}>
                Adicionar propriedade
              </button>
            )}
          </div>

          {adding && (
            <PropertyForm
              producerId={id}
              onDone={() => {
                setAdding(false);
                load();
              }}
              onCancel={() => setAdding(false)}
            />
          )}

          <div className="table-wrap">
            {producer.properties.length === 0 ? (
              <div className="empty">
                <strong>Nenhuma propriedade cadastrada</strong>
                Adicione a propriedade com a área em hectares.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Propriedade</th>
                    <th>Localidade</th>
                    <th>Atividade principal</th>
                    <th className="right">Área</th>
                  </tr>
                </thead>
                <tbody>
                  {producer.properties.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.locality}</td>
                      <td>{p.mainActivity || <span className="muted">Não informada</span>}</td>
                      <td className="right area">{formatArea(p.areaHa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${styles.sectionHead} ${styles.sectionGap}`}>
            <h2>
              Visitas <span className="muted num">{producer.visits.length}</span>
            </h2>
            <Link href={`/visitas/nova?produtor=${id}`} className="btn btn-primary">
              Registrar visita
            </Link>
          </div>
          <div className="table-wrap">
            {producer.visits.length === 0 ? (
              <div className="empty">
                <strong>Nenhuma visita registrada</strong>
                As visitas técnicas a este produtor aparecem aqui.
              </div>
            ) : (
              <VisitTable visits={producer.visits} showProducer={false} />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function PropertyForm({ producerId, onDone, onCancel }: { producerId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [locality, setLocality] = useState('');
  const [activity, setActivity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const areaHa = parseArea(area);
    if (areaHa === null) {
      setError('Informe a área em hectares, maior que zero. Exemplo: 12,5');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addProperty(producerId, { name, areaHa, locality, mainActivity: activity || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a propriedade.');
      setSaving(false);
    }
  }

  return (
    <form className={styles.propertyForm} onSubmit={onSubmit} noValidate>
      <div className="form-row">
        <label className="field">
          <span>Nome da propriedade</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        </label>
        <label className="field">
          <span>Área (hectares)</span>
          <input className="input num" inputMode="decimal" placeholder="12,5" value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Localidade</span>
          <input className="input" value={locality} onChange={(e) => setLocality(e.target.value)} maxLength={80} />
        </label>
        <label className="field">
          <span>Atividade principal</span>
          <input
            className="input"
            placeholder="Ex.: bovinocultura de leite"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            maxLength={80}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar propriedade'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
