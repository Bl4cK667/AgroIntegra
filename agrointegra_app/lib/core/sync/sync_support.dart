import 'dart:math';

/// Espera antes de tentar de novo: 5 s, 10 s, 20 s... até 15 min, com até 20% de folga aleatória.
abstract final class Backoff {
  static const Duration _base = Duration(seconds: 5);
  static const Duration _max = Duration(minutes: 15);

  static Duration delayFor(int attempts, Random random) {
    final int shift = (attempts - 1).clamp(0, 10);
    final Duration raw = _base * (1 << shift);
    final Duration capped = raw > _max ? _max : raw;
    final int jitterMs = (capped.inMilliseconds * 0.2 * random.nextDouble())
        .round();
    return capped + Duration(milliseconds: jitterMs);
  }
}

/// Relógio do aparelho corrigido pelo `serverTime` do pull.
/// O servidor recusa `updatedAt` mais de 5 min no futuro, então o horário do celular precisa bater com o dele.
class SyncClock {
  Duration _offset = Duration.zero;

  DateTime nowUtc() => DateTime.now().toUtc().add(_offset);

  void adjustTo(DateTime serverTime) {
    _offset = serverTime.toUtc().difference(DateTime.now().toUtc());
  }
}

/// Data em ISO 8601 UTC. Comparável como texto (usado nas consultas de "vencido").
String isoUtc(DateTime value) => value.toUtc().toIso8601String();
