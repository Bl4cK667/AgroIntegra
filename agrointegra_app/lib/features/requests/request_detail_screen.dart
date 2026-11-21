import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/domain_writer.dart';
import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';
import 'request_labels.dart';

/// Ficha da solicitação: status, prioridade e atalho para registrar a visita.
class RequestDetailScreen extends ConsumerWidget {
  const RequestDetailScreen({super.key, required this.requestId});

  final String requestId;

  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
  ) async {
    try {
      await action();
      syncInBackground(ref);
    } on StateError catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<Map<String, dynamic>> rows =
        ref.watch(recordsProvider('request')).value ?? const [];
    final List<Map<String, dynamic>> producers =
        ref.watch(recordsProvider('producer')).value ?? const [];
    final List<Map<String, dynamic>> properties =
        ref.watch(recordsProvider('property')).value ?? const [];
    final Map<String, dynamic>? r = rows
        .where((x) => x['id'] == requestId)
        .firstOrNull;
    if (r == null) {
      return const Scaffold(body: Center(child: Text(AppStrings.notFound)));
    }

    final bool local = DomainWriter.isLocalId(requestId);
    final String status = r['status'] as String? ?? 'NEW';
    final String producerName =
        producers
            .where((p) => p['id'] == r['producerId'])
            .map((p) => p['name'] as String? ?? '')
            .firstOrNull ??
        '';
    final String propertyName =
        properties
            .where((p) => p['id'] == r['propertyId'])
            .map((p) => p['name'] as String? ?? '')
            .firstOrNull ??
        '';
    final DomainWriter? writer = ref.watch(domainWriterProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.requestDetail)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r['subject'] as String? ?? '',
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Pill(statusLabel(status), color: statusColor(status)),
                    const SizedBox(width: 8),
                    Pill(priorityLabel(r['priority'] as String? ?? 'MEDIUM')),
                    if (local) ...[
                      const SizedBox(width: 8),
                      const Pill(
                        AppStrings.waitingSend,
                        color: AppColors.warning,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                InfoLine(AppStrings.requestProducer, producerName),
                InfoLine(AppStrings.requestProperty, propertyName),
                InfoLine(
                  AppStrings.requestScheduledLabel,
                  displayDay(r['scheduledFor'] as String?),
                ),
                InfoLine(
                  AppStrings.requestDescription,
                  r['description'] as String?,
                ),
              ],
            ),
          ),
          if (local)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                AppStrings.requestTempBlocked,
                style: TextStyle(color: AppColors.muted, fontSize: 15),
              ),
            ),
          const SectionTitle(AppStrings.requestChangeStatus),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: local || writer == null
                    ? null
                    : () => _run(
                        context,
                        ref,
                        () =>
                            writer.changeRequestStatus(r, status: 'IN_REVIEW'),
                      ),
                child: const Text(AppStrings.requestMarkInReview),
              ),
              OutlinedButton(
                onPressed: local || writer == null
                    ? null
                    : () async {
                        final DateTime? day = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime.now().subtract(
                            const Duration(days: 365),
                          ),
                          lastDate: DateTime.now().add(
                            const Duration(days: 365),
                          ),
                        );
                        if (day == null || !context.mounted) return;
                        await _run(
                          context,
                          ref,
                          () => writer.changeRequestStatus(
                            r,
                            status: 'SCHEDULED',
                            scheduledFor: dayString(day),
                          ),
                        );
                      },
                child: const Text(AppStrings.requestSchedule),
              ),
              OutlinedButton(
                onPressed: local || writer == null
                    ? null
                    : () => _run(
                        context,
                        ref,
                        () => writer.changeRequestStatus(r, status: 'DONE'),
                      ),
                child: const Text(AppStrings.requestMarkDone),
              ),
            ],
          ),
          const SectionTitle(AppStrings.requestPriority),
          Wrap(
            spacing: 8,
            children: [
              for (final p in priorities)
                ChoiceChip(
                  label: Text(priorityLabel(p)),
                  selected: r['priority'] == p,
                  onSelected: local || writer == null
                      ? null
                      : (_) => _run(
                          context,
                          ref,
                          () => writer.changeRequestPriority(r, priority: p),
                        ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: AppStrings.requestOpenVisit,
            onPressed: local
                ? null
                : () {
                    final String? propertyId = r['propertyId'] as String?;
                    final String producerId = r['producerId'] as String;
                    context.push(
                      '/visitas/nova?producerId=$producerId&requestId=$requestId'
                      '${propertyId == null ? '' : '&propertyId=$propertyId'}',
                    );
                  },
          ),
        ],
      ),
    );
  }
}
