import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// PIN guardado como PBKDF2-HMAC-SHA256 (salt aleatório por aparelho).
abstract final class PinHasher {
  static const int iterations = 20000;
  static const int _keyLength = 32;

  static String newSalt() {
    final Random random = Random.secure();
    return base64Encode(List<int>.generate(16, (_) => random.nextInt(256)));
  }

  static String hash(String pin, String saltBase64) {
    final List<int> salt = base64Decode(saltBase64);
    return base64Encode(_pbkdf2(utf8.encode(pin), salt, iterations));
  }

  /// Comparação em tempo constante.
  static bool matches(String pin, String saltBase64, String expectedHash) {
    final List<int> a = utf8.encode(hash(pin, saltBase64));
    final List<int> b = utf8.encode(expectedHash);
    if (a.length != b.length) return false;
    int diff = 0;
    for (int i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }

  // PBKDF2 para um bloco de 32 bytes (o tamanho do SHA-256).
  static List<int> _pbkdf2(List<int> password, List<int> salt, int rounds) {
    final Hmac hmac = Hmac(sha256, password);
    List<int> u = hmac.convert([...salt, 0, 0, 0, 1]).bytes;
    final List<int> out = List<int>.from(u);
    for (int i = 1; i < rounds; i++) {
      u = hmac.convert(u).bytes;
      for (int j = 0; j < out.length; j++) {
        out[j] ^= u[j];
      }
    }
    assert(out.length == _keyLength);
    return out;
  }
}
