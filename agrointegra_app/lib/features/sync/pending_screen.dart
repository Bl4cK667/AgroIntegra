import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/database/app_database.dart';
import '../../core/strings/app_strings.dart';
import '../../core/sync/sync_controller.dart';
import '../../core/theme/app_theme.dart';

/// Tela de pendências: o que ainda não subiu e o que precisa de atenção.
class PendingScreen extends ConsumerWidget {
  const PendingScreen({super.key});

  static String _entityLabel(String entity) => switch (entity) {
    'producer' => AppStrings.pendingEntityProducer,
    'property' => AppStrings.pendingEntityProperty,
    'visit' => AppStrings.pendingEntityVisit,
    'feature' => AppStrings.pendingEntityFeature,
    'request' => AppStrings.pendingEntityRequest,
    _ => entity,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<OutboxEntry>> ops = ref.watch(pendingOpsProvider);
    final SyncStatus status = ref.watch(syncControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.pendingTitle)),
      body: Column(
        children: [
          Expanded(
            child: ops.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => const Center(child: Text(AppStrings.syncError)),
              data: (List<OutboxEntry> rows) {
                if (rows.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        AppStrings.pendingEmpty,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted, fontSize: 17),
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) => _OpTile(entry: rows[index]),
                );
              },
            ),
          ),
          if (status.message != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                status.message!,
                style: const TextStyle(color: AppColors.warning, fontSize: 15),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: status.phase == SyncPhase.syncing
                  ? null
                  : () => ref.read(syncControllerProvider.notifier).syncNow(),
              child: Text(
                status.phase == SyncPhase.syncing
                    ? AppStrings.syncSyncing
                    : AppStrings.syncNow,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OpTile extends StatelessWidget {
  const _OpTile({required this.entry});

  final OutboxEntry entry;

  @override
  Widget build(BuildContext context) {
    final bool failed = entry.status == 'failed';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: failed ? AppColors.danger : AppColors.line),
        borderRadius: AppTheme.radius,
      ),
      child: Row(
        children: [
          Icon(
            failed ? Icons.error_outline : Icons.schedule,
            color: failed ? AppColors.danger : AppColors.muted,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  PendingScreen._entityLabel(entry.entity),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  failed
                      ? (entry.lastError ?? AppStrings.pendingNeedsAttention)
                      : AppStrings.pendingWaiting,
                  style: TextStyle(
                    color: failed ? AppColors.danger : AppColors.muted,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
