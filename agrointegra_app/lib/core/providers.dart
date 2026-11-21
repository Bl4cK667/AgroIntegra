import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'database/app_database.dart';
import 'domain/domain_writer.dart';
import 'sync/store_extensions.dart';
import 'sync/sync_controller.dart';
import 'sync/sync_engine.dart';
import 'sync/sync_store.dart';

/// Registros locais de uma entidade ('producer', 'property', 'request', 'visit'), ao vivo.
final recordsProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>((
      ref,
      entity,
    ) async* {
      final SyncStore store = await ref.watch(syncStoreProvider.future);
      yield* store.watchRecords(entity);
    });

/// Escrita de domínio (criar e editar offline).
final domainWriterProvider = FutureProvider<DomainWriter>((ref) async {
  final SyncStore store = await ref.watch(syncStoreProvider.future);
  return DomainWriter(store: store, clock: ref.watch(syncClockProvider));
});

/// Fila REST de solicitações, para mostrar o que ainda não subiu.
final restQueueProvider = StreamProvider<List<RestQueueEntry>>((ref) async* {
  final SyncStore store = await ref.watch(syncStoreProvider.future);
  yield* store.watchRest();
});

/// Dispara uma sincronização em segundo plano depois de uma gravação (sem travar a tela).
void syncInBackground(WidgetRef ref) {
  ref.read(syncControllerProvider.notifier).syncNow();
}
