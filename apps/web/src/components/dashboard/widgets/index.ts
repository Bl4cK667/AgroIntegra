import { createElement as h } from 'react';
import type { Layout, WidgetDef } from '../types';
import { HighPriority, Overview, RecentVisits, Upcoming } from './Lists';
import { Communities, Coverage, Kpi, RequestsStatus, VisitsChart, VisitsMode } from './Widgets';

const kpiSize = { defaultSize: { w: 3, h: 2 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 3 } };
const listSize = { defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 8 } };

export const WIDGETS: WidgetDef[] = [
  { type: 'overview', title: 'Situação geral', description: 'Produtores, demandas e visitas em linhas, com a cobertura do ano.', defaultSize: { w: 4, h: 8 }, minSize: { w: 3, h: 5 }, maxSize: { w: 6, h: 10 }, render: props => h(Overview, props) },
  { type: 'list-high-priority', title: 'Alta prioridade em aberto', description: 'Solicitações de alta prioridade ainda não concluídas, das mais antigas para as mais novas.', ...listSize, flush: true, href: '/solicitacoes', render: props => h(HighPriority, props) },
  { type: 'list-upcoming', title: 'Próximas visitas agendadas', description: 'Solicitações agendadas a partir de hoje, pela data da visita.', ...listSize, flush: true, href: '/solicitacoes', render: props => h(Upcoming, props) },
  { type: 'list-recent-visits', title: 'Últimas visitas', description: 'Visitas técnicas mais recentes, com produtor, propriedade e técnico.', ...listSize, flush: true, href: '/visitas', render: props => h(RecentVisits, props) },
  { type: 'kpi-open-requests', title: 'Demandas abertas', description: 'Solicitações em andamento e prioridades de atendimento.', ...kpiSize, href: '/solicitacoes', render: props => h(Kpi, { ...props, kind: 'open' }) },
  { type: 'kpi-completed-month', title: 'Concluídas no mês', description: 'Solicitações encerradas no mês de referência.', ...kpiSize, href: '/solicitacoes', render: props => h(Kpi, { ...props, kind: 'completed' }) },
  { type: 'kpi-visits-year', title: 'Visitas no ano', description: 'Total de atendimentos técnicos realizados no ano.', ...kpiSize, href: '/visitas', render: props => h(Kpi, { ...props, kind: 'visits' }) },
  { type: 'kpi-producers-served', title: 'Produtores atendidos', description: 'Produtores com visita no ano e proporção da base cadastrada.', ...kpiSize, href: '/produtores', render: props => h(Kpi, { ...props, kind: 'producers' }) },
  { type: 'visits-area', title: 'Evolução dos atendimentos', description: 'Visitas por mês, com área ou barras e consulta de cada valor.', defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 6 }, href: '/visitas', headerExtra: () => h(VisitsMode), render: props => h(VisitsChart, props) },
  { type: 'requests-status', title: 'Fluxo de demandas', description: 'Distribuição das demandas abertas: novas, em análise e agendadas.', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 }, href: '/solicitacoes', render: props => h(RequestsStatus, props) },
  { type: 'communities-ranking', title: 'Atendimentos por comunidade', description: 'Ranking de comunidades por visitas, com produtores atendidos.', defaultSize: { w: 4, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 6 }, render: props => h(Communities, props) },
  { type: 'coverage', title: 'Cobertura de produtores', description: 'Participação dos produtores com atendimento no ano.', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 }, href: '/produtores', render: props => h(Coverage, props) },
];

// Layout padrão no estilo de referência: "Situação geral" à esquerda (1/3) e painéis de tabela à direita (2/3).
// A grade usa fluxo denso, então a ordem abaixo monta as duas colunas.
const DEFAULT_TYPES = [
  'overview', // colunas 1–4, linhas 1–8
  'list-high-priority', // colunas 5–12, linhas 1–4
  'list-upcoming', // colunas 5–12, linhas 5–8
  'visits-area', // colunas 1–8, linhas 9–12
  'requests-status', // colunas 9–12, linhas 9–12
  'list-recent-visits', // colunas 1–8, linhas 13–16
  'communities-ranking', // colunas 9–12, linhas 13–16
];

const byType = new Map(WIDGETS.map(widget => [widget.type, widget]));
export const DEFAULT_LAYOUT: Layout = DEFAULT_TYPES.map(type => ({ id: `default-${type}`, type, ...byType.get(type)!.defaultSize }));
