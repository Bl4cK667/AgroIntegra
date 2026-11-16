'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MonthlyBars } from '@/components/MonthlyBars';
import { ApiError, Dashboard, getDashboard } from '@/lib/api';
import { useSession } from '@/lib/session';
import styles from './painel.module.css';

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const num = new Intl.NumberFormat('pt-BR');

// Todos os números vêm da API, calculados do banco a cada carregamento.
export default function PainelPage() {
  const user = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o painel.'));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Painel</h1>
          <p>
            Bom trabalho, {user?.name.split(' ')[0]}.
            {data && ` Números de ${MONTHS[data.month - 1]} de ${data.year}, calculados agora.`}
          </p>
        </div>
      </header>

      {error && <p className="alert">{error}</p>}
      {!data && !error && <p className="muted">Carregando…</p>}

      {data && (
        <>
          <section className={styles.figures} aria-label="Indicadores">
            <Link href="/solicitacoes" className={styles.figure}>
              <span className={styles.label}>Demandas abertas</span>
              <strong className="num">{num.format(data.openRequests)}</strong>
              <span className={styles.note}>
                {data.highPriorityOpen > 0 ? (
                  <>
                    <b className="num">{data.highPriorityOpen}</b> de prioridade alta
                  </>
                ) : (
                  'nenhuma de prioridade alta'
                )}
              </span>
            </Link>
            <div className={styles.figure}>
              <span className={styles.label}>Concluídas em {MONTHS[data.month - 1]}</span>
              <strong className="num">{num.format(data.completedThisMonth)}</strong>
              <span className={styles.note}>solicitações encerradas no mês</span>
            </div>
            <Link href="/visitas" className={styles.figure}>
              <span className={styles.label}>Visitas em {data.year}</span>
              <strong className="num">{num.format(data.visitsThisYear)}</strong>
              <span className={styles.note}>atendimentos técnicos no ano</span>
            </Link>
            <Link href="/produtores" className={styles.figure}>
              <span className={styles.label}>Produtores atendidos</span>
              <strong className="num">{num.format(data.producersServed)}</strong>
              <span className={styles.note}>
                de <b className="num">{num.format(data.producersTotal)}</b> cadastrados, com visita em {data.year}
              </span>
            </Link>
          </section>

          <div className={styles.split}>
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Visitas por mês em {data.year}</h2>
                <span className="muted num">soma dos meses: {num.format(data.visitsByMonth.reduce((a, b) => a + b, 0))}</span>
              </div>
              {data.visitsThisYear === 0 ? (
                <p className={styles.empty}>Nenhuma visita registrada em {data.year}.</p>
              ) : (
                <MonthlyBars values={data.visitsByMonth} currentMonth={data.month} year={data.year} />
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Atendimentos por comunidade</h2>
                <span className="muted">{data.year}</span>
              </div>
              {data.visitsByCommunity.length === 0 ? (
                <p className={styles.empty}>As comunidades aparecem com as primeiras visitas do ano.</p>
              ) : (
                <table className={`table ${styles.communities}`}>
                  <thead>
                    <tr>
                      <th>Comunidade</th>
                      <th className="right">Produtores</th>
                      <th className="right">Visitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visitsByCommunity.map((c) => (
                      <tr key={c.community}>
                        <td>
                          {c.community}
                          {/* Barra de proporção: mesma cor do gráfico, só reforça o número ao lado. */}
                          <span
                            className={styles.share}
                            style={{ width: `${(c.visits / data.visitsByCommunity[0].visits) * 100}%` }}
                            aria-hidden="true"
                          />
                        </td>
                        <td className="right num">{c.producers}</td>
                        <td className="right num">{c.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="right num">{data.producersServed}</td>
                      <td className="right num">{data.visitsThisYear}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
