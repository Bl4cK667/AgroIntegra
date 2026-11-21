import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../database/app_database.dart';
import 'sync_support.dart';

/// Acesso do motor de sincronização ao banco local.
class SyncStore {
  SyncStore(this.db);

  final AppDatabase db;
  static const Uuid _uuid = Uuid();

  // ---------- metadados ----------

  Future<String?> meta(String key) async {
    final AppMetaData? row = await (db.select(
      db.appMeta,
    )..where((t) => t.key.equals(key))).getSingleOrNull();
    return row?.value;
  }

  Future<void> setMeta(String key, String value) => db
      .into(db.appMeta)
      .insertOnConflictUpdate(AppMetaCompanion.insert(key: key, value: value));

  // ---------- registros recebidos (pull) ----------

  Future<void> upsertRecord(String entity, Map<String, dynamic> record) {
    return db
        .into(db.localRecords)
        .insertOnConflictUpdate(
          LocalRecordsCompanion.insert(
            entity: entity,
            id: record['id'] as String,
            updatedAt: record['updatedAt'] as String,
            data: jsonEncode(record),
          ),
        );
  }

  Future<void> deleteRecord(String entity, String id) {
    return (db.delete(
      db.localRecords,
    )..where((t) => t.entity.equals(entity) & t.id.equals(id))).go();
  }

  Future<List<Map<String, dynamic>>> records(String entity) async {
    final List<LocalRecord> rows = await (db.select(
      db.localRecords,
    )..where((t) => t.entity.equals(entity))).get();
    return rows.map((r) => jsonDecode(r.data) as Map<String, dynamic>).toList();
  }

  // ---------- fila de operações (push) ----------

  Future<void> enqueue({
    required String entity,
    required String entityId,
    required String op,
    required Map<String, dynamic> payload,
    required DateTime updatedAt,
    String? baseUpdatedAt,
  }) {
    return db
        .into(db.outbox)
        .insert(
          OutboxCompanion.insert(
            opId: _uuid.v4(),
            entity: entity,
            entityId: entityId,
            op: op,
            payload: jsonEncode(payload),
            updatedAt: isoUtc(updatedAt),
            baseUpdatedAt: Value(baseUpdatedAt),
          ),
        );
  }

  /// Operações pendentes que já podem ser enviadas, na ordem de criação.
  Future<List<OutboxEntry>> dueOps(DateTime now, {int limit = 50}) {
    final String nowIso = isoUtc(now);
    return (db.select(db.outbox)
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

  Future<void> removeOp(int seq) =>
      (db.delete(db.outbox)..where((t) => t.seq.equals(seq))).go();

  Future<void> updateOp(
    int seq, {
    required String status,
    required int attempts,
    String? lastError,
    DateTime? nextAttemptAt,
  }) {
    return (db.update(db.outbox)..where((t) => t.seq.equals(seq))).write(
      OutboxCompanion(
        status: Value(status),
        attempts: Value(attempts),
        lastError: Value(lastError),
        nextAttemptAt: Value(
          nextAttemptAt == null ? null : isoUtc(nextAttemptAt),
        ),
      ),
    );
  }

  /// Depois de um registro ser gravado no servidor, as operações pendentes dele passam a usar essa versão como base.
  Future<void> rebaseOps(String entity, String entityId, String updatedAt) {
    return (db.update(db.outbox)..where(
          (t) =>
              t.entity.equals(entity) &
              t.entityId.equals(entityId) &
              t.status.equals('pending'),
        ))
        .write(OutboxCompanion(baseUpdatedAt: Value(updatedAt)));
  }

  Stream<List<OutboxEntry>> watchOps() {
    return (db.select(
      db.outbox,
    )..orderBy([(t) => OrderingTerm.asc(t.seq)])).watch();
  }

  Future<int> pendingOpCount() async {
    final List<OutboxEntry> rows = await db.select(db.outbox).get();
    return rows.length;
  }

  Future<bool> hasPendingVisit(String visitId) async {
    final OutboxEntry? row =
        await (db.select(db.outbox)..where(
              (t) => t.entity.equals('visit') & t.entityId.equals(visitId),
            ))
            .getSingleOrNull();
    return row != null;
  }

  // ---------- fila de fotos ----------

  Future<void> enqueuePhoto({
    required String photoId,
    required String visitId,
    required String filePath,
  }) {
    return db
        .into(db.photoOutbox)
        .insert(
          PhotoOutboxCompanion.insert(
            photoId: photoId,
            visitId: visitId,
            filePath: filePath,
          ),
        );
  }

  /// Fotos prontas para envio: a visita já foi aceita pelo servidor (não está mais na fila de operações).
  Future<List<PhotoOutboxEntry>> duePhotos(
    DateTime now, {
    int limit = 10,
  }) async {
    final String nowIso = isoUtc(now);
    final List<PhotoOutboxEntry> candidates =
        await (db.select(db.photoOutbox)
              ..where(
                (t) =>
                    t.status.equals('pending') &
                    (t.nextAttemptAt.isNull() |
                        t.nextAttemptAt.isSmallerOrEqualValue(nowIso)),
              )
              ..orderBy([(t) => OrderingTerm.asc(t.seq)])
              ..limit(limit))
            .get();

    final List<PhotoOutboxEntry> ready = [];
    for (final PhotoOutboxEntry photo in candidates) {
      if (!await hasPendingVisit(photo.visitId)) ready.add(photo);
    }
    return ready;
  }

  Future<void> removePhoto(int seq) =>
      (db.delete(db.photoOutbox)..where((t) => t.seq.equals(seq))).go();

  Future<void> updatePhoto(
    int seq, {
    required String status,
    required int attempts,
    String? lastError,
    DateTime? nextAttemptAt,
  }) {
    return (db.update(db.photoOutbox)..where((t) => t.seq.equals(seq))).write(
      PhotoOutboxCompanion(
        status: Value(status),
        attempts: Value(attempts),
        lastError: Value(lastError),
        nextAttemptAt: Value(
          nextAttemptAt == null ? null : isoUtc(nextAttemptAt),
        ),
      ),
    );
  }

  Future<int> pendingPhotoCount() async {
    final List<PhotoOutboxEntry> rows = await db.select(db.photoOutbox).get();
    return rows.length;
  }
}
