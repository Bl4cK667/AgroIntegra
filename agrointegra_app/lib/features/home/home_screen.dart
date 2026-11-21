import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/strings/app_strings.dart';
import '../../core/sync/sync_controller.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';
import '../requests/request_labels.dart';

/// Agenda: solicitações agendadas (atrasadas, hoje e próximas), status da sincronização e atalhos.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text(AppStrings.logoutConfirmTitle),
        content: const Text(AppStrings.logoutConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text(AppStrings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text(AppStrings.logout),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(authProvider.notifier).signOut();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool expired = ref.watch(authProvider).session?.isExpired ?? false;
    final List<Map<String, dynamic>> requests =
        ref.watch(recordsProvider('request')).value ?? const [];
    final List<Map<String, dynamic>> producers =
        ref.watch(recordsProvider('producer')).value ?? const [];
    final Map<String, String> producerNames = {
      for (final p in producers) p['id'] as String: p['name'] as String? ?? '',
    };

    final String today = dayString(DateTime.now());
    final List<Map<String, dynamic>> scheduled =
        requests
            .where(
              (r) => r['status'] == 'SCHEDULED' && r['scheduledFor'] != null,
            )
            .toList()
          ..sort(
            (a, b) => (a['scheduledFor'] as String).compareTo(
              b['scheduledFor'] as String,
            ),
          );
    final List<Map<String, dynamic>> late = scheduled
        .where((r) => (r['scheduledFor'] as String).compareTo(today) < 0)
        .toList();
    final List<Map<String, dynamic>> todayList = scheduled
        .where((r) => r['scheduledFor'] == today)
        .toList();
    final List<Map<String, dynamic>> upcoming = scheduled
        .where((r) => (r['scheduledFor'] as String).compareTo(today) > 0)
        .toList();
    final int open = requests
        .where((r) => r['status'] == 'NEW' || r['status'] == 'IN_REVIEW')
        .length;
    final SyncStatus sync = ref.watch(syncControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.agendaTitle),
        actions: [
          IconButton(
            tooltip: AppStrings.syncStatusTooltip,
            icon: const Icon(Icons.sync),
            onPressed: () => context.push(AppRoutes.pending),
          ),
          IconButton(
            tooltip: AppStrings.logout,
            icon: const Icon(Icons.logout),
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (expired) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.12),
                border: Border.all(color: AppColors.warning),
                borderRadius: AppTheme.radius,
              ),
              child: const Text(
                AppStrings.sessionExpiredBanner,
                style: TextStyle(color: AppColors.warning, fontSize: 15),
              ),
            ),
            const SizedBox(height: 12),
          ],
          _SyncCard(status: sync),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _Shortcut(
                  icon: Icons.groups,
                  label: AppStrings.producersTitle,
                  onTap: () => context.push('/produtores'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Shortcut(
                  icon: Icons.assignment,
                  label: '${AppStrings.requestsTitle} ($open)',
                  onTap: () => context.push('/solicitacoes'),
                ),
              ),
            ],
          ),
          const SectionTitle(AppStrings.requestAgendaLate),
          _AgendaGroup(
            items: late,
            producerNames: producerNames,
            empty: AppStrings.requestAgendaNoneLate,
          ),
          const SectionTitle(AppStrings.requestAgendaToday),
          _AgendaGroup(
            items: todayList,
            producerNames: producerNames,
            empty: AppStrings.requestAgendaNoneToday,
          ),
          const SectionTitle(AppStrings.requestAgendaUpcoming),
          _AgendaGroup(
            items: upcoming,
            producerNames: producerNames,
            empty: AppStrings.requestAgendaNoneUpcoming,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _AgendaGroup extends StatelessWidget {
  const _AgendaGroup({
    required this.items,
    required this.producerNames,
    required this.empty,
  });

  final List<Map<String, dynamic>> items;
  final Map<String, String> producerNames;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return EmptyState(empty);
    return Column(
      children: [
        for (final r in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              onTap: () => context.push('/solicitacoes/${r['id']}'),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r['subject'] as String? ?? '',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${producerNames[r['producerId']] ?? ''} · ${displayDay(r['scheduledFor'] as String?)}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Pill(priorityLabel(r['priority'] as String? ?? 'MEDIUM')),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        children: [
          Icon(icon, color: AppColors.brand, size: 28),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.ink, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

class _SyncCard extends ConsumerWidget {
  const _SyncCard({required this.status});

  final SyncStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (IconData icon, Color color, String text) = switch (status.phase) {
      SyncPhase.syncing => (
        Icons.sync,
        AppColors.muted,
        AppStrings.syncSyncing,
      ),
      SyncPhase.upToDate => (
        Icons.cloud_done,
        AppColors.success,
        AppStrings.syncUpToDate,
      ),
      SyncPhase.pending => (
        Icons.cloud_upload,
        AppColors.warning,
        '${status.pendingCount} ${AppStrings.syncPending}',
      ),
      SyncPhase.offline => (
        Icons.cloud_off,
        AppColors.muted,
        AppStrings.syncOffline,
      ),
      SyncPhase.needsLogin => (
        Icons.lock_clock,
        AppColors.warning,
        AppStrings.syncNeedsLogin,
      ),
      SyncPhase.error => (
        Icons.error_outline,
        AppColors.danger,
        AppStrings.syncError,
      ),
      SyncPhase.idle => (
        Icons.cloud_queue,
        AppColors.muted,
        AppStrings.syncNow,
      ),
    };

    return AppCard(
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: AppColors.ink, fontSize: 16),
            ),
          ),
          TextButton(
            onPressed: status.phase == SyncPhase.syncing
                ? null
                : () => ref.read(syncControllerProvider.notifier).syncNow(),
            child: const Text(AppStrings.syncNow),
          ),
        ],
      ),
    );
  }
}
