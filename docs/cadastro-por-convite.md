# Cadastro fechado por convite

A página de cadastro fica em `/cadastro` e só abre o formulário depois da validação de um convite. A tela de login não oferece inscrição pública. A administração é representada pelo perfil existente `COORDINATION`, validado pela membership da organização no backend.

## Implementação

- `/configuracoes/usuarios`: coordenação emite, lista e revoga convites da organização atual. O link com token é mostrado somente na emissão; a administração deve entregá-lo diretamente à pessoa convidada. Não há envio de email implementado.
- Convites têm token aleatório de 256 bits, hash SHA-256 no banco, email normalizado, papel, organização, validade entre 1 e 168 horas (padrão 72 horas) e uso único. A resposta de listagem não contém token nem hash.
- O link usa `/cadastro#token=...`. O fragmento não é enviado ao servidor; a página o retira do histórico e mantém o token somente em memória. A validação e a aceitação enviam o token no corpo JSON, nunca na query da API.
- Cadastro em duas etapas: nome e sobrenome, email fixo do convite, telefone com DDD e senha confirmada. Backend rejeita campos extras, incluindo tentativa de informar outra organização ou perfil.
- Criação da conta pela Supabase Auth Admin API, exclusivamente no servidor. `User.authUserId` é único e liga a identidade remota ao perfil interno; perfil e organização vêm do convite, nunca de `user_metadata`.
- A criação local do usuário e da membership ocorre em transação, com reserva atômica e revalidação do convite. Cadastro não emite sessão; a pessoa entra pela tela de login existente.
- Se o provisionamento remoto terminar e a gravação local falhar, a conta remota fica sem acesso aos dados e a tentativa pode ser retomada pelo mesmo convite com o mesmo identificador. A aplicação não apaga automaticamente contas remotas durante a compensação, evitando apagar uma conta já finalizada por outra requisição. Se o convite expirar ou for revogado, a reconciliação é administrativa.
- Contas novas validam senha no Supabase, e contas legadas continuam usando o hash anterior. A API emite sua sessão JWT de oito horas, preservando os contratos existentes. A alteração de senha de contas Supabase também usa Auth, sem alterar o hash local aleatório.

## Isolamento e RLS

O guard verifica usuário ativo, organização ativa e membership ativa a cada requisição. O papel efetivo é o da membership, não o campo global legado do usuário. Se houver uma única organização, ela é selecionada automaticamente. Se houver várias, a API exige `X-Organization-Id`, validado contra as memberships; a interface atual não oferece seletor de organização.

O contexto por requisição usa AsyncLocalStorage. Os delegates Prisma de produtores, propriedades, visitas/fotos, solicitações, programas, inscrições, entregas, notificações e auditoria exigem esse contexto e incluem `organizationId` em consultas e mutações. A criação atribui a organização no servidor; mover um registro entre organizações é rejeitado. Transações mantêm os filtros, e fotos criadas junto da visita herdam a organização. As consultas SQL do painel incluem explicitamente o filtro. Notificações de equipe consultam memberships da mesma organização.

Relações compostas entre recursos de domínio impedem referências a registros de outra organização, mesmo fora da API. Eventos de autenticação sem organização validada ficam na trilha privada de auditoria com `organizationId = NULL`, invisível às consultas de equipe.

As migrations habilitam RLS nas 14 tabelas e revogam grants de `PUBLIC`, `anon` e `authenticated` nas tabelas internas. Não há escrita direta pelo navegador; nem `passwordHash` nem `Invitation.tokenHash` ficam disponíveis via Data API. As políticas de leitura de domínio também verificam `authUserId`, usuário ativo e membership/organização ativas como defesa adicional.

**Limite importante:** o papel SQL proprietário usado pelo servidor local pode ignorar RLS. Nessa conexão, a autorização depende dos filtros da API e das FKs; não se deve afirmar que RLS filtra automaticamente o Prisma. Credenciais SQL ficam somente no servidor. Uma futura conexão de runtime sem bypass exige grants e contexto transacional próprios, homologados antes de substituir a conexão atual.

## Banco e preservação dos dados

- `20261118090000_closed_registration_organizations`: adiciona organizações, memberships, convites e `authUserId`; preserva as contas e registros existentes, atribuindo a equipe atual à organização inicial AgroIntegra. Não cria usuários.
- `20261118091000_closed_registration_rls`: aplica o fechamento da Data API e as políticas descritas acima. Não altera schemas gerenciados do Supabase nem cria papéis nele.
- Ambas foram validadas em uma instância PostgreSQL temporária vazia e aplicadas apenas ao banco local `agrointegra` neste trabalho. Nenhuma migration foi executada no projeto Supabase remoto.

Não executar seeds/reset para ativar o recurso. Um banco novo precisa receber os dados reais existentes ou um primeiro administrador explicitamente autorizado por procedimento operacional; não existe bootstrap público de administrador.

## Configuração para ativação real

O ambiente local mantém `SUPABASE_AUTH_ENABLED=false` e o cadastro desabilitado. A URL, a chave publicável e a chave administrativa fornecidas estão apenas no `.env` da API, fora do Git, com permissões locais restritas. A credencial administrativa foi validada com uma consulta somente leitura à Admin API (HTTP 200), sem criar contas. A consulta às configurações de Auth confirmou que o cadastro público ainda está habilitado; a ativação permanece pendente de desabilitá-lo. O portal `Supabase Auth` foi aberto no canvas, mas exige login no painel para alterar essa configuração.

1. Configurar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente em `apps/api/.env` ou no secret manager do servidor, sem enviá-la ao frontend, chat ou Git. `SUPABASE_PUBLISHABLE_KEY` é utilizada pelo servidor na validação de email/senha.
2. No Supabase, desabilitar **Allow new users to sign up**, logins anônimos e provedores que possam criar contas por fora do fluxo autorizado. A aplicação não consegue garantir essa configuração apenas com a chave publicável. [Configuração oficial de Auth](https://supabase.com/docs/guides/auth/general-configuration).
3. Se o banco oficial passar ao Supabase, preparar a conexão SQL server-only e migrar os dados reais com backup/restauração ensaiados. Aplicar as migrations revisadas primeiro em homologação; não basta preencher a URL de Auth. O banco local atual não é replicado automaticamente.
4. Configurar `WEB_ORIGIN` com a origem HTTPS do painel, `JWT_SECRET` forte, limites de login/cadastro e `TRUST_PROXY` de acordo com a infraestrutura. Os contadores são por processo; múltiplas réplicas precisam de armazenamento compartilhado.
5. Ativar `SUPABASE_AUTH_ENABLED=true`, verificar login e identidade em homologação, e só então `SUPABASE_REGISTRATION_ENABLED=true`. Reiniciar a API após configurar o ambiente.
6. Usar um convite para uma pessoa real autorizada e verificar cadastro, login, perfil, organização, reutilização negada, revogação, expiração e bloqueio entre duas organizações. Essa verificação remota permanece pendente das credenciais e da homologação do projeto.

A Admin API é uma operação de servidor: [documentação oficial de criação de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser). A posse do link autoriza o cadastro: entregá-lo apenas ao destinatário; não publicar convites em páginas, logs ou grupos abertos.

## Testes e limites

Os testes isolados exercitam controllers, guard, validação, contexto de organização e ciclo convite → cadastro → login → acesso → troca de senha, com banco e Supabase em memória. Não criam contas reais. Também cobrem técnico impedido de administrar convites, token expirado/revogado/reutilizado, troca de email, falhas de provisionamento e acesso a outra organização.

Resultados desta entrega: 126 testes isolados da API e 10 do frontend passaram; builds e verificação de tipos passaram. O PostgreSQL temporário validou as migrations, RLS e grants sem criar contas. No banco local com usuários preexistentes, login e consultas retornaram 200; um técnico recebeu 403 na administração de convites e ao solicitar outra organização. No navegador, foram conferidos cadastro sem convite e convite inválido, login sem inscrição pública e área administrativa em 390 px e desktop, sem overflow da página. A criação real via Supabase permanece pendente das credenciais/configuração descritas acima.

```bash
# A partir de apps/api; não usa prepare-test-db nem e2e com limpeza de tabelas
npx jest --runInBand --testPathIgnorePatterns=e2e

# A partir da raiz; usa PostgreSQL novo sob o diretório temporário do sistema
node scripts/check-registration-db.mjs

node --test apps/web/src/lib/backend-config.test.mjs apps/web/src/lib/invite-token.test.mjs
npm run -w apps/api build
npm run -w apps/web build
```

Os e2e legados de banco têm cliente de manutenção separado do cliente escopado da API; as rotinas de preparação recusam banco não local ou sem sufixo `_test`. Não foram executados contra o banco de desenvolvimento. Nenhuma senha, token de convite real ou credencial administrativa é necessária para os testes isolados.

Permanecem fora deste fluxo: envio automático de emails, adicionar uma conta já existente a outra organização, seletor de múltiplas organizações no painel e revogação imediata de sessões JWT já emitidas. Desativar usuário/membership bloqueia a próxima chamada à API. Supabase Storage continua planejado, sem migração de arquivos nesta atividade.
