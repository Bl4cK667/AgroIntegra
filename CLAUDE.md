# AgroIntegra — demo para a secretaria de agricultura

## Contexto

AgroIntegra é um sistema de assistência técnica rural (ATER) para secretarias municipais de agricultura.
Este repositório contém **apenas a versão de demonstração** (MVP), descrita em `docs/plano_mvp_agrointegra.md`.
Leia esse plano antes de qualquer trabalho.

A demo serve para:
- mostrar o fluxo **produtor → propriedade → solicitação → visita → relatório**;
- validar as telas com a agrônoma da secretaria;
- gerar o atestado de capacidade técnica exigido em licitações.

## Decisões aprovadas (seção 8 do plano)

1. Solicitações (quadro) e Programas (somente leitura) **entram** na demo.
2. Mapa e polígono da propriedade ficam para o piloto. A área é **digitada**.
3. Painel web primeiro. App offline fica para o piloto.

## Escopo (seção 4 do plano)

**Dentro:**
- Login por perfil (`coordenação` e `técnico`), com registro de quem fez cada ação (auditoria);
- Painel com números calculados do banco;
- Cadastro de produtores e propriedades (área digitada);
- Solicitações em quadro (Nova, Em análise, Agendada, Concluída), com troca de coluna e prioridade;
- Registro de visita: diagnóstico, plano de ação, prazo de retorno, impacto, fotos, assinatura e localização;
- Programas em modo leitura: vagas, inscritos, beneficiários, entregas, execução física/financeira;
- Relatório simples em PDF (por produtor e período);
- Dados fictícios consistentes.

**Fora — NÃO criar:**
- Mapa, desenho de polígono, cálculo de área pelo mapa, tabelas de geometria;
- App mobile, modo offline, sincronização;
- Integrações com sistemas federais ou estaduais;
- Módulo financeiro, insumos, maquinário;
- Cálculos agronômicos.

## Regras

1. **Escopo:** siga a seção 4. Na dúvida, não construa — pergunte.
2. **Dados 100% fictícios.** Nenhum nome, CPF ou endereço real. CPF sempre **mascarado na tela** (ex.: `***.456.789-**`). A API nunca devolve o CPF completo nas listagens.
3. **Nenhum número fixo no painel.** Todo número exibido é calculado a partir do banco. Deve existir teste automático que confere os números do painel com a soma do banco.
4. **Idioma:** textos da interface em português do Brasil. Nomes de variáveis, funções, tabelas e arquivos em inglês.
5. **Visual:** verdes escuros, dourado e marrom terra, como no protótipo.
6. **Stack:** Next.js + TypeScript (painel web), NestJS + Prisma + PostgreSQL (API), Docker Compose para o banco. Para trocar qualquer item: explicar em poucas linhas e esperar a resposta do usuário.
7. **LGPD na demo:** guardar a data do consentimento do produtor, mascarar CPF, registrar auditoria (quem, o quê, quando).

## Como trabalhar

- Uma fase por vez, na ordem da seção 5 do plano.
- Antes de cada fase, explicar o plano em poucos itens simples.
- Testes antes ou junto do código. Rodar os testes; a fase só está pronta se eles passarem.
- Ao final de cada fase: commit + resumo curto do que ficou pronto e de como ver funcionando.
- **Parar e esperar confirmação** antes de começar a fase seguinte.

## Fases (seção 5 do plano)

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 0 | Plano aprovado e CLAUDE.md | CLAUDE.md na raiz |
| 1 | Repositório, banco, login por perfil, painel vazio | Login funciona e o banco sobe com um comando |
| 2 | Produtores e propriedades | Testes do cadastro passam e a busca encontra o produtor |
| 3 | Visitas | Visita salva aparece na página do produtor |
| 4 | Solicitações e painel | Números batem com a soma do banco (teste automático) |
| 5 | Programas e relatório PDF | PDF abre e valores batem com a tela |
| 6 | Dados e roteiro da demo | Roteiro de 15 min ensaiado, com gravação de backup |

## Estado atual

- Fase 0 concluída.
- Fase 1 concluída: login por perfil (JWT), auditoria de login, painel vazio. Rodar: ver `README.md`.
- Fase 2 concluída: produtores e propriedades (CPF validado e mascarado, consentimento com data, busca sem acento por palavras, auditoria). Visual refeito sem cara de template: fonte Archivo, tabelas, curvas de nível no login. Logo oficial em `apps/web/public/brand` (recortada de uma captura com fundo branco; símbolo num quadrado branco no menu).
- Fase 3 concluída: visitas (diagnóstico, plano de ação, retorno, impacto, até 3 fotos reduzidas no aparelho, assinatura desenhada, localização do aparelho sem mapa). Fotos e assinatura ficam no banco e só saem com login; o tipo é conferido pelo conteúdo do arquivo. Visita salva não é editada. Aparece na página do produtor e em Visitas.
- Versões: NestJS 11 (o 12 é só ESM e quebra o Jest), Prisma 6, Next.js 16.
- Sem Docker nesta máquina: `npm run db:up` usa `embedded-postgres` + `pg_ctl` (porta 5433, UTF-8).
- Iniciar o Next com `node node_modules/next/dist/bin/next start`, não com `npx`: o `npx` deixa um processo órfão segurando a porta.
- Testes não usam `prisma migrate reset` (o Prisma bloqueia quando chamado por IA); usam `migrate deploy` e limpam as tabelas.
