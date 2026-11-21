import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';

import '../auth/session_store.dart';
import '../network/api_client.dart';
import '../security/key_value_store.dart';
import 'sync_engine.dart';

const String _uniqueName = 'agrointegra-sync-periodico';
const String _taskName = 'agrointegra-sync';

/// Ponto de entrada do segundo plano. Roda em outro isolate, então monta o próprio container.
@pragma('vm:entry-point')
void syncBackgroundDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    WidgetsFlutterBinding.ensureInitialized();
    final ProviderContainer container = ProviderContainer();
    try {
      // Sem sessão salva, não há o que enviar: nada a fazer até o técnico entrar.
      final session = await SessionStore(SecureKeyValueStore()).readSession();
      if (session == null) return true;

      container.read(sessionHolderProvider).current = session;
      final SyncEngine engine = await container.read(syncEngineProvider.future);
      await engine.run();
      return true;
    } on Object {
      // Falha inesperada: o sistema tenta de novo depois.
      return false;
    } finally {
      container.dispose();
    }
  });
}

/// Liga a sincronização periódica (a cada 15 min, só com rede).
///
/// Só no Android: no iOS, o segundo plano depende de configuração nativa (BGTaskScheduler)
/// que ainda não foi validada em aparelho físico. Lá a sincronização roda ao abrir o app,
/// ao voltar a internet e pelo botão.
Future<void> startBackgroundSync() async {
  if (!Platform.isAndroid) return;
  await Workmanager().initialize(syncBackgroundDispatcher);
  await Workmanager().registerPeriodicTask(
    _uniqueName,
    _taskName,
    frequency: const Duration(minutes: 15),
    constraints: Constraints(networkType: NetworkType.connected),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
  );
}
