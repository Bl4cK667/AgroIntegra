# Design system: referência SGP adaptada ao AgroIntegra

Este documento registra a estética observada no SGP (sistema de gestão para provedores de internet) e como ela se traduz para o AgroIntegra. Do SGP aproveitamos **só a forma**: estrutura de layout, densidade e estilo dos componentes. Cores, marca, textos, telas e regras continuam sendo do AgroIntegra.

- Referência principal: vídeo "SGP treinamento padrão" (YouTube, cerca de 1h52).
- Capturas: `docs/referencia-sgp/`, **só na máquina local** (está no `.gitignore`). São telas de um produto de terceiros e não são publicadas no repositório. Quem não tiver a pasta pode consultar o vídeo nos minutos indicados abaixo.
- Decisão de 20/11/2026: **mantemos a paleta do AgroIntegra** (verde #1F5A3D, IBM Plex Sans, cantos de 2 a 4px). A organização visual vem do SGP, e as cores dele aparecem aqui só como registro.

## Capturas de referência

| Arquivo | Minuto | O que mostra |
| --- | --- | --- |
| `01-login-portal.jpg` | ~58:00 | Login (portal do assinante): cartão estreito centralizado, alternância segmentada, botão de largura total |
| `02-dashboard.jpg` | 01:00 | Painel: cabeçalho em duas faixas, coluna de indicadores à esquerda, painéis com tabela à direita |
| `03-modal-formulario.jpg` | 05:00 | Modal com formulário horizontal, rodapé com botões à direita |
| `04-formulario-abas.jpg` | 25:00 | Cadastro com abas; rótulo à esquerda, campo à direita, texto de ajuda abaixo |
| `05-formulario-secoes.jpg` | 45:00 | Formulário longo dividido em seções com faixa de título |
| `06-listagem-simples.jpg` | 40:00 | Listagem: título, botão "Cadastrar" verde à direita, busca acima da tabela, paginação no rodapé |
| `07-ficha-cliente-abas-tabela-badges.jpg` | 1:06:00 | Ficha do registro: bloco de identificação, abas, tabela com badges e botões de ação |
| `08-formulario-em-ficha.jpg` | 1:24:00 | Formulário dentro de uma aba da ficha |
| `09-listagem-status-linha-destacada.jpg` | 1:36:00 | Sub-abas, linha de tabela destacada por status |
| `10-secao-escura-botoes-rodape.jpg` | 1:42:00 | Faixa escura de seção, barra de ações no rodapé do formulário |
| `11-mapa.jpg` | 1:48:00 | Mapa em tela cheia sob o cabeçalho, controles flutuantes |
| `12-portal-sidebar-cards.jpg` | 1:00:00 | Variante com barra lateral escura e cards com faixa de título colorida |
| `13-editor-rich-text.jpg` | 10:00 | Editor de texto com barra de ferramentas escura |

O vídeo não mostra o login do painel administrativo, só o do portal do assinante. Ele serve de referência para a tela de login.

## 1. Paleta

### Observada no SGP (aproximada)

| Papel | Hex | Uso |
| --- | --- | --- |
| Faixa superior do cabeçalho | `#2F3B47` | marca, busca rápida, usuário |
| Faixa do menu | `#3A4653` | menu principal com submenus |
| Fundo da página | `#FFFFFF` | conteúdo direto no branco |
| Fundo de faixa de painel | `#F5F5F5` | título de painel, cabeçalho de tabela |
| Rodapé de tabela | `#E9E9E9` | contagem e paginação |
| Borda | `#DDDDDD` | painéis, tabelas, campos |
| Texto | `#333333` | corpo |
| Texto secundário | `#888888` | ajuda sob campos, paginação |
| Primária (ação) | `#1E7BC4` | "Dashboards", "Cadastrar contrato" |
| Sucesso / criar | `#3C9A4A` | "Cadastrar", "Status" |
| Alerta | `#F0AD4E` | badge "Inativo", aba ativa secundária |
| Erro | `#D9534F` | badge "Offline", excluir |
| Rosa / roxo / cinza | `#E8578E` / `#9B59B6` / `#6C757D` | badges de categoria |
| Linha destacada | `#F8D7DA` | registro atrasado |

### Adaptada ao AgroIntegra (vale para o código)

Os papéis são os do SGP e os valores são os tokens que já existem em `themes.css`. Entram tokens novos só para as faixas do cabeçalho e dos painéis.

| Papel | Token | Claro | Observação |
| --- | --- | --- | --- |
| Faixa superior | `--header-top-bg` (novo) | `#17472F` | verde da marca escurecido |
| Faixa do menu | `--header-menu-bg` (novo) | `#1F5A3D` | verde da marca |
| Texto no cabeçalho | `--header-ink` (novo) | `#FFFFFF` / `#D7E4DC` | contraste AA sobre os dois verdes |
| Fundo da página | `--fundo` | `#F3F4F3` | mantido (o SGP usa branco puro) |
| Painel | `--card` | `#FFFFFF` | |
| Faixa de título do painel | `--panel-head-bg` (novo) | `#F0F2F1` | equivale ao `#F5F5F5` do SGP |
| Faixa de seção escura | `--section-dark-bg` (novo) | `#3F4A44` | equivale ao cinza-escuro "PRODUTOS" |
| Borda | `--linha` / `--linha-forte` | `#D5D9D6` / `#8E9792` | |
| Texto | `--ink` / `--muted` | `#1B2420` / `#55605A` | |
| Primária | `--accent` | `#1F5A3D` | ocupa o lugar do azul e do verde de ação do SGP |
| Sucesso | `--success` | `#1E6B3A` | |
| Alerta | `--warning` | `#8A5A00` | |
| Erro | `--perigo` | `#A12A1B` | |
| Destaque de linha | `--perigo-fundo` / `--warning-bg` | `#FBEEEC` / `#FBF3E4` | |

Os 5 temas alternativos (4 escuros e "Areia") recebem os mesmos tokens novos com valores próprios. No escuro, o cabeçalho usa `--nav-bg` com uma borda inferior, e não verde chapado.

Se precisar de mais cores de categoria, como o rosa e o roxo do SGP, elas saem da série de gráficos (`--chart-*`) e de tons terrosos (`--ouro`, `--terra`), nunca de cores vivas soltas.

## 2. Tipografia

- O SGP usa uma sans neo-grotesca (aparência de Roboto/Helvetica) em corpo pequeno, de 12 a 13px. A tela é densa.
- Rótulo obrigatório em **negrito** com asterisco; rótulo opcional em peso normal.
- Título de página grande e leve (~22px, peso 400). Título de painel pequeno e em negrito (~13px, 600).
- **No AgroIntegra:** mantemos a **IBM Plex Sans**, já carregada por `next/font`, sem dependência nova. Uma fonte gratuita equivalente ao SGP seria a Roboto, mas a Plex já atende à mesma função e é a fonte aprovada.

| Uso | Tamanho | Peso |
| --- | --- | --- |
| Título de página | 22px (`--text-xl`) | 400 (hoje 600) |
| Título de painel / seção | 14px (`--text-md`) | 600 |
| Corpo e células | 14px (`--text-md`) | 400 |
| Rótulo de campo | 13px (`--text-sm`) | 400, ou 600 se obrigatório |
| Ajuda sob o campo, paginação | 12px (`--text-xs`) | 400 |
| Item de menu | 13px | 500 |

O corpo continua em 14 a 15px, e não nos 12px do SGP: os técnicos usam o painel no campo e precisam de legibilidade.

## 3. Espaçamento, cantos e sombras

- Grade de 4px (já existe: `--space-1` a `--space-6`).
- Densidade do SGP: células com padding de 6 a 8px por 10px, painéis com padding interno de 10 a 12px, 16px entre painéis.
- Cantos de 3 a 4px (padrão Bootstrap 3). Coincide com o `--radius-sm` a `--radius-lg` atual: **sem mudança**.
- Sombras: o SGP quase não usa. Só o modal tem sombra (`--shadow-lift`). Painéis e cards têm só borda. Coincide com a regra atual.

## 4. Estrutura do layout

```
┌──────────────────────────────────────────────────────────────┐
│ [marca]  [Consultar produtor____] [tipo▾]   Org · Usuário  Sair│  faixa superior, 44px, --header-top-bg
├──────────────────────────────────────────────────────────────┤
│ Painel  Produtores  Propriedades  Mapa  …              Ajuda │  faixa do menu, 36px, --header-menu-bg
├──────────────────────────────────────────────────────────────┤
│ Título da página                               [+ Cadastrar] │
│ ┌ Painel ───────────────┐ ┌ Painel ───────────────────────┐ │
│ │ faixa de título       │ │ faixa de título               │ │
│ │ conteúdo              │ │ Buscar: [____]                 │ │
│ └───────────────────────┘ │ tabela                         │ │
│                           │ rodapé: contagem · paginação   │ │
│                           └───────────────────────────────┘ │
│                rodapé discreto centralizado                  │
└──────────────────────────────────────────────────────────────┘
```

- **Cabeçalho em duas faixas, fixo no topo.** A de cima tem a marca, a busca rápida, a organização, o usuário e "Sair". A de baixo tem o menu horizontal; o item ativo fica com fundo mais claro ou com sublinhado.
- **Conteúdo em largura total**, com margem lateral de 16 a 24px. O SGP não centraliza em coluna estreita.
- **Grade do painel:** coluna de indicadores com ~1/3 da largura à esquerda e painéis de tabela com ~2/3 à direita. No celular, tudo em uma coluna.
- **Ficha do registro:** bloco de identificação (ID, nome, documento, contadores coloridos) à esquerda, metadados à direita, abas logo abaixo.
- **Variante com barra lateral** (portal do assinante): barra escura de ~240px com grupos rotulados em caixa alta pequena. Ela equivale ao estilo "Sidebar" que já existe em Configurações → Aparência.
- **Celular:** a faixa do menu vira um botão "Menu" que abre a lista; a busca rápida vai para dentro do menu.

## 5. Componentes

### Botões
- Retangulares, altura 30 a 34px, padding de 12px, canto de 3px, texto 13px peso 500, sem sombra nem gradiente.
- **Primário** (criar ou confirmar): fundo `--accent`, texto branco. No SGP, o "Cadastrar" verde fica no canto superior direito da listagem.
- **Secundário**: fundo `--card-2`, borda `--linha`, texto `--ink`. É o "Cancelar" dos modais.
- **Escuro** (salvar em barra de rodapé): fundo `--section-dark-bg`, texto branco.
- **Perigo**: fundo `--perigo`, texto branco, só para excluir.
- **Ícone de ação em linha** (editar, excluir): botão de 24px só com ícone, sempre com `aria-label`.
- Grupo de ações no rodapé do formulário: barra `--panel-head-bg` com os botões alinhados à direita.

### Campos
- **Formulário horizontal:** rótulo à esquerda em coluna de ~160px, alinhado ao topo do campo, e campo à direita. Abaixo de 640px, o rótulo vai para cima.
- Campo com altura de 30 a 34px, borda `--linha-forte`, canto de 3px e fundo branco. Foco com contorno `--accent`.
- Texto de ajuda em 12px `--muted`, logo abaixo do campo.
- Obrigatório: rótulo em 600 e asterisco em `--perigo`.
- Select nativo com seta à direita; checkbox nativo com `accent-color`.

### Painéis (cards)
- Borda de 1px `--linha`, canto de 4px, sem sombra.
- **Faixa de título:** fundo `--panel-head-bg`, borda inferior, texto 14px 600, padding de 8 a 12px. Ações do painel ficam à direita da faixa.
- Variante de destaque (portal): faixa de título com cor de status (`--accent`, `--warning-bg`, etc.) e ícone. Uso restrito a avisos.

### Tabelas
- Ficam dentro de um painel. Acima, uma barra com "Buscar:" e o campo alinhados à direita.
- Cabeçalho com fundo `--panel-head-bg`, texto 13px 600 e indicador de ordenação ⇅ à direita da coluna, quando houver ordenação.
- Células com padding de 6 a 8px por 10px e bordas horizontais finas. Linhas zebradas leves são opcionais.
- **Rodapé da tabela:** fundo `--panel-head-bg`, com "Mostrando 1 a 10 de 42 registros" à esquerda e paginação "Primeiro · Anterior · 1 · Seguinte · Último" à direita.
- Linha destacada por status (atrasado, por exemplo) com fundo `--perigo-fundo` ou `--warning-bg`.
- Estado vazio: "Não foram encontrados resultados." centralizado dentro da tabela.

### Badges
- No SGP: retângulo pequeno (canto de 3px) **com fundo sólido** e texto branco, 11 a 12px.
- **No AgroIntegra:** fundo sólido nas cores de status (`--success`, `--warning`, `--perigo`, `--accent`, `--muted`) com texto branco. Todas essas cores passam do AA contra branco em 12px semibold. O badge atual (fundo claro com borda) continua como variante "suave" para listas longas.
- Contadores em linha ("Ativos: 0 | Inativos: 1 | Suspensos: 0") em texto colorido, sem fundo.

### Abas
- Estilo "nav-tabs": uma faixa `--panel-head-bg` com as abas; a aba ativa tem fundo `--card` e borda que se funde com o conteúdo.
- Sub-abas: mesmo desenho, menores. A aba ativa de segundo nível pode usar `--warning-bg`.

### Modais
- Largura de 480 a 640px, canto de 4px, sombra `--shadow-lift`, fundo de trás `--overlay`.
- Cabeçalho com faixa `--panel-head-bg`, título 14px 600 e "×" à direita.
- Corpo em formulário horizontal.
- Rodapé com borda superior e botões à direita (primário, depois "Cancelar").

### Menus
- Cabeçalho em duas faixas, como na seção 4. Os itens do menu têm 13px, peso 500 e texto `--header-ink`; no hover, fundo branco a 10%; o item ativo tem fundo branco a 16% e sublinhado de 2px.
- Menu suspenso: painel branco com borda e `--shadow-lift`, itens de 32px.
- Menu do usuário na faixa superior: nome em negrito, papel em texto menor, e "Sair" como link discreto.

### Rodapé
- Uma linha centralizada, 12px `--muted`: "AgroIntegra · Integra Tech".

## 5.1 Classes globais (`apps/web/src/app/globals.css`)

Os tokens ficam em `tokens.css` (tamanhos) e `themes.css` (cores por tema).

| Componente | Classes |
| --- | --- |
| Botões | `.btn` + `.btn-primary`, `.btn-secondary`, `.btn-dark`, `.btn-danger`, `.btn-link`; tamanhos `.btn-sm`, `.btn-icon` |
| Campos | `.field` (rótulo em `span`), `.input`, `.req` (obrigatório: negrito e asterisco), `.form-h` (formulário horizontal) |
| Painel | `.card` com `.card-head` como primeiro filho (vira faixa de título); `.card-flush` para tabela de borda a borda |
| Tabela | `.table-wrap` > `.table`; `.table-tools` (Buscar), `.table-foot` + `.pager` (contagem e paginação), `.table-striped`, linhas `.row-alert` / `.row-warning` |
| Badges | `.badge` + `.badge-success`, `-warning`, `-danger`, `-info`, `-neutral` (sólidos); `.badge-soft` para a versão clara |
| Abas | `.tabs` (itens com `aria-selected` ou `aria-current`) + `.tab-panel` |
| Modal | `<dialog class="modal">` com `.modal-head`, `.modal-body`, `.modal-foot` |
| Formulário | `.section-bar` (faixa escura de seção), `.form-bar` (ações no rodapé) |
| Contadores | `.counters` (itens separados por barra vertical) |

## 6. Tema claro e escuro

O SGP mostra **só tema claro**, nas duas áreas (painel e portal). O AgroIntegra mantém os 6 temas de Configurações → Aparência. O estilo SGP é desenhado primeiro para o claro padrão, e os tokens novos ganham valores para os temas escuros.
