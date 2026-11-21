import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../network/api_client.dart';
import '../strings/app_strings.dart';
import 'session.dart';

part 'auth_repository.g.dart';

/// Erro de autenticação com mensagem pronta para a tela (em português).
class AuthException implements Exception {
  const AuthException(this.message);
  final String message;

  @override
  String toString() => message;
}

class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<Session> login(String email, String password) async {
    try {
      final Response<Map<String, dynamic>> res = await _dio
          .post<Map<String, dynamic>>(
            '/auth/login',
            data: {'email': email.trim(), 'password': password},
          );
      final Map<String, dynamic> body = res.data!;
      final String token = body['accessToken'] as String;
      final Map<String, dynamic> user = body['user'] as Map<String, dynamic>;
      final List<OrganizationRef> orgs =
          (user['organizations'] as List<dynamic>)
              .map((e) => OrganizationRef.fromJson(e as Map<String, dynamic>))
              .toList();

      // Com uma organização ela já fica ativa; com várias, o usuário escolhe.
      final String? activeOrgId = user['organizationId'] as String?;
      final OrganizationRef? active = activeOrgId == null
          ? (orgs.length == 1 ? orgs.first : null)
          : orgs.firstWhere((o) => o.id == activeOrgId);

      return Session(
        accessToken: token,
        expiresAt:
            jwtExpiry(token) ??
            DateTime.now().toUtc().add(const Duration(hours: 8)),
        userId: user['id'] as String,
        name: user['name'] as String,
        email: user['email'] as String,
        organizations: orgs,
        organizationId: active?.id,
        role: (active?.role ?? user['role']) as String?,
      );
    } on DioException catch (e) {
      throw AuthException(_messageFor(e));
    }
  }

  static String _messageFor(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return AppStrings.loginNoConnection;
      default:
        break;
    }
    final int? status = e.response?.statusCode;
    if (status == 401) return AppStrings.loginInvalidCredentials;
    final Object? message = e.response?.data is Map
        ? (e.response!.data as Map)['message']
        : null;
    // A API manda mensagens em português; a lista (validação) vira a primeira linha.
    if (message is String) return message;
    if (message is List && message.isNotEmpty) return message.first.toString();
    return AppStrings.loginGenericError;
  }
}

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) {
  return AuthRepository(ref.watch(apiClientProvider));
}
