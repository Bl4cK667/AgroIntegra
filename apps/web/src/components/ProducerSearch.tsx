'use client';

import { useEffect, useState } from 'react';
import { listProducers, ProducerSummary } from '@/lib/api';
import { useDebounced } from '@/lib/useDebounced';
import styles from './form.module.css';

// Busca de produtor por nome ou CPF, usada nos formulários de visita e de solicitação.
export function ProducerSearch({ onPick }: { onPick: (id: string) => void }) {
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
