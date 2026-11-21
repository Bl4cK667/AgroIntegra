# Plano do app do técnico de campo (Fase A)

Escopo: app Flutter offline-first em `agrointegra_app/`, consumindo a API NestJS de `apps/api` **sem alterar a API**. Este documento é só plano; nenhum código de feature foi escrito.

## 1. Estado do ambiente (20/11/2026)

| Item | Situação |
| --- | --- |
| Flutter | 3.50.0 stable, em `~/development/flutter` (fora do PATH padrão) |
| Dart | 3.14.0 |
| Xcode | 27.2 + simulador iPhone 18 Pro (iOS 27.2) |
| CocoaPods | 1.10.2 (Ruby 2.6 do sistema). Aviso do doctor: recomendado 1.16.2. **Risco** para o build iOS |
| Android SDK | platform 35 e 36, build-tools 35.0.0 e 28.0.3, platform-tools, licenças aceitas |
| JDK | Temurin 17.0.21 em `~/Library/Java/jdk/jdk-17.0.21.1+2` |
| Chrome / rede | OK |

## 2. Mapa entidade → tabela drift → rota

A UI lê só do drift. A rede alimenta o banco local.

| Entidade (API) | Tabela drift | Entrada (pull) | Saída (push / REST) | Observação |
| --- | --- | --- | --- | --- |
| `Producer` | `producers` | `changes.producers` | push `producer` upsert | CPF mascarado; nunca completo. `searchName` sem acento calculado no app |
| `Property` | `properties` | `changes.properties` | push `property` upsert | FK `producerId`; coordenadas com precisão |
| `Visit` | `visits` | `changes.visits` (sem fotos e assinatura) | push `visit` (só criar) | Imutável após criada. Fotos em `visit_photos` |
| Foto da visita | `visit_photos` + fila `outbox_photos` | não vem no pull (só `photos` como lista de metadados) | `PUT /sync/visits/:id/photos/:photoId` | Máximo 3 por visita, até 2 MB, 1 por requisição |
| Feição (GeoJSON) | `features` | `changes.features` | push `feature` upsert/delete | Somente leitura no MVP (mapa) |
| `ServiceRequest` | `requests` | `changes.requests` | **REST** `GET/POST /requests`, `PATCH /requests/:id/status`, `PATCH /requests/:id/priority` | Fora do sync: fila REST própria (ver lacunas) |
| Rascunho de visita | `visit_drafts` | — | — | Salvo a cada campo, retomada após fechar à força |
| Outbox | `outbox` | — | push em lotes de até 50 | `opId`, `entity`, `entityId`, `op`, `payload`, `updatedAt`, `baseUpdatedAt`, `status`, `attempts`, `lastError`, `nextAttemptAt` |
| Cursor | `sync_state` | `cursor` da última página | — | Gravado só após página aplicada |
| Sessão | `flutter_secure_storage` | — | — | Token, `organizationId`. Nunca em SharedPreferences |

Rotas REST fora do sync (`GET /notifications`, `GET /clima/properties/:id`, `GET /reports/producer/:id/pdf`): ficam para depois da Fase F, se entrarem no MVP.

## 3. Contrato verificado no código da API

- `POST /auth/login` → `{accessToken, user{id,name,email,role,organizationId,organizations[]}}`. JWT de 8 h, sem refresh. Com várias organizações, `organizationId` vem `null` e o app precisa enviar `X-Organization-Id`.
- `GET /sync/pull?since=&limit=` (máx. 500, padrão 200). Pull entrega o que foi gravado até `SYNC_PULL_LAG_MS` (5 s) atrás. Registros com `deletedAt` apagam a cópia local.
- `POST /sync/push`: 1 a 50 operações, aplicadas em ordem. Resultados: `applied`, `duplicate`, `rejected` (com `record` do servidor), `error` (com `message` e `retry`).
- `updatedAt` mais de 5 min no futuro é recusado. Usar `serverTime` do pull para corrigir relógio do aparelho.
- Permissões: perfil `TECHNICIAN` edita as próprias visitas; fotos só o autor da visita pode acrescentar.

## 4. Lacunas de backend (registradas em `backend-pendente.md`, não implementadas)

1. Sem refresh token: a sessão expira em 8 h no meio do campo.
2. Solicitações fora do `/sync/push`: criação e mudança de status exigem a fila REST.
3. Fotos em `bytea` no banco (a troca para S3 está isolada em `photo-store.ts`, sem impacto no app).

## 5. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| CocoaPods 1.10.2 com Xcode 27 | Build iOS e simulador podem falhar | Testar cedo na Fase B; se falhar, atualizar o Ruby (3.x) e o CocoaPods |
| Android SDK 36 exigido pelo Flutter 3.50 | APK falha sem a plataforma | Já instalada |
| SQLCipher no iOS e Android | Pode exigir configuração nativa | Validar na Fase B com banco de teste antes de depender dele |
| `material_ui: ^1.1.0` no `pubspec.yaml` do projeto atual | Pacote estranho, possivelmente inexistente | Remover na Fase B e registrar |
| `com.example` no bundle id e no `applicationId` | Não publicável | Trocar na Fase B e registrar em `decisoes.md` |
| Relógio do aparelho errado | Push recusado ou conflito falso | Usar `serverTime` do pull |
| WorkManager no iOS é limitado | Sync em segundo plano não garantido | Sync ao abrir, ao voltar a conexão e no botão |
| Token vencido offline | Técnico não consegue enviar | Fila local continua; pede login antes de enviar |
| Fotos grandes em aparelho de 2 a 4 GB | Memória e armazenamento | Comprimir antes (lado maior ~1600 px, até 2 MB); miniaturas nas listas |
| Visita imutável | Erro de digitação não tem correção | Aviso antes de salvar; revisão na última etapa |
| Conflito de edição entre painel e app | Perda silenciosa | Usar `baseUpdatedAt`; mostrar o resultado do `rejected` |

## 6. Decisões tomadas nesta fase

- Stack Flutter (ver `docs/decisoes.md` na raiz).
- Identidade visual: manter `#1F5A3D`, IBM Plex Sans e cantos de 2 a 4 px, conforme `docs/design-system.md`. O `main.dart` atual (`#1F3D2B` e dourado) será substituído na Fase B.
- Bundle id e `applicationId` definitivos serão definidos na Fase B (hoje `com.example`).

## 7. Próximos passos

- Fase B: dependências, lints, tema, strings centralizadas, go_router, dio, drift + SQLCipher, configuração por ambiente (`API_URL`), permissões no `Info.plist`, bundle id definitivo. O app precisa abrir no simulador.
- Antes da Fase B, confirmar com o responsável pelo backend (João Pedro, dono do sync, segundo a equipe) se pode ser usado o contrato acima sem mudança.
