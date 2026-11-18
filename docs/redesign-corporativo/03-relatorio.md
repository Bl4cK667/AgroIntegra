# Redesign corporativo: relatório

Branch: `redesign-corporativo` (12 commits sobre `main`). **Sem push e sem merge.**

## Resultado das verificações

| Verificação | Antes (baseline) | Depois |
| --- | --- | --- |
| Build do site (`npm run -w apps/web build`) | passou | passou (exit 0) |
| Testes do site (`node --test apps/web/src/lib/*.test.mjs`) | 10 passaram, 0 falharam | 10 passaram, 0 falharam |
| Testes da API | não rodam sem Docker/PostGIS | API não foi tocada (0 arquivos) |
| Contraste WCAG AA nos 6 temas (13 pares por tema) | — | 0 falhas |
| Foco do teclado (Tab em painel, produtores, solicitações, cotações) | — | contorno visível em todos os elementos |
| Movimento reduzido ligado | — | 0 animações rodando |
| Rolagem lateral no celular (390px, 12 telas) | — | nenhuma |
| Mapa e preços (captura antes x depois, mesmos dados) | — | mesmos pontos, mesmos valores |

## O que mudou

1. **Base visual (tokens):** fonte IBM Plex Sans (400/500/600), uma cor principal verde-escura (#1F5A3D), cantos de 2 a 4px, escala de espaços e de textos, sem sombra decorativa, sem gradiente, sem desfoque.
2. **Temas:** os 6 temas continuam existindo e funcionando (o seletor é uma função). Todos agora são sóbrios e usam a mesma cor principal; só o fundo muda (claro, areia, escuro, escuro esverdeado, azulado, grafite).
3. **Navegação:** barra do topo com faixa verde fina, item ativo sublinhado; menu lateral com barra à esquerda; sem ícones animados nem entrada animada.
4. **Componentes:** botões, campos, tabelas, cartões, avisos, etiquetas e seletores padronizados e mais compactos.
5. **Telas:** painel, solicitações, programas, relatórios, login e cadastro sem animações de entrada, sem "subir" no hover, gráficos em tons de um só verde. Mapa: só o contorno da página mudou; o mapa e suas cores ficaram iguais.
6. **Textos:** sem exclamação, sem tom de propaganda (ex.: "Boa tarde, Maria" virou "Painel de indicadores"; "Cada visita, uma evolução…" virou "Histórico dos atendimentos técnicos realizados em campo.").
7. **Acessibilidade:** bordas de campo mais visíveis nos temas escuros; contorno de foco do teclado corrigido na lista de produtores (já falhava antes do redesign).

Animações mantidas porque explicam uma ação: abrir/fechar notificações e catálogo de widgets, aviso (toast) surgindo, indicador de carregamento do PDF.

## O que ficou de fora de propósito

- **Toda a lógica:** API, banco, autenticação, rotas, chamadas, filtros, cálculos, validações e exportações. Nenhum arquivo fora de `apps/web` mudou.
- **Mapa e estilos de camada** (`packages/map-styles`): cores funcionais mantidas. Atribuição da Esri continua visível.
- **Cores dos gráficos** continuam distinguíveis entre si (tons de verde e cinza).
- **`lib/themes.ts`, `lib/theme.ts`, `lib/navStyle.ts`:** não foram tocados (guardam o tema na conta).

Arquivos `.ts/.tsx` alterados, e por quê:
- 9 telas/componentes: **só textos** (strings) trocados. No painel saiu a função `greeting()`, que só montava "Bom dia/Boa tarde".
- `app/layout.tsx`: troca da fonte.
- `widgets/useCountUp.ts`: o número aparece direto em vez de contar de 0 até o valor (dúvida D7). Mesma assinatura; quem usa não mudou.

## Dúvidas pendentes (precisam de decisão sua)

Detalhes em `01-lista-de-excessos.md`.

- **D1 (resolvida em 18/11: nomes trocados, ids mantidos).** Os nomes e descrições dos temas (ex.: "verde-limão") ficam em `lib/themes.ts` e não batem mais com as cores novas. Sugestão: "Claro (padrão)", "Escuro", "Escuro esverdeado", "Claro areia", "Escuro azulado", "Grafite".
- **D2.** Manter 6 temas ou reduzir para claro + escuro.
- **D3.** Há dois botões de claro/escuro (topo e painel).
- **D4.** Widgets arrastáveis no painel: manter ou fixar o layout.
- **D5.** Escolha topo x menu lateral: manter as duas.
- **D6 (resolvida em 18/11: frase atualizada).** O `CLAUDE.md` diz "Visual: verdes escuros, dourado e marrom terra"; o dourado e o marrom saíram da interface. Atualizar a frase se aprovar.
- **D7.** Contagem animada dos números desligada (feito; fácil de voltar).
- **D8.** Temas, widgets e notificações são do Abner, e cotações, clima e mapa são do João Pedro. Avise os dois antes do merge.
- **D9.** Cores do mapa intocadas.
- **Novo:** não existe link "Pular para o conteúdo" no começo da página. Quem usa só o teclado passa pelos 14 itens do menu em toda tela. Adicionar exige mexer no HTML do layout, por isso só anotei.

## Como revisar

```bash
git switch redesign-corporativo
npm run dev            # abre em http://localhost:3000
git log --oneline main..redesign-corporativo
```

## Como desfazer

- **Tudo:** basta não fazer merge. A `main` está intacta. Para apagar: `git switch main` e `git branch -D redesign-corporativo`.
- **Só uma parte:** cada commit é uma etapa (ex.: `git revert e9316a6` desfaz só o painel). Para trazer de volta a contagem animada, reverta o commit `e9316a6`, ou restaure só o arquivo com `git checkout main -- apps/web/src/components/dashboard/widgets/useCountUp.ts`.
