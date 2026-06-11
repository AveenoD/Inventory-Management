import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/money_transfer.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

const _defaultCategory = 'dmt99';

class _EditDraft {
  _EditDraft({
    required this.date,
    required this.categoryId,
    required this.serviceKey,
    required this.amount,
    required this.note,
  });

  String date;
  String categoryId;
  String serviceKey;
  String amount;
  String note;
}

_EditDraft _rowToEditDraft(Map<String, dynamic> row) {
  final serviceKey = '${row['serviceKey']}';
  return _EditDraft(
    date: '${row['date']}',
    categoryId: getCategoryForKey(serviceKey) ?? _defaultCategory,
    serviceKey: serviceKey,
    amount: '${row['amount']}',
    note: '${row['note'] ?? ''}',
  );
}

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({super.key});

  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  String _dateFilter = '';
  String _categoryFilter = 'ALL';
  String _subFilter = 'ALL';
  String _search = '';
  String _searchDebounced = '';
  Timer? _searchDebounce;

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  bool _submitting = false;
  List<Map<String, dynamic>> _entries = [];

  bool _addOpen = false;
  String? _editingId;
  _EditDraft? _editDraft;
  String? _formError;

  String _formDate = todayIso();
  String _categoryId = _defaultCategory;
  final Map<String, TextEditingController> _amounts = {};

  final _editAmount = TextEditingController();
  final _editNote = TextEditingController();

  @override
  void initState() {
    super.initState();
    _formDate = todayIso();
    for (final key in transferServiceKeys) {
      _amounts[key] = TextEditingController();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    for (final c in _amounts.values) {
      c.dispose();
    }
    _editAmount.dispose();
    _editNote.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredEntries {
    return _entries.where((e) {
      final cat = getCategoryForKey('${e['serviceKey']}');
      if (_categoryFilter != 'ALL' && cat != _categoryFilter) return false;
      if (_subFilter != 'ALL' && e['serviceKey'] != _subFilter) return false;
      if (_searchDebounced.isEmpty) return true;
      final key = '${e['serviceKey']}';
      final hay =
          '$key ${getTransferLabel(key)} ${e['amount']} ${e['date']}'.toLowerCase();
      return hay.contains(_searchDebounced);
    }).toList();
  }

  List<TransferSubService> get _editSubServices {
    final draft = _editDraft;
    if (draft == null) return [];
    final subs = getSubServicesForCategory(draft.categoryId);
    if (subs.any((s) => s.key == draft.serviceKey)) return subs;
    return [
      ...subs,
      TransferSubService(
        key: draft.serviceKey,
        label: getTransferSubLabel(draft.serviceKey),
      ),
    ];
  }

  void _onSearchChanged(String value) {
    setState(() => _search = value);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _searchDebounced = value.trim().toLowerCase());
    });
  }

  void _clearAmountsFor(String categoryId) {
    for (final sub in getSubServicesForCategory(categoryId)) {
      _amounts[sub.key]?.clear();
    }
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
      final res = await ref.read(apiServiceProvider).getTransferEntries(
            month.monthId!,
            page: 1,
            date: _dateFilter.isEmpty ? null : _dateFilter,
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
        _error = e is ApiError ? e.message : 'Could not load transfer entries.';
        _loading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    await _load();
  }

  void _openAddModal() {
    setState(() {
      _categoryId = _defaultCategory;
      _formDate = todayIso();
      _formError = null;
      _addOpen = true;
    });
    _clearAmountsFor(_defaultCategory);
  }

  void _handleCategoryChange(String categoryId) {
    setState(() => _categoryId = categoryId);
    _clearAmountsFor(categoryId);
  }

  Future<void> _saveBulk() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    final payloads = <Map<String, dynamic>>[];
    for (final sub in getSubServicesForCategory(_categoryId)) {
      final amt = parseMoney(_amounts[sub.key]?.text);
      if (amt > 0) {
        payloads.add({'serviceKey': sub.key, 'amount': amt});
      }
    }

    if (payloads.isEmpty) {
      setState(() => _formError = 'Enter at least one amount greater than 0');
      return;
    }

    setState(() {
      _submitting = true;
      _formError = null;
    });

    try {
      final api = ref.read(apiServiceProvider);
      for (final p in payloads) {
        await api.createTransferEntry(month.monthId!, {
          'date': _formDate,
          'serviceKey': p['serviceKey'],
          'amount': p['amount'],
        });
      }
      if (!mounted) return;
      setState(() {
        _addOpen = false;
        _submitting = false;
      });
      _clearAmountsFor(_categoryId);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _formError = e is ApiError ? e.message : 'Could not save entries.';
        _submitting = false;
      });
    }
  }

  void _startEdit(Map<String, dynamic> row) {
    final draft = _rowToEditDraft(row);
    _editAmount.text = draft.amount;
    _editNote.text = draft.note;
    setState(() {
      _editingId = row['id'] as String;
      _editDraft = draft;
      _formError = null;
    });
  }

  void _closeEdit() {
    setState(() {
      _editingId = null;
      _editDraft = null;
      _formError = null;
    });
  }

  void _handleEditCategoryChange(String categoryId) {
    setState(() {
      final draft = _editDraft;
      if (draft == null) return;
      final subs = getSubServicesForCategory(categoryId);
      draft.categoryId = categoryId;
      draft.serviceKey = subs.isNotEmpty ? subs.first.key : draft.serviceKey;
    });
  }

  Future<void> _saveEdit() async {
    final month = await ref.read(monthProvider.future);
    final draft = _editDraft;
    if (month.monthId == null || _editingId == null || draft == null) return;

    setState(() {
      _submitting = true;
      _formError = null;
    });

    try {
      await ref.read(apiServiceProvider).updateTransferEntry(month.monthId!, _editingId!, {
        'date': draft.date,
        'serviceKey': draft.serviceKey,
        'amount': parseMoney(_editAmount.text),
        'note': _editNote.text.trim().isEmpty ? null : _editNote.text.trim(),
      });
      if (!mounted) return;
      _closeEdit();
      setState(() => _submitting = false);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _formError = e is ApiError ? e.message : 'Could not save changes.';
        _submitting = false;
      });
    }
  }

  Future<void> _delete(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(apiServiceProvider).deleteTransferEntry(month.monthId!, id);
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
    final filterSubs = filterSubServicesFor(_categoryFilter);

    return MonthGate(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ScreenShell(
              title: 'Money Transfer',
              subtitle: 'DMT 99, DMT 86, IME',
              titleFontSize: 24,
              onRefresh: _refresh,
              refreshing: _refreshing && !_loading,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildToolbar(),
                  if (!_loading && _error == null)
                    _buildMetrics(todayTotal, todayEntries.length, pageTotal, filtered.length),
                  _buildFilterCard(filterSubs),
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
            visible: _addOpen,
            title: 'Add money transfer',
            onClose: () => setState(() => _addOpen = false),
            child: _buildAddModal(),
          ),
          FormModal(
            visible: _editingId != null && _editDraft != null,
            title: 'Edit money transfer',
            onClose: _closeEdit,
            child: _buildEditModal(),
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
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(AppRadii.input),
              border: Border.all(color: AppColors.border),
            ),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: [
                const Icon(AppIcons.search, size: 16, color: AppColors.muted),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SearchField(
                    value: _search,
                    onChanged: _onSearchChanged,
                    placeholder: 'Search service, amount…',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          PrimaryButton(label: '+ Add Transfer', onPressed: _openAddModal),
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
            icon: const Icon(AppIcons.arrowLeftRight, size: 18, color: AppColors.accent),
            label: "Today's Transfer",
            value: formatMoney(todayTotal),
            sub: '$todayCount txns',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.green,
            icon: const Icon(AppIcons.trendingUp, size: 18, color: AppColors.green),
            label: 'Filtered Total',
            value: formatMoney(pageTotal),
            sub: '$entryCount entries',
          ),
        ),
      ],
    );
  }

  Widget _buildFilterCard(List<TransferSubService> filterSubs) {
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
            value: _categoryFilter,
            items: ['ALL', ...transferCategories.map((c) => c.id)],
            labelBuilder: (v) {
              if (v == 'ALL') return 'All Services';
              return transferCategories.firstWhere((c) => c.id == v).label;
            },
            onChanged: (v) => setState(() {
              _categoryFilter = v ?? 'ALL';
              _subFilter = 'ALL';
            }),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilterPicker<String>(
            value: _subFilter,
            items: ['ALL', ...filterSubs.map((s) => s.key)],
            labelBuilder: (v) {
              if (v == 'ALL') return 'All Sub-types';
              return filterSubs.firstWhere((s) => s.key == v).label;
            },
            onChanged: (v) => setState(() => _subFilter = v ?? 'ALL'),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: EmptyState(
        title: 'No transfer entries',
        description: 'Add DMT, AEPS, or other money transfer records.',
        action: PrimaryButton(label: 'Add transfer', onPressed: _openAddModal),
      ),
    );
  }

  Widget _buildEntryCard(Map<String, dynamic> entry) {
    final serviceKey = '${entry['serviceKey']}';
    return InkWell(
      onTap: () => _startEdit(entry),
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        getTransferCategoryLabel(serviceKey),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        getTransferSubLabel(serviceKey),
                        style: const TextStyle(fontSize: 13, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                Text(
                  formatMoney(parseMoney('${entry['amount']}')),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${entry['date']}',
                    style: const TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
                ),
                InkWell(
                  onTap: () => _startEdit(entry),
                  borderRadius: BorderRadius.circular(8),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(AppIcons.pencil, size: 16, color: AppColors.accent),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                InkWell(
                  onTap: _submitting
                      ? null
                      : () => ConfirmDialog.show(
                            context,
                            title: 'Delete transfer?',
                            message: 'Remove this money transfer entry permanently?',
                            onConfirm: () => _delete(entry['id'] as String),
                          ),
                  borderRadius: BorderRadius.circular(8),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(AppIcons.trash2, size: 16, color: AppColors.red),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddModal() {
    final amountFields = getSubServicesForCategory(_categoryId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(label: 'Date', value: _formDate, onChanged: (v) => setState(() => _formDate = v)),
        const FieldLabel('Service'),
        FilterPicker<String>(
          value: _categoryId,
          items: transferCategories.map((c) => c.id).toList(),
          labelBuilder: (v) => transferCategories.firstWhere((c) => c.id == v).label,
          onChanged: (v) => _handleCategoryChange(v ?? _defaultCategory),
        ),
        const FieldLabel('Amount (₹) — leave blank for 0'),
        LayoutBuilder(
          builder: (context, constraints) {
            final fieldWidth = (constraints.maxWidth - AppSpacing.sm) / 2;
            return Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final field in amountFields)
                  SizedBox(
                    width: fieldWidth,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FieldLabel(field.label, optional: true),
                        AppTextField(
                          controller: _amounts[field.key],
                          keyboardType: TextInputType.number,
                          hint: '0',
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
        if (_formError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_formError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: () => setState(() => _addOpen = false),
          onConfirm: _saveBulk,
          confirmLabel: 'Save',
          loading: _submitting,
        ),
      ],
    );
  }

  Widget _buildEditModal() {
    final draft = _editDraft;
    if (draft == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date',
          value: draft.date,
          onChanged: (v) => setState(() => draft.date = v),
        ),
        const FieldLabel('Service'),
        FilterPicker<String>(
          value: draft.categoryId,
          items: transferCategories.map((c) => c.id).toList(),
          labelBuilder: (v) => transferCategories.firstWhere((c) => c.id == v).label,
          onChanged: (v) => _handleEditCategoryChange(v ?? draft.categoryId),
        ),
        const FieldLabel('Sub-type'),
        FilterPicker<String>(
          value: draft.serviceKey,
          items: _editSubServices.map((s) => s.key).toList(),
          labelBuilder: (v) => _editSubServices.firstWhere((s) => s.key == v).label,
          onChanged: (v) => setState(() => draft.serviceKey = v ?? draft.serviceKey),
        ),
        const FieldLabel('Amount (₹)'),
        AppTextField(controller: _editAmount, keyboardType: TextInputType.number),
        const FieldLabel('Note', optional: true),
        AppTextField(controller: _editNote),
        if (_formError != null)
          Text(_formError!, style: const TextStyle(color: AppColors.red)),
        ModalActions(
          onCancel: _closeEdit,
          onConfirm: _saveEdit,
          confirmLabel: 'Save changes',
          loading: _submitting,
        ),
      ],
    );
  }
}
