import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/recharge.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

String _formatProfitBreakdown(Map<String, dynamic> row) {
  final parts = getRechargeBreakdownParts(row);
  if (parts.isEmpty) return '—';
  return parts.map((p) => formatMoney(parseMoney(p.amount))).join(' + ');
}

class RechargeScreen extends ConsumerStatefulWidget {
  const RechargeScreen({super.key});

  @override
  ConsumerState<RechargeScreen> createState() => _RechargeScreenState();
}

class _RechargeScreenState extends ConsumerState<RechargeScreen> {
  String _dateFilter = '';
  String _operatorFilter = 'ALL';
  String _typeFilter = 'ALL';
  String _search = '';
  String _searchDebounced = '';
  Timer? _searchDebounce;

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  bool _submitting = false;
  List<Map<String, dynamic>> _entries = [];

  bool _modalOpen = false;
  String? _editingId;
  String? _formError;

  String _formDate = todayIso();
  String _operator = 'AIRTEL';
  final _rechargeAmount = TextEditingController();
  final _saleProfit = TextEditingController();
  final _chillar = TextEditingController();
  final _act = TextEditingController();
  final _mnp = TextEditingController();

  @override
  void initState() {
    super.initState();
    _formDate = todayIso();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _rechargeAmount.dispose();
    _saleProfit.dispose();
    _chillar.dispose();
    _act.dispose();
    _mnp.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredEntries {
    return _entries.where((e) {
      if (_operatorFilter != 'ALL' && e['operator'] != _operatorFilter) return false;
      if (_typeFilter != 'ALL' && !rechargeEntryHasType(e, _typeFilter)) return false;
      if (_searchDebounced.isEmpty) return true;
      final hay =
          '${e['operator']} ${formatRechargeTypeLabel(e)} ${e['amount']} ${e['date']}'.toLowerCase();
      return hay.contains(_searchDebounced);
    }).toList();
  }

  void _onSearchChanged(String value) {
    setState(() => _search = value);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _searchDebounced = value.trim().toLowerCase());
    });
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    if (!_refreshing) {
      setState(() {
        _loading = _entries.isEmpty;
        _error = null;
      });
    }

    try {
      final res = await ref.read(apiServiceProvider).getRechargeEntries(
            month.monthId!,
            page: 1,
            date: _dateFilter.isEmpty ? null : _dateFilter,
            limit: 50,
          );
      if (!mounted) return;
      setState(() {
        _entries = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
        _refreshing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load recharge entries.';
        _loading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    await _load();
  }

  void _resetForm() {
    _formDate = todayIso();
    _operator = 'AIRTEL';
    _rechargeAmount.clear();
    _saleProfit.clear();
    _chillar.clear();
    _act.clear();
    _mnp.clear();
    _formError = null;
  }

  void _openCreate() {
    _editingId = null;
    _resetForm();
    setState(() => _modalOpen = true);
  }

  void _openEdit(Map<String, dynamic> entry) {
    _editingId = entry['id'] as String;
    _formDate = '${entry['date'] ?? todayIso()}';
    _operator = '${entry['operator'] ?? 'AIRTEL'}';
    _rechargeAmount.text = '${entry['rechargeAmount'] ?? ''}';
    _saleProfit.text = '${entry['saleProfit'] ?? ''}';
    _chillar.text = '${entry['chillar'] ?? ''}';
    _act.text = '${entry['act'] ?? ''}';
    _mnp.text = '${entry['mnp'] ?? ''}';
    setState(() {
      _formError = null;
      _modalOpen = true;
    });
  }

  Map<String, dynamic> _payload() => {
        'date': _formDate,
        'operator': _operator,
        'rechargeAmount': parseMoney(_rechargeAmount.text),
        'saleProfit': parseMoney(_saleProfit.text),
        'chillar': parseMoney(_chillar.text),
        'act': parseMoney(_act.text),
        'mnp': parseMoney(_mnp.text),
      };

  Future<void> _save() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() {
      _submitting = true;
      _formError = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      if (_editingId != null) {
        await api.updateRechargeEntry(month.monthId!, _editingId!, _payload());
      } else {
        await api.createRechargeEntry(month.monthId!, _payload());
      }
      if (!mounted) return;
      setState(() {
        _modalOpen = false;
        _editingId = null;
        _submitting = false;
      });
      _resetForm();
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _formError = e is ApiError ? e.message : 'Could not save entry.';
        _submitting = false;
      });
    }
  }

  Future<void> _delete(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(apiServiceProvider).deleteRechargeEntry(month.monthId!, id);
      if (!mounted) return;
      setState(() => _submitting = false);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiError ? e.message : 'Could not delete entry.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = todayIso();
    final filtered = _filteredEntries;
    final pageTotal = sumMoney(filtered.map((r) => r['amount']));
    final todayEntries = filtered.where((r) => r['date'] == today).toList();
    final todayTotal = sumMoney(todayEntries.map((r) => r['amount']));

    return MonthGate(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ScreenShell(
              title: 'Recharge',
              subtitle: 'Mobile recharge entries',
              titleFontSize: 24,
              onRefresh: _refresh,
              refreshing: _refreshing && !_loading,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildToolbar(),
                  if (!_loading && _error == null) _buildMetrics(todayTotal, todayEntries.length, pageTotal, filtered.length),
                  _buildFilterCard(),
                  if (_loading) const PageLoader(message: 'Loading entries…'),
                  if (_error != null) _buildError(),
                  if (!_loading && _error == null && filtered.isEmpty) _buildEmpty(),
                  if (!_loading && _error == null && filtered.isNotEmpty)
                    ...filtered.map(_buildEntryCard),
                ],
              ),
            ),
          ),
          FormModal(
            visible: _modalOpen,
            title: _editingId == null ? 'Create recharge' : 'Edit recharge',
            onClose: () => setState(() {
              _modalOpen = false;
              _editingId = null;
            }),
            child: _buildFormModal(),
          ),
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
            placeholder: 'Search operator, type…',
          ),
          const SizedBox(height: AppSpacing.sm),
          PrimaryButton(label: '+ Create Recharge', onPressed: _openCreate),
        ],
      ),
    );
  }

  Widget _buildMetrics(double todayTotal, int todayCount, double pageTotal, int entryCount) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Icon(AppIcons.smartphone, size: 18, color: AppColors.accent),
            label: "Today's Recharge",
            value: formatMoney(todayTotal),
            sub: '$todayCount txns',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.green,
            icon: const Icon(AppIcons.zap, size: 18, color: AppColors.green),
            label: 'Filtered Total',
            value: formatMoney(pageTotal),
            sub: '$entryCount entries',
          ),
        ),
      ],
    );
  }

  Widget _buildFilterCard() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DateField(
            label: 'Date filter',
            value: _dateFilter,
            onChanged: (v) {
              setState(() => _dateFilter = v);
              _load();
            },
          ),
          if (_dateFilter.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () {
                  setState(() => _dateFilter = '');
                  _load();
                },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Clear date', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          FilterPicker<String>(
            value: _operatorFilter,
            items: ['ALL', ...rechargeOperators],
            labelBuilder: (v) => v == 'ALL' ? 'All Operators' : v,
            onChanged: (v) => setState(() => _operatorFilter = v ?? 'ALL'),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilterPicker<String>(
            value: _typeFilter,
            items: ['ALL', ...rechargeAmountFields.map((f) => f.entryType)],
            labelBuilder: (v) {
              if (v == 'ALL') return 'All Types';
              return rechargeAmountFields.firstWhere((f) => f.entryType == v).label;
            },
            onChanged: (v) => setState(() => _typeFilter = v ?? 'ALL'),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_error!, style: const TextStyle(color: AppColors.red)),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: EmptyState(
        title: 'No recharge entries',
        description: 'Create a recharge entry or clear filters.',
      ),
    );
  }

  Widget _buildEntryCard(Map<String, dynamic> entry) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${entry['operator']}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                      ),
                    ),
                    Text(
                      formatMoney(parseMoney('${entry['amount']}')),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              RowActionMenu(
                disabled: _submitting,
                items: [
                  RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () => _openEdit(entry)),
                  RowActionMenuItem(
                    key: 'delete',
                    label: 'Delete',
                    danger: true,
                    onPress: () => ConfirmDialog.show(
                      context,
                      title: 'Delete recharge?',
                      message: 'Remove this recharge entry permanently?',
                      onConfirm: () => _delete(entry['id'] as String),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AppBadge(label: formatRechargeTypeLabel(entry)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${entry['date']} · Profit: ${_formatProfitBreakdown(entry)}',
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
        ],
      ),
    );
  }

  Widget _buildFormModal() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date',
          value: _formDate,
          onChanged: (v) => setState(() => _formDate = v),
        ),
        const FieldLabel('Operator'),
        FilterPicker<String>(
          value: _operator,
          items: rechargeOperators,
          onChanged: (v) => setState(() => _operator = v ?? 'AIRTEL'),
        ),
        const SizedBox(height: AppSpacing.sm),
        const FieldLabel('Recharge amount', optional: true),
        AppTextField(controller: _rechargeAmount, keyboardType: TextInputType.number, hint: 'Optional'),
        for (final f in rechargeAmountFields) ...[
          FieldLabel(f.label, optional: true),
          AppTextField(
            controller: switch (f.key) {
              'saleProfit' => _saleProfit,
              'chillar' => _chillar,
              'act' => _act,
              'mnp' => _mnp,
              _ => _saleProfit,
            },
            keyboardType: TextInputType.number,
          ),
        ],
        if (_formError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_formError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: () => setState(() {
            _modalOpen = false;
            _editingId = null;
          }),
          onConfirm: _save,
          confirmLabel: _editingId == null ? 'Save' : 'Update',
          loading: _submitting,
        ),
      ],
    );
  }
}
