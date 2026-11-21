import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Ficha do produtor: dados, propriedades, visitas e solicitações.
class ProducerDetailScreen extends ConsumerWidget {
  const ProducerDetailScreen({super.key, required this.producerId});

  final String producerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Map<String, dynamic>>> producers = ref.watch(
      recordsProvider('producer'),
    );
    final List<Map<String, dynamic>> properties =
        ref.watch(recordsProvider('property')).value ?? const [];
    final List<Map<String, dynamic>> visits =
        ref.watch(recordsProvider('visit')).value ?? const [];
    final List<Map<String, dynamic>> requests =
        ref.watch(recordsProvider('request')).value ?? const [];

    return producers.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) =>
          const Scaffold(body: Center(child: Text(AppStrings.loadError))),
      data: (rows) {
        final Map<String, dynamic>? p = rows
            .where((r) => r['id'] == producerId)
            .firstOrNull;
        if (p == null) {
          return const Scaffold(body: Center(child: Text(AppStrings.notFound)));
        }

        final List<Map<String, dynamic>> myProperties = properties
            .where((r) => r['producerId'] == producerId)
            .toList();
        final List<Map<String, dynamic>> myVisits =
            visits.where((r) => r['producerId'] == producerId).toList()..sort(
              (a, b) => (b['visitedOn'] as String? ?? '').compareTo(
                a['visitedOn'] as String? ?? '',
              ),
            );
        final List<Map<String, dynamic>> myRequests = requests
            .where((r) => r['producerId'] == producerId)
            .toList();

        return Scaffold(
          appBar: AppBar(
            title: Text(p['name'] as String? ?? AppStrings.producerDetail),
            actions: [
              IconButton(
                tooltip: AppStrings.producerEdit,
                icon: const Icon(Icons.edit),
                onPressed: () => context.push('/produtores/$producerId/editar'),
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
                    InfoLine(AppStrings.producerCpf, p['cpf'] as String?),
                    InfoLine(
                      AppStrings.producerCommunity,
                      p['community'] as String?,
                    ),
                    InfoLine(AppStrings.producerPhone, p['phone'] as String?),
                    InfoLine(
                      AppStrings.producerConsentDate,
                      displayDay(p['consentAt'] as String?),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.push(
                        '/propriedades/nova?producerId=$producerId',
                      ),
                      child: const Text(AppStrings.newProperty),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.push(
                        '/solicitacoes/nova?producerId=$producerId',
                      ),
                      child: const Text(AppStrings.newRequest),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              PrimaryButton(
                label: AppStrings.newVisit,
                onPressed: () =>
                    context.push('/visitas/nova?producerId=$producerId'),
              ),
              const SectionTitle(AppStrings.producerProperties),
              if (myProperties.isEmpty)
                const EmptyState(AppStrings.producerNoProperties)
              else
                for (final Map<String, dynamic> pr in myProperties)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      onTap: () => context.push('/propriedades/${pr['id']}'),
                      child: Text(
                        '${pr['name'] ?? ''} · ${pr['areaHa'] ?? '-'} ha · ${pr['locality'] ?? ''}',
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
              const SectionTitle(AppStrings.producerVisits),
              if (myVisits.isEmpty)
                const EmptyState(AppStrings.producerNoVisits)
              else
                for (final Map<String, dynamic> v in myVisits)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      onTap: () => context.push('/visitas/${v['id']}'),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${displayDay(v['visitedOn'] as String?)} · ${v['diagnosis'] ?? ''}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.ink,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          if (v['_created'] == true)
                            const Pill(
                              AppStrings.waitingSend,
                              color: AppColors.warning,
                            ),
                        ],
                      ),
                    ),
                  ),
              const SectionTitle(AppStrings.producerRequests),
              if (myRequests.isEmpty)
                const EmptyState(AppStrings.producerNoRequests)
              else
                for (final Map<String, dynamic> r in myRequests)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      onTap: () => context.push('/solicitacoes/${r['id']}'),
                      child: Text(
                        r['subject'] as String? ?? '',
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}
