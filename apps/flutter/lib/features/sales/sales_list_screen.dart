import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

const _paymentFilters = ['ALL', 'CASH', 'UPI', 'CARD'];

String _formatSaleProducts(List<dynamic> lines) {
  if (lines.isEmpty) return '—';
  return lines.map((l) {
    final line = l as Map<String, dynamic>;
    final qty = line['quantity'] ?? 1;
    final name = line['productName'] ?? '';
    return qty > 1 ? '$name ×$qty' : '$name';
  }).join(', ');
}

class SalesListScreen extends ConsumerStatefulWidget {
  const SalesListScreen({super.key});

  @override
  ConsumerState<SalesListScreen> createState() => _SalesListScreenState();
}

class _SalesListScreenState extends ConsumerState<SalesListScreen> {
  String _dateFilter = todayIso();
  String _paymentFilter = 'ALL';
  String _search = '';
  String _searchDebounced = '';
  Timer? _searchDebounce;

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  bool _deleting = false;
  List<Map<String, dynamic>> _sales = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  bool get _hasActiveFilters =>
      _paymentFilter != 'ALL' ||
      _searchDebounced.isNotEmpty ||
      _dateFilter != todayIso();

  List<Map<String, dynamic>> get _filteredSales {
    return _sales.where((s) {
      if (_paymentFilter != 'ALL' && s['paymentMethod'] != _paymentFilter) return false;
      if (_searchDebounced.isEmpty) return true;
      final lines = s['lines'] as List<dynamic>? ?? [];
      final hay = [
        s['customerName'] ?? 'walk-in',
        _formatSaleProducts(lines),
        s['paymentMethod'],
        s['subtotal'],
        s['discount'],
        s['total'],
      ].join(' ').toLowerCase();
      return hay.contains(_searchDebounced);
    }).toList();
  }

  ({int count, double revenue, int items}) get _summary {
    final filtered = _filteredSales;
    final revenue = filtered.fold<double>(0, (sum, s) => sum + parseMoney('${s['total']}'));
    final items = filtered.fold<int>(0, (sum, s) {
      final lines = s['lines'] as List<dynamic>? ?? [];
      return sum + lines.length;
    });
    return (count: filtered.length, revenue: revenue, items: items);
  }

  void _onSearchChanged(String value) {
    setState(() => _search = value);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _searchDebounced = value.trim().toLowerCase());
    });
  }

  Future<void> _load() async {
    if (!_refreshing) {
      setState(() {
        _loading = _sales.isEmpty;
        _error = null;
      });
    }
    try {
      final res = await ref.read(apiServiceProvider).getSales(page: 1, date: _dateFilter);
      if (!mounted) return;
      setState(() {
        _sales = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
        _refreshing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load sales.';
        _loading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    await _load();
  }

  void _clearFilters() {
    setState(() {
      _dateFilter = todayIso();
      _paymentFilter = 'ALL';
      _search = '';
      _searchDebounced = '';
    });
    _load();
  }

  Future<void> _deleteSale(String id) async {
    setState(() => _deleting = true);
    try {
      await ref.read(apiServiceProvider).deleteSale(id);
      if (!mounted) return;
      setState(() => _deleting = false);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiError ? e.message : 'Could not delete sale.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _summary;
    final filtered = _filteredSales;
    final today = todayIso();

    return ScreenShell(
      title: 'Sales',
      subtitle: formatDateLabel(_dateFilter),
      titleFontSize: 24,
      scroll: false,
      refreshing: _refreshing && !_loading,
      onRefresh: _refresh,
      child: _loading
          ? const Center(child: PageLoader(message: 'Loading sales…'))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    children: [
                      _buildToolbar(),
                      _buildMetrics(summary),
                      _buildFilterCard(today),
                      if (filtered.isEmpty)
                        _buildEmptyState()
                      else
                        ...filtered.map(_buildSaleCard),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_error!, style: const TextStyle(color: AppColors.red)),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildToolbar() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        children: [
          SearchField(
            value: _search,
            onChanged: _onSearchChanged,
            placeholder: 'Search customer, product…',
          ),
          const SizedBox(height: AppSpacing.sm),
          PrimaryButton(
            label: '+ New sale',
            onPressed: () => context.push('/sales/new'),
          ),
        ],
      ),
    );
  }

  Widget _buildMetrics(({int count, double revenue, int items}) summary) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Icon(AppIcons.shoppingBag, size: 18, color: AppColors.accent),
            label: 'Sales',
            value: '${summary.count}',
            sub: _hasActiveFilters ? 'Matching filter' : 'On selected date',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.green,
            icon: const Icon(AppIcons.indianRupee, size: 18, color: AppColors.green),
            label: 'Revenue',
            value: formatMoney(summary.revenue),
            sub: 'Total collected',
          ),
        ),
        MetricCell(
          fullWidth: true,
          child: GradientStatCard(
            tone: StatTone.purple,
            icon: const Icon(AppIcons.package, size: 18, color: AppColors.purple),
            label: 'Line items',
            value: '${summary.items}',
            sub: 'Products in sales',
          ),
        ),
      ],
    );
  }

  Widget _buildFilterCard(String today) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    DateField(
                      label: 'Date',
                      value: _dateFilter,
                      onChanged: (v) {
                        setState(() => _dateFilter = v);
                        _load();
                      },
                    ),
                    if (_dateFilter != today)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed: () {
                            setState(() => _dateFilter = today);
                            _load();
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.only(top: AppSpacing.xs),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Today', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const FieldLabel('Payment'),
                    FilterPicker<String>(
                      value: _paymentFilter,
                      items: _paymentFilters,
                      labelBuilder: (p) => p == 'ALL' ? 'All' : paymentLabel(p),
                      onChanged: (v) => setState(() => _paymentFilter = v ?? 'ALL'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_hasActiveFilters)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _clearFilters,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Clear filters', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    if (_sales.isEmpty) {
      return EmptyState(
        title: 'No sales on ${formatDateLabel(_dateFilter)}',
        description: 'Record a sale when a customer buys from your shop.',
        action: PrimaryButton(
          label: '+ New sale',
          onPressed: () => context.push('/sales/new'),
        ),
      );
    }
    return const EmptyState(
      title: 'No matching sales',
      description: 'Try a different search or clear filters.',
    );
  }

  Widget _buildSaleCard(Map<String, dynamic> sale) {
    final lines = sale['lines'] as List<dynamic>? ?? [];
    final method = '${sale['paymentMethod']}';
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${sale['customerName'] ?? 'Walk-in'}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                ),
              ),
              AppBadge(label: paymentLabel(method), tone: paymentBadgeTone(method)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            _formatSaleProducts(lines),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, color: AppColors.muted),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  formatMoney(parseMoney('${sale['total']}')),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text),
                ),
              ),
              InkWell(
                onTap: _deleting
                    ? null
                    : () => ConfirmDialog.show(
                          context,
                          title: 'Delete sale?',
                          message:
                              'Remove this sale (${formatMoney(parseMoney('${sale['total']}'))}) permanently? Stock will be restored.',
                          onConfirm: () => _deleteSale(sale['id'] as String),
                        ),
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(AppIcons.trash2, size: 18, color: AppColors.red),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
