import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Armazenamento chave-valor protegido. Em produção usa o Keychain/Keystore;
/// nos testes usa memória.
abstract interface class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureKeyValueStore implements KeyValueStore {
  SecureKeyValueStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class MemoryKeyValueStore implements KeyValueStore {
  final Map<String, String> _data = {};

  @override
  Future<String?> read(String key) async => _data[key];

  @override
  Future<void> write(String key, String value) async => _data[key] = value;

  @override
  Future<void> delete(String key) async => _data.remove(key);
}
