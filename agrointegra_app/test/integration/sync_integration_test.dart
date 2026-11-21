// Teste de integração contra a API local (npm run dev na raiz do monorepo).
// Só roda com: flutter test test/integration --dart-define=INTEGRATION=true
// Cria registros com o prefixo "TESTE APP" na organização de demonstração.
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agrointegra_app/core/database/app_database.dart';
import 'package:agrointegra_app/core/domain/domain_writer.dart';
import 'package:agrointegra_app/core/sync/sync_engine.dart';
import 'package:agrointegra_app/core/sync/sync_remote.dart';
import 'package:agrointegra_app/core/sync/sync_store.dart';
import 'package:agrointegra_app/core/sync/sync_support.dart';

import 'sync_integration_helpers.dart';

const bool integration = bool.fromEnvironment('INTEGRATION');
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:3001',
);

// PNG 1x1 válido, para o teste de foto.
const String _pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

void main() {
  test('sincronização completa contra a API real', skip: integration ? false : 'defina --dart-define=INTEGRATION=true', () async {
    final Dio plain = Dio(BaseOptions(baseUrl: apiUrl));
    final session = await loginDemo(plain);
    final Dio authed = Dio(
      BaseOptions(
        baseUrl: apiUrl,
        headers: {
          'Authorization': 'Bearer ${session.token}',
          'X-Organization-Id': session.orgId,
        },
      ),
    );

    final AppDatabase db = AppDatabase(NativeDatabase.memory());
    addTearDown(db.close);
    final SyncStore store = SyncStore(db);
    final SyncClock clock = SyncClock();
    final DomainWriter writer = DomainWriter(store: store, clock: clock);
    final DioSyncRemote remote = DioSyncRemote(authed);
    final SyncEngine engine = SyncEngine(
      remote: remote,
      store: store,
      clock: clock,
      canSend: () => true,
      readPhotoDataUrl: (path) async => 'data:image/png;base64,$_pngBase64',
    );

    final Directory tmp = Directory.systemTemp.createTempSync('agro_it');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final File photo = File('${tmp.path}/foto.png')
      ..writeAsBytesSync(base64Decode(_pngBase64));

    // 1) Produtor, propriedade, visita com foto e solicitação, tudo offline.
    final String producerId = await writer.createProducer(
      name: 'TESTE APP Produtor ${DateTime.now().millisecondsSinceEpoch}',
      cpf: randomValidCpf(Random()),
      community: 'TESTE APP Comunidade',
      consent: true,
    );
    final String propertyId = await writer.createProperty(
      producerId: producerId,
      name: 'TESTE APP Propriedade',
      areaHa: 12.5,
      locality: 'TESTE APP Localidade',
      latitude: -6.4966,
      longitude: -49.8786,
    );
    final String visitId = await writer.createVisit(
      producerId: producerId,
      propertyId: propertyId,
      visitedOn: DateTime.now(),
      diagnosis: 'TESTE APP diagnóstico',
      actionPlan: 'TESTE APP plano',
      photoPaths: [photo.path],
    );
    await writer.createRequest(
      producerId: producerId,
      propertyId: propertyId,
      subject: 'TESTE APP solicitação',
      priority: 'LOW',
    );

    // 2) Uma rodada do motor: push em lote, solicitação via REST, foto e pull.
    final SyncReport report = await engine.run();
    expect(report.failed, 0, reason: 'nenhuma operação deveria falhar');
    expect(report.needsLogin, isFalse);
    expect(report.offline, isFalse);
    expect(report.applied, greaterThanOrEqualTo(3));
    expect(report.restSent, 1);
    expect(report.photosSent, 1);

    expect(await store.pendingOpCount(), 0);
    expect(await store.pendingPhotoCount(), 0);
    expect(await db.select(db.restQueue).get(), isEmpty);

    // 3) A solicitação temporária foi trocada pelo id do servidor.
    final List<Map<String, dynamic>> requests = await store.records('request');
    expect(
      requests.any((r) => (r['id'] as String).startsWith('local-')),
      isFalse,
    );

    // 4) Reenvio do mesmo produtor (mesmo id): o servidor responde duplicate, sem erro.
    await store.enqueue(
      entity: 'producer',
      entityId: producerId,
      op: 'upsert',
      payload: {'community': 'TESTE APP Comunidade'},
      updatedAt: clock.nowUtc(),
    );
    final SyncReport again = await engine.run();
    expect(again.failed, 0);
    expect(await store.pendingOpCount(), 0);

    // 5) Pelo mesmo cliente, o servidor tem o produtor com CPF mascarado.
    final List<Map<String, dynamic>> producers = await store.records(
      'producer',
    );
    final Map<String, dynamic> mine = producers.firstWhere(
      (p) => p['id'] == producerId,
    );
    expect(mine['cpf'], startsWith('***.'));
    expect(visitId, isNotEmpty);
  });
}
