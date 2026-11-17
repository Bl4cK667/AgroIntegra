# Roteiro da demonstração (15 minutos)

História contada: **a produtora pede ajuda → a secretaria organiza → o técnico visita → a coordenação acompanha e gera o relatório.**
Personagem: **Maria das Graças Nogueira**, da comunidade Serra do Cedro, com a palma atacada pela cochonilha.
Todos os nomes, CPFs e telefones são inventados.

Os números do painel mudam conforme o dia da carga. Por isso o roteiro não cita números fixos: ele mostra que **os números mudam na hora**, quando a visita é salva.

---

## Antes de começar (no dia, 20 minutos antes)

1. Abrir um terminal na pasta do projeto e rodar:
   ```
   npm run db:up
   npm run demo:reset
   ```
   O `demo:reset` apaga os dados de atendimento e recria tudo com datas relativas a **hoje**. Assim, o painel sempre tem visitas no mês atual e a solicitação da Maria aparece aberta "ontem".
2. Subir a API e o painel (ver `README.md`) e abrir `http://localhost:3000/login` no Chrome.
3. No Chrome:
   - zoom em 110%;
   - fechar outras abas e desligar as notificações do computador;
   - permitir a localização para `localhost`. Para isso, abrir uma visita nova uma vez, clicar em **Registrar localização atual** e aceitar.
4. Deixar aberta a pasta `docs/demo`. Lá está a imagem `foto-palma-ilustrativa.jpg`, usada na visita.
5. Ter à mão a gravação de backup (`docs/demo/ensaio-demo.mp4`), aberta em outra janela.

Acessos (não mostrar na tela):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Coordenação | coordenacao@agrointegra.demo | demo1234 |
| Técnico | tecnico@agrointegra.demo | demo1234 |

---

## Passo a passo

### 0:00 – 1:00 · Abertura
- **Falar:** "Hoje o atendimento ao produtor fica em papel, planilha e WhatsApp. No fim do ano é difícil provar quantas visitas foram feitas e para quem. O AgroIntegra junta tudo num lugar só."
- **Falar:** "Tudo o que vocês vão ver é fictício. Nenhum nome ou CPF é de pessoa real."

### 1:00 – 2:30 · Login e Painel (coordenação)
- Entrar como **coordenação**.
- **Mostrar:** os quatro números do topo, o gráfico de visitas por mês e a tabela por comunidade.
- **Mostrar:** a "soma dos meses" no canto do gráfico. Ela é igual ao número de "Visitas no ano", e o total da tabela por comunidade também.
- **Falar:** "Nenhum número aqui é digitado. Tudo é contado do banco na hora. Tem um teste automático que confere isso."
- **Anotar** em um papel: *Concluídas no mês* e *Visitas no ano*. Esses dois números vão subir no fim do roteiro.

### 2:30 – 4:00 · Produtores
- Menu **Produtores** → buscar `maria gracas`, sem acento e sem "das".
- **Mostrar:** a busca acha "Maria das Graças Nogueira" mesmo assim.
- Abrir a produtora:
  - **CPF mascarado** (`***.xxx.xxx-**`): "o CPF completo nunca aparece na tela nem sai da API";
  - **Consentimento LGPD** com data;
  - duas propriedades, com área digitada (o mapa fica para o piloto);
  - histórico com 3 visitas no ano.

### 4:00 – 5:30 · Solicitações
- Menu **Solicitações**.
- **Mostrar:** as quatro colunas (Nova, Em análise, Agendada, Concluída).
- Achar o cartão **"Cochonilha-do-carmim na palma"**, da Maria, com prioridade **Alta**, na coluna **Nova**.
- **Arrastar** o cartão para **Agendada**. Abrir o cartão e pôr a data de **amanhã**.
- **Falar:** "Cada mudança fica registrada: quem mudou, o quê e quando."

### 5:30 – 6:00 · Troca de perfil
- **Sair** e entrar como **técnico** (Rafael).
- **Falar:** "Cada pessoa entra com o seu perfil. O sistema sabe quem registrou cada visita."

### 6:00 – 9:30 · Registro da visita (técnico)
- Menu **Solicitações** → abrir o cartão da Maria → **Registrar visita**.
  O formulário já vem com a produtora e a solicitação marcadas.
- Preencher:
  - **Propriedade:** Sítio Pedra Branca;
  - **Diagnóstico:** `Cochonilha-do-carmim em cerca de 30% das raquetes da palma plantada há quatro meses.`
  - **Plano de ação:** `Retirar e enterrar as raquetes mais atacadas. Pulverizar calda de sabão neutro nas demais a cada 7 dias.`
  - **Prazo de retorno:** daqui a 30 dias;
  - **Impacto esperado:** `Preservar a reserva de palma para a seca.`
- **Adicionar fotos** → escolher `docs/demo/foto-palma-ilustrativa.jpg`.
  - **Falar:** "No celular, o técnico tira a foto na hora. O sistema reduz a foto antes de enviar, para funcionar com internet fraca."
- **Registrar localização atual** → aparecem as coordenadas.
  - **Falar:** "Só a coordenada, sem mapa nesta versão."
- **Assinatura:** assinar com o mouse na área "Assine aqui".
- **Salvar visita**.
- **Mostrar:** a página da produtora abre com o aviso "Visita salva" e a visita nova na lista. Clicar nela para ver a foto, a assinatura e a localização.
- **Falar:** "Depois de salva, a visita não é editada. Ela vale como registro do atendimento."

### 9:30 – 10:30 · De volta à coordenação
- **Sair** e entrar como **coordenação**.
- **Solicitações:** o cartão da Maria agora está em **Concluída**. Ninguém precisou mover: a visita concluiu o pedido.
- **Painel:** *Concluídas no mês* e *Visitas no ano* subiram **1** em relação ao que foi anotado. A barra do mês atual também subiu.
  - **Falar:** "É por isso que os números não podem ser digitados à mão."

### 10:30 – 12:00 · Programas
- Menu **Programas**.
- **Mostrar:** vagas, inscritos, beneficiários, entregas, execução física e execução financeira.
- Abrir **Palma forrageira resistente**.
  - **Mostrar:** a Maria aparece como **Beneficiária**, com a entrega de 200 raquetes.
  - **Falar:** "Isto ajuda na prestação de contas: quanto da meta e quanto do orçamento já foi executado."

### 12:00 – 13:30 · Relatório em PDF
- Voltar à página da Maria → **Relatório em PDF**. O período já vem de 1º de janeiro até hoje.
- **Mostrar:** a prévia com visitas, solicitações, programas e entregas.
- **Baixar PDF** e abrir.
- **Mostrar:**
  - os números do PDF são os mesmos da prévia;
  - o CPF está mascarado;
  - o rodapé diz quem gerou, quando, e numera as páginas.
- **Falar:** "Este relatório serve para prestar contas e para o atestado de capacidade técnica."

### 13:30 – 15:00 · Fechamento
- **Falar:** "O que vocês viram é a demonstração. No piloto entram:
  - o mapa com o desenho da propriedade;
  - o aplicativo do técnico que funciona sem internet;
  - as integrações com os sistemas do estado e da União."
- Perguntas.
- **Pedir:** a avaliação da agrônoma sobre as telas e o próximo passo, que é o piloto e o atestado.

---

## Plano B

| Problema | O que fazer |
| --- | --- |
| A API ou o painel não abre | Mostrar a gravação `docs/demo/ensaio-demo.mp4` e narrar por cima |
| A localização não funciona (sem permissão ou sem sinal) | Pular o passo. Falar: "No celular, em campo, o GPS registra a posição." A visita salva sem localização |
| O arrastar do cartão não funciona (tela de toque) | Abrir o cartão e trocar a **Situação** na lista |
| Alguém pergunta sobre um produtor real | "Os dados são fictícios para respeitar a LGPD. No piloto entram os dados da secretaria, com consentimento" |
| Os dados ficaram bagunçados num ensaio | Rodar `npm run demo:reset` de novo (leva poucos segundos) |

---

## Ensaio

O ensaio é feito por um roteiro automático. Ele abre o Chrome, faz os passos 1:00 a 13:30 e confere cada resultado:
- a busca sem acento;
- o CPF mascarado na tela e no PDF;
- o cartão arrastado para Agendada;
- a visita com foto, localização e assinatura;
- o pedido concluído pela visita;
- o painel subindo 1;
- a entrega de 200 raquetes;
- a visita nova dentro do PDF.

A gravação fica em `docs/demo/ensaio-demo.mp4` (cerca de 2 minutos, com legenda em cada passo, sem áudio) e serve de backup para o dia.

O robô é mais rápido que uma pessoa. Antes da apresentação, faça **um ensaio falado, com cronômetro**, seguindo os tempos acima. Depois rode `npm run demo:reset` de novo, porque o ensaio altera os dados.
