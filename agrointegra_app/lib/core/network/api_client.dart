import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../auth/session.dart';
import '../config/app_config.dart';

part 'api_client.g.dart';

/// Sessão em memória, usada pelo cliente HTTP para montar os cabeçalhos.
class SessionHolder {
  Session? current;
}

@Riverpod(keepAlive: true)
SessionHolder sessionHolder(Ref ref) => SessionHolder();

/// Cliente HTTP da API: envia `Authorization` e `X-Organization-Id` quando há sessão.
@Riverpod(keepAlive: true)
Dio apiClient(Ref ref) {
  final SessionHolder holder = ref.watch(sessionHolderProvider);

  final Dio dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 60),
      headers: const {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final Session? session = holder.current;
        if (session != null && !options.headers.containsKey('Authorization')) {
          options.headers['Authorization'] = 'Bearer ${session.accessToken}';
          if (session.organizationId != null) {
            options.headers['X-Organization-Id'] = session.organizationId;
          }
        }
        handler.next(options);
      },
    ),
  );

  // Log só de método, caminho, status e duração. Nunca corpo, token ou dados pessoais.
  if (kDebugMode) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onResponse: (response, handler) {
          debugPrint(
            '[api] ${response.requestOptions.method} ${response.requestOptions.path} -> ${response.statusCode}',
          );
          handler.next(response);
        },
        onError: (error, handler) {
          debugPrint(
            '[api] ${error.requestOptions.method} ${error.requestOptions.path} -> ${error.response?.statusCode ?? 'sem resposta'}',
          );
          handler.next(error);
        },
      ),
    );
  }

  return dio;
}
