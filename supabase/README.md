# Preparação Supabase — AgroIntegra (ESPECIFICAÇÃO PLANEJADA)

> Os arquivos `planned/` abaixo são referências da fase anterior. A implementação atual usa `Organization`, `OrganizationMembership`, `organizationId` e `User.authUserId`, com migrations reais em `apps/api/prisma/migrations/20261118090000_closed_registration_organizations` e `20261118091000_closed_registration_rls`. Veja [o estado atual do cadastro fechado](../docs/cadastro-por-convite.md). Não aplique os exemplos antigos sobre essas migrations.

> **IMPORTANTE:** Todo o conteúdo desta pasta é uma **especificação de design** (`.sql.example` em `supabase/planned/`), **não pronta para aplicação direta** e fora de `supabase/migrations/` para impedir execução automática.  
> **Nenhuma migration foi executada** no banco atual.

---

## 1. Arquitetura atual vs. arquitetura proposta

### Arquitetura atual
- **Frontend (`apps/web`)**: Next.js 16 (App Router) operando exclusivamente no modo `legacy` (`POST /auth/login` na API NestJS, sessão em `sessionStorage`, papel `COORDINATION` | `TECHNICIAN` obtido via `/auth/me`).
- **Backend (`apps/api`)**: NestJS + Prisma ORM sobre PostgreSQL local, preservando a fronteira de negócio e segurança no servidor.
- **Vínculo provisório no backend**: `SupabaseIdentityService` resolve o usuário legado por `app_metadata.agrointegra_user_id` (gravável apenas com `service_role`, nunca pelo usuário).

### Arquitetura proposta (transição futura)
- **Vínculo de identidade (`auth.uid()` -> `"User".id`)**:
  - **Atual (provisório)**: `app_metadata.agrointegra_user_id` validado no servidor.
  - **Futuro (no banco para RLS)**: `User.authUserId` (FK para `auth.users(id)`) ou tabela dedicada `public.user_identities (auth_user_id, legacy_user_id)` gerenciada exclusivamente por `service_role`.
  - **Regra absoluta**: **nunca** confiar em `auth.jwt() -> 'user_metadata'` (editável pelo usuário via `supabase.auth.updateUser()`).
- **Multi-tenancy com membership validado e FKs compostas obrigatórias**:
  - Tabelas `public.tenants` e `public.tenant_memberships (tenant_id, user_id, role, active)`.
  - Funções `SECURITY DEFINER` (`current_legacy_user_id()`, `is_tenant_member()`, `has_tenant_role()`, `shares_active_tenant_with()`) evitam recursão de RLS em `tenant_memberships` e validam `tenants.active`, `tenant_memberships.active` e `"User".active`.
  - **FKs compostas obrigatórias** `(id, tenant_id)` garantem no schema (mesmo fora do RLS) que `Property`, `ServiceRequest`, `Visit`, `Enrollment` e `Delivery` nunca apontem para registros de outro tenant.
- **Supabase Storage (planejado)**: buckets privados `visit-photos`, `visit-signatures` e `avatars`, validando recurso pai (`Visit`) e imutabilidade das mídias de visita.

---

## 2. Especificações planejadas (`.sql.example`)

- `supabase/planned/01_identity_and_tenants.sql.example`: `tenants`, `tenant_memberships`, `user_identities` / futuro `User.authUserId`, `tenant_id` + FKs compostas obrigatórias e funções `SECURITY DEFINER`.
- `supabase/planned/02_rls_policies.sql.example`: rascunhos de políticas por operação (`SELECT`/`INSERT`/`UPDATE`, sem `FOR ALL` permissivo), `GRANT` por coluna (`User` sem leitura de `passwordHash` e sem alteração de `role`/`active`; `Notification` só altera `readAt`) e view `producers_safe` com `security_barrier = true`.
- `supabase/planned/03_storage_policies.sql.example`: buckets privados `visit-photos`, `visit-signatures`, `avatars` com validação de recurso e imutabilidade.

---

## 3. Matriz de tabelas e políticas RLS planejadas

| Tabela | `SELECT` | `INSERT` / `UPDATE` | `DELETE` | Proteções críticas |
| :--- | :--- | :--- | :--- | :--- |
| `tenants` | Membro ativo (`active = true`) | Apenas `service_role` | Negada | Sem enumeração cross-tenant |
| `tenant_memberships` | Próprio vínculo ativo ou `COORDINATION` do tenant | Apenas `service_role` | Negada | Fonte de verdade de tenant e papel |
| `user_identities` | Próprio `auth_user_id = auth.uid()` | Apenas `service_role` | Negada | Liga `auth.uid()` ao `"User".id` legado |
| `User` | Próprio usuário ou `shares_active_tenant_with(id)` | `UPDATE` apenas próprio perfil (`name`, `phone`, `jobTitle`, `navStyle`, `theme`) | Negada | `REVOKE SELECT` em `passwordHash`; `REVOKE UPDATE` em `role`/`active`; sem recursão RLS |
| `Notification` | Próprio `userId` no tenant ativo | `INSERT`: `service_role`; `UPDATE`: apenas coluna `"readAt"` | Negada | `GRANT UPDATE ("readAt")` impede alterar `title`/`body`/`tenant_id` |
| `AuditLog` | Apenas `COORDINATION` do tenant | `INSERT`: `service_role`; `UPDATE`: negado | Negada | Log LGPD imutável |
| `Producer` | Membros ativos (sem coluna `cpf`; usar `producers_safe`) | Membros ativos (`createdById = current_legacy_user_id()` no insert) | Negada | View `producers_safe` com `security_barrier = true` mascara `cpf` |
| `Property` | Membros ativos do tenant | Membros ativos (validando `Producer` no mesmo `tenant_id` no `INSERT` e `UPDATE`) | Negada | FK composta `(producerId, tenant_id)` |
| `Visit` | Membros ativos do tenant | `INSERT`: membro ativo (`technicianId = current_legacy_user_id()`, validando `Producer`, `Property` e `ServiceRequest` no mesmo `tenant_id`); `UPDATE`: negado | Negada | Registro de visita imutável + FKs compostas |
| `VisitPhoto` | Membros ativos da `Visit` pai | `INSERT`: técnico da `Visit` pai; `UPDATE`: negado | Negada | Escopo e imutabilidade herdados de `Visit` |
| `ServiceRequest` | Membros ativos do tenant | Membros ativos (validando `Producer` e `Property` no mesmo `tenant_id` no `INSERT` e `UPDATE`) | Negada | FKs compostas `(producerId, tenant_id)` e `(propertyId, tenant_id)` |
| `Program`, `Enrollment`, `Delivery` | Membros ativos do tenant | `INSERT`/`UPDATE`: apenas `COORDINATION` do tenant (validando `Program` e `Producer` no mesmo `tenant_id`) | Negada | Sem `FOR ALL` (evita `DELETE` acidental); FKs compostas |

---

## 4. Variáveis de ambiente necessárias

### Frontend (`apps/web/.env.example`)
- `NEXT_PUBLIC_API_URL`: URL da API NestJS (`http://localhost:3001` em dev; `https://...` obrigatório em produção; sem credenciais/query/fragmento).
- `NEXT_PUBLIC_AUTH_MODE`: `legacy` (único modo ativo; `"supabase"` é rejeitado até implementação futura).
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: reservadas/opcionais (nunca gravar chaves reais em exemplos versionados).

### Backend (`apps/api/.env.example` — exclusivo do servidor)
- `DATABASE_URL`, `JWT_SECRET`
- `SUPABASE_AUTH_ENABLED`, `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUDIENCE`
- `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (**nunca** no frontend)

---

## 5. Riscos e pontos de atenção

1. **Nunca confiar em `user_metadata`**: é editável pelo usuário; autorização usa apenas `tenant_memberships`, `"User".active` e `app_metadata` / `user_identities` / futuro `User.authUserId`.
2. **Backfill antes de habilitar RLS**: popular `tenant_id` e `tenant_memberships` antes de aplicar `NOT NULL` e FKs compostas.
3. **Sem `service_role` ou segredos no browser**: `apps/web/next.config.ts` e `apps/web/src/lib/backend-config.ts` bloqueiam nomes e valores secretos em `NEXT_PUBLIC_*`.

4. **Exemplos não são migrations homologadas**: a extensão `.sql.example` impede descoberta automática, mas o conteúdo ainda é SQL e não deve ser executado manualmente. Não houve validação em banco. Antes de converter em migrations, definir grants completos, proprietário restrito das funções `SECURITY DEFINER`, schemas não expostos e conexão de runtime que não seja dona das tabelas nem tenha `BYPASSRLS`. A view privilegiada precisa manter o filtro explícito de membership; `security_barrier` isoladamente não aplica RLS.
5. **Imutabilidade de uploads ainda exige implementação**: negar `UPDATE`/`DELETE` não impede adicionar novas fotos/assinaturas a uma visita antiga. Os exemplos de `INSERT` são parciais; o backend deverá criar uma autorização de upload limitada e expirá-la ao finalizar a visita, com vínculos dos objetos ao registro, limites de fotos e assinatura única. Não liberar escrita direta em Storage/Data API antes disso. Auditar e revogar políticas permissivas preexistentes, pois políticas permissivas se combinam por `OR`.
6. **Unicidade do vínculo de identidade**: escolher `User.authUserId` ou `user_identities` como fonte canônica, atualizar o adaptador do backend para consultá-la e remover a ponte administrativa provisória antes do corte. Ver [o plano completo](../docs/preparacao-supabase.md) para a sequência de homologação e para o contexto de RLS com Prisma.
