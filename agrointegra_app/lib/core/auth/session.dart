import 'dart:convert';

/// Organização à qual o usuário pertence (vem do login).
class OrganizationRef {
  const OrganizationRef({
    required this.id,
    required this.name,
    required this.role,
  });

  final String id;
  final String name;
  final String role;

  factory OrganizationRef.fromJson(Map<String, dynamic> json) {
    return OrganizationRef(
      id: json['id'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role};
}

/// Sessão do técnico. O token vale 8 h na API e não há refresh token (lacuna
/// registrada em `backend-pendente.md`).
class Session {
  const Session({
    required this.accessToken,
    required this.expiresAt,
    required this.userId,
    required this.name,
    required this.email,
    required this.organizations,
    this.organizationId,
    this.role,
  });

  final String accessToken;
  final DateTime expiresAt;
  final String userId;
  final String name;
  final String email;
  final List<OrganizationRef> organizations;

  /// Organização ativa. `null` quando o usuário tem várias e ainda não escolheu.
  final String? organizationId;
  final String? role;

  bool get hasOrganization => organizationId != null;

  /// Expirou: o app ainda abre offline, mas precisa de novo login para enviar dados.
  bool get isExpired => !DateTime.now().toUtc().isBefore(expiresAt);

  Session withOrganization(String id) {
    final OrganizationRef org = organizations.firstWhere((o) => o.id == id);
    return Session(
      accessToken: accessToken,
      expiresAt: expiresAt,
      userId: userId,
      name: name,
      email: email,
      organizations: organizations,
      organizationId: org.id,
      role: org.role,
    );
  }

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'expiresAt': expiresAt.toIso8601String(),
    'userId': userId,
    'name': name,
    'email': email,
    'organizations': organizations.map((o) => o.toJson()).toList(),
    'organizationId': organizationId,
    'role': role,
  };

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      accessToken: json['accessToken'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      userId: json['userId'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      organizations: (json['organizations'] as List<dynamic>)
          .map((e) => OrganizationRef.fromJson(e as Map<String, dynamic>))
          .toList(),
      organizationId: json['organizationId'] as String?,
      role: json['role'] as String?,
    );
  }

  String encode() => jsonEncode(toJson());
}

/// Lê o campo `exp` (em segundos) do payload de um JWT, sem verificar a assinatura.
DateTime? jwtExpiry(String token) {
  final List<String> parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    final String payload = utf8.decode(
      base64Url.decode(base64Url.normalize(parts[1])),
    );
    final Object? exp = (jsonDecode(payload) as Map<String, dynamic>)['exp'];
    if (exp is! int) return null;
    return DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true);
  } on FormatException {
    return null;
  }
}
