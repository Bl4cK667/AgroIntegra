import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:agrointegra_app/core/auth/auth_controller.dart';
import 'package:agrointegra_app/core/auth/pin_hasher.dart';
import 'package:agrointegra_app/core/auth/session.dart';
import 'package:agrointegra_app/core/auth/session_store.dart';
import 'package:agrointegra_app/core/router/app_router.dart';
import 'package:agrointegra_app/core/security/key_value_store.dart';

String _fakeJwt(int expSeconds) {
  String part(Map<String, dynamic> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${part({'alg': 'HS256'})}.${part({'exp': expSeconds})}.sig';
}

Session _session({DateTime? expiresAt, String? orgId = 'org-1'}) {
  return Session(
    accessToken: 'token',
    expiresAt:
        expiresAt ?? DateTime.now().toUtc().add(const Duration(hours: 8)),
    userId: 'u1',
    name: 'Rafael',
    email: 'tecnico@agrointegra.demo',
    organizations: const [
      OrganizationRef(id: 'org-1', name: 'AgroIntegra', role: 'TECHNICIAN'),
      OrganizationRef(id: 'org-2', name: 'Outra', role: 'COORDINATION'),
    ],
    organizationId: orgId,
    role: orgId == null ? null : 'TECHNICIAN',
  );
}

void main() {
  group('PinHasher', () {
    test('confere o PIN certo e recusa o errado', () {
      final String salt = PinHasher.newSalt();
      final String hash = PinHasher.hash('1234', salt);

      expect(PinHasher.matches('1234', salt, hash), isTrue);
      expect(PinHasher.matches('4321', salt, hash), isFalse);
    });

    test('salt diferente gera hash diferente', () {
      final String a = PinHasher.hash('1234', PinHasher.newSalt());
      final String b = PinHasher.hash('1234', PinHasher.newSalt());
      expect(a, isNot(b));
    });
  });

  group('SessionStore.checkPin', () {
    test('bloqueia depois de 5 erros e apaga o PIN', () async {
      final SessionStore store = SessionStore(MemoryKeyValueStore());
      await store.savePin('1234');

      for (int i = 1; i < SessionStore.maxPinAttempts; i++) {
        final PinCheckResult r = await store.checkPin('0000');
        expect(r.result, PinCheck.wrong);
        expect(r.attemptsLeft, SessionStore.maxPinAttempts - i);
      }
      final PinCheckResult last = await store.checkPin('0000');
      expect(last.result, PinCheck.lockedOut);
      expect(await store.hasPin(), isFalse);
    });

    test('acerto zera as tentativas', () async {
      final SessionStore store = SessionStore(MemoryKeyValueStore());
      await store.savePin('1234');
      await store.checkPin('0000');
      await store.checkPin('0000');

      expect((await store.checkPin('1234')).result, PinCheck.ok);
      final PinCheckResult r = await store.checkPin('0000');
      expect(r.attemptsLeft, SessionStore.maxPinAttempts - 1);
    });

    test('sessão sobrevive a leitura e escrita', () async {
      final SessionStore store = SessionStore(MemoryKeyValueStore());
      await store.writeSession(_session());
      final Session? back = await store.readSession();

      expect(back?.name, 'Rafael');
      expect(back?.organizationId, 'org-1');
      expect(back?.organizations.length, 2);
    });

    test('dado corrompido vira "sem sessão" sem derrubar o app', () async {
      final MemoryKeyValueStore raw = MemoryKeyValueStore();
      await raw.write('agrointegra.session.v1', '{quebrado');
      expect(await SessionStore(raw).readSession(), isNull);
    });
  });

  group('Session', () {
    test('withOrganization escolhe a organização e o papel dela', () {
      final Session s = _session(orgId: null).withOrganization('org-2');
      expect(s.organizationId, 'org-2');
      expect(s.role, 'COORDINATION');
    });

    test('isExpired vale depois do fim do token', () {
      final Session expired = _session(
        expiresAt: DateTime.now().toUtc().subtract(const Duration(minutes: 1)),
      );
      expect(expired.isExpired, isTrue);
      expect(_session().isExpired, isFalse);
    });

    test('jwtExpiry lê o campo exp do token', () {
      final DateTime? exp = jwtExpiry(_fakeJwt(1800000000));
      expect(exp?.millisecondsSinceEpoch, 1800000000 * 1000);
      expect(jwtExpiry('nao-e-jwt'), isNull);
    });
  });

  group('redirectFor', () {
    test('sem sessão cai no login; com sessão vai para a agenda', () {
      expect(redirectFor(AuthStatus.signedOut, '/'), AppRoutes.login);
      expect(redirectFor(AuthStatus.unlocked, AppRoutes.login), AppRoutes.home);
      expect(redirectFor(AuthStatus.unlocked, '/'), isNull);
    });

    test('bloqueado vai para o desbloqueio; sem PIN vai para criar PIN', () {
      expect(redirectFor(AuthStatus.locked, '/'), AppRoutes.unlock);
      expect(redirectFor(AuthStatus.createPin, '/'), AppRoutes.createPin);
      expect(redirectFor(AuthStatus.locked, AppRoutes.unlock), isNull);
    });
  });
}
