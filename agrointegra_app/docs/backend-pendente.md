# Backend pendente (proposta, não implementada)

Lacunas encontradas ao ler `apps/api` para o app do técnico. Nenhuma foi implementada: a API e o schema Prisma não foram alterados.

## 1. Refresh token

- **Problema:** o JWT vale 8 h e não há refresh. O técnico pode perder a sessão no meio do campo.
- **Proposta:** refresh token rotativo, com validade maior só para o app.
- **Enquanto isso:** o app continua funcionando offline e guarda tudo na fila. Ao voltar a conexão, pede o login de novo antes de enviar.

## 2. Solicitações fora do `/sync/push`

- **Problema:** criar solicitação e mudar status só existem em REST (`POST /requests`, `PATCH /requests/:id/status`, `PATCH /requests/:id/priority`). Offline, essas ações se perdem.
- **Proposta:** entidade `request` no `/sync/push`, com as mesmas regras de conflito de visitas e propriedades.
- **Enquanto isso:** fila REST separada no app, com retry e marcação "pendente" na tela.

## 3. Fotos no banco

- **Problema:** as fotos ficam em `bytea`. Não é bloqueio para o app, porque a troca por S3 está isolada em `apps/api/src/visits/photo-store.ts`.
- **Proposta:** storage compatível com S3, com URL assinada no pull. A decisão de 18/11 manteve `bytea` por enquanto (registrada no `CLAUDE.md` do commit `38ca719`).
