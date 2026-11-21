import 'package:geolocator/geolocator.dart';

/// Resultado da leitura do GPS. `null` quando o técnico não deu permissão ou o aparelho não tem GPS ligado.
class GpsFix {
  const GpsFix({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
  });

  final double latitude;
  final double longitude;
  final double accuracy;
}

/// Pede a permissão (se ainda não tiver) e lê a posição atual com alta precisão.
Future<GpsFix?> readGps() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    final Position position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
    return GpsFix(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    );
  } on Object {
    return null;
  }
}
