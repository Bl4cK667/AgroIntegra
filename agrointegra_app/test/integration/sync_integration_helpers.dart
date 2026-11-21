import 'dart:math';

import 'package:dio/dio.dart';

class DemoSession {
  const DemoSession({required this.token, required this.orgId});

  final String token;
  final String orgId;
}

/// Entra com o técnico de demonstração e pega a organização padrão.
Future<DemoSession> loginDemo(Dio dio) async {
  final Response<Map<String, dynamic>> res = await dio
      .post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': 'tecnico@agrointegra.demo', 'password': 'demo1234'},
      );
  final Map<String, dynamic> body = res.data!;
  final Map<String, dynamic> user = body['user'] as Map<String, dynamic>;
  final String? orgId = user['organizationId'] as String?;
  final List<dynamic> orgs = user['organizations'] as List<dynamic>;
  return DemoSession(
    token: body['accessToken'] as String,
    orgId: orgId ?? (orgs.first as Map<String, dynamic>)['id'] as String,
  );
}

/// CPF com dígitos verificadores corretos, para não colidir com cadastros de demonstração.
String randomValidCpf(Random random) {
  final List<int> d = List<int>.generate(9, (_) => random.nextInt(9) + 1);
  int check(List<int> digits) {
    int sum = 0;
    for (int i = 0; i < digits.length; i++) {
      sum += digits[i] * (digits.length + 1 - i);
    }
    final int rest = (sum * 10) % 11;
    return rest == 10 ? 0 : rest;
  }

  d.add(check(d));
  d.add(check(d));
  final String s = d.join();
  return '${s.substring(0, 3)}.${s.substring(3, 6)}.${s.substring(6, 9)}-${s.substring(9)}';
}
