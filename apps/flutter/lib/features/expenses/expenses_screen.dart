import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/expense.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

class ExpensesScreen extends ConsumerStatefulWidget {
  const ExpensesScreen({super.key});

  @override
  ConsumerState<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends ConsumerState<ExpensesScreen> {
  String _from = '';
  String _to = '';
  bool _loading = true;
  List<ExpenseLineItem> _lines = [];
  bool _addOpen = false;
  bool _withdrawOpen = false;
  ExpenseLineItem? _editing;
  String _formDate = todayIso();
  String _category = 'SHOP';
  final _amount = TextEditingController();
  final _description = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amount.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final shop = await api.getShopExpenses(month.monthId!, from: _from.isEmpty ? null : _from, to: _to.isEmpty ? null : _to);
      final dmg = await api.getDamages(month.monthId!, from: _from.isEmpty ? null : _from, to: _to.isEmpty ? null : _to);
      final wd = await api.getWithdrawals(month.monthId!, from: _from.isEmpty ? null : _from, to: _to.isEmpty ? null : _to);
      if (mounted) {
        setState(() {
          _lines = buildExpenseLineItems(
            (shop['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
            (dmg['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
            (wd['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
          );
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveExpense() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final api = ref.read(apiServiceProvider);
    final body = {
      'date': _formDate,
      'category': _category,
      'amount': parseMoney(_amount.text),
      'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
    };
    if (_editing != null && _editing!.lineCategory != 'WITHDRAWAL') {
      await api.updateExpenseEntry(month.monthId!, body);
    } else if (_editing == null) {
      await api.createExpenseEntry(month.monthId!, body);
    }
    setState(() { _addOpen = false; _editing = null; });
    await _load();
  }

  Future<void> _saveWithdraw() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).createWithdrawal(month.monthId!, {
      'date': _formDate,
      'amount': parseMoney(_amount.text),
    });
    setState(() => _withdrawOpen = false);
    await _load();
  }

  Future<void> _delete(ExpenseLineItem line) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final api = ref.read(apiServiceProvider);
    if (line.lineCategory == 'WITHDRAWAL' && line.withdrawalId != null) {
      await api.deleteWithdrawal(month.monthId!, line.withdrawalId!);
    } else {
      await api.deleteExpenseEntry(month.monthId!, {'date': line.date, 'category': line.categoryKey});
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return MonthGate(
      child: ScreenShell(
        title: 'Expenses',
        showBack: true,
        onRefresh: _load,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: OutlinedButton(onPressed: () => setState(() => _addOpen = true), child: const Text('Add expense'))),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: OutlinedButton(onPressed: () => setState(() => _withdrawOpen = true), child: const Text('Withdraw profit'))),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                if (_loading) const PageLoader()
                else ..._lines.map((line) => Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: ListTile(
                        title: Text(line.type, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${line.date} · ${line.description}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(formatMoney(line.amount), style: const TextStyle(fontWeight: FontWeight.w700)),
                            RowActionMenu(items: [
                              if (line.lineCategory != 'WITHDRAWAL')
                                RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () {
                                  _editing = line;
                                  _formDate = line.date;
                                  _category = line.categoryKey;
                                  _amount.text = '${line.amount}';
                                  _description.text = line.description;
                                  setState(() => _addOpen = true);
                                }),
                              RowActionMenuItem(key: 'delete', label: 'Delete', danger: true, onPress: () => _delete(line)),
                            ]),
                          ],
                        ),
                      ),
                    )),
              ],
            ),
            FormModal(
              visible: _addOpen,
              title: _editing == null ? 'Add expense' : 'Edit expense',
              onClose: () => setState(() { _addOpen = false; _editing = null; }),
              child: Column(
                children: [
                  DateField(value: _formDate, onChanged: (v) => setState(() => _formDate = v), label: 'Date'),
                  DropdownButtonFormField<String>(
                    value: _category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: expenseCategories.map((c) => DropdownMenuItem(value: c.key, child: Text(c.label))).toList(),
                    onChanged: _editing == null ? (v) => setState(() => _category = v ?? 'SHOP') : null,
                  ),
                  const FieldLabel('Amount'),
                  AppTextField(controller: _amount, keyboardType: TextInputType.number),
                  const FieldLabel('Description'),
                  AppTextField(controller: _description),
                  ModalActions(onCancel: () => setState(() { _addOpen = false; _editing = null; }), onConfirm: _saveExpense),
                ],
              ),
            ),
            FormModal(
              visible: _withdrawOpen,
              title: 'Withdraw profit',
              onClose: () => setState(() => _withdrawOpen = false),
              child: Column(
                children: [
                  DateField(value: _formDate, onChanged: (v) => setState(() => _formDate = v), label: 'Date'),
                  const FieldLabel('Amount'),
                  AppTextField(controller: _amount, keyboardType: TextInputType.number),
                  ModalActions(onCancel: () => setState(() => _withdrawOpen = false), onConfirm: _saveWithdraw, confirmLabel: 'Withdraw'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
