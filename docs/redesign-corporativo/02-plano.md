# Redesign corporativo: plano de execução

> Execução: feita por mim nesta mesma sessão, uma fase por vez, com commit pequeno ao fim de cada uma (você pediu para seguir direto após este plano).

**Objetivo:** deixar o painel web do AgroIntegra com aparência institucional e discreta, sem mudar nenhuma funcionalidade.

**Abordagem:** quase tudo é CSS. Primeiro os tokens (cores, fonte, espaçamento, raios, sombras) num só lugar; depois os temas, a moldura, os componentes e as telas passam a usar esses tokens. TSX só é tocado para trocar texto visível ou para a fonte (`app/layout.tsx`).

**Tecnologia:** Next.js 16 (App Router), CSS Modules, `next/font/google`.

**Base:** `docs/redesign-corporativo/01-lista-de-excessos.md` (os códigos M1, G1, T1… vêm de lá).

## Regras que valem para todas as fases

- Mudar só o visual. Nada de rota, chamada de API, estado, validação, filtro, exportação, cálculo, mapa ou preço.
- Arquivos que **não** podem aparecer no diff: `apps/api/**`, `packages/**`, `apps/web/src/lib/**`, `components/geo/*.tsx`, `components/dashboard/*.ts(x)` (exceto textos em `widgets/Widgets.tsx` e o `useCountUp.ts`, ver D7), `*.test.mjs`, `package.json`, `package-lock.json`.
- TSX pode mudar só em: textos visíveis (fase 6) e `app/layout.tsx` (fonte).
- Os identificadores dos 6 temas continuam iguais (`pure-light`, `midnight-black`, `forest-dark`, `sand-earth`, `ocean-blue`, `graphite`). O seletor de temas continua funcionando.
- Cores do mapa (`packages/map-styles`) e a tinta da assinatura não mudam.
- Textos em português formal, sem emoji e sem exclamação.
- Contraste mínimo WCAG AA (4,5:1 texto normal, 3:1 texto grande e bordas de controles). Foco visível no teclado.
- Respeitar `prefers-reduced-motion`.

## Tokens (decididos aqui, usados em todas as fases)

| Token | Claro (`pure-light`) | Escuro (`midnight-black`) |
| --- | --- | --- |
| `--fundo` | `#F3F4F3` | `#15191A` |
| `--superficie` / `--card` | `#FFFFFF` | `#1D2224` |
| `--card-2` (cabeçalho de tabela, hover) | `#F6F7F6` | `#252B2E` |
| `--tinta` / `--ink` | `#1B2420` | `#E7EBE9` |
| `--sutil` / `--muted` | `#55605A` | `#A3ACA8` |
| `--linha` / `--card-border` | `#D5D9D6` | `#343C40` |
| `--linha-forte` (borda de campo) | `#8E9792` | `#5E686D` |
| `--accent` / `--chart-1` (cor principal) | `#1F5A3D` | `#7FBF98` |
| `--on-accent` | `#FFFFFF` | `#0F2418` |
| `--success` / `--warning` / `--perigo` | `#1E6B3A` / `#8A5A00` / `#A12A1B` | `#8FD1A6` / `#E3BE6E` / `#F2A093` |
| `--chart-2`, `--chart-3`, `--chart-4` | `#6B8F7A`, `#A8C2B2`, `#5A6570` | `#5E8F73`, `#3E6150`, `#8E99A3` |

Os outros 4 temas seguem a mesma regra: mesma cor principal e mesmos status; muda só o tom do fundo (esverdeado, areia neutra, azulado, grafite).

| Token | Valor |
| --- | --- |
| Fonte | IBM Plex Sans, pesos 400, 500, 600 |
| Tamanhos | 12, 13, 14, 15 (corpo), 17 (seção), 22 (título de página) px |
| Espaçamento | 4, 8, 12, 16, 24, 32 px (`--space-1` a `--space-6`) |
| Raios | `--radius-sm: 2px` (botão, etiqueta), `--radius-md: 3px` (campo), `--radius-lg: 4px` (card, janela). `--radius-pill` passa a valer 2px. Avatar e pontos continuam redondos. |
| Sombras | `--shadow-card: none`; `--shadow-lift: 0 4px 12px rgba(0,0,0,.12)` (só menus e janelas flutuantes) |
| Movimento | `--dur-fast: 120ms`, sem mola (`--ease-spring` = `--ease-out`). Animações de entrada desligadas. |
| Foco | contorno de 2px na cor principal, afastado 2px |

## Verificação padrão (rodar ao fim de toda fase)

1. `npm run -w apps/web build` → termina sem erro, 24 rotas.
2. `node --test apps/web/src/lib/*.test.mjs` → 10 de 10.
3. `git diff --stat HEAD~1` e o guarda de arquivos:
   `git diff --name-only main -- . | grep -vE '\.css$|^docs/|apps/web/src/app/layout\.tsx$'`
   → cada arquivo listado tem de ser um TSX com troca **só de texto** (conferir com `git diff`).
4. Capturas com a API simulada (`shots.js` na pasta temporária) em 1440 px e 390 px; comparar com as de antes.
5. A API não é tocada, então os testes da API mantêm a linha de base (179 passam; os e2e precisam de Docker).

---

### Fase 1: tokens num só lugar

**Arquivos:** `app/globals.css` (bloco `:root`), `app/themes.css` (bloco `pure-light`), `app/layout.tsx` (fonte).

- [ ] Trocar Archivo por IBM Plex Sans em `app/layout.tsx` (mesma variável CSS `--font-archivo` renomeada para `--font-sans`; `globals.css` passa a usar `--font-sans`).
- [ ] Definir no `:root` os tokens de espaço, raio, sombra, movimento e tipografia da tabela acima.
- [ ] Atualizar o tema `pure-light` com as cores da tabela.
- [ ] Remover `font-stretch: 88%` dos títulos (F1) e limitar pesos a 400/500/600 nos estilos globais (F2).
- [ ] Verificação padrão. Commit: `estilo: tokens de cor, fonte, espaço, raio e sombra`.

### Fase 2: temas sóbrios (mecanismo intacto)

**Arquivos:** `app/themes.css`, `components/account/themePicker.module.css`, `components/account/navStylePicker.module.css`.

- [ ] Reescrever as 5 paletas restantes conforme a regra dos tokens (T1, T2, T3). Os blocos `[data-palette=…]` e os nomes das variáveis continuam iguais.
- [ ] Simplificar a transição de troca de tema (M14) para só cor de fundo e texto, 150 ms.
- [ ] Seletores de tema e de navegação: miniaturas menores, cartões com borda de 1px e raio de 4px, selecionado marcado por borda na cor principal (T5, T6).
- [ ] Conferir: em Configurações, trocar entre os 6 temas com a API simulada e ver que `data-palette` muda e a tela continua legível.
- [ ] Verificação padrão. Commit: `estilo: temas sóbrios com uma cor principal`.

### Fase 3: moldura (barra do topo, menu lateral, carregamento)

**Arquivos:** `components/nav/topbar.module.css`, `components/nav/nav.module.css`, `app/(app)/shell.module.css`, `app/(app)/template.module.css`, `components/notifications/notifications.module.css`.

- [ ] Barra do topo: fundo branco, faixa de 3px na cor principal no topo, item ativo com texto na cor principal e linha inferior de 2px; sem pílula com mola (M5), sem giro do logo (M4), sem desfoque (G2), sem sombra.
- [ ] Menu lateral e barra do celular: fundo sólido, sem vidro fosco (G1), sem sombra larga (G9), sem ícones animados (M3), avatar sem gradiente (G3).
- [ ] Página sem deslize de entrada (M1); carregamento sem logo "respirando" (M7).
- [ ] Notificações: sem balanço, estouro, pulso ou flutuação (M6); painel lateral com borda e sem desfoque.
- [ ] Conferir: menu de perfil, busca (Ctrl+K), notificações e troca topbar/lateral abrem e fecham igual.
- [ ] Verificação padrão. Commit: `estilo: barra do topo, menu lateral e notificações sóbrios`.

### Fase 4: componentes

**Arquivos:** `app/globals.css` (botões, campos, alertas, tabelas, cards, badges, segmentado, vazio, skeleton), `components/form.module.css`, `components/property/field-ui.module.css`, `components/figures.module.css`, `components/Meter.module.css`, `components/MonthlyBars.module.css`, `components/feedback/Toast.module.css`, `components/visit/visit.module.css`, `components/property/property.module.css`, `components/geo/geo.module.css`, `components/clima/clima.module.css`, `components/cotacoes/cotacoes.module.css`, `components/account/avatar.module.css`.

- [ ] Botões: retângulo de 2px, altura 36px (44px no celular), sem subir no hover, sem brilho (M13, G8). Primário: fundo na cor principal; secundário: branco com borda.
- [ ] Campos: borda `--linha-forte`, raio 3px, foco com contorno na cor principal.
- [ ] Tabelas: cabeçalho em caixa normal, peso 600, fundo `--card-2` (F4); linhas com 10px de altura interna; borda externa de 1px e raio 4px; sem sombra.
- [ ] Cards: raio 4px, borda 1px, sem sombra e sem mudança de borda no hover.
- [ ] Etiquetas (badge) e segmentado: raio 2px (R3).
- [ ] `.eyebrow` em caixa normal, 13px, cor `--muted` (F3); ícones de título de página e de seção escondidos (E1, E3).
- [ ] `FieldStats` (três cards com ícone) vira uma faixa única dividida por linhas, sem ícone (E2).
- [ ] Vazio mais baixo e sem tracejado grande (E9); skeleton sem brilho deslizante (cor fixa).
- [ ] Barras (Meter) sem gradiente e sem crescer (G5, M10). Toast com raio 4px.
- [ ] Desligar todas as animações de entrada (`.enter`, `.stagger-in`) (M2).
- [ ] Conferir: formulário de novo produtor mostra erro e foco iguais; tabela de produtores continua clicável.
- [ ] Verificação padrão. Commit: `estilo: botões, campos, tabelas, cards e avisos padronizados`.

### Fase 5: telas, uma por vez

Cada tela é um commit `estilo: tela <nome>`. Só CSS do módulo da tela.

- [ ] Painel: `components/dashboard/dashboard.module.css`, `widgets/widgets.module.css`. Sem moldura extra (E6), botões iguais a `.btn` (I1), sem fundo pontilhado nem desfoque na edição (G6, G2), gráficos sem animação (M8), ícones de título escondidos (E4). Desligar a contagem animada em `useCountUp.ts` (M9, D7): devolve `value` direto, mesma assinatura `useCountUp(value: number): number`.
- [ ] Solicitações: `solicitacoes/quadro.module.css` — cartões sem animação (M11), raios e sombras dos tokens. Conferir que arrastar entre colunas e abrir detalhes continua igual.
- [ ] Programas e programa: `programas.module.css`, `programas/[id]/programa.module.css` — barras sem crescer.
- [ ] Relatórios: `relatorios.module.css` — sem gradiente (G5). Conferir que a prévia e o botão de PDF continuam.
- [ ] Produtor, visita: `produtores/[id]/produtor.module.css`, `visitas/[id]/visita.module.css`.
- [ ] Configurações e usuários: `configuracoes.module.css`, `usuarios.module.css`.
- [ ] Mapa e mapa da propriedade: só `geo.module.css` (painéis ao redor do mapa). As cores das camadas não mudam (D9). Conferir que o mapa carrega, os filtros e o painel de importação aparecem.
- [ ] Cotações: só `cotacoes.module.css`. Conferir que os valores e variações aparecem iguais.
- [ ] Login e cadastro: `login.module.css`, `cadastro.module.css` — fundo sólido (G4), curvas de nível mais discretas, sem zoom (M12, E5).
- [ ] Verificação padrão após cada tela.

### Fase 6: textos da interface

**Arquivos:** só os TSX listados em 2.7 da lista de excessos (X1 a X12).

- [ ] Trocar cada texto pelo proposto. Não mudar mensagens de erro de validação nem rótulos de campo.
- [ ] `grep -rn "!'" apps/web/src --include=*.tsx` e busca por emoji → nada na interface.
- [ ] Verificação padrão; no guarda de arquivos, `git diff` desses TSX mostra só troca de string. Commit: `texto: linguagem formal na interface`.

### Fase 7: acessibilidade e responsividade

**Arquivos:** os CSS já tocados, conforme o que aparecer.

- [ ] Medir contraste dos pares texto/fundo de cada tema (script na pasta temporária) → todos ≥ 4,5:1; bordas de campo ≥ 3:1.
- [ ] Navegar por Tab em login, topbar, produtores e configurações → foco sempre visível.
- [ ] Capturas a 390 px: sem rolagem horizontal da página; botões com 44px.
- [ ] `prefers-reduced-motion`: nenhuma animação.
- [ ] Verificação padrão. Commit: `acessibilidade: contraste, foco e celular`.

### Fechamento

- [ ] `docs/redesign-corporativo/03-relatorio.md`: o que mudou, o que não foi mexido de propósito, dúvidas pendentes, como reverter.
- [ ] Commit `docs: relatório do redesign`. Sem push e sem merge.

## Pontos de atenção na revisão

1. Tela do quadro de solicitações no celular: arrastar e soltar depende de tamanhos; conferir que nada ficou pequeno demais para tocar.
2. Mapa: o CSS em volta do MapLibre não pode cobrir a atribuição da Esri (exigência de licença).
3. Temas escuros: badges e alertas precisam continuar legíveis em todos os 4 escuros.
4. Topbar entre 761 e 1279 px mostra só ícones com dica; conferir que a dica continua aparecendo.
5. Impressão/prévia do relatório: o relatório usa as cores da tela; conferir que continua legível.
