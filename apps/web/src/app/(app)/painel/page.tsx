'use client';

import { ROLE_LABEL } from '@/lib/api';
import { useSession } from '@/lib/session';
import styles from './painel.module.css';

// Painel vazio da fase 1. Os números chegam na fase 4, sempre calculados do banco.
const CARDS = ['Demandas abertas', 'Concluídas no mês', 'Visitas no ano', 'Produtores atendidos'];

export default function PainelPage() {
  const user = useSession();

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1>Painel</h1>
          <p>
            Olá, {user?.name.split(' ')[0]}. Você entrou como <strong>{user && ROLE_LABEL[user.role]}</strong>.
          </p>
        </div>
      </header>

      <section className={styles.cards}>
        {CARDS.map((title) => (
          <article key={title} className={styles.card}>
            <h2>{title}</h2>
            <p className={styles.empty}>Sem dados ainda</p>
          </article>
        ))}
      </section>

      <section className={styles.placeholder}>
        <h2>Atendimentos por mês</h2>
        <p>O gráfico aparece quando houver visitas registradas.</p>
      </section>
    </>
  );
}
