import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/location/gps.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// UFs aceitas pela API.
const List<String> brazilStates = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

/// Cadastro (com produtor) ou edição (com id) de propriedade.
class PropertyFormScreen extends ConsumerStatefulWidget {
  const PropertyFormScreen({super.key, this.propertyId, this.producerId});

  final String? propertyId;
  final String? producerId;

  @override
  ConsumerState<PropertyFormScreen> createState() => _PropertyFormScreenState();
}

class _PropertyFormScreenState extends ConsumerState<PropertyFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _area = TextEditingController();
  final _locality = TextEditingController();
  final _activity = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  String? _state;
  GpsFix? _gps;
  bool _loaded = false;
  bool _saving = false;
  bool _gpsBusy = false;
  String? _error;

  bool get _isNew => widget.propertyId == null;

  @override
  void dispose() {
    for (final c in [_name, _area, _locality, _activity, _address, _city]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fillFrom(Map<String, dynamic> p) {
    if (_loaded) return;
    _loaded = true;
    _name.text = p['name'] as String? ?? '';
    _area.text = '${p['areaHa'] ?? ''}';
    _locality.text = p['locality'] as String? ?? '';
    _activity.text = p['mainActivity'] as String? ?? '';
    _address.text = p['address'] as String? ?? '';
    _city.text = p['city'] as String? ?? '';
    _state = p['state'] as String?;
    final Map<String, dynamic>? coords =
        p['coordinates'] as Map<String, dynamic>?;
    if (coords != null) {
      _gps = GpsFix(
        latitude: (coords['latitude'] as num).toDouble(),
        longitude: (coords['longitude'] as num).toDouble(),
        accuracy: 0,
      );
    }
  }

  Future<void> _readGps() async {
    setState(() => _gpsBusy = true);
    final GpsFix? fix = await readGps();
    if (!mounted) return;
    setState(() {
      _gpsBusy = false;
      if (fix != null) {
        _gps = fix;
        _error = null;
      } else {
        _error = AppStrings.propertyGpsFail;
      }
    });
  }

  Future<void> _save(Map<String, dynamic>? current) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final double area = double.parse(_area.text.replaceAll(',', '.'));
    try {
      final writer = await ref.read(domainWriterProvider.future);
      if (_isNew) {
        await writer.createProperty(
          producerId: widget.producerId!,
          name: _name.text,
          areaHa: area,
          locality: _locality.text,
          mainActivity: _activity.text,
          address: _address.text,
          city: _city.text,
          state: _state,
          latitude: _gps?.latitude,
          longitude: _gps?.longitude,
        );
      } else {
        await writer.updateProperty(
          current!,
          name: _name.text,
          areaHa: area,
          locality: _locality.text,
          mainActivity: _activity.text,
          address: _address.text,
          city: _city.text,
          state: _state,
          latitude: _gps?.latitude,
          longitude: _gps?.longitude,
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
    Map<String, dynamic>? current;
    if (!_isNew) {
      final List<Map<String, dynamic>> rows =
          ref.watch(recordsProvider('property')).value ?? const [];
      current = rows.where((r) => r['id'] == widget.propertyId).firstOrNull;
      if (current != null) _fillFrom(current);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isNew ? AppStrings.propertyNew : AppStrings.propertyEdit),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppField(
              controller: _name,
              label: AppStrings.propertyName,
              maxLength: 120,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? AppStrings.propertyNameRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _area,
              label: AppStrings.propertyArea,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              validator: (v) {
                final double? n = double.tryParse(
                  (v ?? '').replaceAll(',', '.'),
                );
                return (n == null || n <= 0)
                    ? AppStrings.propertyAreaInvalid
                    : null;
              },
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _locality,
              label: AppStrings.propertyLocality,
              maxLength: 120,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? AppStrings.propertyLocalityRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _activity,
              label: AppStrings.propertyActivity,
              maxLength: 120,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _address,
              label: AppStrings.propertyAddress,
              maxLength: 160,
            ),
            const SizedBox(height: 12),
            AppField(
              controller: _city,
              label: AppStrings.propertyCity,
              maxLength: 80,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _state,
              decoration: const InputDecoration(
                labelText: AppStrings.propertyState,
              ),
              items: [
                for (final uf in brazilStates)
                  DropdownMenuItem(value: uf, child: Text(uf)),
              ],
              onChanged: (v) => setState(() => _state = v),
            ),
            const SizedBox(height: 16),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    AppStrings.propertyCoords,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _gps == null
                        ? AppStrings.propertyNoCoords
                        : '${_gps!.latitude.toStringAsFixed(6)}, ${_gps!.longitude.toStringAsFixed(6)}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _gpsBusy ? null : _readGps,
                    icon: const Icon(Icons.my_location),
                    label: Text(
                      _gpsBusy ? AppStrings.loading : AppStrings.propertyGps,
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
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
