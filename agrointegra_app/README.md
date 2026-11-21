# AgroIntegra · App do técnico de campo

App Flutter offline-first para o técnico de campo. Consome a API NestJS de `apps/api`
(monorepo na raiz do projeto), sem alterar o backend.

## Como rodar

1. Suba a API e o banco na raiz do monorepo: `npm run setup` (uma vez) e `npm run dev`.
2. Rode o app apontando para a API:

```bash
# Simulador do iPhone
flutter run -d <id-do-simulador> --dart-define=API_URL=http://localhost:3001

# Emulador Android
flutter run --dart-define=API_URL=http://10.0.2.2:3001
```

Usuário de demonstração: `tecnico@agrointegra.demo` / `demo1234` (rode `npm run demo:reset` antes para os dados).

## Testes

```bash
flutter analyze
flutter test                                              # unitários e de widget (sem rede)
flutter test test/integration --dart-define=INTEGRATION=true   # contra a API local (cria registros "TESTE APP")
```

## Builds

```bash
flutter build apk --debug
flutter build apk --release --dart-define=API_URL=https://<api-de-producao>
flutter build ios --simulator --debug --dart-define=API_URL=http://localhost:3001
```

Pendente antes de distribuir: keystore de release (hoje a build usa a chave de debug) e a URL HTTPS da API de produção.
Em build de release, o app recusa iniciar com `API_URL` em HTTP (`AppConfig.validate`).

## Arquitetura

- `lib/core/database`: banco local (drift + SQLCipher). A chave fica no Keychain/Keystore.
- `lib/core/sync`: motor de sincronização. Push em lotes de 50, fila REST para solicitações, fotos depois da visita, pull paginado.
- `lib/core/domain`: escrita offline (produtor, propriedade, visita, solicitação) e regras (CPF, busca sem acento).
- `lib/core/auth`: sessão, PIN (PBKDF2), biometria e expiração do token.
- `lib/features`: telas por domínio (agenda, produtores, propriedades, solicitações, visitas, pendências).

A UI lê só do banco local. A rede apenas alimenta esse banco. Escritas vão primeiro para a fila e depois para o servidor.

## Limitações conhecidas

- **Segundo plano só no Android** (WorkManager, a cada 15 min com rede). No iOS a sincronização roda ao abrir o app, ao voltar a internet e pelo botão. O agendamento nativo do iOS (BGTaskScheduler) não foi validado em aparelho.
- **Biometria no simulador** depende de cadastrar Face ID; ver a seção de teste no iPhone físico.
- **Sem refresh token** na API: a sessão vale 8 h. Depois disso o app continua abrindo offline e pede login antes de enviar.
- **Solicitação criada offline** não pode mudar de status nem ser usada como origem de visita até subir (o servidor gera o id).
- **Mapa** é somente leitura e usa imagens de satélite (Esri), que precisam de internet na primeira carga.
- Fonte IBM Plex Sans ainda não empacotada; o app usa a fonte padrão.

Decisões registradas em `docs/decisoes.md`. Lacunas de backend em `docs/backend-pendente.md`. Plano em `docs/plano.md`.
