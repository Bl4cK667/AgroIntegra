import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';
import 'request_labels.dart';

/// Nova solicitação. Fica na fila REST e só vai para o servidor quando houver conexão.
class RequestFormScreen extends ConsumerStatefulWidget {
  const RequestFormScreen({super.key, this.producerId});

  final String? producerId;

  @override
  ConsumerState<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends ConsumerState<RequestFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String? _producerId;
  String? _propertyId;
  String _priority = 'MEDIUM';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _producerId = widget.producerId;
  }

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_producerId == null) {
      setState(() => _error = AppStrings.requestPickProducer);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final writer = await ref.read(domainWriterProvider.future);
      await writer.createRequest(
        producerId: _producerId!,
        propertyId: _propertyId,
        subject: _subject.text,
        description: _description.text,
        priority: _priority,
      );
      syncInBackground(ref);
      if (mounted) context.pop();
    } on Object {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = AppStrings.saveError;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> producers =
        ref.watch(recordsProvider('producer')).value ?? const [];
    final List<Map<String, dynamic>> properties =
        ref.watch(recordsProvider('property')).value ?? const [];
    final List<Map<String, dynamic>> ofProducer = properties
        .where((p) => p['producerId'] == _producerId)
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.newRequest)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _producerId,
              decoration: const InputDecoration(
                labelText: AppStrings.requestProducer,
              ),
              items: [
                for (final p in producers)
                  DropdownMenuItem(
                    value: p['id'] as String,
                    child: Text(p['name'] as String? ?? ''),
                  ),
              ],
              onChanged: (v) => setState(() {
                _producerId = v;
                _propertyId = null;
              }),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: _propertyId,
              decoration: const InputDecoration(
                labelText: AppStrings.requestProperty,
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text(AppStrings.noneOption),
                ),
                for (final p in ofProducer)
                  DropdownMenuItem<String?>(
                    value: p['id'] as String,
                    child: Text(p['name'] as String? ?? ''),
                  ),
              ],
              onChanged: (v) => setState(() => _propertyId = v),
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _subject,
              label: AppStrings.requestSubject,
              maxLength: 160,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? AppStrings.requestSubjectRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _description,
              label: AppStrings.requestDescription,
              maxLines: 3,
              maxLength: 1000,
            ),
            const SizedBox(height: 12),
            const Text(
              AppStrings.requestPriority,
              style: TextStyle(color: AppColors.muted, fontSize: 15),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final p in priorities)
                  ChoiceChip(
                    label: Text(priorityLabel(p)),
                    selected: _priority == p,
                    onSelected: (_) => setState(() => _priority = p),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: AppStrings.requestSave,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
