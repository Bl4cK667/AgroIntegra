# Decisões do app do técnico (Flutter)

| Data | Decisão | Motivo |
| --- | --- | --- |
| 20/11/2026 | Stack Flutter (Dart 3, Riverpod, go_router, drift + SQLCipher, dio) | Prompt `prompt-app-mobile.md`. Substitui a proposta de Expo no `docs/decisoes.md` da raiz |
| 20/11/2026 | UI em `#1F5A3D`, IBM Plex Sans, cantos de 2 a 4 px | `docs/design-system.md` (decisão de 20/11). O `#1F3D2B` e o dourado do `main.dart` inicial saem na Fase B |
| 20/11/2026 | Lacunas de backend ficam em `backend-pendente.md`, sem mudar a API | Regra 3 do prompt |
| 20/11/2026 | CocoaPods 1.10.2 instalado por RubyGems no Ruby 2.6 do sistema | Não há Homebrew no Mac. Pendente atualizar se o build iOS falhar |
| 20/11/2026 | Bundle id e applicationId: `br.com.integratech.agrointegra` (iOS e Android); `MainActivity` movido para o novo pacote | Sair de `com.example`. Confirmar o domínio definitivo antes de publicar |
| 20/11/2026 | SQLCipher via build hook do `sqlite3` 3.x (`hooks.user_defines.sqlite3.source: sqlcipher`) | `sqlcipher_flutter_libs` e `sqlite3_flutter_libs` estão em fim de vida (`+eol`) e não fazem mais nada com o sqlite3 3.x |
| 20/11/2026 | Material e Cupertino pelos pacotes `material_ui` e `cupertino_ui` | O Flutter 3.50 marca `package:flutter/material.dart` como depreciado |
| 20/11/2026 | Permissões do iOS em português; HTTP liberado só para rede local (`NSAllowsLocalNetworking`) | Regra de segurança do prompt. Produção exige HTTPS (`AppConfig.validate`) |
| 20/11/2026 | IBM Plex Sans ainda não empacotada; o app usa a fonte padrão | Falta a fonte no repositório. Entra junto com as telas |
| 21/11/2026 | Solicitação vai pela fila REST, com id temporário `local-…` até o servidor responder | A API gera o id da solicitação, então ela não cabe no `/sync/push` (lacuna em `backend-pendente.md`) |
| 21/11/2026 | Visita só referencia solicitação já enviada; o botão "Registrar visita" fica desligado enquanto a solicitação é temporária | Evita um `requestId` que o servidor ainda não conhece |
| 21/11/2026 | Pull grava registros com nome singular (`producer`, `visit`…), igual às operações de envio | Bug achado pelo teste: o plural separava o registro baixado do que a tela lê |
| 21/11/2026 | Fila REST espera o produtor pendente subir (adia 30 s) em vez de pular | Pular sem adiar fazia o laço repetir a mesma solicitação para sempre (bug achado pelo teste) |
| 21/11/2026 | Segundo plano só no Android (WorkManager, 15 min, com rede) | Configuração nativa do iOS (BGTaskScheduler) não validada em aparelho; ativar sem teste pode derrubar o app |
| 21/11/2026 | Lint `lintVital` de release desligado (`android/build.gradle.kts`) | Bug do lint com o plugin `image_picker_android` quebrava o `assembleRelease`. Não afeta o APK |
| 21/11/2026 | Coordenadas da propriedade sem `accuracy` | `CoordinatesDto` da API só aceita latitude e longitude |
| 21/11/2026 | Mapa com satélite Esri, somente leitura | Decisão do prompt (MVP). Sem cache offline dos tiles ainda |
