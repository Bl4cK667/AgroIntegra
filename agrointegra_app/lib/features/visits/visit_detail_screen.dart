import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Visita salva: somente leitura (a visita é imutável depois de criada).
class VisitDetailScreen extends ConsumerWidget {
  const VisitDetailScreen({super.key, required this.visitId});

  final String visitId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<Map<String, dynamic>> visits =
        ref.watch(recordsProvider('visit')).value ?? const [];
    final Map<String, dynamic>? v = visits
        .where((r) => r['id'] == visitId)
        .firstOrNull;
    if (v == null) {
      return const Scaffold(body: Center(child: Text(AppStrings.notFound)));
    }
    final bool pending = v['_created'] == true;

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.visitDetail)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (pending)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Pill(AppStrings.waitingSend, color: AppColors.warning),
            ),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InfoLine(
                  AppStrings.visitDate,
                  displayDay(v['visitedOn'] as String?),
                ),
                InfoLine(
                  AppStrings.visitStepDiagnosis,
                  v['diagnosis'] as String?,
                ),
                InfoLine(AppStrings.visitImpactLabel, v['impact'] as String?),
                InfoLine(AppStrings.visitStepPlan, v['actionPlan'] as String?),
                InfoLine(
                  AppStrings.visitReturnOn,
                  displayDay(v['returnOn'] as String?),
                ),
                InfoLine(AppStrings.visitStepPhotos, '${v['photoCount'] ?? 0}'),
                InfoLine(
                  AppStrings.visitGps,
                  v['location'] != null
                      ? AppStrings.visitGpsOk
                      : AppStrings.visitGpsMissing,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            AppStrings.visitReadOnly,
            style: TextStyle(color: AppColors.muted, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
