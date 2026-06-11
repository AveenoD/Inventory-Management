import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

class PartiesScreen extends ConsumerStatefulWidget {
  const PartiesScreen({super.key});

  @override
  ConsumerState<PartiesScreen> createState() => _PartiesScreenState();
}

class _PartiesScreenState extends ConsumerState<PartiesScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _parties = [];
  List<Map<String, dynamic>> _transactions = [];
  bool _partyModal = false;
  bool _txModal = false;
  final _partyName = TextEditingController();
  final _partyPhone = TextEditingController();
  String _txType = 'MATERIAL_IN';
  String _txDate = todayIso();
  String? _txPartyId;
  final _txAmount = TextEditingController();
  final _txNote = TextEditingController();
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _partyName.dispose();
    _partyPhone.dispose();
    _txAmount.dispose();
    _txNote.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final parties = await api.getPartyList();
      final txs = await api.getPartyTransactions(month.monthId!);
      if (mounted) {
        setState(() {
          _parties = (parties['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _transactions = (txs['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createParty() async {
    await ref.read(apiServiceProvider).createParty({
      'name': _partyName.text.trim(),
      'phone': _partyPhone.text.trim().isEmpty ? null : _partyPhone.text.trim(),
    });
    setState(() => _partyModal = false);
    await _load();
  }

  Future<void> _createTx() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null || _txPartyId == null) return;
    await ref.read(apiServiceProvider).createPartyTransaction(month.monthId!, {
      'partyId': _txPartyId,
      'date': _txDate,
      'type': _txType,
      'amount': parseMoney(_txAmount.text),
      'note': _txNote.text.trim().isEmpty ? null : _txNote.text.trim(),
    });
    setState(() => _txModal = false);
    await _load();
  }

  Future<void> _deleteTx(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).deletePartyTransaction(month.monthId!, id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _transactions.where((t) {
      if (_search.isEmpty) return true;
      return '${t['partyName']} ${t['type']} ${t['amount']}'.toLowerCase().contains(_search.toLowerCase());
    }).toList();

    return MonthGate(
      child: ScreenShell(
        title: 'Parties',
        showBack: true,
        onRefresh: _load,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: AppTextField(hint: 'Search…', onChanged: (v) => setState(() => _search = v))),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                      onPressed: () => setState(() => _partyModal = true),
                      icon: const Icon(AppIcons.userPlus, color: Colors.white, size: 18),
                    ),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                      onPressed: () => setState(() => _txModal = true),
                      icon: const Icon(AppIcons.plus, color: Colors.white),
                    ),
                  ],
                ),
                if (_loading) const PageLoader()
                else ...filtered.map((t) => Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: ListTile(
                        title: Text('${t['partyName'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${t['type']} · ${t['date']}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(formatMoney(parseMoney('${t['amount']}')), style: const TextStyle(fontWeight: FontWeight.w700)),
                            IconButton(
                              icon: const Icon(AppIcons.trash2, size: 18, color: AppColors.red),
                              onPressed: () => _deleteTx(t['id'] as String),
                            ),
                          ],
                        ),
                      ),
                    )),
              ],
            ),
            FormModal(
              visible: _partyModal,
              title: 'Create party',
              onClose: () => setState(() => _partyModal = false),
              child: Column(
                children: [
                  const FieldLabel('Name'),
                  AppTextField(controller: _partyName),
                  const FieldLabel('Phone'),
                  AppTextField(controller: _partyPhone, keyboardType: TextInputType.phone),
                  ModalActions(onCancel: () => setState(() => _partyModal = false), onConfirm: _createParty, confirmLabel: 'Create'),
                ],
              ),
            ),
            FormModal(
              visible: _txModal,
              title: 'Add transaction',
              onClose: () => setState(() => _txModal = false),
              child: Column(
                children: [
                  DropdownButtonFormField<String>(
                    value: _txPartyId,
                    decoration: const InputDecoration(labelText: 'Party'),
                    items: _parties.map((p) => DropdownMenuItem(value: p['id'] as String, child: Text('${p['name']}'))).toList(),
                    onChanged: (v) => setState(() => _txPartyId = v),
                  ),
                  DropdownButtonFormField<String>(
                    value: _txType,
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: const [
                      DropdownMenuItem(value: 'MATERIAL_IN', child: Text('Material in')),
                      DropdownMenuItem(value: 'PAYMENT_OUT', child: Text('Payment out')),
                    ],
                    onChanged: (v) => setState(() => _txType = v ?? 'MATERIAL_IN'),
                  ),
                  DateField(value: _txDate, onChanged: (v) => setState(() => _txDate = v), label: 'Date'),
                  const FieldLabel('Amount'),
                  AppTextField(controller: _txAmount, keyboardType: TextInputType.number),
                  const FieldLabel('Note'),
                  AppTextField(controller: _txNote),
                  ModalActions(onCancel: () => setState(() => _txModal = false), onConfirm: _createTx),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
