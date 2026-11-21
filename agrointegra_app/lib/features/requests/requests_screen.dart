import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/text_utils.dart';
import '../../core/domain/domain_writer.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';
import 'request_labels.dart';

/// Todas as solicitações, com filtro por status.
class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> {
  String? _filter;

  static const List<String?> _filters = [
    null,
    'NEW',
    'IN_REVIEW',
    'SCHEDULED',
    'DONE',
  ];

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> requests =
        ref.watch(recordsProvider('request')).value ?? const [];
    final List<Map<String, dynamic>> producers =
        ref.watch(recordsProvider('producer')).value ?? const [];
    final Map<String, String> producerNames = {
      for (final p in producers) p['id'] as String: p['name'] as String? ?? '',
    };

    final List<Map<String, dynamic>> visible =
        requests
            .where((r) => _filter == null || r['status'] == _filter)
            .toList()
          ..sort(
            (a, b) => (b['createdAt'] as String? ?? '').compareTo(
              a['createdAt'] as String? ?? '',
            ),
          );

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.requestsTitle)),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        onPressed: () => context.push('/solicitacoes/nova'),
        icon: const Icon(Icons.add_task),
        label: const Text(AppStrings.newRequest),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              children: [
                for (final String? f in _filters)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                        f == null ? AppStrings.requestsAll : statusLabel(f),
                      ),
                      selected: _filter == f,
                      onSelected: (_) => setState(() => _filter = f),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: visible.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: EmptyState(AppStrings.requestsEmpty),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: visible.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final Map<String, dynamic> r = visible[index];
                      final bool local = DomainWriter.isLocalId(
                        r['id'] as String,
                      );
                      return AppCard(
                        onTap: () => context.push('/solicitacoes/${r['id']}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    r['subject'] as String? ?? '',
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.ink,
                                    ),
                                  ),
                                ),
                                Pill(
                                  statusLabel(r['status'] as String? ?? ''),
                                  color: statusColor(
                                    r['status'] as String? ?? '',
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                producerNames[r['producerId']] ?? '',
                                if (r['scheduledFor'] != null)
                                  'Agendada: ${displayDay(r['scheduledFor'] as String?)}',
                              ].where((s) => s.isNotEmpty).join(' · '),
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 15,
                              ),
                            ),
                            if (local)
                              const Padding(
                                padding: EdgeInsets.only(top: 6),
                                child: Pill(
                                  AppStrings.waitingSend,
                                  color: AppColors.warning,
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
