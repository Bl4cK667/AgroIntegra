/// Todos os textos da interface, em português do Brasil, num só lugar.
abstract final class AppStrings {
  static const String appName = 'AgroIntegra';
  static const String appSubtitle = 'Assistência técnica rural';

  static const String agendaTitle = 'Agenda';
  static const String loading = 'Carregando…';
  static const String save = 'Salvar';
  static const String cancel = 'Cancelar';
  static const String saveError =
      'Não foi possível salvar agora. Tente de novo.';
  static const String loadError = 'Não foi possível carregar os dados.';
  static const String notFound = 'Registro não encontrado.';
  static const String noneOption = 'Nenhuma';
  static const String waitingSend = 'Aguardando envio';

  // Login
  static const String loginTitle = 'Entrar';
  static const String loginEmail = 'E-mail';
  static const String loginPassword = 'Senha';
  static const String loginButton = 'Entrar';
  static const String loginEmailRequired = 'Informe o e-mail.';
  static const String loginPasswordRequired = 'Informe a senha.';
  static const String loginInvalidCredentials = 'E-mail ou senha inválidos.';
  static const String loginNoConnection =
      'Sem internet. Confira a conexão e tente de novo.';
  static const String loginGenericError =
      'Não foi possível entrar agora. Tente novamente em instantes.';

  // Organização
  static const String organizationTitle = 'Escolha a organização';
  static const String organizationHint =
      'Você tem acesso a mais de uma organização. Escolha onde vai trabalhar agora.';

  // PIN e desbloqueio
  static const String createPinTitle = 'Crie seu PIN';
  static const String createPinHint =
      'Com o PIN você abre o app sem internet. Ele não substitui a senha do painel.';
  static const String pinLabel = 'PIN (4 a 6 números)';
  static const String pinConfirmLabel = 'Repita o PIN';
  static const String pinSave = 'Salvar PIN';
  static const String pinInvalid = 'Use de 4 a 6 números.';
  static const String pinMismatch = 'Os PINs não coincidem.';
  static const String unlockTitle = 'Desbloquear';
  static const String unlockHint = 'Digite seu PIN para continuar.';
  static const String unlockButton = 'Entrar com PIN';
  static const String unlockBiometric = 'Usar biometria';
  static const String unlockWithPassword = 'Entrar com senha';
  static const String biometricReason =
      'Confirme sua identidade para abrir o AgroIntegra';
  static const String pinLockedOut =
      'PIN bloqueado após muitas tentativas. Entre com sua senha.';

  static String pinWrong(int attemptsLeft) =>
      'PIN incorreto. Tentativas restantes: $attemptsLeft.';

  // Sessão
  static const String logout = 'Sair';
  static const String logoutConfirmTitle = 'Sair do AgroIntegra?';
  static const String logoutConfirmBody =
      'Seu PIN será apagado neste aparelho. Os dados já salvos continuam aqui.';
  static const String sessionExpiredBanner =
      'Sessão expirada. Entre de novo quando tiver internet para enviar os dados.';

  // Sincronização
  static const String syncSyncing = 'Sincronizando…';
  static const String syncUpToDate = 'Tudo enviado';
  static const String syncPending = 'pendente(s) para enviar';
  static const String syncOffline =
      'Sem internet. Os dados ficam salvos e serão enviados depois.';
  static const String syncNeedsLogin = 'Entre de novo para enviar os dados.';
  static const String syncError =
      'Não foi possível sincronizar agora. Tente de novo.';
  static const String syncNow = 'Sincronizar agora';
  static const String syncDiscardedTitle = 'Alterações descartadas';
  static const String syncStatusTooltip = 'Pendências e sincronização';
  static const String pendingTitle = 'Pendências';
  static const String pendingEmpty = 'Nada pendente. Tudo está enviado.';
  static const String pendingWaiting = 'Aguardando envio';
  static const String pendingNeedsAttention = 'Precisa de atenção';
  static const String pendingEntityProducer = 'Produtor';
  static const String pendingEntityProperty = 'Propriedade';
  static const String pendingEntityVisit = 'Visita';
  static const String pendingEntityFeature = 'Feição do mapa';
  static const String pendingEntityRequest = 'Solicitação';

  // Produtores
  static const String producersTitle = 'Produtores';
  static const String producersSearch = 'Buscar por nome ou comunidade';
  static const String producersEmpty =
      'Nenhum produtor ainda. Toque em "Novo produtor" para cadastrar.';
  static const String producerNew = 'Novo produtor';
  static const String producerEdit = 'Editar produtor';
  static const String producerDetail = 'Produtor';
  static const String producerName = 'Nome';
  static const String producerNameRequired = 'Informe o nome.';
  static const String producerCpf = 'CPF';
  static const String producerCpfHint = 'Somente números';
  static const String producerCpfInvalid = 'CPF inválido. Confira os números.';
  static const String producerCpfLocked =
      'O CPF não pode ser alterado depois do cadastro.';
  static const String producerPhone = 'Telefone (opcional)';
  static const String producerCommunity = 'Comunidade';
  static const String producerCommunityRequired = 'Informe a comunidade.';
  static const String producerConsent =
      'O produtor autorizou o uso dos dados para o atendimento técnico (LGPD).';
  static const String producerConsentRequired =
      'Sem o consentimento do produtor, o cadastro não pode ser salvo.';
  static const String producerConsentDate = 'Consentimento em';
  static const String producerProperties = 'Propriedades';
  static const String producerVisits = 'Visitas';
  static const String producerRequests = 'Solicitações';
  static const String producerNoProperties = 'Nenhuma propriedade cadastrada.';
  static const String producerNoVisits = 'Nenhuma visita registrada.';
  static const String producerNoRequests = 'Nenhuma solicitação.';
  static const String newProperty = 'Nova propriedade';
  static const String newVisit = 'Nova visita';
  static const String newRequest = 'Nova solicitação';

  // Propriedades
  static const String propertyTitle = 'Propriedade';
  static const String propertyNew = 'Nova propriedade';
  static const String propertyEdit = 'Editar propriedade';
  static const String propertyName = 'Nome da propriedade';
  static const String propertyNameRequired = 'Informe o nome da propriedade.';
  static const String propertyArea = 'Área declarada (ha)';
  static const String propertyAreaInvalid =
      'Informe a área em hectares (número maior que zero).';
  static const String propertyLocality = 'Localidade';
  static const String propertyLocalityRequired = 'Informe a localidade.';
  static const String propertyActivity = 'Atividade principal (opcional)';
  static const String propertyAddress = 'Endereço (opcional)';
  static const String propertyCity = 'Município (opcional)';
  static const String propertyState = 'UF (opcional)';
  static const String propertyCoords = 'Localização';
  static const String propertyNoCoords = 'Sem localização cadastrada.';
  static const String propertyGps = 'Usar GPS agora';
  static const String propertyGpsFail =
      'Não consegui o GPS. Confira a permissão de localização e tente de novo.';
  static const String propertyMap = 'Mapa';
  static const String mapAttribution = 'Imagens: Esri (World Imagery)';

  // Solicitações e agenda
  static const String requestsTitle = 'Solicitações';
  static const String requestsAll = 'Todas';
  static const String requestsEmpty = 'Nenhuma solicitação nesta lista.';
  static const String requestDetail = 'Solicitação';
  static const String requestSubject = 'Assunto';
  static const String requestSubjectRequired = 'Informe o assunto.';
  static const String requestDescription = 'Descrição (opcional)';
  static const String requestPriority = 'Prioridade';
  static const String requestProducer = 'Produtor';
  static const String requestProperty = 'Propriedade (opcional)';
  static const String requestPickProducer = 'Escolha o produtor.';
  static const String requestSave = 'Salvar solicitação';
  static const String requestChangeStatus = 'Mudar status';
  static const String requestMarkInReview = 'Em análise';
  static const String requestSchedule = 'Agendar';
  static const String requestMarkDone = 'Concluir';
  static const String requestScheduledLabel = 'Agendada para';
  static const String requestOpenVisit = 'Registrar visita';
  static const String requestTempBlocked =
      'Esta solicitação ainda não foi enviada. O status poderá ser mudado depois da sincronização.';
  static const String requestAgendaLate = 'Atrasadas';
  static const String requestAgendaToday = 'Hoje';
  static const String requestAgendaUpcoming = 'Próximos dias';
  static const String requestAgendaNoneLate = 'Nenhuma atrasada.';
  static const String requestAgendaNoneToday = 'Nada agendado para hoje.';
  static const String requestAgendaNoneUpcoming =
      'Nada agendado para os próximos dias.';
  static const String statusNew = 'Nova';
  static const String statusInReview = 'Em análise';
  static const String statusScheduled = 'Agendada';
  static const String statusDone = 'Concluída';
  static const String priorityHigh = 'Alta';
  static const String priorityMedium = 'Média';
  static const String priorityLow = 'Baixa';

  // Visita
  static const String visitStepProducer = 'Produtor e propriedade';
  static const String visitStepDiagnosis = 'Diagnóstico';
  static const String visitStepImpact = 'Impacto';
  static const String visitStepPlan = 'Plano de ação';
  static const String visitStepPhotos = 'Fotos';
  static const String visitStepSignature = 'Assinatura';
  static const String visitStepReview = 'Revisão';
  static const String visitDate = 'Data da visita';
  static const String visitDiagnosisLabel = 'Diagnóstico da lavoura';
  static const String visitDiagnosisHint = 'O que foi observado no campo';
  static const String visitDiagnosisRequired =
      'Descreva o diagnóstico para continuar.';
  static const String visitImpactLabel = 'Impacto (opcional)';
  static const String visitImpactHint = 'Efeito do problema na produção';
  static const String visitPlanLabel = 'Plano de ação';
  static const String visitPlanRequired =
      'Descreva o plano de ação para continuar.';
  static const String visitReturnOn = 'Data de retorno (opcional)';
  static const String visitReturnClear = 'Remover data de retorno';
  static const String visitPhotosHint =
      'Até 3 fotos da lavoura. Elas são comprimidas no aparelho.';
  static const String visitAddPhoto = 'Adicionar foto';
  static const String visitPhotoAdded = 'Foto anexada';
  static const String visitRemovePhoto = 'Remover foto';
  static const String visitPhotoLimit = 'Limite de 3 fotos por visita.';
  static const String visitSignatureHint =
      'Peça ao produtor para assinar abaixo (opcional).';
  static const String visitClearSignature = 'Limpar';
  static const String visitConfirmSignature = 'Confirmar assinatura';
  static const String visitSigned = 'Assinatura registrada';
  static const String visitNotSigned = 'Sem assinatura';
  static const String visitGps = 'Localização';
  static const String visitGpsOk = 'Localização registrada';
  static const String visitGpsMissing =
      'Sem localização (permissão negada ou GPS desligado).';
  static const String visitNext = 'Próximo';
  static const String visitBack = 'Voltar';
  static const String visitSave = 'Salvar visita';
  static const String visitSaveConfirm = 'Salvar mesmo assim';
  static const String visitSaved =
      'Visita salva. Ela será enviada assim que houver conexão.';
  static const String visitWarningTitle = 'Salvar a visita?';
  static const String visitWarning =
      'Depois de salvar, a visita não pode ser editada. Confira os dados antes.';
  static const String visitDiscard = 'Descartar';
  static const String visitDiscardTitle = 'Descartar a visita?';
  static const String visitDiscardBody =
      'O rascunho e as fotos deste aparelho serão apagados.';
  static const String visitDetail = 'Visita';
  static const String visitReadOnly = 'Visita salva. Não pode ser editada.';

  // Mensagens das pendências de solicitação
  static const String syncRequestBlocked = 'Aguarde a solicitação ser enviada.';
}
