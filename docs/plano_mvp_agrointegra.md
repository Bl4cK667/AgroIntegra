# Plano do MVP AgroIntegra: demonstração para a secretaria

**Status:** rascunho para aprovação. Nenhum código foi criado ainda.
**Base:** planejamento técnico (docx, 10/11/2026), guia de legalização e vendas (PDF, 26/10/2026) e vídeo do protótipo (55 s, 1 quadro a cada 5 s).

---

## 1. Objetivo

Montar uma versão de demonstração que a secretaria de agricultura consiga usar e entender. Ela serve para:

- mostrar o fluxo produtor → propriedade → solicitação → visita → relatório;
- validar as telas com a agrônoma da secretaria;
- gerar o atestado de capacidade técnica exigido nas licitações (o PDF diz que esse é o maior gargalo).

---

## 2. O que o protótipo mostra (vídeo)

| Tela | O que aparece |
| --- | --- |
| Painel | Cards (demandas abertas, concluídas no mês, visitas no ano, produtores atendidos), gráfico mensal e atendimentos por comunidade |
| Produtores | Lista e formulário de novo produtor com CPF e campo de consentimento LGPD |
| Propriedades | Aparece no menu, mas não aparece no vídeo |
| Solicitações | Quadro com colunas Nova, Em análise, Agendada e Concluída, e prioridade (alta/média) |
| Visitas | Diagnóstico, plano de ação, prazo de retorno, impacto, 3 fotos, assinatura do produtor e localização registrada |
| Programas | Vagas, inscritos, beneficiários aprovados, entregas e execução física/financeira |
| Relatórios | Aparece no menu, mas não aparece no vídeo |

**Observação:** o vídeo foi analisado por amostragem (1 quadro a cada 5 segundos). Pequenos trechos entre os quadros podem ter ficado de fora.

---

## 3. Divergências entre o vídeo e o planejamento técnico

Estas são as decisões que precisam ser confirmadas.

1. **Solicitações e Programas** aparecem no vídeo, mas não estão no planejamento técnico. O guia do PDF cita programas de fomento como diferencial, então faz sentido incluí-los.
   - *Recomendação:* incluir **Solicitações** (quadro simples) e **Programas** (somente leitura, com números) na demo.
2. **Mapa e polígono da propriedade** são o núcleo do planejamento técnico, mas não aparecem no vídeo.
   - *Recomendação:* deixar o mapa de fora da demo. Na demo, a área da propriedade é digitada. O desenho no mapa fica para o piloto.
3. **App offline primeiro ou painel web primeiro?** O planejamento coloca o app offline na etapa 4. O vídeo mostra o painel web.
   - *Recomendação:* painel web primeiro. O app offline fica para o piloto em campo.
4. **Números do painel não batem entre si** (ponto a corrigir antes de qualquer apresentação):
   - "1.204 produtores atendidos de 1.610 cadastrados" no painel, mas "1.205 cadastrados" na tela de produtores;
   - "312 visitas no ano" no painel, mas a soma dos meses do gráfico dá 488 (58+71+66+84+97+112).
   - *Solução:* calcular todos os números a partir do banco de dados, sem valores fixos.
5. **Dados de exemplo.** O vídeo mostra nomes e um CPF de aparência real. O planejamento pede dados fictícios.
   - *Solução:* usar dados inventados. Mascarar o CPF na tela (ex.: ***.456.789-**).
6. **LGPD.** No vídeo, o campo "Consentimento de uso de dados (LGPD) registrado em —" aparece vazio. O guia do PDF exige política de privacidade, nomeação de encarregado e acordo de tratamento de dados.
   - *Solução para a demo:* guardar a data do consentimento e mascarar CPF. Os documentos jurídicos ficam para antes do piloto.

---

## 4. Escopo da demo

**Dentro:**
- Login por perfil (coordenação e técnico), com registro de quem fez cada ação;
- Painel com números calculados do banco;
- Cadastro de produtores e propriedades (área digitada);
- Solicitações em quadro, com troca de coluna;
- Registro de visita com diagnóstico, plano, prazo, fotos, assinatura e localização;
- Programas em modo de leitura, com vagas, inscritos e entregas;
- Relatório simples em PDF (produtor e período);
- Dados fictícios consistentes.

**Fora (vai para o piloto ou versão 2):**
- Mapa e desenho de polígono (com cálculo de área pelo mapa);
- App mobile offline e sincronização;
- Integrações com sistemas federais ou estaduais;
- Módulo financeiro, insumos e maquinário;
- Cálculos agronômicos.

---

## 5. Sequência de trabalho

Cada fase termina com uma verificação. Só avance quando a verificação passar.

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 0. Decisões | Este plano aprovado e o arquivo CLAUDE.md criado | Você aprovou o escopo e o CLAUDE.md está na raiz |
| 1. Base | Repositório, banco de dados, login por perfil e tela vazia do painel | Login funciona e o banco sobe com um comando |
| 2. Produtores e propriedades | Cadastro, busca, CPF mascarado e data de consentimento | Testes do cadastro passam e a busca encontra o produtor |
| 3. Visitas | Registro completo da visita, com fotos e assinatura | Visita salva aparece na página do produtor |
| 4. Solicitações e painel | Quadro de solicitações e números do painel vindos do banco | Os números batem com a soma do banco (teste automático) |
| 5. Programas e relatório PDF | Tela de programas em leitura e relatório PDF | O PDF abre e os valores batem com a tela |
| 6. Dados e roteiro da demo | Dados fictícios consistentes e roteiro de 15 minutos | Roteiro ensaiado do início ao fim, com gravação de backup |

**Estimativa:** no planejamento técnico, as etapas 1, 2, 7 e 8 (fundação, backend, painel e polimento) somam 6 semanas, e a etapa 3 (GIS) soma mais 1, totalizando 7 semanas. Como a demo deixa de fora o mapa e o app offline, o trabalho cai para perto dessas 6 semanas, mais o tempo de Solicitações e Programas (a estimar).

---

## 6. Prompts para o Claude Code

O planejamento técnico já tem prompts prontos (0 a 9). Para a demo:

- **Usar:** prompt 0 (CLAUDE.md), 1 (fundação), 2 (modelo de dados), 3 (login e cadastros), 8 (painel web) e 9 (dados de demonstração).
- **Ajustar:** prompt 2 para não criar tabelas de geometria agora. Prompt 3 com a visita completa.
- **Não usar agora:** prompts 4 (GIS), 5 (app mobile), 6 (mapa) e 7 (sincronização).
- **Criar:** um prompt para **Solicitações**, um para **Programas**, um para **LGPD da demo** (mascarar CPF, data de consentimento, registro de auditoria) e um para **relatório PDF**.

**Regra de ouro:** rodar um prompt por vez, revisar, testar e fazer commit antes do próximo.

---

## 7. Modelo e skills

**Modelo sugerido:** Opus 5.5 no planejamento, na modelagem do banco, nas regras de LGPD e na revisão do código. Para telas repetitivas, o Sonnet 5.5 costuma bastar e custa menos. A escolha final é sua.

**Skills verificadas neste ambiente:**
- `superpowers:writing-plans` (transformar este plano em tarefas);
- `superpowers:test-driven-development` (testes antes do código, útil para regras de cálculo e de consentimento);
- `superpowers:verification-before-completion` (só dar uma fase por pronta com prova de que funciona);
- `superpowers:systematic-debugging` (para erros);
- `anthropic-skills:frontend-design` (para o painel web).

**Skills citadas no planejamento técnico que ainda não verifiquei:**
- Prisma (skills oficiais), Playwright (skill oficial) e Trail of Bits (segurança) são nomes conhecidos. Confirme no repositório antes de instalar.
- Os itens do "Claude Directory", "QA Skills", "agnix" e "secondsky" precisam de verificação. Uma skill é texto que orienta o agente, então só instale de fontes confiáveis.

---

## 8. Aprovação necessária

1. **Solicitações e Programas entram na demo?** (recomendado: sim)
2. **Mapa fica para o piloto?** (recomendado: sim)
3. **Web primeiro e app offline depois?** (recomendado: sim)

**Se você não responder:** sigo com as três recomendações acima.
