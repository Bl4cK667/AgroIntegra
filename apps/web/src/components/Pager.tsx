'use client';

import { useEffect, useState } from 'react';

// Paginação das listas, no mesmo padrão da lista de Solicitações (.pager em globals.css):
// contagem "Mostrando X a Y de Z" e botões de texto Primeira / Anterior / Seguinte / Última.
// Divide os registros já carregados; a busca e os filtros valem para a lista inteira.
export const PAGE_SIZE = 20;

export function usePager<T>(items: T[], resetKey: unknown = null, size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));

  // Nova busca ou filtro: volta para a primeira página.
  useEffect(() => setPage(1), [resetKey]);

  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  return { current, pages, setPage, start, pageItems: items.slice(start, start + size) };
}

export function Pager({ current, pages, setPage, start, shown, total }: {
  current: number;
  pages: number;
  setPage: (n: number) => void;
  start: number;
  shown: number;
  total: number;
}) {
  return (
    <>
      <span className="num">
        Mostrando {shown ? `${(start + 1).toLocaleString('pt-BR')} a ${(start + shown).toLocaleString('pt-BR')}` : '0'} de {total.toLocaleString('pt-BR')}
      </span>
      {pages > 1 && (
        <nav className="pager" aria-label="Páginas">
          <button type="button" onClick={() => setPage(1)} disabled={current === 1}>Primeira</button>
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1}>Anterior</button>
          <button type="button" aria-current="page">{current} de {pages}</button>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages}>Seguinte</button>
          <button type="button" onClick={() => setPage(pages)} disabled={current === pages}>Última</button>
        </nav>
      )}
    </>
  );
}
