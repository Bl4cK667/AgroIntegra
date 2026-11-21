'use client';

// Cotações (módulo cotacoes): preço recebido pelo produtor da CONAB (semanal, UF e praças municipais
// com dado recente) e preços locais lançados pela equipe. Sempre com fonte, praça e data.

import { Fragment, useCallback, useEffect, useState } from 'react';
import { FieldHeading, FieldLoading, fieldStyles as ui } from '@/components/property/FieldUI';
import { Toast } from '@/components/feedback/Toast';
import styles from '@/components/cotacoes/cotacoes.module.css';
import { ApiError } from '@/lib/api';
import {
  createLocalPrice,
  deleteLocalPrice,
  formatPrice,
  getCotacoes,
  getProductHistory,
  importCotacoesNow,
  listLocalPrices,
  parsePrice,
  type CotacoesOverview,
  type LocalQuote,
  type ProductHistory,
  type ProductQuotes,
} from '@/lib/cotacoes';
import { formatDate, formatDay, formatPercent, todayIso } from '@/lib/format';
import { useSession } from '@/lib/session';

const OTHER = '__outro__';

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const cls = pct > 0 ? styles.up : pct < 0 ? styles.down : styles.flat;
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
  return (
    <span className={`${styles.change} ${cls}`} title="Variação para a semana anterior">
      {arrow} {formatPercent(Math.abs(pct))}
    </span>
  );
}

// Uma linha por produto (mesmo padrão de Cadastros > Produtores). A linha abre o histórico logo abaixo.
function ProductRow({ p, onHistory, selected }: { p: ProductQuotes; onHistory: () => void; selected: boolean }) {
  const main = p.state[0] ?? null;
  return (
    <tr className={`clickable ${selected ? styles.rowOpen : ''}`} onClick={onHistory}>
      <td data-label="Produto">
        <button
          type="button"
          className={styles.rowButton}
          aria-expanded={selected}
          aria-controls={`hist-${p.key}`}
          onClick={(e) => {
            e.stopPropagation();
            onHistory();
          }}
        >
          {p.label}
        </button>
        {p.note && <small className={styles.cellNote}>{p.note}</small>}
      </td>
      <td className="right" data-label="Preço no estado (CONAB)">
        {main ? (
          <>
            <strong className="num">{formatPrice(main.value, main.unit)}</strong>
            {main.stale && <> <span className="badge badge-warning">Desatualizada</span></>}
            {main.warning && <small className={styles.cellNote}>{main.warning}</small>}
          </>
        ) : (
          <span className="muted">Sem cotação</span>
        )}
      </td>
      <td className="right nowrap" data-label="Variação">{main ? <Change pct={main.changePct} /> : null}</td>
      <td className="hide-sm nowrap num" data-label="Semana">
        {main ? (
          <>
            {formatDay(main.weekStart)} a {formatDay(main.weekEnd)}
            <small className={styles.cellNote}>{main.place} · CONAB</small>
          </>
        ) : '—'}
      </td>
      <td className="hide-sm" data-label="Praças municipais">
        {p.municipalities.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <ul className={styles.placeList}>
            {p.municipalities.map((m) => (
              <li key={m.place}>
                {m.place}: <span className="num">{formatPrice(m.value, m.unit)}</span>{' '}
                <span className={styles.meta}>até {formatDay(m.weekEnd)}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td data-label="Preço local">
        {p.local ? (
          <>
            <span className="num">{formatPrice(p.local.price, p.local.unit)}</span>
            <small className={styles.cellNote}>
              {p.local.place}, {formatDay(p.local.observedOn)} · {p.local.createdBy.name}
            </small>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  );
}

function History({ data }: { data: ProductHistory }) {
  const weeks = [...new Set(data.series.flatMap((s) => s.points.map((pt) => pt.weekEnd)))].sort().reverse();
  return (
    <section className={styles.history} aria-label={`Histórico de ${data.product.label}`}>
      <h3 className={styles.sectionTitle}>Histórico: {data.product.label} ({data.product.unit})</h3>
      {weeks.length === 0 ? (
        <p className="muted">Sem histórico no período.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Semana até</th>
                {data.series.map((s) => <th key={s.place} className="right">{s.place}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w}>
                  <td className="nowrap">{formatDay(w)}</td>
                  {data.series.map((s) => {
                    const pt = s.points.find((x) => x.weekEnd === w);
                    return <td key={s.place} className="right num">{pt ? formatPrice(pt.value, data.product.unit) : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.local.length > 0 && (
        <p className={styles.meta}>
          Preços locais no período: {data.local.map((l) => `${formatPrice(l.price, l.unit)} (${l.place}, ${formatDay(l.observedOn)})`).join('; ')}.
        </p>
      )}
      <p className={styles.meta}>{data.source}</p>
    </section>
  );
}

export default function CotacoesPage() {
  const session = useSession();
  const isCoordination = session?.role === 'COORDINATION';
  const [data, setData] = useState<CotacoesOverview | null>(null);
  const [locals, setLocals] = useState<{ items: LocalQuote[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Formulário de preço local.
  const [productKey, setProductKey] = useState('BOI_GORDO');
  const [productName, setProductName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [place, setPlace] = useState('');
  const [observedOn, setObservedOn] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    getCotacoes()
      .then((d) => (setData(d), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as cotações.'));
    listLocalPrices(1, 20).then(setLocals).catch(() => setLocals({ items: [], total: 0 }));
  }, []);
  useEffect(load, [load]);

  async function toggleHistory(key: string) {
    if (historyKey === key) {
      setHistoryKey(null);
      setHistory(null);
      return;
    }
    setHistoryKey(key);
    setHistory(null);
    try {
      setHistory(await getProductHistory(key, 26));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o histórico.');
    }
  }

  async function importNow() {
    setImporting(true);
    try {
      const results = await importCotacoesNow();
      const failed = results.filter((r) => r.status === 'FAILED');
      if (failed.length) setError(failed.map((r) => r.message).join(' '));
      else setSuccess(results.map((r) => `${r.file === 'UF' ? 'UF' : 'Municípios'}: ${r.message}`).join(' '));
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível importar agora.');
    } finally {
      setImporting(false);
    }
  }

  async function saveLocal(e: React.FormEvent) {
    e.preventDefault();
    const value = parsePrice(price);
    if (value === null) {
      setFormError('Informe o preço em reais, por exemplo 310,50.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const other = productKey === OTHER;
      await createLocalPrice({
        ...(other ? { productName: productName.trim(), unit: unit.trim() } : { productKey }),
        price: value,
        place: place.trim(),
        observedOn,
        notes: notes.trim() || undefined,
      });
      setSuccess('Preço local lançado.');
      setPrice('');
      setNotes('');
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o preço.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: LocalQuote) {
    if (!window.confirm(`Excluir o preço de ${l.productName} (${formatPrice(l.price, l.unit)}, ${l.place})?`)) return;
    try {
      await deleteLocalPrice(l.id);
      setSuccess('Preço local excluído.');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
    }
  }

  if (!data && !error) return <FieldLoading />;
  const selectedUnit = productKey === OTHER ? null : data?.products.find((p) => p.key === productKey)?.unit;

  return (
    <>
      <FieldHeading
        eyebrow="Cotações"
        title="Preços ao produtor"
        description="Preço recebido pelo produtor no Pará, semana a semana (CONAB), e os preços que a equipe encontra nas praças da região."
        actions={
          isCoordination ? (
            <button type="button" className="btn btn-secondary" onClick={importNow} disabled={importing}>
              {importing ? 'Buscando…' : 'Buscar dados da CONAB agora'}
            </button>
          ) : undefined
        }
      />
      <Toast message={success} onClose={() => setSuccess(null)} />
      {error && <p role="alert" className="alert">{error}</p>}

      {data && (
        <>
          <p className={styles.status}>
            {data.imports.lastSuccessAt
              ? <>Dados da CONAB conferidos em <span className="num">{formatDate(data.imports.lastSuccessAt)}</span>.</>
              : 'Os dados da CONAB ainda não foram importados.'}
            {data.imports.lastError && <> Última tentativa falhou: {data.imports.lastError} Mostrando os últimos dados válidos.</>}
          </p>

          <section className={`card ${ui.listCard}`}>
            <div className="toolbar">
              <span className="count num">
                {data.products.length} {data.products.length === 1 ? 'produto' : 'produtos'} · selecione uma linha para ver o histórico de 26 semanas
              </span>
            </div>
            <div className="table-wrap">
              <table className={`table ${ui.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="right">Preço no estado (CONAB)</th>
                    <th className="right">Variação</th>
                    <th className="hide-sm">Semana</th>
                    <th className="hide-sm">Praças municipais</th>
                    <th>Preço local</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <Fragment key={p.key}>
                      <ProductRow p={p} selected={historyKey === p.key} onHistory={() => toggleHistory(p.key)} />
                      {historyKey === p.key && (
                        <tr className={styles.detailRow}>
                          <td colSpan={6} id={`hist-${p.key}`}>
                            {history ? <History data={history} /> : <p className={`muted ${styles.loadingNote}`}>Carregando histórico…</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className={styles.meta}>
            {data.sources.conab} Valores convertidos para a unidade usada no campo. Praças municipais aparecem quando o dado tem até {data.staleDays} dias.
          </p>
        </>
      )}

      <div className={styles.localGrid}>
        <form className={`card ${styles.form}`} onSubmit={saveLocal}>
          <h3 className={styles.sectionTitle}>Lançar preço local</h3>
          {formError && <p role="alert" className="alert">{formError}</p>}
          <label className="field">
            <span>Produto</span>
            <select className="input" value={productKey} onChange={(e) => setProductKey(e.target.value)}>
              {data?.products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              <option value={OTHER}>Outro produto…</option>
            </select>
          </label>
          {productKey === OTHER && (
            <div className="form-row">
              <label className="field">
                <span>Nome do produto</span>
                <input className="input" value={productName} maxLength={80} required onChange={(e) => setProductName(e.target.value)} placeholder="Ex.: Queijo coalho" />
              </label>
              <label className="field">
                <span>Unidade</span>
                <input className="input" value={unit} maxLength={30} required onChange={(e) => setUnit(e.target.value)} placeholder="Ex.: R$/kg" />
              </label>
            </div>
          )}
          <div className="form-row">
            <label className="field">
              <span>Preço{selectedUnit ? ` (${selectedUnit})` : ''}</span>
              <input className="input num" inputMode="decimal" value={price} required onChange={(e) => setPrice(e.target.value)} placeholder="310,50" />
            </label>
            <label className="field">
              <span>Data</span>
              <input className="input" type="date" value={observedOn} max={todayIso()} required onChange={(e) => setObservedOn(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Praça</span>
            <input className="input" value={place} maxLength={120} required onChange={(e) => setPlace(e.target.value)} placeholder="Ex.: Laticínio Serra Dourada, Canaã dos Carajás" />
          </label>
          <label className="field">
            <span>Observação</span>
            <input className="input" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Lançar preço'}</button>
          </div>
        </form>

        <section className={`card ${styles.form}`} aria-label="Preços locais lançados">
          <h3 className={styles.sectionTitle}>Preços locais lançados{locals ? ` (${locals.total})` : ''}</h3>
          {!locals ? (
            <p className="muted">Carregando…</p>
          ) : locals.items.length === 0 ? (
            <p className="muted">Nenhum preço local lançado ainda.</p>
          ) : (
            <ul className={styles.localList}>
              {locals.items.map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.productName}</strong> <span className="num">{formatPrice(l.price, l.unit)}</span>
                    <div className={styles.meta}>
                      {l.place} · {formatDay(l.observedOn)} · por {l.createdBy.name}
                      {l.notes ? ` · ${l.notes}` : ''}
                    </div>
                  </div>
                  {(isCoordination || l.createdBy.id === session?.id) && (
                    <button type="button" className="btn-link" onClick={() => remove(l)}>Excluir</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
