import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/repair.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

class RepairScreen extends ConsumerStatefulWidget {
  const RepairScreen({super.key});

  @override
  ConsumerState<RepairScreen> createState() => _RepairScreenState();
}

class _RepairScreenState extends ConsumerState<RepairScreen> {
  String? _status;
  String _date = '';
  String _search = '';
  bool _loading = true;
  List<Map<String, dynamic>> _jobs = [];
  bool _intakeOpen = false;
  final _customer = TextEditingController();
  final _phone = TextEditingController();
  final _device = TextEditingController();
  final _issue = TextEditingController();
  final _repairCost = TextEditingController();
  final _customerCharge = TextEditingController();
  String _intakeDate = todayIso();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _customer.dispose();
    _phone.dispose();
    _device.dispose();
    _issue.dispose();
    _repairCost.dispose();
    _customerCharge.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final res = await ref.read(apiServiceProvider).getRepairJobs(
            month.monthId!,
            page: 1,
            date: _date.isEmpty ? null : _date,
            status: _status,
          );
      if (mounted) {
        setState(() {
          _jobs = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createIntake() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).createRepairIntake(month.monthId!, {
      'date': _intakeDate,
      'customerName': _customer.text.trim(),
      'customerPhone': _phone.text.trim(),
      'deviceName': _device.text.trim(),
      'issueDescription': _issue.text.trim(),
      'repairCost': parseMoney(_repairCost.text),
      'customerCharge': parseMoney(_customerCharge.text),
    });
    setState(() => _intakeOpen = false);
    await _load();
  }

  Future<void> _updateStatus(Map<String, dynamic> job, String status) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).updateRepairJob(month.monthId!, job['id'] as String, {'status': status});
    await _load();
  }

  Future<void> _delete(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    await ref.read(apiServiceProvider).deleteRepairJob(month.monthId!, id);
    await _load();
  }

  List<RowActionMenuItem> _actions(Map<String, dynamic> job) {
    final status = '${job['status']}';
    final items = <RowActionMenuItem>[];
    if (status == 'RECEIVED') {
      items.add(RowActionMenuItem(key: 'start', label: 'Start repair', onPress: () => _updateStatus(job, 'IN_PROGRESS')));
    }
    if (status == 'IN_PROGRESS') {
      items.add(RowActionMenuItem(key: 'complete', label: 'Mark repaired', onPress: () => _updateStatus(job, 'REPAIRED_PENDING_PICKUP')));
    }
    if (status == 'REPAIRED_PENDING_PICKUP') {
      items.add(RowActionMenuItem(key: 'deliver', label: 'Mark delivered', onPress: () => _updateStatus(job, 'DELIVERED')));
    }
    items.add(RowActionMenuItem(key: 'delete', label: 'Delete', danger: true, onPress: () => _delete(job['id'] as String)));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    return MonthGate(
      child: ScreenShell(
        title: 'Repairs',
        subtitle: 'Repair job tracking',
        onRefresh: _load,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: AppTextField(hint: 'Search jobs…', onChanged: (v) => setState(() => _search = v))),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: AppColors.accent),
                      onPressed: () => setState(() => _intakeOpen = true),
                      icon: const Icon(AppIcons.plus, color: Colors.white),
                    ),
                  ],
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(label: const Text('All'), selected: _status == null, onSelected: (_) { setState(() => _status = null); _load(); }),
                      ...repairJobStatuses.map((s) => FilterChip(
                            label: Text(repairStatusLabel(s)),
                            selected: _status == s,
                            onSelected: (_) { setState(() => _status = s); _load(); },
                          )),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_loading) const PageLoader()
                else ..._jobs.where((j) {
                  if (_search.isEmpty) return true;
                  final hay = '${j['customerName']} ${j['deviceName']} ${j['issueDescription']}'.toLowerCase();
                  return hay.contains(_search.toLowerCase());
                }).map((job) => Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: ListTile(
                        title: Text('${job['customerName'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${job['deviceName']}\n${repairStatusLabel('${job['status']}')}'),
                        isThreeLine: true,
                        trailing: RowActionMenu(items: _actions(job)),
                      ),
                    )),
              ],
            ),
            FormModal(
              visible: _intakeOpen,
              title: 'New repair intake',
              onClose: () => setState(() => _intakeOpen = false),
              child: Column(
                children: [
                  DateField(value: _intakeDate, onChanged: (v) => setState(() => _intakeDate = v), label: 'Date'),
                  const FieldLabel('Customer name'),
                  AppTextField(controller: _customer),
                  const FieldLabel('Phone'),
                  AppTextField(controller: _phone, keyboardType: TextInputType.phone),
                  const FieldLabel('Device'),
                  AppTextField(controller: _device),
                  const FieldLabel('Issue'),
                  AppTextField(controller: _issue, maxLines: 2),
                  const FieldLabel('Repair cost'),
                  AppTextField(controller: _repairCost, keyboardType: TextInputType.number),
                  const FieldLabel('Customer charge'),
                  AppTextField(controller: _customerCharge, keyboardType: TextInputType.number),
                  ModalActions(onCancel: () => setState(() => _intakeOpen = false), onConfirm: _createIntake, confirmLabel: 'Create'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
