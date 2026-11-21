import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../auth/auth_controller.dart';
import '../database/app_database.dart';
import 'sync_engine.dart';
import 'sync_store.dart';

part 'sync_controller.g.dart';

enum SyncPhase { idle, syncing, upToDate, pending, offline, needsLogin, error }

class SyncStatus {
  const SyncStatus({
    required this.phase,
    this.pendingCount = 0,
    this.lastSyncAt,
    this.message,
  });

  final SyncPhase phase;
  final int pendingCount;
  final DateTime? lastSyncAt;
  final String? message;
}

/// Dispara a sincronização (ao desbloquear, ao voltar a internet e pelo botão) e guarda o status para a UI.
@Riverpod(keepAlive: true)
class SyncController extends _$SyncController {
  @override
  SyncStatus build() {
    ref.listen(authProvider, (previous, next) {
      final bool wasUnlocked = previous?.status == AuthStatus.unlocked;
      if (next.status == AuthStatus.unlocked && !wasUnlocked) {
        unawaited(syncNow());
      }
    });

    final StreamSubscription<List<ConnectivityResult>>? subscription =
        _watchConnectivity();
    ref.onDispose(() => subscription?.cancel());

    return const SyncStatus(phase: SyncPhase.idle);
  }

  StreamSubscription<List<ConnectivityResult>>? _watchConnectivity() {
    try {
      return Connectivity().onConnectivityChanged.listen((results) {
        if (!results.contains(ConnectivityResult.none)) {
          unawaited(syncNow());
        }
      });
    } on Object {
      // Sem o plugin (ex.: testes), a sincronização continua pelo botão.
      return null;
    }
  }

  Future<void> syncNow() async {
    if (state.phase == SyncPhase.syncing) return;
    final SyncEngine engine = await ref.read(syncEngineProvider.future);
    final SyncStore store = await ref.read(syncStoreProvider.future);

    state = SyncStatus(
      phase: SyncPhase.syncing,
      pendingCount: state.pendingCount,
      lastSyncAt: state.lastSyncAt,
    );

    final SyncReport report = await engine.run();
    final int pending =
        await store.pendingOpCount() + await store.pendingPhotoCount();
    final DateTime? lastSyncAt =
        (report.busy ||
            report.error != null ||
            report.offline ||
            report.needsLogin)
        ? state.lastSyncAt
        : DateTime.now();

    state = SyncStatus(
      phase: _phaseFor(report, pending),
      pendingCount: pending,
      lastSyncAt: lastSyncAt,
      message:
          report.error ??
          (report.discarded.isEmpty ? null : report.discarded.join('\n')),
    );
  }

  SyncPhase _phaseFor(SyncReport report, int pending) {
    if (report.busy) return SyncPhase.syncing;
    if (report.needsLogin) return SyncPhase.needsLogin;
    if (report.offline) return SyncPhase.offline;
    if (report.error != null) return SyncPhase.error;
    if (pending > 0) return SyncPhase.pending;
    return SyncPhase.upToDate;
  }
}

/// Operações pendentes (para a tela de pendências). Atualiza sozinha quando a fila muda.
// Escrito à mão (sem gerador): o gerador não consegue resolver o tipo gerado pelo drift aqui.
final StreamProvider<List<OutboxEntry>> pendingOpsProvider =
    StreamProvider<List<OutboxEntry>>((ref) async* {
      final SyncStore store = await ref.watch(syncStoreProvider.future);
      yield* store.watchOps();
    });
