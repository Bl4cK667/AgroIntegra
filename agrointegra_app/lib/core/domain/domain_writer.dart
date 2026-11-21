import 'package:uuid/uuid.dart';

import '../sync/store_extensions.dart';
import '../sync/sync_store.dart';
import '../sync/sync_support.dart';
import 'text_utils.dart';

/// Escrita de domínio offline-first: grava localmente e enfileira para envio.
///
/// - Produtor, propriedade e visita vão para a fila de sync (ids gerados no aparelho).
/// - Solicitação vai para a fila REST (o servidor gera o id), então ganha um id temporário `local-…`.
class DomainWriter {
  DomainWriter({required this.store, required this.clock});

  final SyncStore store;
  final SyncClock clock;

  static const Uuid _uuid = Uuid();
  static const String localPrefix = 'local-';

  String newId() => _uuid.v4();

  static bool isLocalId(String id) => id.startsWith(localPrefix);

  /// Versão de referência para conflito: a do servidor. Registro criado no aparelho não tem uma.
  static String? baseFor(Map<String, dynamic> record) {
    if (record['_created'] == true) return null;
    return record['updatedAt'] as String?;
  }

  // ---------- produtor ----------

  Future<String> createProducer({
    required String name,
    required String cpf,
    String? phone,
    required String community,
    required bool consent,
  }) async {
    final String id = newId();
    final DateTime now = clock.nowUtc();
    final String digits = cpfDigits(cpf);
    final String? cleanPhone = _clean(phone);

    await store.enqueue(
      entity: 'producer',
      entityId: id,
      op: 'upsert',
      payload: {
        'name': name.trim(),
        'cpf': digits,
        'phone': ?cleanPhone,
        'community': community.trim(),
        'consent': consent,
      },
      updatedAt: now,
    );
    await store.upsertRecord('producer', {
      'id': id,
      'name': name.trim(),
      'cpf': maskCpf(digits),
      'phone': cleanPhone,
      'community': community.trim(),
      'consentAt': consent ? isoUtc(now) : null,
      'updatedAt': isoUtc(now),
      '_created': true,
    });
    return id;
  }

  /// Só os campos que mudaram vão na operação. O CPF não muda depois de cadastrado.
  Future<void> updateProducer(
    Map<String, dynamic> current, {
    String? name,
    String? phone,
    String? community,
    bool? consent,
  }) async {
    final Map<String, dynamic> changes = {
      if (name != null) 'name': name.trim(),
      if (phone != null) 'phone': _clean(phone),
      if (community != null) 'community': community.trim(),
      'consent': ?consent,
    };
    if (changes.isEmpty) return;

    final DateTime now = clock.nowUtc();
    await store.enqueue(
      entity: 'producer',
      entityId: current['id'] as String,
      op: 'upsert',
      payload: changes,
      updatedAt: now,
      baseUpdatedAt: baseFor(current),
    );
    await store.upsertRecord('producer', {
      ...current,
      if (name != null) 'name': name.trim(),
      if (phone != null) 'phone': _clean(phone),
      if (community != null) 'community': community.trim(),
      if (consent != null) 'consentAt': consent ? isoUtc(now) : null,
      '_pending': true,
    });
  }

  // ---------- propriedade ----------

  Future<String> createProperty({
    required String producerId,
    required String name,
    required double areaHa,
    required String locality,
    String? mainActivity,
    String? address,
    String? city,
    String? state,
    double? latitude,
    double? longitude,
    double? accuracy,
  }) async {
    final String id = newId();
    final DateTime now = clock.nowUtc();
    final Map<String, dynamic> fields = _propertyFields(
      mainActivity: mainActivity,
      address: address,
      city: city,
      state: state,
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy,
    );

    await store.enqueue(
      entity: 'property',
      entityId: id,
      op: 'upsert',
      payload: {
        'producerId': producerId,
        'name': name.trim(),
        'areaHa': areaHa,
        'locality': locality.trim(),
        ...fields,
      },
      updatedAt: now,
    );
    await store.upsertRecord('property', {
      'id': id,
      'producerId': producerId,
      'name': name.trim(),
      'areaHa': areaHa,
      'locality': locality.trim(),
      ...fields,
      'updatedAt': isoUtc(now),
      '_created': true,
    });
    return id;
  }

  Future<void> updateProperty(
    Map<String, dynamic> current, {
    String? name,
    double? areaHa,
    String? locality,
    String? mainActivity,
    String? address,
    String? city,
    String? state,
    double? latitude,
    double? longitude,
    double? accuracy,
  }) async {
    final Map<String, dynamic> fields = _propertyFields(
      mainActivity: mainActivity,
      address: address,
      city: city,
      state: state,
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy,
    );
    final Map<String, dynamic> changes = {
      if (name != null) 'name': name.trim(),
      'areaHa': ?areaHa,
      if (locality != null) 'locality': locality.trim(),
      ...fields,
    };
    if (changes.isEmpty) return;

    final DateTime now = clock.nowUtc();
    await store.enqueue(
      entity: 'property',
      entityId: current['id'] as String,
      op: 'upsert',
      payload: changes,
      updatedAt: now,
      baseUpdatedAt: baseFor(current),
    );
    await store.upsertRecord('property', {
      ...current,
      ...changes,
      '_pending': true,
    });
  }

  Map<String, dynamic> _propertyFields({
    String? mainActivity,
    String? address,
    String? city,
    String? state,
    double? latitude,
    double? longitude,
    double? accuracy,
  }) {
    final String? activity = _clean(mainActivity);
    final String? addr = _clean(address);
    final String? cityName = _clean(city);
    return {
      'mainActivity': ?activity,
      'address': ?addr,
      'city': ?cityName,
      if (state != null && state.isNotEmpty) 'state': state,
      // CoordinatesDto da API só aceita latitude e longitude.
      if (latitude != null && longitude != null)
        'coordinates': {'latitude': latitude, 'longitude': longitude},
    };
  }

  // ---------- visita ----------

  /// Visita é imutável depois de criada. As fotos entram na fila própria, e só sobem depois que a visita for aceita.
  Future<String> createVisit({
    required String producerId,
    String? propertyId,
    String? requestId,
    required DateTime visitedOn,
    required String diagnosis,
    required String actionPlan,
    DateTime? returnOn,
    String? impact,
    String? signature,
    double? latitude,
    double? longitude,
    double? accuracy,
    List<String> photoPaths = const [],
  }) async {
    final String id = newId();
    final DateTime now = clock.nowUtc();
    final String? impactText = _clean(impact);
    final Map<String, dynamic>? location = latitude != null && longitude != null
        ? {'latitude': latitude, 'longitude': longitude, 'accuracy': ?accuracy}
        : null;

    final Map<String, dynamic> payload = {
      'producerId': producerId,
      'propertyId': ?propertyId,
      'requestId': ?requestId,
      'visitedOn': dayString(visitedOn),
      'diagnosis': diagnosis.trim(),
      'actionPlan': actionPlan.trim(),
      if (returnOn != null) 'returnOn': dayString(returnOn),
      'impact': ?impactText,
      'signature': ?signature,
      'location': ?location,
    };

    await store.enqueue(
      entity: 'visit',
      entityId: id,
      op: 'upsert',
      payload: payload,
      updatedAt: now,
    );
    for (final String path in photoPaths) {
      await store.enqueuePhoto(photoId: newId(), visitId: id, filePath: path);
    }
    await store.upsertRecord('visit', {
      ...payload,
      'id': id,
      'updatedAt': isoUtc(now),
      'photoCount': photoPaths.length,
      '_created': true,
    });
    return id;
  }

  // ---------- solicitação (fila REST) ----------

  Future<String> createRequest({
    required String producerId,
    String? propertyId,
    required String subject,
    String? description,
    required String priority,
  }) async {
    final String tempId = '$localPrefix${newId()}';
    final DateTime now = clock.nowUtc();
    final Map<String, dynamic> body = {
      'producerId': producerId,
      'propertyId': ?propertyId,
      'subject': subject.trim(),
      if (_clean(description) != null) 'description': _clean(description),
      'priority': priority,
    };

    await store.enqueueRest(
      kind: 'createRequest',
      targetId: tempId,
      payload: body,
      now: now,
    );
    await store.upsertRecord('request', {
      'id': tempId,
      ...body,
      'status': 'NEW',
      'scheduledFor': null,
      'createdAt': isoUtc(now),
      'updatedAt': isoUtc(now),
      '_created': true,
    });
    return tempId;
  }

  /// Só solicitações já criadas no servidor podem mudar de status (as temporárias esperam o envio).
  Future<void> changeRequestStatus(
    Map<String, dynamic> current, {
    required String status,
    String? scheduledFor,
  }) async {
    final String id = current['id'] as String;
    if (isLocalId(id)) {
      throw StateError(
        'Aguarde a solicitação ser enviada para mudar o status.',
      );
    }
    final DateTime now = clock.nowUtc();
    await store.enqueueRest(
      kind: 'requestStatus',
      targetId: id,
      payload: {'status': status, 'scheduledFor': ?scheduledFor},
      now: now,
    );
    await store.upsertRecord('request', {
      ...current,
      'status': status,
      'scheduledFor': ?scheduledFor,
      '_pending': true,
    });
  }

  Future<void> changeRequestPriority(
    Map<String, dynamic> current, {
    required String priority,
  }) async {
    final String id = current['id'] as String;
    if (isLocalId(id)) {
      throw StateError(
        'Aguarde a solicitação ser enviada para mudar a prioridade.',
      );
    }
    await store.enqueueRest(
      kind: 'requestPriority',
      targetId: id,
      payload: {'priority': priority},
      now: clock.nowUtc(),
    );
    await store.upsertRecord('request', {
      ...current,
      'priority': priority,
      '_pending': true,
    });
  }

  static String? _clean(String? value) {
    final String? trimmed = value?.trim();
    return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  }
}
