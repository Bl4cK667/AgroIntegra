import 'package:local_auth/local_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../strings/app_strings.dart';

part 'local_unlock.g.dart';

/// Desbloqueio pela biometria do aparelho (Face ID / Touch ID / digital).
class LocalUnlock {
  final LocalAuthentication _auth = LocalAuthentication();

  Future<bool> canUseBiometric() async {
    try {
      return await _auth.canCheckBiometrics && await _auth.isDeviceSupported();
    } on Object {
      return false;
    }
  }

  Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(
        localizedReason: AppStrings.biometricReason,
        biometricOnly: true,
      );
    } on Object {
      return false;
    }
  }
}

@Riverpod(keepAlive: true)
LocalUnlock localUnlock(Ref ref) => LocalUnlock();
