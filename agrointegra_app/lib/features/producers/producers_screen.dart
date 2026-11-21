import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/domain/text_utils.dart';
import '../../core/providers.dart';
import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_widgets.dart';

/// Lista de produtores com busca sem acento. Funciona offline, lendo o banco local.
class ProducersScreen extends ConsumerStatefulWidget {
  const ProducersScreen({super.key});

  @override
  ConsumerState<ProducersScreen> createState() => _ProducersScreenState();
}

class _ProducersScreenState extends ConsumerState<ProducersScreen> {
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<Map<String, dynamic>>> producers = ref.watch(
      recordsProvider('producer'),
    );
    final String query = normalizeForSearch(_search.text.trim());

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.producersTitle)),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        onPressed: () => context.push('/produtores/novo'),
        icon: const Icon(Icons.person_add),
        label: const Text(AppStrings.producerNew),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: AppStrings.producersSearch,
              ),
            ),
          ),
          Expanded(
            child: producers.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => const Center(child: Text(AppStrings.loadError)),
              data: (List<Map<String, dynamic>> rows) {
                final List<Map<String, dynamic>> visible =
                    rows.where((r) {
                      if (query.isEmpty) return true;
                      final String haystack = normalizeForSearch(
                        '${r['name'] ?? ''} ${r['community'] ?? ''}',
                      );
                      return haystack.contains(query);
                    }).toList()..sort(
                      (a, b) => (a['name'] as String? ?? '').compareTo(
                        b['name'] as String? ?? '',
                      ),
                    );

                if (visible.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: EmptyState(AppStrings.producersEmpty),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: visible.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final Map<String, dynamic> p = visible[index];
                    return AppCard(
                      onTap: () => context.push('/produtores/${p['id']}'),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p['name'] as String? ?? '',
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.ink,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${p['community'] ?? ''} · ${p['cpf'] ?? ''}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (p['_created'] == true || p['_pending'] == true)
                            const Pill(
                              AppStrings.waitingSend,
                              color: AppColors.warning,
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
