import { createElement as h } from 'react';
import type { Layout, WidgetDef } from '../types';
import { Communities, Coverage, Kpi, RequestsStatus, VisitsChart, VisitsMode } from './Widgets';

function icon(path: string) {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: path }));
}
const kpiSize = { defaultSize: { w: 3, h: 2 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 3 } };
export const WIDGETS: WidgetDef[] = [
  { type: 'kpi-open-requests', title: 'Demandas abertas', description: 'Solicitações em andamento e prioridades de atendimento.', icon: icon('M8 3h8l4 4v14H4V3h4m0 7h8m-8 4h5'), ...kpiSize, href: '/solicitacoes', render: props => h(Kpi, { ...props, kind: 'open' }) },
  { type: 'kpi-completed-month', title: 'Concluídas no mês', description: 'Solicitações encerradas no mês de referência.', icon: icon('M20 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9m-6 7 4 4L22 5'), ...kpiSize, href: '/solicitacoes', render: props => h(Kpi, { ...props, kind: 'completed' }) },
  { type: 'kpi-visits-year', title: 'Visitas no ano', description: 'Total de atendimentos técnicos realizados no ano.', icon: icon('M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 11 3 3 5-5'), ...kpiSize, href: '/visitas', render: props => h(Kpi, { ...props, kind: 'visits' }) },
  { type: 'kpi-producers-served', title: 'Produtores atendidos', description: 'Produtores com visita no ano e proporção da base cadastrada.', icon: icon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m7 .13a4 4 0 0 1 0 7.75'), ...kpiSize, href: '/produtores', render: props => h(Kpi, { ...props, kind: 'producers' }) },
  { type: 'visits-area', title: 'Evolução dos atendimentos', description: 'Visitas por mês, com área ou barras e consulta de cada valor.', icon: icon('M3 3v18h18M6 15l4-5 4 3 7-8'), defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 6 }, href: '/visitas', headerExtra: () => h(VisitsMode), render: props => h(VisitsChart, props) },
  { type: 'requests-status', title: 'Fluxo de demandas', description: 'Distribuição das demandas abertas: novas, em análise e agendadas.', icon: icon('M4 5h16M4 12h10M4 19h6'), defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 }, href: '/solicitacoes', render: props => h(RequestsStatus, props) },
  { type: 'communities-ranking', title: 'Atendimentos por comunidade', description: 'Ranking de comunidades por visitas, com produtores atendidos.', icon: icon('M3 21h18M5 21V10l7-7 7 7v11M9 21v-7h6v7'), defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 6 }, render: props => h(Communities, props) },
  { type: 'coverage', title: 'Cobertura de produtores', description: 'Participação dos produtores com atendimento no ano.', icon: icon('M21 12a9 9 0 1 1-9-9v9h9M16 3.9A9 9 0 0 1 20.1 8H16V3.9'), defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 }, href: '/produtores', render: props => h(Coverage, props) },
];

export const DEFAULT_LAYOUT: Layout = WIDGETS.map(widget => ({ id: `default-${widget.type}`, type: widget.type, ...widget.defaultSize }));
