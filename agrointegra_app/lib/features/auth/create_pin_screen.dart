import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';

class CreatePinScreen extends ConsumerStatefulWidget {
  const CreatePinScreen({super.key});

  @override
  ConsumerState<CreatePinScreen> createState() => _CreatePinScreenState();
}

class _CreatePinScreenState extends ConsumerState<CreatePinScreen> {
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final String? error = await ref
        .read(authProvider.notifier)
        .createPin(_pin.text, _confirm.text);
    if (mounted) setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.createPinTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            AppStrings.createPinHint,
            style: TextStyle(color: AppColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 16),
          _PinField(controller: _pin, label: AppStrings.pinLabel),
          const SizedBox(height: 12),
          _PinField(controller: _confirm, label: AppStrings.pinConfirmLabel),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _save,
            child: const Text(AppStrings.pinSave),
          ),
        ],
      ),
    );
  }
}

class _PinField extends StatelessWidget {
  const _PinField({required this.controller, required this.label});

  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      obscureText: true,
      maxLength: 6,
      decoration: InputDecoration(labelText: label, counterText: ''),
    );
  }
}
