import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/fields.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  String _search = '';
  String _segment = 'all';
  String? _kind;
  bool _loading = true;
  List<Map<String, dynamic>> _products = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final filters = <String, String>{};
      if (_segment == 'covers') filters['segment'] = 'covers';
      if (_segment == 'other') filters['segment'] = 'other_accessories';
      final res = await api.getProducts(
        page: 1,
        search: _search.isEmpty ? null : _search,
        kind: _kind,
        limit: 100,
        filters: filters.isEmpty ? null : filters,
      );
      if (mounted) {
        setState(() {
          _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(String id) async {
    await ref.read(apiServiceProvider).deleteProduct(id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Inventory',
      subtitle: 'Products and stock',
      showBack: true,
      onRefresh: _load,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: AppTextField(hint: 'Search products…', onChanged: (v) { _search = v; _load(); })),
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                onPressed: () => context.push('/inventory/new'),
                icon: const Icon(AppIcons.plus, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              FilterChip(label: const Text('All'), selected: _segment == 'all', onSelected: (_) { setState(() => _segment = 'all'); _load(); }),
              FilterChip(label: const Text('Covers'), selected: _segment == 'covers', onSelected: (_) { setState(() => _segment = 'covers'); _load(); }),
              FilterChip(label: const Text('Accessories'), selected: _segment == 'other', onSelected: (_) { setState(() => _segment = 'other'); _load(); }),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_loading) const PageLoader()
          else if (_products.isEmpty) const EmptyState(message: 'No products found.')
          else ..._products.map((p) => Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                child: ListTile(
                  title: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${p['kind']} · Stock ${p['stockQty']} · ${formatMoney(parseMoney('${p['salePrice']}'))}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(AppIcons.packagePlus, size: 18),
                        onPressed: () => context.push('/inventory/${p['id']}/stock'),
                      ),
                      IconButton(
                        icon: const Icon(AppIcons.trash2, size: 18, color: AppColors.red),
                        onPressed: () => ConfirmDialog.show(
                          context,
                          title: 'Delete product?',
                          message: 'This cannot be undone.',
                          onConfirm: () => _delete(p['id'] as String),
                        ),
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }
}
