import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'database_key_store.g.dart';

/// Chave do banco local (SQLCipher). Fica só no Keychain (iOS) ou no Keystore (Android).
class DatabaseKeyStore {
  DatabaseKeyStore(this._storage);

  static const String _keyName = 'agrointegra.db_key.v1';
  final FlutterSecureStorage _storage;

  /// Devolve a chave em hexadecimal (32 bytes), criando uma na primeira abertura.
  Future<String> loadOrCreate() async {
    final String? existing = await _storage.read(key: _keyName);
    if (existing != null && existing.length == 64) return existing;

    final Random random = Random.secure();
    final String fresh = List<int>.generate(
      32,
      (_) => random.nextInt(256),
    ).map((int b) => b.toRadixString(16).padLeft(2, '0')).join();
    await _storage.write(key: _keyName, value: fresh);
    return fresh;
  }
}

@Riverpod(keepAlive: true)
DatabaseKeyStore databaseKeyStore(Ref ref) {
  return DatabaseKeyStore(const FlutterSecureStorage());
}
