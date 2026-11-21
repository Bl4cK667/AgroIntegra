import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/local_unlock.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';

class UnlockScreen extends ConsumerStatefulWidget {
  const UnlockScreen({super.key});

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  final _pin = TextEditingController();
  bool _biometricAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final bool available = await ref
        .read(localUnlockProvider)
        .canUseBiometric();
    if (mounted) setState(() => _biometricAvailable = available);
  }

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AuthState auth = ref.watch(authProvider);
    final Auth notifier = ref.read(authProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.unlockTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            auth.session == null
                ? AppStrings.unlockHint
                : '${auth.session!.name}. ${AppStrings.unlockHint}',
            style: const TextStyle(color: AppColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _pin,
            keyboardType: TextInputType.number,
            obscureText: true,
            maxLength: 6,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: AppStrings.pinLabel,
              counterText: '',
            ),
            onSubmitted: (value) => notifier.unlockWithPin(value),
          ),
          if (auth.errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              auth.errorMessage!,
              style: const TextStyle(color: AppColors.danger),
            ),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => notifier.unlockWithPin(_pin.text),
            child: const Text(AppStrings.unlockButton),
          ),
          if (_biometricAvailable) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: const RoundedRectangleBorder(
                  borderRadius: AppTheme.radius,
                ),
              ),
              onPressed: notifier.unlockWithBiometric,
              child: const Text(AppStrings.unlockBiometric),
            ),
          ],
          const SizedBox(height: 12),
          TextButton(
            onPressed: notifier.signOut,
            child: const Text(AppStrings.unlockWithPassword),
          ),
        ],
      ),
    );
  }
}
