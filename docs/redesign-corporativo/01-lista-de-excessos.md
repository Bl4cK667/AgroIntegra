# Redesign corporativo: lista de excessos

Branch: `redesign-corporativo` (criada de `main` em `e17a976`, 18/11/2026).
Escopo: só o painel web (`apps/web`). A API, o banco e o pacote `map-styles` não entram.

Legenda:

- **[VISUAL: pode mudar]**: só CSS, fonte ou texto da interface.
- **[TOCA LÓGICA: só anotar]**: mexer exigiria alterar comportamento, dados ou código de outra pessoa. Fica para você decidir.

Os caminhos são relativos a `apps/web/src`.

---

## 1. Mapa rápido do projeto

| O quê | Onde | Tipo |
| --- | --- | --- |
| Tokens de cor dos 6 temas | `app/themes.css` | VISUAL |
| Tokens gerais, botões, campos, tabelas, cards, badges | `app/globals.css` | VISUAL |
| Fonte (Archivo) | `app/layout.tsx` linhas 2-11 | VISUAL |
| Estilos de cada tela e componente | `**/*.module.css` (42 arquivos) | VISUAL |
| Lista de temas, nomes e tema padrão | `lib/themes.ts` | LÓGICA (dados do seletor) |
| Troca e gravação do tema na conta | `lib/theme.ts` | LÓGICA |
| Topbar ou menu lateral, gravado no perfil | `lib/navStyle.ts` | LÓGICA |
| Chamadas da API, sessão, formatação, geo, cotações, clima | `lib/*.ts` | LÓGICA |
| Painel com widgets arrastáveis (layout salvo no navegador) | `components/dashboard/*.tsx`, `useDashboardLayout.ts` | LÓGICA |
| Mapa (MapLibre, terra-draw, importação) | `components/geo/*.tsx`, `mapConfig.ts` | LÓGICA |
| Cores das feições do mapa | `packages/map-styles` | LÓGICA (João Pedro) |
| Marca (logo PNG) | `public/brand`, `components/Brand.tsx` | VISUAL |

**Sistema de temas do Abner.** Tem 6 paletas (`pure-light`, `midnight-black`, `forest-dark`, `sand-earth`, `ocean-blue`, `graphite`). A escolha fica salva na conta do usuário pela API (`PATCH /account`, campo `theme`) e no navegador. Há um atalho claro/escuro na barra do topo e outro no painel. O mecanismo é funcionalidade: **não vou remover nada dele**. Vou só redesenhar as cores de cada paleta para ficarem sóbrias, mantendo os mesmos identificadores.

**Linha de base (antes de mexer):**

- `npm run -w apps/api build`: passa.
- `npm run -w apps/web build`: passa (24 rotas).
- Testes da web (`node --test src/lib/*.test.mjs`): 10 de 10 passam.
- Testes da API: 16 suítes passam (179 testes); 16 suítes e2e falham **porque não há Docker nesta máquina** (precisam de PostgreSQL + PostGIS). Isso não tem relação com o redesign.

---

## 2. Excessos encontrados

### 2.1 Movimento decorativo

| # | Arquivo e linha | O que é | Por que atrapalha | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- | --- |
| M1 | `app/(app)/template.module.css:1-14` | Toda página entra deslizando com desfoque (`blur(2px)`) | Chama atenção sem informar nada; parece site de marketing | Página aparece direto | VISUAL |
| M2 | `app/globals.css:520-524` (`.enter`, `.stagger-in`) e usos em quase todas as telas | Cada bloco entra em cascata (fade-up com atraso) | "Efeito de entrada em tudo" | Sem animação de entrada | VISUAL |
| M3 | `components/nav/nav.module.css:331-401, 609-670` | Ícones do menu pulam, quicam, "escrevem" e giram no hover | Puramente decorativo | Ícones parados; só muda a cor | VISUAL |
| M4 | `components/nav/topbar.module.css:15-20` e `nav.module.css:54-56` | Logo gira e cresce no hover; textos do menu deslizam | Decorativo | Sem movimento | VISUAL |
| M5 | `topbar.module.css:22` e `nav.module.css:116-130` | "Pílula" do item ativo desliza com efeito de mola | Efeito chamativo | Item ativo marcado por cor e linha, sem mola | VISUAL |
| M6 | `components/notifications/notifications.module.css:35, 39, 72, 313, 357` | Sino balança, contador "estoura", ponto pulsa sem parar, ícone vazio flutua | Movimento contínuo distrai | Sino parado; contador estático | VISUAL |
| M7 | `app/(app)/shell.module.css:14, 74-78` | Logo "respirando" na tela de carregamento | Decorativo | Texto "Carregando…" discreto | VISUAL |
| M8 | `components/dashboard/widgets/widgets.module.css:15, 29, 32, 45, 66` | Gráficos crescem, linhas se desenham, anel gira ao abrir | Decorativo, atrasa leitura | Gráficos já desenhados | VISUAL |
| M9 | `components/dashboard/widgets/useCountUp.ts` | Números do painel contam de 0 até o valor | Por quase 1 s o número na tela está errado | Mostrar o valor final direto | VISUAL (é só apresentação, mas é arquivo .ts: ver dúvida D7) |
| M10 | `components/Meter.module.css:51`, `programas.module.css:119` | Barras de progresso crescem ao abrir | Decorativo | Barra estática | VISUAL |
| M11 | `solicitacoes/quadro.module.css:106, 189` | Cartões do quadro entram animados | Decorativo | Sem animação | VISUAL |
| M12 | `login.module.css:26`, `cadastro.module.css:22` | Curvas de nível do login entram com zoom | Decorativo | Estático | VISUAL |
| M13 | `.btn` em `globals.css:126-153` | Botões sobem 1 px e mudam brilho no hover | Efeito "app de consumo" | Só muda a cor de fundo | VISUAL |
| M14 | `lib/theme.ts:9, 54-60` + `themes.css:338-347` | Transição animada de 320 ms ao trocar tema | Decorativo | Pode ficar (só acontece quando o usuário troca). Simplifico o CSS | VISUAL (CSS) |

### 2.2 Gradientes, desfoque, brilho e sombras

| # | Arquivo e linha | O que é | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- |
| G1 | `nav.module.css:436-437, 471-472, 517` | Barras do celular com vidro fosco (`backdrop-filter: blur`) | Fundo sólido com borda fina | VISUAL |
| G2 | `topbar.module.css:43`, `dashboard.module.css:391`, `notifications.module.css:111` | Fundo desfocado atrás de janelas | Fundo escurecido sólido | VISUAL |
| G3 | `nav.module.css:202` | Avatar com gradiente dourado | Cor sólida neutra | VISUAL |
| G4 | `login.module.css:11, 18`, `cadastro.module.css:11` | Fundo com gradiente radial | Cor sólida | VISUAL |
| G5 | `Meter.module.css:49, 55`, `relatorios.module.css:153` | Barras com gradiente | Cor sólida | VISUAL |
| G6 | `dashboard.module.css:138` | Fundo pontilhado ao editar o painel | Contorno tracejado simples | VISUAL |
| G7 | `themes.css` (`--shadow-card`, `--shadow-lift`, `--nav-active-shadow`) | Sombras de 20-44 px em cards e menus | Sem sombra em cards; sombra curta só em menus flutuantes | VISUAL |
| G8 | `globals.css:141-146` | Botão principal com "brilho" colorido embaixo | Sem sombra | VISUAL |
| G9 | `nav.module.css:14` | Menu lateral com sombra larga | Só a borda | VISUAL |

### 2.3 Cantos arredondados

| # | Arquivo e linha | O que é | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- |
| R1 | `globals.css:4-6` | Raios de 20 px (cards), 12 px (campos) e pílula (botões) | 4 px (cards e campos), 2-3 px (botões e etiquetas) | VISUAL |
| R2 | 42 arquivos `.module.css` | 30 valores diferentes de raio escritos à mão (7, 9, 10, 11, 14, 15, 18, 22, 26, 30 px…) | Todos apontando para os tokens | VISUAL |
| R3 | `.badge`, `.segmented`, botões | Etiquetas e botões em formato de pílula | Retângulo com canto de 2 px | VISUAL |

### 2.4 Temas e cores

| # | Arquivo e linha | O que é | Por que atrapalha | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- | --- |
| T1 | `themes.css:63-111` (Midnight Black) | Preto puro com verde-limão neon `#c4f263` | "Modo escuro estiloso" | Escuro sóbrio: cinza-azulado com verde institucional claro | VISUAL |
| T2 | `themes.css:213-262` (Ocean Blue) e 162-211 (Sand & Earth) | Paletas temáticas saturadas (azul-céu, terracota) | Cada tema muda a identidade do sistema | Mesma família sóbria, só variando o fundo | VISUAL |
| T3 | `themes.css` (todos) | Cada tema tem seu próprio destaque (limão, azul, terracota, lilás) | Muitas cores, identidade instável | Um só verde institucional; claro/escuro só trocam fundo e texto | VISUAL |
| T4 | `lib/themes.ts:9-16` | Nomes em inglês ("Midnight Black", "Pure Light") e descrições informais ("verde-limão") | Linguagem de app de consumo | Nomes descritivos em português | **TOCA LÓGICA** (ver D1) |
| T5 | `components/account/ThemePicker.tsx` + `themePicker.module.css` | Seletor com 6 miniaturas grandes coloridas | Chamativo | Lista compacta de opções com miniatura pequena | VISUAL (só CSS) |
| T6 | `NavStylePicker` + `navStylePicker.module.css` | Mesmo padrão de miniaturas grandes | Chamativo | Igual ao T5 | VISUAL (só CSS) |
| T7 | `widgets/Widgets.tsx:78`, `RequestsStatus` | Verde, dourado e verde-claro misturados no gráfico de demandas e no ranking | Paleta com cores demais | Tons de um só verde + cinza para status | VISUAL (pelos tokens `--chart-*`) |
| T8 | `globals.css:66-69` | Contorno de foco dourado | Pouco contraste em fundo claro | Contorno azul-esverdeado escuro de 2 px, sempre visível | VISUAL |

### 2.5 Tipografia

| # | Arquivo e linha | O que é | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- |
| F1 | `app/layout.tsx:2-11`, `globals.css:37` | Archivo comprimido a 88% nos títulos | IBM Plex Sans (desenhada para sistemas e documentos), largura normal | VISUAL |
| F2 | 40+ arquivos | Pesos soltos (480, 560, 650, 720, 800) | Só 400, 500 e 600 | VISUAL |
| F3 | `globals.css:527-535` (`.eyebrow`) e `FieldHeading` em 16 telas | Rótulo em CAIXA ALTA espaçada acima de todo título ("RELACIONAMENTO NO CAMPO") | Enfeite típico de template | Vira uma linha discreta de contexto, em caixa normal | VISUAL |
| F4 | `globals.css:270-275` | Cabeçalhos de tabela em caixa alta espaçada | Menos legível | Caixa normal, peso 600, fundo cinza claro | VISUAL |
| F5 | `topbar.module.css:13-14` | "Agro**Integra**" com pesos diferentes | Destaque decorativo | Peso único | VISUAL |

### 2.6 Elementos de enfeite e repetição

| # | Arquivo e linha | O que é | O que entra no lugar | Tipo |
| --- | --- | --- | --- | --- |
| E1 | `FieldUI.tsx:26` (`FieldHeading`) | Ícone dentro de caixa ao lado de todo título de página | Esconder o ícone (CSS) | VISUAL |
| E2 | `FieldUI.tsx:31` (`FieldStats`) em Produtores, Propriedades, Solicitações, Visitas | Três cards iguais com ícone, número grande e frase | Uma faixa única de indicadores, compacta, sem ícones | VISUAL |
| E3 | `globals.css:561-571` (`.card-icon`) em Configurações e seções | Ícone em caixinha antes de cada título de seção | Esconder | VISUAL |
| E4 | `dashboard/WidgetFrame.tsx` | Botão "↗" em todo widget e ícone em caixa no título | Ícone de título escondido; "↗" fica (é link para a tela) com visual mais discreto | VISUAL |
| E5 | `login/page.tsx:43-50` | Ilustração de curvas de nível ocupando metade da tela | Painel institucional sólido com nome da secretaria; curvas bem mais discretas | VISUAL |
| E6 | `dashboard.module.css` (`.page`) | Painel dentro de uma "moldura" arredondada extra | Sem moldura | VISUAL |
| E7 | `Topbar.tsx:289` | Seta "⌄" como caractere | Fica (é indicador do menu), menor | VISUAL |
| E8 | `Widgets.tsx:14` | Ícone grande + "Ainda estamos no começo" nos widgets vazios | Texto objetivo (ver Textos) | VISUAL (texto) |
| E9 | `globals.css:378-385` (`.empty`) | Caixa tracejada grande com muito espaço | Caixa simples, mais baixa | VISUAL |

### 2.7 Textos informais

Os textos já estão, em geral, em português formal e claro. Não encontrei emojis na interface. Pontos a ajustar:

| # | Arquivo e linha | Hoje | Proposta | Tipo |
| --- | --- | --- | --- | --- |
| X1 | `cadastro/page.tsx:339` | "Cadastro concluído!" | "Cadastro concluído." | VISUAL |
| X2 | `painel/page.tsx:63-64` | "Boa tarde, Maria" | "Painel" (a saudação some; o subtítulo com o mês fica) | VISUAL (texto) |
| X3 | `painel/page.tsx:67` | "Preparando seus indicadores…" | "Carregando indicadores…" | VISUAL |
| X4 | `widgets/Widgets.tsx:14` | "Ainda estamos no começo" | "Sem dados no período" | VISUAL |
| X5 | `widgets/Widgets.tsx:50` | "Passe sobre o gráfico ou selecione um mês para explorar." | "Selecione um mês para ver o total." | VISUAL |
| X6 | `visitas/page.tsx:26` | "Cada visita, uma evolução. Consulte o histórico…" | "Histórico dos atendimentos técnicos em campo." | VISUAL |
| X7 | `produtores/page.tsx:31` | eyebrow "Relacionamento no campo"; "Conheça quem produz. Acompanhe…" | "Cadastro" ; "Cadastro de produtores rurais, propriedades e atendimentos." | VISUAL |
| X8 | `propriedades/page.tsx:29` | "Território e produção"; "Uma visão do território…" | "Cadastro"; "Propriedades rurais cadastradas, com área e atividade principal." | VISUAL |
| X9 | `programas/page.tsx:31` | "Fomento e políticas públicas" | "Programas" | VISUAL |
| X10 | `solicitacoes/page.tsx` | "Clique num cartão para ver detalhes e agir." | "Selecione um cartão para ver os detalhes." | VISUAL |
| X11 | `configuracoes/page.tsx:416` | "Escolha uma senha fácil de lembrar e difícil de adivinhar." | "Use pelo menos 6 caracteres." | VISUAL |
| X12 | `notifications` (estado vazio) | a conferir na execução | texto objetivo | VISUAL |

### 2.8 Inconsistências

| # | O que é | O que entra no lugar | Tipo |
| --- | --- | --- | --- |
| I1 | Painel usa botões próprios (`.toolBtn`, `.toolBtnPrimary`, `.themeToggle`) diferentes de `.btn` | Mesmo visual de `.btn-secondary`/`.btn-primary` | VISUAL |
| I2 | Títulos de página com tamanhos diferentes (painel 1.5rem, demais 1.75rem, login outro) | Uma escala: 1.5rem página, 1.0625rem seção | VISUAL |
| I3 | Espaçamentos escritos à mão (13, 15, 17, 18, 22 px) | Escala de 4 px (4, 8, 12, 16, 24, 32) | VISUAL |
| I4 | Cores fixas no código: `#18211c` no mapa e na assinatura (`GeometryEditor.tsx:140`, `TerritoryMapView.tsx:82`, `SignaturePad.tsx:29`) | Mantidas: são cores do desenho do mapa e da tinta da assinatura | TOCA LÓGICA (não mexer) |
| I5 | Botão de alternar tema aparece duas vezes (topbar e painel) | Ver D3 | TOCA LÓGICA |
| I6 | Cards com borda `rgba(...,0.08)` quase invisível em uns e `--linha` em outros | Uma cor de borda | VISUAL |

---

## 3. Dúvidas (você decide)

| # | Dúvida | O que fiz por enquanto |
| --- | --- | --- |
| D1 | **Nomes dos temas** ("Midnight Black", "Ocean Blue"…) ficam em `lib/themes.ts`, junto com o tema padrão e o script que aplica o tema. Trocar só os nomes é texto, mas o arquivo é de lógica. | Não mexi. Sugestão: "Claro (padrão)", "Escuro", "Escuro esverdeado", "Claro areia", "Escuro azulado", "Grafite". |
| D2 | **Reduzir para um tema só.** Hoje são 6 temas salvos na conta de cada usuário. Remover opções muda o que o usuário pode escolher. | Mantive os 6 identificadores e o mecanismo; todos ficaram sóbrios e com a mesma cor principal. Se quiser só "Claro" e "Escuro", isso mexe em `lib/themes.ts` e na validação da API. |
| D3 | **Botão claro/escuro duplicado** no painel e na barra do topo. Remover é tirar um controle. | Mantive os dois, com visual discreto. |
| D4 | **Painel com widgets arrastáveis** ("Personalizar"). Sistema de prefeitura costuma ter painel fixo. | Mantive. Só simplifiquei o visual do modo de edição. |
| D5 | **Escolha Topbar x Menu lateral.** É preferência salva no perfil. | Mantive as duas opções, com o mesmo visual sóbrio. |
| D6 | **Arquivo `CLAUDE.md`** diz "Visual: verdes escuros, dourado e marrom terra". A nova direção usa um verde institucional e tira o dourado da interface (fica só no logo). | Não alterei o `CLAUDE.md`. Se aprovar, atualizo a linha. |
| D7 | **Contagem animada dos números do painel** (`useCountUp.ts`). Desligar exige editar um arquivo `.ts` de 25 linhas, mas ele só desenha o número; não calcula nada. | Vou desligar a animação (o hook passa a devolver o valor direto). Se preferir, reverto esse commit sozinho. |
| D8 | **Dono dos arquivos.** Temas, painel com widgets e notificações são do Abner; mapa e cotações do João Pedro. O `CLAUDE.md` pede para avisar antes de mexer em módulo de outra pessoa. | Mexi só em CSS desses módulos. Vale avisar os dois antes do merge. |
| D9 | **Cores das feições no mapa** (`packages/map-styles`) e paleta copiada no KML da API. | Não mexi: são funcionais e compartilhadas com o app. |
