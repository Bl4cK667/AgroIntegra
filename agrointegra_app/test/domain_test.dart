import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agrointegra_app/core/database/app_database.dart';
import 'package:agrointegra_app/core/domain/domain_writer.dart';
import 'package:agrointegra_app/core/domain/text_utils.dart';
import 'package:agrointegra_app/core/sync/sync_engine.dart';
import 'package:agrointegra_app/core/sync/sync_remote.dart';
import 'package:agrointegra_app/core/sync/sync_store.dart';
import 'package:agrointegra_app/core/sync/sync_support.dart';

class _Remote implements SyncRemote {
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

  @override
  Future<List<PushOutcome>> push(List<PushOperation> operations) async => [
    for (int i = 0; i < operations.length; i++)
      PushOutcome(
        index: i,
        status: 'error',
        message: 'Servidor ocupado.',
        retry: true,
      ),
  ];

  @override
  Future<PullPage> pull({String? since, int limit = 200}) async => PullPage(
    cursor: since ?? 'vazio',
    hasMore: false,
    serverTime: DateTime.now().toUtc(),
    changes: const {},
  );

  @override
  Future<void> uploadPhoto({
    required String visitId,
    required String photoId,
    required String dataUrl,
  }) async {}
}

void main() {
  group('texto e CPF', () {
    test('busca ignora acento e caixa', () {
      expect(normalizeForSearch('João Ribeirão'), 'joao ribeirao');
    });

    test('CPF válido e inválido', () {
      expect(isValidCpf('529.982.247-25'), isTrue);
      expect(isValidCpf('529.982.247-26'), isFalse);
      expect(isValidCpf('111.111.111-11'), isFalse);
    });

    test('máscara nunca mostra o CPF completo', () {
      expect(maskCpf('52998224725'), '***.982.247-**');
    });

    test('data no formato da API', () {
      expect(dayString(DateTime(2026, 3, 5)), '2026-03-05');
      expect(displayDay('2026-03-05'), '05/03/2026');
    });
  });

  late AppDatabase db;
  late SyncStore store;
  late DomainWriter writer;
  late _Remote remote;
  final SyncClock clock = SyncClock();

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    store = SyncStore(db);
    writer = DomainWriter(store: store, clock: clock);
    remote = _Remote();
  });

  tearDown(() async => db.close());

  SyncEngine engine() => SyncEngine(
    remote: remote,
    store: store,
    clock: clock,
    canSend: () => true,
    readPhotoDataUrl: (_) async => '',
  );

  test('produtor criado offline: CPF vai completo só na operação, e na tela fica mascarado', () async {
    final String id = await writer.createProducer(
      name: 'Maria',
      cpf: '529.982.247-25',
      community: 'Serra',
      consent: true,
    );

    final OutboxEntry op = (await db.select(db.outbox).get()).single;
    expect(op.entity, 'producer');
    expect(op.entityId, id);
    expect(op.payload, contains('"cpf":"52998224725"'));

    final Map<String, dynamic> shown = (await store.records('producer')).single;
    expect(shown['cpf'], '***.982.247-**');
  });

  test('editar produtor envia só o que mudou, sem CPF', () async {
    final String id = await writer.createProducer(
      name: 'Maria',
      cpf: '52998224725',
      community: 'Serra',
      consent: true,
    );
    final Map<String, dynamic> current = (await store.records('producer'))
        .single;
    await writer.updateProducer(current, community: 'Vale');

    final List<OutboxEntry> ops = await db.select(db.outbox).get();
    expect(ops.last.payload, '{"community":"Vale"}');
    expect(ops.last.entityId, id);
    expect(
      ops.last.baseUpdatedAt,
      isNull,
      reason: 'criado no aparelho: sem versão do servidor ainda',
    );
  });

  test(
    'solicitação criada offline entra na fila REST com id temporário',
    () async {
      final String producer = await writer.createProducer(
        name: 'Maria',
        cpf: '52998224725',
        community: 'Serra',
        consent: true,
      );
      final String tempId = await writer.createRequest(
        producerId: producer,
        subject: 'Praga no milho',
        priority: 'HIGH',
      );

      expect(DomainWriter.isLocalId(tempId), isTrue);
      expect(
        (await db.select(db.restQueue).get()).single.kind,
        'createRequest',
      );
    },
  );

  test('não muda status de solicitação que ainda não foi enviada', () async {
    final String producer = await writer.createProducer(
      name: 'Maria',
      cpf: '52998224725',
      community: 'Serra',
      consent: true,
    );
    final String tempId = await writer.createRequest(
      producerId: producer,
      subject: 'Praga',
      priority: 'LOW',
    );
    final Map<String, dynamic> current = (await store.records('request'))
        .single;

    expect(
      () => writer.changeRequestStatus(current, status: 'DONE'),
      throwsA(isA<StateError>()),
    );
    expect(tempId, current['id']);
  });

  test('solicitação espera o produtor subir antes de ser enviada', () async {
    final String producer = await writer.createProducer(
      name: 'Maria',
      cpf: '52998224725',
      community: 'Serra',
      consent: true,
    );
    await writer.createRequest(
      producerId: producer,
      subject: 'Praga',
      priority: 'LOW',
    );

    await engine().run();

    expect(
      remote.restCalls,
      isEmpty,
      reason: 'o produtor ainda está pendente de envio',
    );
    expect((await db.select(db.restQueue).get()).single.status, 'pending');
  });

  test('depois que o servidor aceita a solicitação, o id temporário é trocado pelo do servidor', () async {
    // Produtor já enviado: some da fila de operações.
    final String producer = await writer.createProducer(
      name: 'Maria',
      cpf: '52998224725',
      community: 'Serra',
      consent: true,
    );
    await db.delete(db.outbox).go();

    final String tempId = await writer.createRequest(
      producerId: producer,
      subject: 'Praga',
      priority: 'LOW',
    );
    remote.onRest = (method, path, body) => {'id': 'srv-1', 'status': 'NEW'};

    await engine().run();

    expect(remote.restCalls, ['POST /requests']);
    expect(await db.select(db.restQueue).get(), isEmpty);
    final List<Map<String, dynamic>> requests = await store.records('request');
    expect(requests.where((r) => r['id'] == tempId), isEmpty);
  });
}
