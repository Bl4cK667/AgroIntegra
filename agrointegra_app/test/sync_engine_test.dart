import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agrointegra_app/core/database/app_database.dart';
import 'package:agrointegra_app/core/sync/sync_engine.dart';
import 'package:agrointegra_app/core/sync/sync_remote.dart';
import 'package:agrointegra_app/core/sync/sync_store.dart';
import 'package:agrointegra_app/core/sync/sync_support.dart';

/// API simulada: cada teste define o que o servidor responde.
class FakeRemote implements SyncRemote {
  final List<List<PushOperation>> pushedBatches = [];
  List<PushOutcome> Function(List<PushOperation> ops)? onPush;
  final List<PullPage> pullPages = [];
  final List<String?> pullSinces = [];
  final List<String> uploadedPhotoIds = [];
  final List<String> restCalls = [];
  Map<String, dynamic> Function(
    String method,
    String path,
    Map<String, dynamic>? body,
  )?
  onRest;

  @override
  Future<Map<String, dynamic>> rest({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    restCalls.add('$method $path');
    return onRest?.call(method, path, body) ?? <String, dynamic>{};
  }

  Object? pushError;

  @override
  Future<List<PushOutcome>> push(List<PushOperation> operations) async {
    pushedBatches.add(operations);
    if (pushError != null) throw pushError!;
    return onPush!(operations);
  }

  @override
  Future<PullPage> pull({String? since, int limit = 200}) async {
    pullSinces.add(since);
    if (pullPages.isEmpty) {
      return PullPage(
        cursor: since ?? 'vazio',
        hasMore: false,
        serverTime: DateTime.now().toUtc(),
        changes: const {},
      );
    }
    return pullPages.removeAt(0);
  }

  @override
  Future<void> uploadPhoto({
    required String visitId,
    required String photoId,
    required String dataUrl,
  }) async {
    uploadedPhotoIds.add(photoId);
  }
}

PushOutcome applied(int index, Map<String, dynamic> record) =>
    PushOutcome(index: index, status: 'applied', record: record);

void main() {
  late AppDatabase db;
  late SyncStore store;
  late FakeRemote remote;
  late bool canSend;

  SyncEngine engine() => SyncEngine(
    remote: remote,
    store: store,
    clock: SyncClock(),
    canSend: () => canSend,
    readPhotoDataUrl: (_) async => 'data:image/jpeg;base64,AAAA',
  );

  Future<void> enqueueProducer(String id, {String name = 'Maria'}) {
    return store.enqueue(
      entity: 'producer',
      entityId: id,
      op: 'upsert',
      payload: {'name': name},
      updatedAt: DateTime.utc(2026, 11, 20, 10),
    );
  }

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    store = SyncStore(db);
    remote = FakeRemote();
    canSend = true;
  });

  tearDown(() async {
    await db.close();
  });

  test(
    'operação aceita sai da fila e o registro vai para o banco local',
    () async {
      await enqueueProducer('p1');
      remote.onPush = (ops) => [
        applied(0, {
          'id': 'p1',
          'updatedAt': '2026-11-20T10:00:00.000Z',
          'name': 'Maria',
        }),
      ];

      final SyncReport report = await engine().run();

      expect(report.applied, 1);
      expect(await store.pendingOpCount(), 0);
      expect((await store.records('producer')).single['name'], 'Maria');
    },
  );

  test('rejeitada pelo conflito: aplica a versão do servidor e avisa o que foi descartado', () async {
    await enqueueProducer('p1', name: 'do aparelho');
    remote.onPush = (ops) => [
      PushOutcome(
        index: 0,
        status: 'rejected',
        message: 'O servidor tem uma alteração mais recente deste produtor.',
        record: {
          'id': 'p1',
          'updatedAt': '2026-11-20T11:00:00.000Z',
          'name': 'do servidor',
        },
      ),
    ];

    final SyncReport report = await engine().run();

    expect(await store.pendingOpCount(), 0);
    expect((await store.records('producer')).single['name'], 'do servidor');
    expect(report.discarded.single, contains('mais recente'));
  });

  test('erro temporário fica na fila com nova tentativa agendada e não é reenviado logo em seguida', () async {
    await enqueueProducer('p1');
    remote.onPush = (ops) => [
      const PushOutcome(
        index: 0,
        status: 'error',
        message: 'Servidor ocupado.',
        retry: true,
      ),
    ];

    final SyncReport report = await engine().run();

    expect(report.failed, 1);
    final entry = (await db.select(db.outbox).get()).single;
    expect(entry.status, 'pending');
    expect(entry.attempts, 1);
    expect(entry.nextAttemptAt, isNotNull);

    await engine().run();
    expect(
      remote.pushedBatches.length,
      1,
      reason: 'a operação ainda está esperando o backoff',
    );
  });

  test('erro definitivo marca a operação como falha e não reenvia', () async {
    await enqueueProducer('p1');
    remote.onPush = (ops) => [
      const PushOutcome(
        index: 0,
        status: 'error',
        message: 'CPF inválido.',
        retry: false,
      ),
    ];

    await engine().run();
    await engine().run();

    final entry = (await db.select(db.outbox).get()).single;
    expect(entry.status, 'failed');
    expect(entry.lastError, 'CPF inválido.');
    expect(remote.pushedBatches.length, 1);
  });

  test('depois de gravar um registro, as operações pendentes dele passam a usar essa versão como base', () async {
    await enqueueProducer('p1');
    await store.enqueue(
      entity: 'producer',
      entityId: 'p1',
      op: 'upsert',
      payload: {'community': 'Serra'},
      updatedAt: DateTime.utc(2026, 11, 20, 10, 5),
    );
    // A segunda operação falha de forma temporária, então fica pendente depois do lote.
    remote.onPush = (ops) => [
      applied(0, {
        'id': 'p1',
        'updatedAt': '2026-11-20T10:01:00.000Z',
        'name': 'Maria',
      }),
      const PushOutcome(index: 1, status: 'error', message: 'Oi', retry: true),
    ];

    await engine().run();

    final entry = (await db.select(db.outbox).get()).single;
    expect(entry.baseUpdatedAt, '2026-11-20T10:01:00.000Z');
  });

  test('envia em lotes de no máximo 50 operações', () async {
    for (int i = 0; i < 120; i++) {
      await enqueueProducer('p$i');
    }
    remote.onPush = (ops) => [
      for (int i = 0; i < ops.length; i++)
        applied(i, {'id': ops[i].id, 'updatedAt': '2026-11-20T10:00:00.000Z'}),
    ];

    final SyncReport report = await engine().run();

    expect(remote.pushedBatches.map((b) => b.length).toList(), [50, 50, 20]);
    expect(report.applied, 120);
    expect(await store.pendingOpCount(), 0);
  });

  test('pull segue as páginas enquanto hasMore, grava o cursor e apaga o que foi excluído', () async {
    await store.upsertRecord('producer', {
      'id': 'p1',
      'updatedAt': '2026-11-19T00:00:00.000Z',
      'name': 'Antiga',
    });
    remote.pullPages.addAll([
      PullPage(
        cursor: 'c1',
        hasMore: true,
        serverTime: DateTime.now().toUtc(),
        changes: {
          'producers': [
            {
              'id': 'p2',
              'updatedAt': '2026-11-20T09:00:00.000Z',
              'name': 'Nova',
            },
          ],
        },
      ),
      PullPage(
        cursor: 'c2',
        hasMore: false,
        serverTime: DateTime.now().toUtc(),
        changes: {
          'producers': [
            {
              'id': 'p1',
              'updatedAt': '2026-11-20T09:30:00.000Z',
              'deletedAt': '2026-11-20T09:30:00.000Z',
            },
          ],
        },
      ),
    ]);

    final SyncReport report = await engine().run();

    expect(report.pulled, 2);
    expect(remote.pullSinces, [null, 'c1']);
    expect((await store.records('producer')).map((r) => r['id']).toList(), [
      'p2',
    ]);
    expect(await store.meta('sync.cursor'), 'c2');
  });

  test(
    'foto só é enviada depois que a visita foi aceita pelo servidor',
    () async {
      await store.enqueue(
        entity: 'visit',
        entityId: 'v1',
        op: 'upsert',
        payload: {'diagnosis': 'x'},
        updatedAt: DateTime.utc(2026, 11, 20, 10),
      );
      await store.enqueuePhoto(
        photoId: 'f1',
        visitId: 'v1',
        filePath: '/tmp/f1.jpg',
      );

      // Visita ainda na fila (erro temporário): a foto não sobe.
      remote.onPush = (ops) => [
        const PushOutcome(
          index: 0,
          status: 'error',
          message: 'Instável',
          retry: true,
        ),
      ];
      await engine().run();
      expect(remote.uploadedPhotoIds, isEmpty);

      // Agora o servidor aceita a visita: a foto sobe na mesma rodada.
      await db
          .update(db.outbox)
          .write(const OutboxCompanion(nextAttemptAt: Value(null)));
      remote.onPush = (ops) => [
        applied(0, {'id': 'v1', 'updatedAt': '2026-11-20T10:00:00.000Z'}),
      ];
      final SyncReport report = await engine().run();

      expect(report.photosSent, 1);
      expect(remote.uploadedPhotoIds, ['f1']);
      expect(await store.pendingPhotoCount(), 0);
    },
  );

  test('sem sessão válida não chama a API e pede login', () async {
    await enqueueProducer('p1');
    canSend = false;

    final SyncReport report = await engine().run();

    expect(report.needsLogin, isTrue);
    expect(remote.pushedBatches, isEmpty);
    expect(await store.pendingOpCount(), 1);
  });

  test('401 do servidor vira "entre de novo" e mantém tudo na fila', () async {
    await enqueueProducer('p1');
    remote.pushError = const SyncHttpException(
      401,
      'Não autorizado',
      retryable: false,
    );

    final SyncReport report = await engine().run();

    expect(report.needsLogin, isTrue);
    expect(await store.pendingOpCount(), 1);
  });

  test('sem conexão vira "offline" e nada se perde', () async {
    await enqueueProducer('p1');
    remote.pushError = const SyncNetworkException();

    final SyncReport report = await engine().run();

    expect(report.offline, isTrue);
    expect(await store.pendingOpCount(), 1);
  });
}
