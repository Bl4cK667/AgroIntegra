'use client';

import Link from 'next/link';
import { FormFeedback } from '@/components/property/FormFeedback';
import { checkRequiredFields, clearFieldError, propertyArea, reportFieldError, validCpf } from '@/components/property/formValidation';
import { FieldHeading, fieldStyles as ui } from '@/components/property/FieldUI';
import { PerimeterField } from '@/components/geo/PerimeterField';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { addProperty, ApiError, createProducer } from '@/lib/api';
import { checkPerimeter, emptyPerimeter, savePerimeter, type PerimeterDraft } from '@/lib/geo';
import { cpfInput } from '@/lib/format';

export default function NovoProdutorPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [community, setCommunity] = useState('');
  const [consent, setConsent] = useState(false);
  // Primeira propriedade + demarcação (módulo geo), opcional.
  const [withProperty, setWithProperty] = useState(false);
  const [propName, setPropName] = useState('');
  const [propArea, setPropArea] = useState('');
  const [propLocality, setPropLocality] = useState('');
  const [propActivity, setPropActivity] = useState('');
  const [perimeter, setPerimeter] = useState<PerimeterDraft>(emptyPerimeter);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (saving || !checkRequiredFields(form)) return;
    if (!validCpf(cpf)) { reportFieldError(form, 'cpf', 'Confira o CPF. Digite os 11 números de um CPF válido.'); return; }
    const areaHa = withProperty ? propertyArea(propArea) : null;
    if (withProperty && areaHa === null) {
      reportFieldError(form, 'propArea', 'Informe a área declarada, maior que zero, com no máximo duas casas após a vírgula. Exemplo: 12,5.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Confere o desenho antes de gravar qualquer coisa, para não criar o produtor e falhar no perímetro.
      if (withProperty) {
        const problem = await checkPerimeter(perimeter);
        if (problem) {
          setError(`Demarcação: ${problem.message}`);
          setSaving(false);
          return;
        }
      }
      const p = await createProducer({ name: name.trim(), cpf, phone: phone.trim() || undefined, community: community.trim(), consent });
      if (!withProperty) {
        router.replace(`/produtores/${p.id}?cadastro=criado`);
        return;
      }
      // Produtor já existe a partir daqui: se algo falhar, seguimos para a página dele com o aviso.
      try {
        const prop = await addProperty(p.id, { name: propName.trim(), areaHa: areaHa!, locality: propLocality.trim(), mainActivity: propActivity.trim() || undefined });
        try {
          await savePerimeter(prop.id, perimeter);
        } catch (err) {
          const why = err instanceof ApiError ? err.message : 'erro de conexão';
          router.replace(`/produtores/${p.id}?cadastro=parcial&motivo=${encodeURIComponent(`A propriedade foi salva, mas a demarcação não (${why}). Abra "Editar" na propriedade para demarcar de novo.`)}`);
          return;
        }
        router.replace(`/produtores/${p.id}?cadastro=criado`);
      } catch (err) {
        const why = err instanceof ApiError ? err.message : 'erro de conexão';
        router.replace(`/produtores/${p.id}?cadastro=parcial&motivo=${encodeURIComponent(`O produtor foi salvo, mas a propriedade não (${why}). Adicione a propriedade abaixo.`)}`);
      }
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
      <FieldHeading eyebrow="Cadastro de produtores" title="Novo produtor" description="Comece pela identificação. Se quiser, já cadastre a primeira propriedade e demarque o perímetro no mapa." />

      <form className={`${ui.form} form-h`} onSubmit={onSubmit} onInput={clearFieldError} noValidate>
          <FormFeedback />
          <fieldset disabled={saving} className={`card enter ${ui.formSection}`}><legend>Identificação e contato</legend>
        <p className="muted">Os campos com * são obrigatórios.</p>
        <label className="field">
          <span>Nome completo *</span>
          <input className="input" name="name" required data-required-message="Informe o nome completo do produtor." autoComplete="name" placeholder="Ex.: Maria da Silva" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>

        <div className="form-row">
          <label className="field">
            <span>CPF *</span>
            <input
              className="input num"
              name="cpf"
              data-required-message="Informe os 11 números do CPF."
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
            <input className="input" name="phone" autoComplete="tel" placeholder="Ex.: (91) 99999-9999" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
          </label>
        </div>

        <label className="field">
          <span>Comunidade *</span>
          <input className="input" name="community" required data-required-message="Informe a comunidade onde o produtor mora." placeholder="Ex.: Comunidade Riacho Verde" value={community} onChange={(e) => setCommunity(e.target.value)} maxLength={80} />
        </label>

          </fieldset>
          <fieldset disabled={saving} className={`card enter ${ui.formSection}`} style={{ '--i': 1 } as React.CSSProperties}><legend>Consentimento e privacidade</legend>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            O produtor autorizou o uso dos seus dados pela secretaria
            <small>Consentimento exigido pela LGPD. A data fica registrada. Se ainda não autorizou, dá para registrar depois.</small>
          </span>
        </label>

          </fieldset>
          <fieldset disabled={saving} className={`card enter ${ui.formSection}`} style={{ '--i': 2 } as React.CSSProperties}><legend>Primeira propriedade e demarcação</legend>
        <label className="check">
          <input type="checkbox" checked={withProperty} onChange={(e) => setWithProperty(e.target.checked)} />
          <span>
            Cadastrar a primeira propriedade agora
            <small>Opcional. A demarcação fica disponível na página do produtor, no mapa da propriedade e no mapa territorial.</small>
          </span>
        </label>
        {withProperty && (
          <>
            <div className="form-row">
              <label className="field">
                <span>Nome da propriedade *</span>
                <input className="input" name="propName" required data-required-message="Informe o nome da propriedade." placeholder="Ex.: Sítio Boa Vista" value={propName} onChange={(e) => setPropName(e.target.value)} maxLength={120} />
              </label>
              <label className="field">
                <span>Área declarada (hectares) *</span>
                <input className="input num" name="propArea" required data-required-message="Informe a área declarada da propriedade. Exemplo: 12,5 hectares." inputMode="decimal" placeholder="12,5" value={propArea} onChange={(e) => setPropArea(e.target.value)} />
                <small>A do documento (CAR, escritura). A área demarcada é calculada pelo mapa.</small>
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Localidade *</span>
                <input className="input" name="propLocality" required data-required-message="Informe onde fica a propriedade." placeholder="Ex.: Vicinal da Serra" value={propLocality} onChange={(e) => setPropLocality(e.target.value)} maxLength={80} />
              </label>
              <label className="field">
                <span>Atividade principal</span>
                <input className="input" placeholder="Ex.: bovinocultura de leite" value={propActivity} onChange={(e) => setPropActivity(e.target.value)} maxLength={80} />
              </label>
            </div>
            <PerimeterField value={perimeter} onChange={setPerimeter} onUseArea={(ha) => setPropArea(String(ha).replace('.', ','))} disabled={saving} />
          </>
        )}
          </fieldset>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        <div className="form-bar">
          <Link href="/produtores" className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Cadastrando…' : 'Cadastrar produtor'}
          </button>
        </div>
      </form>
    </>
  );
}
