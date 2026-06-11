import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/fields.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

class SalesListScreen extends ConsumerStatefulWidget {
  const SalesListScreen({super.key});

  @override
  ConsumerState<SalesListScreen> createState() => _SalesListScreenState();
}

class _SalesListScreenState extends ConsumerState<SalesListScreen> {
  String _date = todayIso();
  String _payment = 'ALL';
  String _search = '';
  bool _loading = true;
  List<Map<String, dynamic>> _sales = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getSales(page: 1, date: _date);
      if (mounted) {
        setState(() {
          _sales = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(String id) async {
    final api = ref.read(apiServiceProvider);
    await api.deleteSale(id);
    await _load();
  }

  List<Map<String, dynamic>> get _filtered {
    return _sales.where((s) {
      if (_payment != 'ALL' && s['paymentMethod'] != _payment) return false;
      if (_search.isEmpty) return true;
      final hay = '${s['customerName'] ?? 'walk-in'} ${s['total']} ${s['paymentMethod']}'.toLowerCase();
      return hay.contains(_search.toLowerCase());
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final revenue = filtered.fold<double>(0, (s, x) => s + parseMoney('${x['total']}'));

    return ScreenShell(
      title: 'Sales',
      subtitle: 'Daily sales records',
      onRefresh: _load,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  hint: 'Search sales…',
                  onChanged: (v) => setState(() => _search = v),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                onPressed: () => context.push('/sales/new'),
                icon: const Icon(AppIcons.plus, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(child: GradientStatCard(icon: const Icon(AppIcons.shoppingBag, size: 18), label: 'Sales', value: '${filtered.length}', tone: StatTone.blue)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: GradientStatCard(icon: const Icon(AppIcons.indianRupee, size: 18), label: 'Revenue', value: formatMoney(revenue), tone: StatTone.green)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          DateField(value: _date, onChanged: (v) { setState(() => _date = v); _load(); }),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<String>(
            value: _payment,
            decoration: const InputDecoration(labelText: 'Payment'),
            items: ['ALL', 'CASH', 'UPI', 'CARD'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
            onChanged: (v) => setState(() => _payment = v ?? 'ALL'),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_loading) const PageLoader()
          else if (filtered.isEmpty) const EmptyState(message: 'No sales for this date.')
          else ...filtered.map((sale) => _SaleCard(sale: sale, onDelete: () => _delete(sale['id'] as String))),
        ],
      ),
    );
  }
}

class _SaleCard extends StatelessWidget {
  const _SaleCard({required this.sale, required this.onDelete});

  final Map<String, dynamic> sale;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final lines = (sale['lines'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final products = lines.map((l) {
      final qty = l['quantity'] ?? 1;
      return qty > 1 ? '${l['productName']} ×$qty' : '${l['productName']}';
    }).join(', ');

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${sale['customerName'] ?? 'Walk-in'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(products.isEmpty ? '—' : products, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(formatMoney(parseMoney('${sale['total']}')), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.accent)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(AppIcons.trash2, color: AppColors.red, size: 18),
              onPressed: () => ConfirmDialog.show(
                context,
                title: 'Delete sale?',
                message: 'This will restore stock for sold items.',
                onConfirm: onDelete,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
