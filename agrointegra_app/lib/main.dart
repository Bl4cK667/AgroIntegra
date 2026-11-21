import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/sync/background_sync.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.validate();
  // Falha de agendamento não impede o app de abrir: a sincronização continua pelo app.
  try {
    await startBackgroundSync();
  } on Object {
    // Ignorado de propósito.
  }
  runApp(const ProviderScope(child: AgroIntegraApp()));
}
