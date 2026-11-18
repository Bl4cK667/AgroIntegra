'use client';

import Link from 'next/link';
import { FormFeedback } from '@/components/property/FormFeedback';
import { Toast } from '@/components/feedback/Toast';
import { checkRequiredFields, clearFieldError, propertyArea, reportFieldError } from '@/components/property/formValidation';
import { FieldHeading, FieldIcon, FieldLoading, FieldStats, SectionTitle, fieldStyles as ui } from '@/components/property/FieldUI';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LocationDraft, locationDraft, LocationFields, locationInput, LocationSummary } from '@/components/property/LocationFields';
import { PerimeterField } from '@/components/geo/PerimeterField';
import { checkPerimeter, emptyPerimeter, savePerimeter, type PerimeterDraft } from '@/lib/geo';
import { PriorityTag } from '@/components/request/PriorityTag';
import { VisitTable } from '@/components/visit/VisitTable';
import {
  addProperty,
  ApiError,
  getProducer,
  listRequests,
  ProducerDetail,
  Property,
  registerConsent,
  ServiceRequest,
  STATUS_LABEL,
  updateProperty,
} from '@/lib/api';
import { formatArea, formatDate, formatDay } from '@/lib/format';
import styles from './produtor.module.css';

export default function ProdutorPage() {
  const { id } = useParams<{ id: string }>();
  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Volta do formulário de visita com ?visita=<id>: mostra o aviso uma vez.
  const [savedVisit, setSavedVisit] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  // Aviso que sobrevive ao recarregamento (ex.: cadastro salvo pela metade).
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('solicitacao') === 'criada') {
      setSuccess('Solicitação registrada com sucesso.');
      url.searchParams.delete('solicitacao');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    const saved = url.searchParams.get('cadastro');
    if (saved === 'criado' || saved === 'atualizado') {
      setSuccess(saved === 'criado' ? 'Produtor cadastrado com sucesso. Agora você pode adicionar uma propriedade ou registrar uma visita.' : 'Dados do produtor atualizados com sucesso.');
      url.searchParams.delete('cadastro');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    if (saved === 'parcial') {
      setWarning(url.searchParams.get('motivo') ?? 'Parte do cadastro não foi salva. Confira os dados abaixo.');
      url.searchParams.delete('cadastro');
      url.searchParams.delete('motivo');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    if (url.searchParams.has('visita')) {
      setSavedVisit(true);
      url.searchParams.delete('visita');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  const load = useCallback(() => {
    Promise.all([getProducer(id), listRequests({ producerId: id, open: true })])
      .then(([p, r]) => (setProducer(p), setRequests(r.items), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o produtor.'));
  }, [id]);

  useEffect(load, [load]);

  async function onConsent() {
    setConsentSaving(true);
    try {
      await registerConsent(id);
      setSuccess('Autorização para uso dos dados registrada.');
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
  if (!producer) return <FieldLoading />;

  return (
    <>
      <Link href="/produtores" className="back">
        Produtores
      </Link>
      <FieldHeading icon="people" eyebrow="Ficha do produtor" title={producer.name} description={producer.community} actions={<><Link href={`/relatorios?produtor=${id}`} className="btn btn-secondary"><FieldIcon name="report" /> Relatório em PDF</Link><Link href={`/produtores/${id}/editar`} className="btn btn-secondary">Editar dados</Link></>} />
      <FieldStats items={[
        { label: 'Propriedades', value: producer.properties.length, icon: 'land', note: 'Vinculadas a este cadastro' },
        { label: 'Visitas registradas', value: producer.visits.length, icon: 'visit', note: 'Histórico do produtor' },
        { label: 'Demandas abertas', value: requests.length, icon: 'note', note: 'Acompanhamento em andamento' },
      ]} />

      {error && <p className="alert">{error}</p>}
      {warning && (
        <p className="alert" role="alert">
          {warning}{' '}
          <button type="button" className="btn-link" onClick={() => setWarning(null)}>Fechar aviso</button>
        </p>
      )}
      <Toast message={success} onClose={() => setSuccess(null)} />
      {savedVisit && (
        <p className="notice" role="status">
          Visita salva. Ela já aparece na lista de visitas abaixo.
        </p>
      )}

      <div className={styles.layout}>
        <dl className={`card enter ${styles.facts}`} style={{ '--i': 3 } as React.CSSProperties}>
          <div className="card-head"><span className="card-icon"><FieldIcon name="people" /></span><h2 className="card-title">Dados do produtor</h2></div>
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
                <span className="badge badge-success">Registrado em <span className="num">{formatDate(producer.consentAt)}</span></span>
              ) : (
                <>
                  <span className="badge badge-warning">Pendente</span>
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

        <section className={styles.sections}>
          <div className="card enter" style={{ '--i': 4 } as React.CSSProperties}>
          <div className={styles.sectionHead}>
            <SectionTitle icon="land">Propriedades</SectionTitle>
            {!adding && (
              <button type="button" className="btn btn-secondary" onClick={() => (setAdding(true), setEditingId(null))}>
                Adicionar propriedade
              </button>
            )}
          </div>

          {adding && (
            <PropertyForm
              producerId={id}
              onDone={(warn) => {
                setAdding(false);
                if (warn) setWarning(warn);
                else setSuccess('Propriedade cadastrada com sucesso.');
                load();
              }}
              onCancel={() => setAdding(false)}
            />
          )}

          <div className="table-wrap">
            {producer.properties.length === 0 ? (
              <div className="empty"><span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="land" /></span>
                <strong>Nenhuma propriedade cadastrada</strong>
                Adicione a propriedade com a área em hectares.
              </div>
            ) : (
              <table className={`table ${ui.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>Propriedade</th>
                    <th>Localidade</th>
                    <th>Localização</th>
                    <th>Atividade principal</th>
                    <th className="right">Área declarada</th>
                    <th className="right">Área demarcada</th>
                    <th className="right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {producer.properties.map((p) =>
                    editingId === p.id ? (
                      <tr key={p.id}>
                        <td colSpan={7}>
                          <PropertyForm
                            producerId={id}
                            property={p}
                            onDone={(warn) => {
                              setEditingId(null);
                              if (warn) setWarning(warn);
                              else setSuccess('Propriedade atualizada com sucesso.');
                              load();
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.id}>
                        <td data-label="Propriedade">{p.name}</td>
                        <td data-label="Localidade">{p.locality}</td>
                        <td data-label="Localização">
                          <LocationSummary property={p} />
                        </td>
                        <td data-label="Atividade principal">{p.mainActivity || <span className="muted">Não informada</span>}</td>
                        <td className="right area" data-label="Área declarada">{formatArea(p.areaHa)}</td>
                        <td className="right area" data-label="Área demarcada">
                          {p.calculatedAreaHa != null ? formatArea(p.calculatedAreaHa) : <span className="badge badge-neutral">Não demarcada</span>}
                        </td>
                        <td className="right nowrap" data-label="Ação">
                          <button type="button" className="btn-link" onClick={() => (setEditingId(p.id), setAdding(false))}>
                            Editar
                          </button>
                          {' · '}
                          <Link href={`/propriedades/${p.id}/mapa`}>Mapa</Link>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </div>

          </div>
          <div className="card enter" style={{ '--i': 5 } as React.CSSProperties}>
          <div className={styles.sectionHead}>
            <SectionTitle icon="note">Solicitações abertas <span className="badge badge-neutral">{requests.length}</span></SectionTitle>
            <Link href={`/solicitacoes/nova?produtor=${id}`} className="btn btn-secondary">
              Nova solicitação
            </Link>
          </div>
          <div className="table-wrap">
            {requests.length === 0 ? (
              <div className="empty"><span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="land" /></span>
                <strong>Nenhuma solicitação aberta</strong>
                Pedidos do produtor aparecem aqui até serem concluídos.
              </div>
            ) : (
              <table className={`table ${ui.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>Assunto</th>
                    <th>Prioridade</th>
                    <th>Situação</th>
                    <th className="right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Assunto">{r.subject}</td>
                      <td data-label="Prioridade">
                        <PriorityTag priority={r.priority} />
                      </td>
                      <td className="nowrap" data-label="Situação">
                        {STATUS_LABEL[r.status]}
                        {r.status === 'SCHEDULED' && r.scheduledFor && (
                          <span className="muted num"> · {formatDay(r.scheduledFor)}</span>
                        )}
                      </td>
                      <td className="right" data-label="Ação">
                        <Link href={`/visitas/nova?produtor=${id}&solicitacao=${r.id}`} className="nowrap">
                          Registrar visita
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          </div>
          <div className="card enter" style={{ '--i': 6 } as React.CSSProperties}>
          <div className={styles.sectionHead}>
            <SectionTitle icon="visit">Visitas <span className="badge badge-neutral">{producer.visits.length}</span></SectionTitle>
            <Link href={`/visitas/nova?produtor=${id}`} className="btn btn-primary">
              Registrar visita
            </Link>
          </div>
          <div className="table-wrap">
            {producer.visits.length === 0 ? (
              <div className="empty"><span className={`card-icon ${ui.emptyIcon}`}><FieldIcon name="land" /></span>
                <strong>Nenhuma visita registrada</strong>
                As visitas técnicas a este produtor aparecem aqui.
              </div>
            ) : (
              <VisitTable visits={producer.visits} showProducer={false} />
            )}
          </div>
          </div>
        </section>
      </div>
    </>
  );
}

// Cadastro de propriedade ou, com `property`, edição de uma já salva.
function PropertyForm({
  producerId,
  property,
  onDone,
  onCancel,
}: {
  producerId: string;
  property?: Property;
  /** `warning` quando a propriedade foi salva mas a demarcação não */
  onDone: (warning?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(property?.name ?? '');
  const [area, setArea] = useState(property ? String(property.areaHa).replace('.', ',') : '');
  const [locality, setLocality] = useState(property?.locality ?? '');
  const [activity, setActivity] = useState(property?.mainActivity ?? '');
  const [location, setLocation] = useState<LocationDraft>(() => locationDraft(property));
  const [perimeter, setPerimeter] = useState<PerimeterDraft>(emptyPerimeter);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !checkRequiredFields(e.currentTarget)) return;
    const areaHa = propertyArea(area);
    if (areaHa === null) {
      reportFieldError(e.currentTarget, 'area', 'Informe uma área maior que zero, até 99.999.999 hectares, com no máximo duas casas após a vírgula. Exemplo: 12,5.');
      return;
    }
    const place = locationInput(location);
    if (typeof place === 'string') {
      setError(place);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Confere o desenho antes de salvar a propriedade.
      const problem = await checkPerimeter(perimeter);
      if (problem) {
        setError(`Demarcação: ${problem.message}`);
        setSaving(false);
        return;
      }
      const saved = property
        ? await updateProperty(property.id, { name: name.trim(), areaHa, locality: locality.trim(), mainActivity: activity.trim(), ...place })
        : await addProperty(producerId, { name: name.trim(), areaHa, locality: locality.trim(), mainActivity: activity.trim() || undefined, ...place });
      try {
        await savePerimeter(saved.id, perimeter);
      } catch (err) {
        // A propriedade já foi salva: fecha o formulário (reenviar duplicaria) e avisa o que faltou.
        const why = err instanceof ApiError ? err.message : 'erro de conexão';
        onDone(`A propriedade "${saved.name}" foi salva, mas a demarcação não (${why}). Abra "Editar" para tentar de novo.`);
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a propriedade.');
      setSaving(false);
    }
  }

  return (
    <form className={`enter ${styles.propertyForm}`} onSubmit={onSubmit} onInput={clearFieldError} noValidate>
          <FormFeedback />
      <SectionTitle icon="land">{property ? 'Editar propriedade' : 'Nova propriedade'}</SectionTitle>
      <p className="muted">Os campos com * são obrigatórios.</p>
      <fieldset disabled={saving} className={styles.propertyFields}>
      <div className="form-row">
        <label className="field">
          <span>Nome da propriedade *</span>
          <input className="input" name="name" required data-required-message="Informe o nome da propriedade." placeholder="Ex.: Sítio Boa Vista" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        </label>
        <label className="field">
          <span>Área declarada (hectares) *</span>
          <input className="input num" name="area" required data-required-message="Informe a área da propriedade. Exemplo: 12,5 hectares." inputMode="decimal" placeholder="12,5" value={area} onChange={(e) => setArea(e.target.value)} />
          <small>A do documento (CAR, escritura). A área demarcada é calculada pelo mapa.</small>
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Localidade *</span>
          <input className="input" name="locality" required data-required-message="Informe onde fica a propriedade." placeholder="Ex.: Estrada do Lago" value={locality} onChange={(e) => setLocality(e.target.value)} maxLength={80} />
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
      <LocationFields value={location} onChange={setLocation} />
      <PerimeterField propertyId={property?.id} value={perimeter} onChange={setPerimeter} onUseArea={(ha) => setArea(String(ha).replace('.', ','))} disabled={saving} />
      </fieldset>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar propriedade'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
