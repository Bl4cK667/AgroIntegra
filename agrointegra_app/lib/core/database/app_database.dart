import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../security/database_key_store.dart';

part 'app_database.g.dart';

/// Metadados locais: cursor do pull, deslocamento do relógio, etc.
class AppMeta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column<Object>> get primaryKey => {key};
}

/// Cópia local dos registros recebidos no pull (JSON). A UI lê daqui.
@DataClassName('LocalRecord')
class LocalRecords extends Table {
  TextColumn get entity => text()();
  TextColumn get id => text()();
  TextColumn get updatedAt => text()();
  TextColumn get data => text()();

  @override
  Set<Column<Object>> get primaryKey => {entity, id};
}

/// Operações pendentes de envio, na ordem em que foram criadas.
@DataClassName('OutboxEntry')
class Outbox extends Table {
  IntColumn get seq => integer().autoIncrement()();
  TextColumn get opId => text().unique()();
  TextColumn get entity => text()();
  TextColumn get entityId => text()();
  TextColumn get op => text()();
  TextColumn get payload => text()();
  TextColumn get updatedAt => text()();
  TextColumn get baseUpdatedAt => text().nullable()();
  // pending: será enviada. failed: erro definitivo, espera ação do técnico.
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  TextColumn get nextAttemptAt => text().nullable()();
}

/// Fotos de visita a enviar depois que a visita for aceita pelo servidor.
@DataClassName('PhotoOutboxEntry')
class PhotoOutbox extends Table {
  IntColumn get seq => integer().autoIncrement()();
  TextColumn get photoId => text().unique()();
  TextColumn get visitId => text()();
  TextColumn get filePath => text()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  TextColumn get nextAttemptAt => text().nullable()();
}

/// Chamadas REST que não passam pelo sync (solicitações): criar, mudar status e prioridade.
@DataClassName('RestQueueEntry')
class RestQueue extends Table {
  IntColumn get seq => integer().autoIncrement()();
  // createRequest | requestStatus | requestPriority
  TextColumn get kind => text()();
  // Id da solicitação (local, se ainda não foi criada no servidor).
  TextColumn get targetId => text()();
  TextColumn get payload => text()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  TextColumn get nextAttemptAt => text().nullable()();
  TextColumn get createdAt => text()();
}

/// Rascunho da visita: salvo a cada mudança, para retomar depois de fechar o app à força.
@DataClassName('VisitDraftEntry')
class VisitDrafts extends Table {
  TextColumn get draftId => text()();
  TextColumn get data => text()();
  TextColumn get updatedAt => text()();

  @override
  Set<Column<Object>> get primaryKey => {draftId};
}

@DriftDatabase(
  tables: [AppMeta, LocalRecords, Outbox, PhotoOutbox, RestQueue, VisitDrafts],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) => m.createAll(),
    onUpgrade: (Migrator m, int from, int to) async {
      if (from < 2) {
        await m.createTable(localRecords);
        await m.createTable(outbox);
        await m.createTable(photoOutbox);
      }
      if (from < 3) {
        await m.createTable(restQueue);
        await m.createTable(visitDrafts);
      }
    },
  );
}

/// Banco criptografado (SQLCipher). A chave é aplicada logo ao abrir.
@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(Ref ref) async {
  final String key = await ref.watch(databaseKeyStoreProvider).loadOrCreate();

  final AppDatabase db = AppDatabase(
    driftDatabase(
      name: 'agrointegra',
      native: DriftNativeOptions(
        setup: (db) => db.execute("PRAGMA key = \"x'$key'\";"),
      ),
    ),
  );
  ref.onDispose(db.close);
  return db;
}
