import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Cadastro (sem id) ou edição (com id) de produtor. CPF só no cadastro.
class ProducerFormScreen extends ConsumerStatefulWidget {
  const ProducerFormScreen({super.key, this.producerId});

  final String? producerId;

  @override
  ConsumerState<ProducerFormScreen> createState() => _ProducerFormScreenState();
}

class _ProducerFormScreenState extends ConsumerState<ProducerFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _cpf = TextEditingController();
  final _phone = TextEditingController();
  final _community = TextEditingController();
  bool _consent = false;
  bool _saving = false;
  bool _loaded = false;
  String? _error;

  bool get _isNew => widget.producerId == null;

  @override
  void dispose() {
    _name.dispose();
    _cpf.dispose();
    _phone.dispose();
    _community.dispose();
    super.dispose();
  }

  void _fillFrom(Map<String, dynamic> p) {
    if (_loaded) return;
    _loaded = true;
    _name.text = p['name'] as String? ?? '';
    _phone.text = p['phone'] as String? ?? '';
    _community.text = p['community'] as String? ?? '';
    _consent = p['consentAt'] != null;
    _cpf.text = p['cpf'] as String? ?? '';
  }

  Future<void> _save(Map<String, dynamic>? current) async {
    if (!_formKey.currentState!.validate()) return;
    if (!_consent) {
      setState(() => _error = AppStrings.producerConsentRequired);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final writer = await ref.read(domainWriterProvider.future);
      if (_isNew) {
        await writer.createProducer(
          name: _name.text,
          cpf: _cpf.text,
          phone: _phone.text,
          community: _community.text,
          consent: _consent,
        );
      } else {
        await writer.updateProducer(
          current!,
          name: _name.text,
          phone: _phone.text,
          community: _community.text,
          consent: _consent,
        );
      }
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
    final AsyncValue<List<Map<String, dynamic>>> producers = ref.watch(
      recordsProvider('producer'),
    );
    Map<String, dynamic>? current;
    if (!_isNew) {
      producers.whenData((rows) {
        for (final Map<String, dynamic> r in rows) {
          if (r['id'] == widget.producerId) {
            current = r;
            _fillFrom(r);
          }
        }
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isNew ? AppStrings.producerNew : AppStrings.producerEdit),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppField(
              controller: _name,
              label: AppStrings.producerName,
              maxLength: 120,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? AppStrings.producerNameRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _cpf,
              label: AppStrings.producerCpf,
              hint: AppStrings.producerCpfHint,
              enabled: _isNew,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
              ],
              maxLength: 14,
              validator: (v) {
                if (!_isNew) return null;
                return isValidCpf(v ?? '')
                    ? null
                    : AppStrings.producerCpfInvalid;
              },
            ),
            if (!_isNew)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text(
                  AppStrings.producerCpfLocked,
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
              ),
            const SizedBox(height: 12),
            AppField(
              controller: _phone,
              label: AppStrings.producerPhone,
              keyboardType: TextInputType.phone,
              maxLength: 30,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _community,
              label: AppStrings.producerCommunity,
              maxLength: 80,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? AppStrings.producerCommunityRequired
                  : null,
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _consent,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(AppStrings.producerConsent),
              onChanged: (v) => setState(() => _consent = v ?? false),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: AppStrings.save,
              onPressed: _saving || (!_isNew && current == null)
                  ? null
                  : () => _save(current),
            ),
          ],
        ),
      ),
    );
  }
}
