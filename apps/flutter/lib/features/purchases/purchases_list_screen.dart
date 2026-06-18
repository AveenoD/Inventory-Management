import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

String _formatPurchaseItems(List<dynamic> lines) {
  if (lines.isEmpty) return '—';
  return lines.map((l) {
    final line = l as Map<String, dynamic>;
    final qty = line['quantity'] ?? 1;
    final name = line['productName'] ?? '';
    return qty > 1 ? '$name ×$qty' : '$name';
  }).join(', ');
}

class PurchasesListScreen extends ConsumerStatefulWidget {
  const PurchasesListScreen({super.key});

  @override
  ConsumerState<PurchasesListScreen> createState() => _PurchasesListScreenState();
}

class _PurchasesListScreenState extends ConsumerState<PurchasesListScreen> {
  String _dateFilter = todayIso();
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  List<Map<String, dynamic>> _purchases = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      setState(() => _refreshing = true);
    } else {
      setState(() {
        _loading = _purchases.isEmpty;
        _error = null;
      });
    }
    try {
      final res = await ref.read(apiServiceProvider).getPurchases(date: _dateFilter);
      if (!mounted) return;
      setState(() {
        _purchases = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
        _refreshing = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        _error = e is ApiError ? e.message : 'Could not load purchases.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Purchases',
      subtitle: 'Stock in from suppliers',
      showBack: true,
      refreshing: _refreshing,
      onRefresh: () => _load(refresh: true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DateField(value: _dateFilter, onChanged: (v) {
            setState(() => _dateFilter = v);
            _load();
          }),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: 'New purchase',
            onPressed: () => context.push('/purchases/new'),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_loading)
            const PageLoader(message: 'Loading purchases…')
          else if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.red))
          else if (_purchases.isEmpty)
            const Text('No purchases for this date', style: TextStyle(color: AppColors.muted))
          else
            ..._purchases.map((p) => _PurchaseCard(purchase: p)),
        ],
      ),
    );
  }
}

class _PurchaseCard extends StatelessWidget {
  const _PurchaseCard({required this.purchase});

  final Map<String, dynamic> purchase;

  @override
  Widget build(BuildContext context) {
    final lines = purchase['lines'] as List<dynamic>? ?? [];
    final total = parseMoney('${purchase['total']}');
    final paid = parseMoney('${purchase['paidAmount']}');
    final balance = parseMoney('${purchase['balanceDue']}');

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  purchase['partyName']?.toString() ?? 'Supplier',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                purchase['date']?.toString() ?? '',
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _formatPurchaseItems(lines),
            style: const TextStyle(color: AppColors.muted, fontSize: 14),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              _amountChip('Total', formatMoney(total)),
              const SizedBox(width: AppSpacing.sm),
              _amountChip('Paid', formatMoney(paid)),
              const SizedBox(width: AppSpacing.sm),
              _amountChip(
                'Due',
                formatMoney(balance),
                color: balance > 0 ? AppColors.amber : AppColors.green,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _amountChip(String label, String value, {Color? color}) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.w700, color: color ?? AppColors.text),
          ),
        ],
      ),
    );
  }
}
