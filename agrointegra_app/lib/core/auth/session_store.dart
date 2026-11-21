import 'dart:convert';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../security/key_value_store.dart';
import 'pin_hasher.dart';
import 'session.dart';

part 'session_store.g.dart';

enum PinCheck { ok, wrong, lockedOut }

class PinCheckResult {
  const PinCheckResult(this.result, this.attemptsLeft);
  final PinCheck result;
  final int attemptsLeft;
}

/// Sessão e PIN no armazenamento protegido. Nada disso vai para SharedPreferences ou log.
class SessionStore {
  SessionStore(this._store);

  static const String _sessionKey = 'agrointegra.session.v1';
  static const String _pinKey = 'agrointegra.pin.v1';
  static const String _attemptsKey = 'agrointegra.pin_attempts.v1';
  static const int maxPinAttempts = 5;

  final KeyValueStore _store;

  Future<Session?> readSession() async {
    final String? raw = await _store.read(_sessionKey);
    if (raw == null) return null;
    try {
      return Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      // Dado corrompido: trata como sem sessão e pede login de novo.
      await _store.delete(_sessionKey);
      return null;
    }
  }

  Future<void> writeSession(Session session) =>
      _store.write(_sessionKey, session.encode());

  Future<bool> hasPin() async => (await _store.read(_pinKey)) != null;

  Future<void> savePin(String pin) async {
    final String salt = PinHasher.newSalt();
    final String hash = PinHasher.hash(pin, salt);
    await _store.write(_pinKey, jsonEncode({'salt': salt, 'hash': hash}));
    await _store.write(_attemptsKey, '0');
  }

  /// Confere o PIN. Depois de [maxPinAttempts] erros, apaga o PIN e pede senha.
  Future<PinCheckResult> checkPin(String pin) async {
    final String? raw = await _store.read(_pinKey);
    if (raw == null) return const PinCheckResult(PinCheck.lockedOut, 0);

    final Map<String, dynamic> stored = jsonDecode(raw) as Map<String, dynamic>;
    final bool ok = PinHasher.matches(
      pin,
      stored['salt'] as String,
      stored['hash'] as String,
    );

    if (ok) {
      await _store.write(_attemptsKey, '0');
      return const PinCheckResult(PinCheck.ok, maxPinAttempts);
    }

    final int attempts =
        (int.tryParse(await _store.read(_attemptsKey) ?? '') ?? 0) + 1;
    if (attempts >= maxPinAttempts) {
      await _store.delete(_pinKey);
      await _store.delete(_attemptsKey);
      return const PinCheckResult(PinCheck.lockedOut, 0);
    }
    await _store.write(_attemptsKey, '$attempts');
    return PinCheckResult(PinCheck.wrong, maxPinAttempts - attempts);
  }

  /// Logout: apaga sessão e PIN. Os dados locais ficam para a fase D tratar.
  Future<void> clearAuth() async {
    await _store.delete(_sessionKey);
    await _store.delete(_pinKey);
    await _store.delete(_attemptsKey);
  }
}

@Riverpod(keepAlive: true)
SessionStore sessionStore(Ref ref) {
  return SessionStore(SecureKeyValueStore());
}
