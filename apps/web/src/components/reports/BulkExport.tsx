'use client';

import { useEffect, useState } from 'react';
import { FieldIcon } from '@/components/property/FieldUI';
import {
  ApiError,
  BULK_TYPE_LABEL,
  type BulkFilterOptions,
  type BulkFilters,
  type BulkFormat,
  type BulkType,
  countBulkReport,
  fetchBulkReport,
  getBulkFilterOptions,
} from '@/lib/api';
import { formatInt } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import s from './bulkExport.module.css';

const TYPES: BulkType[] = ['producers', 'properties', 'visits'];

// O que o período e o técnico significam em cada tipo (mesma regra da API).
const HINT: Record<BulkType, string> = {
  producers: 'Com período ou técnico, entram só os produtores que tiveram visita que atende a esses filtros.',
  properties: 'Com período ou técnico, entram só as propriedades com visita registrada nelas que atende a esses filtros.',
  visits: 'O período considera a data da visita.',
};

// Exportação em massa: planilha CSV (abre no Excel) ou PDF em tabela. Cada arquivo fica registrado na auditoria.
export function BulkExport() {
  const [type, setType] = useState<BulkType>('producers');
  const [filters, setFilters] = useState<BulkFilters>({});
  const [options, setOptions] = useState<BulkFilterOptions | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState<BulkFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useDebounced(filters);

  const periodHalf = Boolean(filters.from) !== Boolean(filters.to);
  const periodInverted = Boolean(filters.from && filters.to && filters.from > filters.to);
  const periodInvalid = periodHalf || periodInverted;

  useEffect(() => {
    getBulkFilterOptions()
      .then(setOptions)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os filtros.'));
  }, []);

  // A contagem acompanha tipo e filtros, para mostrar o tamanho do arquivo antes de baixar.
  useEffect(() => {
    const half = Boolean(query.from) !== Boolean(query.to);
    if (half || (query.from && query.to && query.from > query.to)) {
      setTotal(null);
      return;
    }
    let alive = true;
    setCounting(true);
    countBulkReport(type, query)
      .then((r) => alive && (setTotal(r.total), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Não foi possível contar os registros.'))
      .finally(() => alive && setCounting(false));
    return () => {
      alive = false;
    };
  }, [type, query]);

  const set = (key: keyof BulkFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: event.target.value || undefined }));

  async function download(format: BulkFormat) {
    setBusy(format);
    setError(null);
    setNotice(null);
    try {
      const { blob, name } = await fetchBulkReport(type, format, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice(`Arquivo ${name} gerado.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível gerar o arquivo.');
    } finally {
      setBusy(null);
    }
  }

  const limits = options?.limits;
  const overCsv = total !== null && !!limits && total > limits.csv;
  const overPdf = total !== null && !!limits && total > limits.pdf;
  const ownName = options?.technicianLocked ? options.technicians[0]?.name : undefined;

  return (
    <section className="card" aria-labelledby="bulk-title">
      <div className="card-head">
        <h2 id="bulk-title" className="card-title">Exportação em massa</h2>
      </div>

      <div className={`form-h ${s.form}`}>
        <div className="field">
          <span id="bulk-type-label">Relatório</span>
          <div className="segmented" role="group" aria-labelledby="bulk-type-label">
            {TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                {BULK_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <small>{HINT[type]}</small>
        </div>

        <div className="field">
          <span id="bulk-period-label">Período</span>
          <div className={s.dates} role="group" aria-labelledby="bulk-period-label">
            <label>
              <span className={s.inline}>De</span>
              <input className="input num" type="date" value={filters.from ?? ''} max={filters.to} onChange={set('from')} aria-invalid={periodInvalid || undefined} />
            </label>
            <label>
              <span className={s.inline}>Até</span>
              <input className="input num" type="date" value={filters.to ?? ''} min={filters.from} onChange={set('to')} aria-invalid={periodInvalid || undefined} />
            </label>
            {(filters.from || filters.to) && (
              <button type="button" className="btn-link" onClick={() => setFilters((f) => ({ ...f, from: undefined, to: undefined }))}>
                Limpar período
              </button>
            )}
          </div>
          {periodHalf && <small className="field-error">Informe o início e o fim, ou deixe os dois em branco.</small>}
          {periodInverted && <small className="field-error">O fim do período não pode ser antes do início.</small>}
          {!periodInvalid && <small>Em branco: todo o histórico.</small>}
        </div>

        <label className="field">
          <span>Comunidade</span>
          <select className="input" value={filters.community ?? ''} onChange={set('community')}>
            <option value="">Todas</option>
            {options?.communities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Técnico</span>
          {options?.technicianLocked ? (
            <>
              <input className="input" value={ownName ?? 'Você'} disabled readOnly />
              <small>Como técnico, você exporta só os seus registros.</small>
            </>
          ) : (
            <select className="input" value={filters.technicianId ?? ''} onChange={set('technicianId')}>
              <option value="">Todos</option>
              {options?.technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </label>

        <label className="field">
          <span>Programa</span>
          <select className="input" value={filters.programId ?? ''} onChange={set('programId')}>
            <option value="">Todos</option>
            {options?.programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <small>Produtores inscritos, em qualquer situação da inscrição.</small>
        </label>
      </div>

      <div className={s.summary} role="status" aria-live="polite">
        {periodInvalid ? (
          <span className="muted">Corrija o período para ver a contagem.</span>
        ) : total === null || counting ? (
          <span className="muted">Contando registros…</span>
        ) : (
          <>
            <strong className="num">{formatInt(total)}</strong> {total === 1 ? 'registro' : 'registros'} de {BULK_TYPE_LABEL[type].toLowerCase()} com estes filtros.
          </>
        )}
      </div>

      {overCsv && limits && (
        <p className="alert" role="alert">Acima de {formatInt(limits.csv)} registros. Restrinja os filtros para exportar.</p>
      )}
      {!overCsv && overPdf && limits && (
        <p className={s.warn}>O PDF aceita até {formatInt(limits.pdf)} registros. Use a planilha ou restrinja os filtros.</p>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="form-bar">
        <button type="button" className="btn btn-secondary" onClick={() => download('pdf')} disabled={!!busy || periodInvalid || total === 0 || overPdf}>
          <FieldIcon name="download" />
          {busy === 'pdf' ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => download('csv')} disabled={!!busy || periodInvalid || total === 0 || overCsv}>
          <FieldIcon name="download" />
          {busy === 'csv' ? 'Gerando planilha…' : 'Baixar planilha (CSV)'}
        </button>
      </div>
      <p className={s.foot}>CPF sempre mascarado. Cada arquivo gerado fica registrado na auditoria.</p>
    </section>
  );
}
