import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../network/api_client.dart';

part 'sync_remote.g.dart';

/// Falha de HTTP. `retryable` vale para 5xx, 429 e falha sem resposta.
class SyncHttpException implements Exception {
  const SyncHttpException(
    this.statusCode,
    this.message, {
    required this.retryable,
  });

  final int? statusCode;
  final String message;
  final bool retryable;

  @override
  String toString() => message;
}

/// Sem conexão: não é erro do técnico, só espera a próxima tentativa.
class SyncNetworkException implements Exception {
  const SyncNetworkException();
}

class PushOperation {
  const PushOperation({
    required this.entity,
    required this.id,
    required this.op,
    required this.updatedAt,
    this.baseUpdatedAt,
    this.data,
  });

  final String entity;
  final String id;
  final String op;
  final String updatedAt;
  final String? baseUpdatedAt;
  final Map<String, dynamic>? data;

  Map<String, dynamic> toJson() => {
    'entity': entity,
    'op': op,
    'id': id,
    'updatedAt': updatedAt,
    if (baseUpdatedAt != null) 'baseUpdatedAt': baseUpdatedAt,
    if (data != null) 'data': data,
  };
}

class PushOutcome {
  const PushOutcome({
    required this.index,
    required this.status,
    this.message,
    this.retry = false,
    this.record,
  });

  final int index;

  /// applied | duplicate | rejected | error
  final String status;
  final String? message;
  final bool retry;
  final Map<String, dynamic>? record;
}

class PullPage {
  const PullPage({
    required this.cursor,
    required this.hasMore,
    required this.serverTime,
    required this.changes,
  });

  final String cursor;
  final bool hasMore;
  final DateTime serverTime;
  final Map<String, List<Map<String, dynamic>>> changes;
}

/// Contrato com a API de sincronização. O motor depende só disto, o que permite testar sem rede.
abstract interface class SyncRemote {
  /// Chamada REST comum (solicitações). Devolve o corpo da resposta.
  Future<Map<String, dynamic>> rest({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  });
  Future<List<PushOutcome>> push(List<PushOperation> operations);
  Future<PullPage> pull({String? since, int limit = 200});
  Future<void> uploadPhoto({
    required String visitId,
    required String photoId,
    required String dataUrl,
  });
}

class DioSyncRemote implements SyncRemote {
  DioSyncRemote(this._dio);

  final Dio _dio;

  @override
  Future<Map<String, dynamic>> rest({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) {
    return _guard(
      () => _dio.request<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(method: method),
      ),
    );
  }

  @override
  Future<List<PushOutcome>> push(List<PushOperation> operations) async {
    final Map<String, dynamic> body = await _guard(
      () => _dio.post<Map<String, dynamic>>(
        '/sync/push',
        data: {'operations': operations.map((o) => o.toJson()).toList()},
      ),
    );
    final List<dynamic> results = body['results'] as List<dynamic>;
    return results.map((dynamic raw) {
      final Map<String, dynamic> r = raw as Map<String, dynamic>;
      return PushOutcome(
        index: r['index'] as int,
        status: r['status'] as String,
        message: r['message'] as String?,
        retry: r['retry'] == true,
        record: r['record'] as Map<String, dynamic>?,
      );
    }).toList();
  }

  @override
  Future<PullPage> pull({String? since, int limit = 200}) async {
    final Map<String, dynamic> body = await _guard(
      () => _dio.get<Map<String, dynamic>>(
        '/sync/pull',
        queryParameters: {'since': since ?? '', 'limit': limit},
      ),
    );
    final Map<String, dynamic> changes =
        body['changes'] as Map<String, dynamic>;
    return PullPage(
      cursor: body['cursor'] as String,
      hasMore: body['hasMore'] as bool,
      serverTime: DateTime.parse(body['serverTime'] as String),
      changes: changes.map(
        (key, value) => MapEntry(
          key,
          (value as List<dynamic>).cast<Map<String, dynamic>>(),
        ),
      ),
    );
  }

  @override
  Future<void> uploadPhoto({
    required String visitId,
    required String photoId,
    required String dataUrl,
  }) async {
    await _guard(
      () => _dio.put<Map<String, dynamic>>(
        '/sync/visits/$visitId/photos/$photoId',
        data: {'image': dataUrl},
      ),
    );
  }

  Future<Map<String, dynamic>> _guard(
    Future<Response<Map<String, dynamic>>> Function() call,
  ) async {
    try {
      final Response<Map<String, dynamic>> res = await call();
      return res.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      switch (e.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          throw const SyncNetworkException();
        default:
          break;
      }
      final int? code = e.response?.statusCode;
      final Object? data = e.response?.data;
      final Object? raw = data is Map ? data['message'] : null;
      final String message = raw is List
          ? raw.join(' ')
          : (raw?.toString() ?? 'Não foi possível sincronizar agora.');
      throw SyncHttpException(
        code,
        message,
        retryable: code == null || code >= 500 || code == 429,
      );
    }
  }
}

@Riverpod(keepAlive: true)
SyncRemote syncRemote(Ref ref) => DioSyncRemote(ref.watch(apiClientProvider));
