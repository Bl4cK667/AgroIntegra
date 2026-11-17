import s from './nav.module.css';

export type NavIconName =
  | 'painel' | 'produtores' | 'propriedades' | 'solicitacoes' | 'visitas' | 'programas' | 'relatorios'
  | 'mais' | 'sair' | 'sol' | 'lua' | 'recolher';

// Ícones desenhados para o menu. Cada parte tem uma classe própria, animada pelo CSS
// quando o item recebe hover, é pressionado ou fica ativo.
export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      className={`${s.icon} ${s[`i_${name}`] ?? ''}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<NavIconName, React.ReactNode> = {
  painel: (
    <>
      <path d="M3.5 20.5h17" />
      <path className={s.p1} d="M6.5 17V12" />
      <path className={s.p2} d="M12 17V6" />
      <path className={s.p3} d="M17.5 17v-7.5" />
    </>
  ),
  produtores: (
    <>
      <g className={s.p1}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19.5c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" />
      </g>
      <g className={s.p2}>
        <path d="M15.5 5.2a3 3 0 0 1 0 5.6" />
        <path d="M17.3 14.8c1.7.6 2.8 2.2 3.2 4.7" />
      </g>
    </>
  ),
  propriedades: (
    <>
      <path className={s.p1} d="M3 11.2 12 4l9 7.2" />
      <path d="M5.5 9.5v10.5h13V9.5" />
      <path className={s.p2} d="M10 20v-5.2h4V20" />
    </>
  ),
  solicitacoes: (
    <>
      <path d="M4 13.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7" />
      <path d="M4 13.5h4.2l1.6 2.5h4.4l1.6-2.5H20V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <g className={s.p1}>
        <path d="M12 7v5" />
        <path d="m9.8 9.8 2.2 2.2 2.2-2.2" />
      </g>
    </>
  ),
  visitas: (
    <>
      <path className={s.p2} d="M7 21h10" />
      <g className={s.p1}>
        <path d="M12 18s-6-5.2-6-9.8a6 6 0 0 1 12 0C18 12.8 12 18 12 18z" />
        <circle cx="12" cy="8.3" r="2.2" />
      </g>
    </>
  ),
  programas: (
    <>
      <path d="M12 21v-8.5" />
      <path className={s.p1} d="M12 12.5C12 8.6 9.3 6 5 6c0 4 2.8 6.5 7 6.5z" />
      <path className={s.p2} d="M12 15c0-3.6 2.6-6.2 7-6.2 0 3.8-2.8 6.2-7 6.2z" />
    </>
  ),
  relatorios: (
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5" />
      <path className={s.p1} d="M9 12.5h6" pathLength={1} />
      <path className={s.p2} d="M9 16.2h4" pathLength={1} />
    </>
  ),
  mais: (
    <>
      <circle className={s.p1} cx="5.5" cy="12" r="1.3" />
      <circle className={s.p2} cx="12" cy="12" r="1.3" />
      <circle className={s.p3} cx="18.5" cy="12" r="1.3" />
    </>
  ),
  sair: (
    <>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <g className={s.p1}>
        <path d="M10.5 12H3.5" />
        <path d="m6.5 8.5-3.5 3.5 3.5 3.5" />
      </g>
    </>
  ),
  sol: (
    <g className={s.p1}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </g>
  ),
  lua: <path className={s.p1} d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" />,
  recolher: (
    <>
      <path d="M4 4.5v15" />
      <g className={s.p1}>
        <path d="M20 12H9" />
        <path d="m13 8-4 4 4 4" />
      </g>
    </>
  ),
};
