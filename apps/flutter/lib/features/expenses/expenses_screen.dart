import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/expense.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

class _EditDraft {
  _EditDraft({required this.date, required this.amount, required this.description});

  String date;
  String amount;
  String description;
}

_EditDraft _lineToEditDraft(ExpenseLineItem row) {
  final label = row.type;
  final desc = row.description.isNotEmpty && row.description != label ? row.description : '';
  return _EditDraft(date: row.date, amount: '${row.amount}', description: desc);
}

String _monthStart(int year, int month) =>
    '$year-${month.toString().padLeft(2, '0')}-01';

class ExpensesScreen extends ConsumerStatefulWidget {
  const ExpensesScreen({super.key});

  @override
  ConsumerState<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends ConsumerState<ExpensesScreen> {
  String _from = '';
  String _to = '';
  bool _loading = true;
  bool _refreshing = false;
  bool _submitting = false;
  List<ExpenseLineItem> _lines = [];
  Map<String, dynamic>? _dashboard;

  bool _expenseOpen = false;
  bool _withdrawOpen = false;
  String _expenseDate = todayIso();
  String _expenseCategory = 'SHOP';
  final _expenseAmount = TextEditingController();
  final _expenseDescription = TextEditingController();
  final _withdrawAmount = TextEditingController();
  final _editAmount = TextEditingController();
  final _editDescription = TextEditingController();
  String? _expenseError;
  String? _withdrawError;

  ExpenseLineItem? _editingRow;
  _EditDraft? _editDraft;
  String? _editError;

  @override
  void initState() {
    super.initState();
    _expenseAmount.addListener(_onFormChanged);
    _withdrawAmount.addListener(_onFormChanged);
    _editAmount.addListener(_onFormChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _initAndLoad());
  }

  void _onFormChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _expenseAmount.removeListener(_onFormChanged);
    _withdrawAmount.removeListener(_onFormChanged);
    _editAmount.removeListener(_onFormChanged);
    _expenseAmount.dispose();
    _expenseDescription.dispose();
    _withdrawAmount.dispose();
    _editAmount.dispose();
    _editDescription.dispose();
    super.dispose();
  }

  Future<void> _initAndLoad() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    if (_from.isEmpty) {
      setState(() {
        _from = _monthStart(month.year, month.month);
        _to = todayIso();
      });
    }
    await _load();
  }

  Future<void> _load({bool refresh = false}) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    if (refresh) {
      setState(() => _refreshing = true);
    } else {
      setState(() => _loading = _lines.isEmpty);
    }

    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.getDashboard(month.monthId!),
        api.getShopExpenses(month.monthId!, from: _from, to: _to),
        api.getDamages(month.monthId!, from: _from, to: _to),
        api.getWithdrawals(month.monthId!, from: _from, to: _to),
      ]);
      if (!mounted) return;
      setState(() {
        _dashboard = results[0] as Map<String, dynamic>;
        _lines = buildExpenseLineItems(
          ((results[1] as Map)['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
          ((results[2] as Map)['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
          ((results[3] as Map)['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
        );
        _loading = false;
        _refreshing = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _refreshing = false;
        });
      }
    }
  }

  void _openAddExpense() {
    setState(() {
      _expenseOpen = true;
      _expenseDate = todayIso();
      _expenseCategory = 'SHOP';
      _expenseAmount.clear();
      _expenseDescription.clear();
      _expenseError = null;
    });
  }

  void _openWithdraw() {
    setState(() {
      _withdrawOpen = true;
      _expenseDate = todayIso();
      _withdrawAmount.clear();
      _withdrawError = null;
    });
  }

  void _startEdit(ExpenseLineItem row) {
    final draft = _lineToEditDraft(row);
    _editAmount.text = draft.amount;
    _editDescription.text = draft.description;
    setState(() {
      _editingRow = row;
      _editDraft = draft;
      _editError = null;
    });
  }

  void _closeEdit() {
    _editAmount.clear();
    _editDescription.clear();
    setState(() {
      _editingRow = null;
      _editDraft = null;
      _editError = null;
    });
  }

  Future<void> _saveExpense() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    final amount = parseMoney(_expenseAmount.text);
    if (amount <= 0) {
      setState(() => _expenseError = 'Enter a valid amount greater than zero.');
      return;
    }

    setState(() {
      _submitting = true;
      _expenseError = null;
    });

    try {
      await ref.read(apiServiceProvider).createExpenseEntry(month.monthId!, {
        'date': _expenseDate,
        'category': _expenseCategory,
        'amount': amount,
        'description': _expenseDescription.text.trim().isEmpty ? null : _expenseDescription.text.trim(),
      });
      if (!mounted) return;
      setState(() {
        _expenseOpen = false;
        _submitting = false;
        _expenseAmount.clear();
        _expenseDescription.clear();
      });
      await _load(refresh: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _expenseError = e is ApiError ? e.message : 'Could not save expense.';
      });
    }
  }

  Future<void> _saveWithdraw() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    final amount = parseMoney(_withdrawAmount.text);
    if (amount <= 0) {
      setState(() => _withdrawError = 'Enter a valid amount greater than zero.');
      return;
    }

    setState(() {
      _submitting = true;
      _withdrawError = null;
    });

    try {
      await ref.read(apiServiceProvider).createWithdrawal(month.monthId!, {
        'date': _expenseDate,
        'amount': amount,
      });
      if (!mounted) return;
      setState(() {
        _withdrawOpen = false;
        _submitting = false;
        _withdrawAmount.clear();
      });
      await _load(refresh: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _withdrawError = e is ApiError ? e.message : 'Could not save withdrawal.';
      });
    }
  }

  Future<void> _saveEdit() async {
    final row = _editingRow;
    final draft = _editDraft;
    if (row == null || draft == null) return;

    final amount = parseMoney(_editAmount.text);
    if (amount <= 0) {
      setState(() => _editError = 'Enter a valid amount greater than zero.');
      return;
    }

    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final api = ref.read(apiServiceProvider);

    setState(() {
      _submitting = true;
      _editError = null;
    });

    try {
      if (row.lineCategory == 'WITHDRAWAL') {
        if (row.withdrawalId == null) {
          throw Exception('Cannot edit this withdrawal.');
        }
        final available = parseMoney('${_dashboard?['netProfit']}');
        if (amount > available + row.amount) {
          throw Exception('Insufficient profit. Available: ${formatMoney(available + row.amount)}.');
        }
        await api.updateWithdrawal(month.monthId!, row.withdrawalId!, {
          'date': draft.date,
          'amount': amount,
          'description': _editDescription.text.trim().isEmpty ? null : _editDescription.text.trim(),
        });
      } else {
        if (draft.date != row.date) {
          await api.deleteExpenseEntry(month.monthId!, {
            'date': row.date,
            'category': row.categoryKey,
          });
        }
        await api.updateExpenseEntry(month.monthId!, {
          'date': draft.date,
          'category': row.categoryKey,
          'amount': amount,
          'description': _editDescription.text.trim().isEmpty ? null : _editDescription.text.trim(),
        });
      }

      if (!mounted) return;
      _closeEdit();
      setState(() => _submitting = false);
      await _load(refresh: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _editError = e is ApiError ? e.message : e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _delete(ExpenseLineItem row) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final api = ref.read(apiServiceProvider);

    setState(() => _submitting = true);
    try {
      if (row.lineCategory == 'WITHDRAWAL') {
        if (row.withdrawalId == null) throw Exception('Cannot delete this withdrawal.');
        await api.deleteWithdrawal(month.monthId!, row.withdrawalId!);
      } else {
        await api.deleteExpenseEntry(month.monthId!, {
          'date': row.date,
          'category': row.categoryKey,
        });
      }
      if (mounted) {
        setState(() => _submitting = false);
        await _load(refresh: true);
      }
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<MonthState>>(monthProvider, (prev, next) {
      final id = next.valueOrNull?.monthId;
      final prevId = prev?.valueOrNull?.monthId;
      if (id != null && id != prevId) {
        final month = next.valueOrNull!;
        setState(() {
          _from = _monthStart(month.year, month.month);
          _to = todayIso();
        });
        WidgetsBinding.instance.addPostFrameCallback((_) => _load());
      }
    });

    return MonthGate(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ScreenShell(
              title: 'Expenses',
              subtitle: 'Shop costs & withdrawals',
              showBack: true,
              refreshing: _refreshing,
              onRefresh: () => _load(refresh: true),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildActions(),
                  if (_dashboard != null) _buildStats(),
                  _buildFilterCard(),
                  if (_loading) const PageLoader(message: 'Loading expenses…'),
                  if (!_loading && _lines.isEmpty)
                    const EmptyState(
                      title: 'No expenses in range',
                      description: 'Add a shop expense or withdrawal.',
                    ),
                  if (!_loading && _lines.isNotEmpty) ..._lines.map(_buildRowCard),
                ],
              ),
            ),
          ),
          FormModal(
            visible: _expenseOpen,
            title: 'Add expense',
            onClose: () => setState(() => _expenseOpen = false),
            child: _buildAddExpenseForm(),
          ),
          FormModal(
            visible: _withdrawOpen,
            title: 'Withdraw profit',
            onClose: () => setState(() => _withdrawOpen = false),
            child: _buildWithdrawForm(),
          ),
          FormModal(
            visible: _editingRow != null && _editDraft != null,
            title: 'Edit transaction',
            onClose: _closeEdit,
            child: _buildEditForm(),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _openAddExpense,
              icon: const Icon(AppIcons.plus, size: 16, color: Colors.white),
              label: const Text(
                'Add expense',
                style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.input)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: SecondaryButton(label: 'Withdraw profit', onPressed: _openWithdraw),
          ),
        ],
      ),
    );
  }

  Widget _buildStats() {
    final dash = _dashboard!;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: GradientStatCard(
              tone: StatTone.orange,
              icon: const Text('−', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.amber)),
              label: 'Total expense',
              value: formatMoney(parseMoney('${dash['totalExpense']}')),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: GradientStatCard(
              tone: StatTone.purple,
              icon: const Text('₹', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.accent)),
              label: 'Withdrawals',
              value: formatMoney(parseMoney('${dash['totalWithdrawal']}')),
            ),
          ),
        ],
      ),
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
            label: 'From',
            value: _from,
            onChanged: (v) {
              setState(() => _from = v);
              _load();
            },
          ),
          DateField(
            label: 'To',
            value: _to,
            onChanged: (v) {
              setState(() => _to = v);
              _load();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildRowCard(ExpenseLineItem row) {
    final menuDisabled = _submitting || (row.lineCategory == 'WITHDRAWAL' && row.withdrawalId == null);
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
                        row.type,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                      ),
                    ),
                    Text(
                      formatMoney(row.amount),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.red),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              RowActionMenu(
                disabled: menuDisabled,
                items: [
                  RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () => _startEdit(row)),
                  RowActionMenuItem(
                    key: 'delete',
                    label: 'Delete',
                    danger: true,
                    onPress: () => ConfirmDialog.show(
                      context,
                      title: 'Delete transaction?',
                      message:
                          'Remove this ${row.lineCategory == 'WITHDRAWAL' ? 'withdrawal' : 'expense'} permanently?',
                      onConfirm: () => _delete(row),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(row.description, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
          const SizedBox(height: 4),
          Text(row.date, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ),
    );
  }

  Widget _buildAddExpenseForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date',
          value: _expenseDate,
          onChanged: (v) => setState(() => _expenseDate = v),
        ),
        const FieldLabel('Category'),
        FilterPicker<String>(
          value: _expenseCategory,
          items: expenseCategories.map((c) => c.key).toList(),
          labelBuilder: getExpenseCategoryLabel,
          onChanged: (v) => setState(() => _expenseCategory = v ?? 'SHOP'),
        ),
        const SizedBox(height: AppSpacing.md),
        const FieldLabel('Amount'),
        AppTextField(controller: _expenseAmount, keyboardType: TextInputType.number),
        const FieldLabel('Description', optional: true),
        AppTextField(controller: _expenseDescription),
        if (_expenseError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_expenseError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: () => setState(() => _expenseOpen = false),
          onConfirm: _saveExpense,
          loading: _submitting,
          disabled: _expenseAmount.text.trim().isEmpty,
        ),
      ],
    );
  }

  Widget _buildWithdrawForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date',
          value: _expenseDate,
          onChanged: (v) => setState(() => _expenseDate = v),
        ),
        const FieldLabel('Amount'),
        AppTextField(controller: _withdrawAmount, keyboardType: TextInputType.number),
        if (_withdrawError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_withdrawError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: () => setState(() => _withdrawOpen = false),
          onConfirm: _saveWithdraw,
          loading: _submitting,
          disabled: _withdrawAmount.text.trim().isEmpty,
          confirmLabel: 'Withdraw',
        ),
      ],
    );
  }

  Widget _buildEditForm() {
    final row = _editingRow;
    final draft = _editDraft;
    if (row == null || draft == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date',
          value: draft.date,
          onChanged: (v) => setState(() => draft.date = v),
        ),
        if (row.lineCategory != 'WITHDRAWAL') ...[
          const FieldLabel('Category'),
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Text(row.type, style: const TextStyle(fontSize: 15, color: AppColors.muted)),
          ),
        ],
        const FieldLabel('Amount'),
        AppTextField(controller: _editAmount, keyboardType: TextInputType.number),
        const FieldLabel('Description', optional: true),
        AppTextField(controller: _editDescription),
        if (_editError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_editError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: _closeEdit,
          onConfirm: _saveEdit,
          loading: _submitting,
          disabled: _editAmount.text.trim().isEmpty,
          confirmLabel: 'Save changes',
        ),
      ],
    );
  }
}
