// Contrato compartilhado da Dashboard editável.
// Grade de 12 colunas no desktop (6 no tablet, 1 no celular); linhas de altura fixa (--row-h).
// Dono: Claude Code. Alterações aqui devem ser combinadas entre as três IAs.
import type { ReactNode } from 'react';
import type { Dashboard } from '@/lib/api';

export interface WidgetSize {
  w: number; // colunas (1–12)
  h: number; // linhas (1–6)
}

export interface WidgetProps {
  data: Dashboard;
  size: WidgetSize; // tamanho atual, para o widget adaptar o conteúdo (ex.: esconder eixos quando pequeno)
  editing: boolean; // em modo edição o widget não deve navegar ao clicar
}

export interface WidgetDef {
  type: string; // identificador estável, salvo no layout do usuário (ex.: 'kpi-open-requests')
  title: string; // título do cabeçalho do card
  description: string; // aparece no catálogo "Adicionar widget"
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  href?: string; // link "ver tudo" no cabeçalho (opcional)
  flush?: boolean; // corpo sem margem interna (tabela de borda a borda)
  headerExtra?: (props: WidgetProps) => ReactNode; // ex.: pílulas de alternância, legenda
  render: (props: WidgetProps) => ReactNode; // apenas o corpo; o card/cabeçalho é do WidgetFrame
}

export interface LayoutItem {
  id: string; // instância (permite o mesmo tipo duas vezes)
  type: string; // WidgetDef.type
  w: number;
  h: number;
}

// A ordem do array é a ordem visual (fluxo da grade com grid-auto-flow: dense).
export type Layout = LayoutItem[];
