import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../auth/session.dart';
import '../database/app_database.dart';
import '../network/api_client.dart';
import 'sync_remote.dart';
import 'store_extensions.dart';
import 'sync_store.dart';
import 'sync_support.dart';

part 'sync_engine.g.dart';

const String _cursorKey = 'sync.cursor';
const int maxPushBatch = 50;
const int maxPullPageLimit = 200;

/// Ordem de aplicação no pull: pais antes dos filhos.
/// Chave = nome no pull (plural); valor = nome local, igual ao das operações de envio (singular).
const Map<String, String> _pullOrder = {
  'producers': 'producer',
  'properties': 'property',
  'requests': 'request',
  'visits': 'visit',
  'features': 'feature',
};

class SyncReport {
  const SyncReport({
    this.applied = 0,
    this.discarded = const [],
    this.failed = 0,
    this.photosSent = 0,
    this.pulled = 0,
    this.restSent = 0,
    this.needsLogin = false,
    this.offline = false,
    this.busy = false,
    this.error,
  });

  final int applied;
  final List<String> discarded;
  final int failed;
  final int photosSent;
  final int pulled;
  final int restSent;
  final bool needsLogin;
  final bool offline;
  final bool busy;
  final String? error;
}

/// Motor do ciclo: push da fila (lotes de 50) → fotos das visitas aceitas → pull paginado.
class SyncEngine {
  SyncEngine({
    required this.remote,
    required this.store,
    required this.clock,
    required this.canSend,
    required this.readPhotoDataUrl,
    Random? random,
  }) : _random = random ?? Random();

  final SyncRemote remote;
  final SyncStore store;
  final SyncClock clock;
  final bool Function() canSend;
  final Future<String> Function(String filePath) readPhotoDataUrl;
  final Random _random;

  bool _running = false;
  int _restFailed = 0;

  Future<SyncReport> run() async {
    if (_running) return const SyncReport(busy: true);
    // Sem sessão válida não há o que enviar nem puxar: o técnico precisa entrar de novo.
    if (!canSend()) return const SyncReport(needsLogin: true);

    _running = true;
    _restFailed = 0;
    try {
      final _PushTotals push = await _pushAll();
      final int restSent = await _flushRest();
      final int photos = await _uploadPhotos();
      final int pulled = await _pullAll();
      return SyncReport(
        applied: push.applied,
        discarded: push.discarded,
        failed: push.failed + _restFailed,
        photosSent: photos,
        pulled: pulled,
        restSent: restSent,
      );
    } on SyncHttpException catch (e) {
      if (e.statusCode == 401) return const SyncReport(needsLogin: true);
      return SyncReport(error: e.message);
    } on SyncNetworkException {
      return const SyncReport(offline: true);
    } finally {
      _running = false;
    }
  }

  // ---------- push ----------

  Future<_PushTotals> _pushAll() async {
    int applied = 0;
    int failed = 0;
    final List<String> discarded = [];

    while (true) {
      final List<OutboxEntry> batch = await store.dueOps(
        clock.nowUtc(),
        limit: maxPushBatch,
      );
      if (batch.isEmpty) break;

      final List<PushOutcome> outcomes = await remote.push([
        for (final OutboxEntry e in batch)
          PushOperation(
            entity: e.entity,
            id: e.entityId,
            op: e.op,
            updatedAt: e.updatedAt,
            baseUpdatedAt: e.baseUpdatedAt,
            data: jsonDecode(e.payload) as Map<String, dynamic>,
          ),
      ]);
      final Map<int, PushOutcome> byIndex = {
        for (final o in outcomes) o.index: o,
      };

      for (int i = 0; i < batch.length; i++) {
        final OutboxEntry entry = batch[i];
        final PushOutcome? outcome = byIndex[i];

        if (outcome == null) {
          await _scheduleOpRetry(entry, 'Resposta incompleta do servidor.');
          failed++;
          continue;
        }

        switch (outcome.status) {
          case 'applied':
          case 'duplicate':
            await store.removeOp(entry.seq);
            await _applyServerRecord(entry, outcome.record);
            applied++;
          case 'rejected':
            // O servidor ficou com a versão dele: descarta a do aparelho e avisa.
            await store.removeOp(entry.seq);
            await _applyServerRecord(entry, outcome.record);
            discarded.add(
              outcome.message ?? 'Uma alteração foi descartada porque o servidor tem uma versão mais recente.',
            );
          case 'error':
            if (outcome.retry) {
              await _scheduleOpRetry(entry, outcome.message);
              failed++;
            } else {
              await store.updateOp(
                entry.seq,
                status: 'failed',
                attempts: entry.attempts + 1,
                lastError:
                    outcome.message ?? 'O servidor recusou esta alteração.',
              );
              failed++;
            }
          default:
            await _scheduleOpRetry(entry, 'Resposta inesperada do servidor.');
            failed++;
        }
      }
    }
    return _PushTotals(applied: applied, failed: failed, discarded: discarded);
  }

  Future<void> _applyServerRecord(
    OutboxEntry entry,
    Map<String, dynamic>? record,
  ) async {
    if (record == null) return;
    await _applyRecord(entry.entity, record);
    final String? stamp = record['updatedAt'] as String?;
    if (stamp != null) {
      await store.rebaseOps(entry.entity, entry.entityId, stamp);
    }
  }

  Future<void> _scheduleOpRetry(OutboxEntry entry, String? message) {
    final int attempts = entry.attempts + 1;
    final DateTime next = clock.nowUtc().add(
      Backoff.delayFor(attempts, _random),
    );
    return store.updateOp(
      entry.seq,
      status: 'pending',
      attempts: attempts,
      lastError: message,
      nextAttemptAt: next,
    );
  }

  // ---------- fila REST (solicitações) ----------

  Future<int> _flushRest() async {
    int sent = 0;
    while (true) {
      final List<RestQueueEntry> batch = await store.dueRest(clock.nowUtc());
      if (batch.isEmpty) break;

      for (final RestQueueEntry entry in batch) {
        final Map<String, dynamic> payload =
            jsonDecode(entry.payload) as Map<String, dynamic>;

        // Solicitação de um produtor que ainda não subiu: espera o produtor (o servidor não a aceitaria).
        final String? producerId = payload['producerId'] as String?;
        if (entry.kind == 'createRequest' &&
            producerId != null &&
            await store.hasPendingEntity('producer', producerId)) {
          // Adia a própria tentativa: sem isso a mesma solicitação voltaria na consulta seguinte e o laço não terminaria.
          await store.updateRest(
            entry.seq,
            status: 'pending',
            attempts: entry.attempts,
            lastError: 'Aguardando o produtor ser enviado.',
            nextAttemptAt: clock.nowUtc().add(const Duration(seconds: 30)),
          );
          continue;
        }

        final String method;
        final String path;
        switch (entry.kind) {
          case 'createRequest':
            method = 'POST';
            path = '/requests';
          case 'requestStatus':
            method = 'PATCH';
            path = '/requests/${entry.targetId}/status';
          case 'requestPriority':
            method = 'PATCH';
            path = '/requests/${entry.targetId}/priority';
          default:
            await store.removeRest(entry.seq);
            continue;
        }

        try {
          final Map<String, dynamic> response = await remote.rest(
            method: method,
            path: path,
            body: payload,
          );
          await store.removeRest(entry.seq);
          if (entry.kind == 'createRequest') {
            // O id do servidor substitui o temporário; a versão completa chega no próximo pull.
            await store.deleteRecord('request', entry.targetId);
            final String? serverId = response['id'] as String?;
            if (serverId != null) {
              await store.retargetRest(entry.targetId, serverId);
            }
          }
          sent++;
        } on SyncHttpException catch (e) {
          if (e.statusCode == 401) rethrow;
          final int attempts = entry.attempts + 1;
          if (e.retryable) {
            await store.updateRest(
              entry.seq,
              status: 'pending',
              attempts: attempts,
              lastError: e.message,
              nextAttemptAt: clock.nowUtc().add(
                Backoff.delayFor(attempts, _random),
              ),
            );
          } else {
            // Recusada pelo servidor (ex.: dados inválidos): fica para o técnico ver nas pendências.
            await store.updateRest(
              entry.seq,
              status: 'failed',
              attempts: attempts,
              lastError: e.message,
            );
            _restFailed++;
          }
        }
      }
    }
    return sent;
  }

  // ---------- fotos ----------

  Future<int> _uploadPhotos() async {
    int sent = 0;
    while (true) {
      final List<PhotoOutboxEntry> batch = await store.duePhotos(
        clock.nowUtc(),
      );
      if (batch.isEmpty) break;

      for (final PhotoOutboxEntry photo in batch) {
        final String dataUrl;
        try {
          dataUrl = await readPhotoDataUrl(photo.filePath);
        } on FileSystemException {
          // Arquivo sumiu do aparelho: não adianta tentar de novo.
          await store.updatePhoto(
            photo.seq,
            status: 'failed',
            attempts: photo.attempts + 1,
            lastError: 'A foto não está mais no aparelho.',
          );
          continue;
        }

        try {
          await remote.uploadPhoto(
            visitId: photo.visitId,
            photoId: photo.photoId,
            dataUrl: dataUrl,
          );
          await store.removePhoto(photo.seq);
          sent++;
        } on SyncHttpException catch (e) {
          if (e.statusCode == 401) rethrow;
          final int attempts = photo.attempts + 1;
          if (e.retryable) {
            await store.updatePhoto(
              photo.seq,
              status: 'pending',
              attempts: attempts,
              lastError: e.message,
              nextAttemptAt: clock.nowUtc().add(
                Backoff.delayFor(attempts, _random),
              ),
            );
          } else {
            await store.updatePhoto(
              photo.seq,
              status: 'failed',
              attempts: attempts,
              lastError: e.message,
            );
          }
        }
      }
    }
    return sent;
  }

  // ---------- pull ----------

  Future<int> _pullAll() async {
    int count = 0;
    String cursor = await store.meta(_cursorKey) ?? '';

    while (true) {
      final PullPage page = await remote.pull(
        since: cursor.isEmpty ? null : cursor,
        limit: maxPullPageLimit,
      );
      clock.adjustTo(page.serverTime);

      for (final MapEntry<String, String> pair in _pullOrder.entries) {
        for (final Map<String, dynamic> record
            in page.changes[pair.key] ?? const []) {
          await _applyRecord(pair.value, record);
          count++;
        }
      }

      // O cursor só avança depois da página gravada: se cair no meio, a página se repete sem perda.
      cursor = page.cursor;
      await store.setMeta(_cursorKey, cursor);
      if (!page.hasMore) break;
    }
    return count;
  }

  Future<void> _applyRecord(String entity, Map<String, dynamic> record) {
    if (record['deletedAt'] != null) {
      return store.deleteRecord(entity, record['id'] as String);
    }
    return store.upsertRecord(entity, record);
  }
}

class _PushTotals {
  const _PushTotals({
    required this.applied,
    required this.failed,
    required this.discarded,
  });

  final int applied;
  final int failed;
  final List<String> discarded;
}

@Riverpod(keepAlive: true)
Future<SyncStore> syncStore(Ref ref) async {
  final AppDatabase db = await ref.watch(appDatabaseProvider.future);
  return SyncStore(db);
}

@Riverpod(keepAlive: true)
SyncClock syncClock(Ref ref) => SyncClock();

@Riverpod(keepAlive: true)
Future<SyncEngine> syncEngine(Ref ref) async {
  final SyncStore store = await ref.watch(syncStoreProvider.future);
  return SyncEngine(
    remote: ref.watch(syncRemoteProvider),
    store: store,
    clock: ref.watch(syncClockProvider),
    canSend: () {
      final Session? session = ref.read(sessionHolderProvider).current;
      return session != null && session.hasOrganization && !session.isExpired;
    },
    readPhotoDataUrl: (path) async {
      final List<int> bytes = await File(path).readAsBytes();
      return 'data:image/jpeg;base64,${base64Encode(bytes)}';
    },
  );
}
