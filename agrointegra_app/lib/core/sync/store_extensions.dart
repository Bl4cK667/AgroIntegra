import 'dart:convert';

import 'package:drift/drift.dart';

import '../database/app_database.dart';
import 'sync_store.dart';
import 'sync_support.dart';

/// Fila REST (solicitações) no mesmo banco do sync.
extension RestQueueStore on SyncStore {
  Future<void> enqueueRest({
    required String kind,
    required String targetId,
    required Map<String, dynamic> payload,
    required DateTime now,
  }) {
    return db
        .into(db.restQueue)
        .insert(
          RestQueueCompanion.insert(
            kind: kind,
            targetId: targetId,
            payload: jsonEncode(payload),
            createdAt: isoUtc(now),
          ),
        );
  }

  Future<List<RestQueueEntry>> dueRest(DateTime now, {int limit = 20}) {
    final String nowIso = isoUtc(now);
    return (db.select(db.restQueue)
          ..where(
            (t) =>
                t.status.equals('pending') &
                (t.nextAttemptAt.isNull() |
                    t.nextAttemptAt.isSmallerOrEqualValue(nowIso)),
          )
          ..orderBy([(t) => OrderingTerm.asc(t.seq)])
          ..limit(limit))
        .get();
  }

  Future<void> removeRest(int seq) =>
      (db.delete(db.restQueue)..where((t) => t.seq.equals(seq))).go();

  Future<void> updateRest(
    int seq, {
    required String status,
    required int attempts,
    String? lastError,
    DateTime? nextAttemptAt,
  }) {
    return (db.update(db.restQueue)..where((t) => t.seq.equals(seq))).write(
      RestQueueCompanion(
        status: Value(status),
        attempts: Value(attempts),
        lastError: Value(lastError),
        nextAttemptAt: Value(
          nextAttemptAt == null ? null : isoUtc(nextAttemptAt),
        ),
      ),
    );
  }

  /// Quando a solicitação criada offline ganha o id do servidor, as chamadas pendentes dela passam a usar o novo id.
  Future<void> retargetRest(String oldId, String newId) {
    return (db.update(db.restQueue)..where((t) => t.targetId.equals(oldId)))
        .write(RestQueueCompanion(targetId: Value(newId)));
  }

  Stream<List<RestQueueEntry>> watchRest() {
    return (db.select(
      db.restQueue,
    )..orderBy([(t) => OrderingTerm.asc(t.seq)])).watch();
  }

  /// Há operação de sync pendente para este registro? (usado para esperar o produtor antes da solicitação.)
  Future<bool> hasPendingEntity(String entity, String id) async {
    final OutboxEntry? row =
        await (db.select(db.outbox)
              ..where((t) => t.entity.equals(entity) & t.entityId.equals(id)))
            .getSingleOrNull();
    return row != null;
  }
}

/// Lista ao vivo de registros de uma entidade (a UI atualiza sozinha quando o banco muda).
extension RecordWatch on SyncStore {
  Stream<List<Map<String, dynamic>>> watchRecords(String entity) {
    return (db.select(
      db.localRecords,
    )..where((t) => t.entity.equals(entity))).watch().map(
      (rows) =>
          rows.map((r) => jsonDecode(r.data) as Map<String, dynamic>).toList(),
    );
  }
}

/// Rascunho da visita, salvo a cada mudança.
extension DraftStore on SyncStore {
  Future<void> saveDraft(
    String draftId,
    Map<String, dynamic> data,
    DateTime now,
  ) {
    return db
        .into(db.visitDrafts)
        .insertOnConflictUpdate(
          VisitDraftsCompanion.insert(
            draftId: draftId,
            data: jsonEncode(data),
            updatedAt: isoUtc(now),
          ),
        );
  }

  Future<Map<String, dynamic>?> loadDraft(String draftId) async {
    final VisitDraftEntry? row = await (db.select(
      db.visitDrafts,
    )..where((t) => t.draftId.equals(draftId))).getSingleOrNull();
    if (row == null) return null;
    return jsonDecode(row.data) as Map<String, dynamic>;
  }

  Future<void> deleteDraft(String draftId) =>
      (db.delete(db.visitDrafts)..where((t) => t.draftId.equals(draftId))).go();

  Future<List<VisitDraftEntry>> allDrafts() => db.select(db.visitDrafts).get();
}
