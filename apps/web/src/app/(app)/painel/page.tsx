'use client';

import Link from 'next/link';
import { useSession } from '@/lib/session';

// Os indicadores entram junto com Solicitações e Visitas, sempre calculados do banco.
export default function PainelPage() {
  const user = useSession();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Painel</h1>
          <p>Bom trabalho, {user?.name.split(' ')[0]}.</p>
        </div>
      </header>

      <section className="table-wrap">
        <div className="empty">
          <strong>Nenhum atendimento registrado</strong>
          Demandas abertas, visitas do ano e produtores atendidos aparecem aqui quando a equipe começar a registrar visitas.
          <p>
            <Link href="/produtores">Ver produtores cadastrados</Link>
          </p>
        </div>
      </section>
    </>
  );
}
