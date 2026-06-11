import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/money_transfer.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({super.key});

  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  bool _modalOpen = false;
  Map<String, dynamic>? _editing;
  String _formDate = todayIso();
  String _categoryId = 'dmt99';
  final Map<String, TextEditingController> _amounts = {};
  final _editAmount = TextEditingController();
  String _editServiceKey = 'dmt99Dmt';

  @override
  void initState() {
    super.initState();
    for (final cat in transferCategories) {
      for (final sub in cat.subServices) {
        _amounts[sub.key] = TextEditingController();
      }
    }
    _load();
  }

  @override
  void dispose() {
    for (final c in _amounts.values) {
      c.dispose();
    }
    _editAmount.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final res = await ref.read(apiServiceProvider).getTransferEntries(month.monthId!, page: 1);
      if (mounted) {
        setState(() {
          _entries = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveBulk() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final api = ref.read(apiServiceProvider);
    for (final sub in getSubServicesForCategory(_categoryId)) {
      final amt = parseMoney(_amounts[sub.key]?.text);
      if (amt > 0) {
        await api.createTransferEntry(month.monthId!, {
          'date': _formDate,
          'serviceKey': sub.key,
          'amount': amt,
        });
      }
    }
    setState(() => _modalOpen = false);
    await _load();
  }

  Future<void> _saveEdit() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null || _editing == null) return;
    await ref.read(apiServiceProvider).updateTransferEntry(month.monthId!, _editing!['id'] as String, {
      'date': _formDate,
      'serviceKey': _editServiceKey,
      'amount': parseMoney(_editAmount.text),
    });
    setState(() { _modalOpen = false; _editing = null; });
    await _load();
  }

  Future<void> _delete(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).deleteTransferEntry(month.monthId!, id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return MonthGate(
      child: ScreenShell(
        title: 'Transfer',
        onRefresh: _load,
        child: Stack(
          children: [
            Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                    onPressed: () { _editing = null; setState(() => _modalOpen = true); },
                    icon: const Icon(AppIcons.plus, color: Colors.white),
                  ),
                ),
                if (_loading) const PageLoader()
                else ..._entries.map((e) => Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: ListTile(
                        title: Text(getTransferLabel('${e['serviceKey']}')),
                        subtitle: Text('${e['date']} · ${formatMoney(parseMoney('${e['amount']}'))}'),
                        trailing: RowActionMenu(items: [
                          RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () {
                            _editing = e;
                            _formDate = '${e['date']}';
                            _editServiceKey = '${e['serviceKey']}';
                            _editAmount.text = '${e['amount']}';
                            setState(() => _modalOpen = true);
                          }),
                          RowActionMenuItem(key: 'delete', label: 'Delete', danger: true, onPress: () => _delete(e['id'] as String)),
                        ]),
                      ),
                    )),
              ],
            ),
            FormModal(
              visible: _modalOpen,
              title: _editing == null ? 'Add Transfer' : 'Edit Transfer',
              onClose: () => setState(() => _modalOpen = false),
              child: Column(
                children: [
                  DateField(value: _formDate, onChanged: (v) => setState(() => _formDate = v), label: 'Date'),
                  if (_editing == null) ...[
                    DropdownButtonFormField<String>(
                      value: _categoryId,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: transferCategories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.label))).toList(),
                      onChanged: (v) => setState(() => _categoryId = v ?? 'dmt99'),
                    ),
                    for (final sub in getSubServicesForCategory(_categoryId)) ...[
                      FieldLabel(sub.label),
                      AppTextField(controller: _amounts[sub.key], keyboardType: TextInputType.number),
                    ],
                    ModalActions(onCancel: () => setState(() => _modalOpen = false), onConfirm: _saveBulk, confirmLabel: 'Save'),
                  ] else ...[
                    DropdownButtonFormField<String>(
                      value: _editServiceKey,
                      decoration: const InputDecoration(labelText: 'Service'),
                      items: transferServiceKeys.map((k) => DropdownMenuItem(value: k, child: Text(getTransferLabel(k)))).toList(),
                      onChanged: (v) => setState(() => _editServiceKey = v ?? _editServiceKey),
                    ),
                    const FieldLabel('Amount'),
                    AppTextField(controller: _editAmount, keyboardType: TextInputType.number),
                    ModalActions(onCancel: () => setState(() => _modalOpen = false), onConfirm: _saveEdit),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
