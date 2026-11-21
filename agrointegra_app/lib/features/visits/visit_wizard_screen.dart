import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:signature/signature.dart';

import '../../core/domain/text_utils.dart';
import '../../core/location/gps.dart';
import '../../core/media/photo_service.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/sync/store_extensions.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/sync/sync_store.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Assistente da visita em etapas curtas. O rascunho é salvo a cada mudança,
/// então um fechamento forçado do app não perde nada.
class VisitWizardScreen extends ConsumerStatefulWidget {
  const VisitWizardScreen({
    super.key,
    required this.producerId,
    this.propertyId,
    this.requestId,
  });

  final String producerId;
  final String? propertyId;
  final String? requestId;

  @override
  ConsumerState<VisitWizardScreen> createState() => _VisitWizardScreenState();
}

const int _stepCount = 7;

class _VisitWizardScreenState extends ConsumerState<VisitWizardScreen> {
  late final String _draftKey =
      'visit:${widget.producerId}:${widget.requestId ?? '-'}';

  SyncStore? _store;
  Map<String, dynamic> _draft = {};
  int _step = 0;
  bool _ready = false;
  bool _saving = false;
  String? _error;

  final TextEditingController _diagnosis = TextEditingController();
  final TextEditingController _impact = TextEditingController();
  final TextEditingController _plan = TextEditingController();
  final SignatureController _signature = SignatureController(
    penStrokeWidth: 3,
    penColor: AppColors.ink,
    exportBackgroundColor: Colors.white,
  );

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void dispose() {
    _diagnosis.dispose();
    _impact.dispose();
    _plan.dispose();
    _signature.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final SyncStore store = await ref.read(syncStoreProvider.future);
    final Map<String, dynamic>? saved = await store.loadDraft(_draftKey);
    _store = store;
    _draft =
        saved ??
        {
          'producerId': widget.producerId,
          'propertyId': widget.propertyId,
          'requestId': widget.requestId,
          'visitedOn': dayString(DateTime.now()),
          'photoPaths': <String>[],
        };
    _diagnosis.text = _draft['diagnosis'] as String? ?? '';
    _impact.text = _draft['impact'] as String? ?? '';
    _plan.text = _draft['actionPlan'] as String? ?? '';
    if (mounted) setState(() => _ready = true);

    // GPS é capturado sozinho, se ainda não há uma leitura neste rascunho.
    if (_draft['gps'] == null) {
      final GpsFix? fix = await readGps();
      if (fix != null) {
        _draft['gps'] = {
          'latitude': fix.latitude,
          'longitude': fix.longitude,
          'accuracy': fix.accuracy,
        };
        await _persist();
      }
      if (mounted) setState(() {});
    }
  }

  Future<void> _persist() async {
    final SyncStore? store = _store;
    if (store == null) return;
    _draft['diagnosis'] = _diagnosis.text;
    _draft['impact'] = _impact.text;
    _draft['actionPlan'] = _plan.text;
    _draft['step'] = _step;
    await store.saveDraft(_draftKey, _draft, DateTime.now().toUtc());
  }

  List<String> get _photos =>
      (_draft['photoPaths'] as List<dynamic>? ?? const []).cast<String>();

  bool _canAdvance() {
    switch (_step) {
      case 1:
        return _diagnosis.text.trim().isNotEmpty;
      case 3:
        return _plan.text.trim().isNotEmpty;
      default:
        return true;
    }
  }

  void _next() {
    final String? message = _step == 1 && !_canAdvance()
        ? AppStrings.visitDiagnosisRequired
        : (_step == 3 && !_canAdvance() ? AppStrings.visitPlanRequired : null);
    if (message != null) {
      setState(() => _error = message);
      return;
    }
    setState(() {
      _error = null;
      _step = (_step + 1).clamp(0, _stepCount - 1);
    });
    _persist();
  }

  void _back() {
    setState(() {
      _error = null;
      _step = (_step - 1).clamp(0, _stepCount - 1);
    });
    _persist();
  }

  Future<void> _addPhoto() async {
    if (_photos.length >= maxVisitPhotos) {
      setState(() => _error = AppStrings.visitPhotoLimit);
      return;
    }
    final String? path = await PhotoService().pickAndStore();
    if (path == null) return;
    setState(() {
      _draft['photoPaths'] = [..._photos, path];
      _error = null;
    });
    await _persist();
  }

  Future<void> _removePhoto(String path) async {
    setState(
      () => _draft['photoPaths'] = _photos.where((p) => p != path).toList(),
    );
    await PhotoService().deleteFile(path);
    await _persist();
  }

  Future<void> _captureSignature() async {
    final Uint8List? png = await _signature.toPngBytes();
    if (png == null) return;
    _draft['signature'] = 'data:image/png;base64,${base64Encode(png)}';
    await _persist();
    if (mounted) setState(() => _error = null);
  }

  Future<void> _discard() async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(AppStrings.visitDiscardTitle),
        content: const Text(AppStrings.visitDiscardBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(AppStrings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(AppStrings.visitDiscard),
          ),
        ],
      ),
    );
    if (ok != true) return;
    for (final p in _photos) {
      await PhotoService().deleteFile(p);
    }
    await _store?.deleteDraft(_draftKey);
    if (mounted) context.pop();
  }

  Future<void> _confirmAndSave() async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(AppStrings.visitWarningTitle),
        content: const Text(AppStrings.visitWarning),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(AppStrings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(AppStrings.visitSaveConfirm),
          ),
        ],
      ),
    );
    if (ok == true) await _save();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final writer = await ref.read(domainWriterProvider.future);
      final Map<String, dynamic>? gps = _draft['gps'] as Map<String, dynamic>?;
      final String visitedOn = _draft['visitedOn'] as String;
      final String? returnOn = _draft['returnOn'] as String?;
      await writer.createVisit(
        producerId: widget.producerId,
        propertyId: _draft['propertyId'] as String?,
        requestId: _draft['requestId'] as String?,
        visitedOn: DateTime.parse(visitedOn),
        diagnosis: _diagnosis.text,
        actionPlan: _plan.text,
        returnOn: returnOn == null ? null : DateTime.parse(returnOn),
        impact: _impact.text,
        signature: _draft['signature'] as String?,
        latitude: (gps?['latitude'] as num?)?.toDouble(),
        longitude: (gps?['longitude'] as num?)?.toDouble(),
        accuracy: (gps?['accuracy'] as num?)?.toDouble(),
        photoPaths: _photos,
      );
      await _store?.deleteDraft(_draftKey);
      syncInBackground(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text(AppStrings.visitSaved)));
      context.go('/produtores/${widget.producerId}');
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
    if (!_ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final List<Map<String, dynamic>> producers =
        ref.watch(recordsProvider('producer')).value ?? const [];
    final List<Map<String, dynamic>> properties =
        ref.watch(recordsProvider('property')).value ?? const [];
    final String producerName =
        producers
            .where((p) => p['id'] == widget.producerId)
            .map((p) => p['name'] as String? ?? '')
            .firstOrNull ??
        '';

    final bool last = _step == _stepCount - 1;
    return Scaffold(
      appBar: AppBar(
        title: Text('${AppStrings.newVisit} · ${_step + 1}/$_stepCount'),
        actions: [
          IconButton(
            tooltip: AppStrings.visitDiscard,
            icon: const Icon(Icons.delete_outline),
            onPressed: _discard,
          ),
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(
            value: (_step + 1) / _stepCount,
            color: AppColors.brand,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  _stepTitle(_step),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 12),
                ..._stepBody(producerName, properties),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 16,
                    ),
                  ),
                ],
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saving ? null : _back,
                        child: const Text(AppStrings.visitBack),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _saving
                          ? null
                          : last
                          ? _confirmAndSave
                          : _next,
                      child: Text(
                        last ? AppStrings.visitSave : AppStrings.visitNext,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _stepTitle(int step) => switch (step) {
    0 => AppStrings.visitStepProducer,
    1 => AppStrings.visitStepDiagnosis,
    2 => AppStrings.visitStepImpact,
    3 => AppStrings.visitStepPlan,
    4 => AppStrings.visitStepPhotos,
    5 => AppStrings.visitStepSignature,
    _ => AppStrings.visitStepReview,
  };

  List<Widget> _stepBody(
    String producerName,
    List<Map<String, dynamic>> properties,
  ) {
    switch (_step) {
      case 0:
        final List<Map<String, dynamic>> mine = properties
            .where((p) => p['producerId'] == widget.producerId)
            .toList();
        return [
          AppCard(
            child: Text(
              producerName,
              style: const TextStyle(fontSize: 17, color: AppColors.ink),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _draft['propertyId'] as String?,
            decoration: const InputDecoration(
              labelText: AppStrings.requestProperty,
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text(AppStrings.noneOption),
              ),
              for (final p in mine)
                DropdownMenuItem<String?>(
                  value: p['id'] as String,
                  child: Text(p['name'] as String? ?? ''),
                ),
            ],
            onChanged: (v) => setState(() => _draft['propertyId'] = v),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () async {
              final DateTime? day = await showDatePicker(
                context: context,
                initialDate: DateTime.parse(_draft['visitedOn'] as String),
                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                lastDate: DateTime.now(),
              );
              if (day == null) return;
              setState(() => _draft['visitedOn'] = dayString(day));
              await _persist();
            },
            child: Text(
              '${AppStrings.visitDate}: ${displayDay(_draft['visitedOn'] as String)}',
            ),
          ),
          const SizedBox(height: 12),
          _gpsLine(),
        ];
      case 1:
        return [
          AppField(
            controller: _diagnosis,
            label: AppStrings.visitDiagnosisLabel,
            hint: AppStrings.visitDiagnosisHint,
            maxLines: 6,
            maxLength: 2000,
          ),
        ];
      case 2:
        return [
          AppField(
            controller: _impact,
            label: AppStrings.visitImpactLabel,
            hint: AppStrings.visitImpactHint,
            maxLines: 6,
            maxLength: 2000,
          ),
        ];
      case 3:
        final String? returnOn = _draft['returnOn'] as String?;
        return [
          AppField(
            controller: _plan,
            label: AppStrings.visitPlanLabel,
            maxLines: 6,
            maxLength: 2000,
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () async {
              final DateTime? day = await showDatePicker(
                context: context,
                initialDate: DateTime.now().add(const Duration(days: 30)),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 730)),
              );
              if (day == null) return;
              setState(() => _draft['returnOn'] = dayString(day));
              await _persist();
            },
            child: Text(
              returnOn == null
                  ? AppStrings.visitReturnOn
                  : '${AppStrings.visitReturnOn}: ${displayDay(returnOn)}',
            ),
          ),
          if (returnOn != null)
            TextButton(
              onPressed: () async {
                setState(() => _draft.remove('returnOn'));
                await _persist();
              },
              child: const Text(AppStrings.visitReturnClear),
            ),
        ];
      case 4:
        return [
          const Text(
            AppStrings.visitPhotosHint,
            style: TextStyle(color: AppColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 12),
          for (final String path in _photos)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: AppTheme.radius,
                      child: Image.file(
                        File(path),
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        AppStrings.visitPhotoAdded,
                        style: TextStyle(color: AppColors.ink),
                      ),
                    ),
                    IconButton(
                      tooltip: AppStrings.visitRemovePhoto,
                      icon: const Icon(Icons.close),
                      onPressed: () => _removePhoto(path),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _photos.length >= maxVisitPhotos ? null : _addPhoto,
            icon: const Icon(Icons.add_a_photo),
            label: Text(
              '${AppStrings.visitAddPhoto} (${_photos.length}/$maxVisitPhotos)',
            ),
          ),
        ];
      case 5:
        final bool signed = _draft['signature'] != null;
        return [
          const Text(
            AppStrings.visitSignatureHint,
            style: TextStyle(color: AppColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.line),
              borderRadius: AppTheme.radius,
            ),
            child: Signature(
              controller: _signature,
              height: 220,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton(
                onPressed: () {
                  _signature.clear();
                  setState(() => _draft.remove('signature'));
                  _persist();
                },
                child: const Text(AppStrings.visitClearSignature),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: _captureSignature,
                child: const Text(AppStrings.visitConfirmSignature),
              ),
            ],
          ),
          if (signed)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Pill(AppStrings.visitSigned, color: AppColors.success),
            ),
        ];
      default:
        return [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InfoLine(
                  AppStrings.visitDate,
                  displayDay(_draft['visitedOn'] as String?),
                ),
                InfoLine(AppStrings.visitStepDiagnosis, _diagnosis.text),
                InfoLine(AppStrings.visitImpactLabel, _impact.text),
                InfoLine(AppStrings.visitStepPlan, _plan.text),
                InfoLine(
                  AppStrings.visitReturnOn,
                  displayDay(_draft['returnOn'] as String?),
                ),
                InfoLine(AppStrings.visitStepPhotos, '${_photos.length}'),
                InfoLine(
                  AppStrings.visitStepSignature,
                  _draft['signature'] != null
                      ? AppStrings.visitSigned
                      : AppStrings.visitNotSigned,
                ),
                InfoLine(
                  AppStrings.visitGps,
                  _draft['gps'] != null
                      ? AppStrings.visitGpsOk
                      : AppStrings.visitGpsMissing,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            AppStrings.visitWarning,
            style: TextStyle(color: AppColors.warning, fontSize: 15),
          ),
        ];
    }
  }

  Widget _gpsLine() {
    final Map<String, dynamic>? gps = _draft['gps'] as Map<String, dynamic>?;
    return AppCard(
      child: Row(
        children: [
          Icon(
            gps == null ? Icons.location_off : Icons.my_location,
            color: gps == null ? AppColors.warning : AppColors.success,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              gps == null ? AppStrings.visitGpsMissing : AppStrings.visitGpsOk,
              style: const TextStyle(color: AppColors.ink, fontSize: 15),
            ),
          ),
          TextButton(
            onPressed: () async {
              final GpsFix? fix = await readGps();
              if (fix == null) {
                setState(() => _error = AppStrings.propertyGpsFail);
                return;
              }
              setState(() {
                _draft['gps'] = {
                  'latitude': fix.latitude,
                  'longitude': fix.longitude,
                  'accuracy': fix.accuracy,
                };
                _error = null;
              });
              await _persist();
            },
            child: const Text(AppStrings.propertyGps),
          ),
        ],
      ),
    );
  }
}
