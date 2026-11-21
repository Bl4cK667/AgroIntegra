import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Ficha da propriedade com mapa somente leitura (satélite).
class PropertyDetailScreen extends ConsumerWidget {
  const PropertyDetailScreen({super.key, required this.propertyId});

  final String propertyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<Map<String, dynamic>> rows =
        ref.watch(recordsProvider('property')).value ?? const [];
    final Map<String, dynamic>? p = rows
        .where((r) => r['id'] == propertyId)
        .firstOrNull;
    if (p == null) {
      return const Scaffold(body: Center(child: Text(AppStrings.notFound)));
    }

    final Map<String, dynamic>? coords =
        p['coordinates'] as Map<String, dynamic>?;
    final LatLng? point = coords == null
        ? null
        : LatLng(
            (coords['latitude'] as num).toDouble(),
            (coords['longitude'] as num).toDouble(),
          );

    return Scaffold(
      appBar: AppBar(
        title: Text(p['name'] as String? ?? AppStrings.propertyTitle),
        actions: [
          IconButton(
            tooltip: AppStrings.propertyEdit,
            icon: const Icon(Icons.edit),
            onPressed: () => context.push('/propriedades/$propertyId/editar'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InfoLine(AppStrings.propertyLocality, p['locality'] as String?),
                InfoLine(
                  AppStrings.propertyArea,
                  p['areaHa'] == null ? null : '${p['areaHa']} ha',
                ),
                InfoLine(
                  AppStrings.propertyActivity,
                  p['mainActivity'] as String?,
                ),
                InfoLine(AppStrings.propertyAddress, p['address'] as String?),
                InfoLine(AppStrings.propertyCity, p['city'] as String?),
                InfoLine(AppStrings.propertyState, p['state'] as String?),
              ],
            ),
          ),
          const SectionTitle(AppStrings.propertyMap),
          if (point == null)
            const EmptyState(AppStrings.propertyNoCoords)
          else
            ClipRRect(
              borderRadius: AppTheme.radius,
              child: SizedBox(
                height: 280,
                child: FlutterMap(
                  options: MapOptions(initialCenter: point, initialZoom: 15),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                      userAgentPackageName: 'br.com.integratech.agrointegra',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: point,
                          width: 36,
                          height: 36,
                          child: const Icon(
                            Icons.location_on,
                            color: AppColors.danger,
                            size: 36,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          if (point != null)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                AppStrings.mapAttribution,
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
