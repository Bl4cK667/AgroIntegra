import 'package:flutter/foundation.dart';

/// Configuração por ambiente. A URL da API vem de `--dart-define=API_URL=...`.
///
/// Desenvolvimento: `http://localhost:3001` (simulador do iPhone) ou
/// `http://10.0.2.2:3001` (emulador Android). Produção: sempre HTTPS.
abstract final class AppConfig {
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3001',
  );

  /// Falha cedo, antes de qualquer tela, se uma build de produção apontar para HTTP.
  static void validate() {
    if (kReleaseMode && !apiUrl.startsWith('https://')) {
      throw StateError('API_URL deve usar HTTPS em builds de produção.');
    }
  }
}
