import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/recharge.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

class RechargeScreen extends ConsumerStatefulWidget {
  const RechargeScreen({super.key});

  @override
  ConsumerState<RechargeScreen> createState() => _RechargeScreenState();
}

class _RechargeScreenState extends ConsumerState<RechargeScreen> {
  String _date = '';
  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  bool _modalOpen = false;
  Map<String, dynamic>? _editing;
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
    _load();
  }

  @override
  void dispose() {
    _rechargeAmount.dispose();
    _saleProfit.dispose();
    _chillar.dispose();
    _act.dispose();
    _mnp.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final res = await ref.read(apiServiceProvider).getRechargeEntries(
            month.monthId!,
            page: 1,
            date: _date.isEmpty ? null : _date,
          );
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

  void _openCreate() {
    _editing = null;
    _formDate = todayIso();
    _operator = 'AIRTEL';
    _rechargeAmount.clear();
    _saleProfit.clear();
    _chillar.clear();
    _act.clear();
    _mnp.clear();
    setState(() => _modalOpen = true);
  }

  void _openEdit(Map<String, dynamic> entry) {
    _editing = entry;
    _formDate = '${entry['date'] ?? todayIso()}';
    _operator = '${entry['operator'] ?? 'AIRTEL'}';
    _rechargeAmount.text = '${entry['rechargeAmount'] ?? ''}';
    _saleProfit.text = '${entry['saleProfit'] ?? ''}';
    _chillar.text = '${entry['chillar'] ?? ''}';
    _act.text = '${entry['act'] ?? ''}';
    _mnp.text = '${entry['mnp'] ?? ''}';
    setState(() => _modalOpen = true);
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
    final api = ref.read(apiServiceProvider);
    if (_editing != null) {
      await api.updateRechargeEntry(month.monthId!, _editing!['id'] as String, _payload());
    } else {
      await api.createRechargeEntry(month.monthId!, _payload());
    }
    setState(() => _modalOpen = false);
    await _load();
  }

  Future<void> _delete(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).deleteRechargeEntry(month.monthId!, id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return MonthGate(
      child: ScreenShell(
        title: 'Recharge',
        onRefresh: _load,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                    onPressed: _openCreate,
                    icon: const Icon(AppIcons.plus, color: Colors.white),
                  ),
                ),
                if (_loading) const PageLoader()
                else ..._entries.map((e) => Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: ListTile(
                        title: Text('${e['operator']} · ${formatRechargeTypeLabel(e)}'),
                        subtitle: Text('${e['date']} · ${formatMoney(parseMoney('${e['totalProfit'] ?? e['amount']}'))}'),
                        trailing: RowActionMenu(items: [
                          RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () => _openEdit(e)),
                          RowActionMenuItem(key: 'delete', label: 'Delete', danger: true, onPress: () => _delete(e['id'] as String)),
                        ]),
                      ),
                    )),
              ],
            ),
            FormModal(
              visible: _modalOpen,
              title: _editing == null ? 'Create Recharge' : 'Edit Recharge',
              onClose: () => setState(() => _modalOpen = false),
              child: Column(
                children: [
                  DateField(value: _formDate, onChanged: (v) => setState(() => _formDate = v), label: 'Date'),
                  DropdownButtonFormField<String>(
                    value: _operator,
                    decoration: const InputDecoration(labelText: 'Operator'),
                    items: rechargeOperators.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
                    onChanged: (v) => setState(() => _operator = v ?? 'AIRTEL'),
                  ),
                  const FieldLabel('Recharge amount', optional: true),
                  AppTextField(controller: _rechargeAmount, keyboardType: TextInputType.number, hint: 'Optional'),
                  for (final f in rechargeAmountFields) ...[
                    FieldLabel(f.label),
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
                  ModalActions(onCancel: () => setState(() => _modalOpen = false), onConfirm: _save),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
