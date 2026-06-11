import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../domain/constants/repair.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/row_action_menu.dart';
import '../../widgets/screen_shell.dart';

const _partOther = '__other__';

class _TabDef {
  const _TabDef(this.key, this.label, {this.status});

  final String key;
  final String label;
  final String? status;
}

const _tabs = <_TabDef>[
  _TabDef('all', 'All'),
  _TabDef('active', 'In shop'),
  _TabDef('pending', 'Pending pickup', status: 'REPAIRED_PENDING_PICKUP'),
  _TabDef('delivered', 'Delivered', status: 'DELIVERED'),
  _TabDef('unrepairable', 'Unrepairable', status: 'UNREPAIRABLE_RETURNED'),
];

class _EditDraft {
  _EditDraft({
    required this.date,
    required this.customerName,
    required this.customerPhone,
    required this.device,
    required this.issueDescription,
    required this.repairCost,
    required this.customerCharge,
  });

  String date;
  String customerName;
  String customerPhone;
  String device;
  String issueDescription;
  String repairCost;
  String customerCharge;
}

String _moneyFieldValue(dynamic amount) {
  final n = parseMoney(amount?.toString());
  return n > 0 ? n.toString() : '';
}

bool _canEditPricing(String status) =>
    status == 'RECEIVED' || status == 'IN_PROGRESS' || status == 'REPAIRED_PENDING_PICKUP';

_EditDraft _jobToEditDraft(Map<String, dynamic> job) => _EditDraft(
      date: '${job['date']}',
      customerName: '${job['customerName'] ?? ''}',
      customerPhone: '${job['customerPhone'] ?? ''}',
      device: '${job['device'] ?? ''}',
      issueDescription: '${job['issueDescription'] ?? ''}',
      repairCost: _moneyFieldValue(job['repairCost']),
      customerCharge: _moneyFieldValue(job['customerCharge'] ?? job['salePrice']),
    );

class RepairScreen extends ConsumerStatefulWidget {
  const RepairScreen({super.key, this.openIntake = false});

  final bool openIntake;

  @override
  ConsumerState<RepairScreen> createState() => _RepairScreenState();
}

class _RepairScreenState extends ConsumerState<RepairScreen> {
  String _tab = 'all';
  String _filterDate = '';
  String _customerSearch = '';
  String _customerSearchDebounced = '';
  Timer? _searchDebounce;

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  String? _intakeError;
  String? _actionError;
  String? _editError;
  bool _submitting = false;

  List<Map<String, dynamic>> _jobs = [];
  Map<String, dynamic>? _todayData;
  List<Map<String, dynamic>> _repairParts = [];

  bool _intakeOpen = false;
  Map<String, dynamic>? _actionJob;
  String? _actionKind;
  Map<String, dynamic>? _editingJob;
  _EditDraft? _editDraft;

  String _intakeDate = todayIso();
  final _intakeCustomer = TextEditingController();
  final _intakePhone = TextEditingController();
  final _intakeDevice = TextEditingController();
  final _intakeIssue = TextEditingController();
  final _intakeRepairCost = TextEditingController();
  final _intakeCustomerCharge = TextEditingController();

  final _completeRepairCost = TextEditingController();
  final _completeCustomerCharge = TextEditingController();
  String _selectedPartId = '';
  final _otherPartName = TextEditingController();
  String _deliveredAt = todayIso();

  final _editCustomer = TextEditingController();
  final _editPhone = TextEditingController();
  final _editDevice = TextEditingController();
  final _editIssue = TextEditingController();
  final _editRepairCost = TextEditingController();
  final _editCustomerCharge = TextEditingController();

  @override
  void initState() {
    super.initState();
    _deliveredAt = todayIso();
    _intakeDate = todayIso();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.openIntake) setState(() => _intakeOpen = true);
      _load();
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _intakeCustomer.dispose();
    _intakePhone.dispose();
    _intakeDevice.dispose();
    _intakeIssue.dispose();
    _intakeRepairCost.dispose();
    _intakeCustomerCharge.dispose();
    _completeRepairCost.dispose();
    _completeCustomerCharge.dispose();
    _otherPartName.dispose();
    _editCustomer.dispose();
    _editPhone.dispose();
    _editDevice.dispose();
    _editIssue.dispose();
    _editRepairCost.dispose();
    _editCustomerCharge.dispose();
    super.dispose();
  }

  _TabDef get _tabDef => _tabs.firstWhere((t) => t.key == _tab);

  List<Map<String, dynamic>> get _filteredJobs {
    var list = _jobs;
    if (_tab == 'active') {
      list = list
          .where((j) => j['status'] == 'RECEIVED' || j['status'] == 'IN_PROGRESS')
          .toList();
    }
    if (_customerSearchDebounced.isNotEmpty) {
      list = list
          .where((j) =>
              '${j['customerName'] ?? ''}'.toLowerCase().contains(_customerSearchDebounced))
          .toList();
    }
    return list;
  }

  void _onSearchChanged(String value) {
    setState(() => _customerSearch = value);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) {
        setState(() => _customerSearchDebounced = value.trim().toLowerCase());
      }
    });
  }

  Future<void> _load({bool jobsOnly = false}) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;

    if (!_refreshing) {
      setState(() {
        _loading = _jobs.isEmpty;
        _error = null;
      });
    }

    try {
      final api = ref.read(apiServiceProvider);
      final tabDef = _tabDef;
      final jobsFuture = api.getRepairJobs(
        month.monthId!,
        page: 1,
        date: _filterDate.isEmpty ? null : _filterDate,
        status: tabDef.status,
      );

      if (jobsOnly) {
        final res = await jobsFuture;
        if (!mounted) return;
        setState(() {
          _jobs = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
          _refreshing = false;
        });
        return;
      }

      final results = await Future.wait<Map<String, dynamic>>([
        jobsFuture,
        api.getToday(),
        api.getProducts(kind: 'REPAIR_PART', limit: 100),
      ]);

      if (!mounted) return;
      final jobsRes = results[0];
      final todayRes = results[1];
      final partsRes = results[2];

      setState(() {
        _jobs = (jobsRes['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _todayData = todayRes;
        _repairParts = (partsRes['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
        _refreshing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load repair jobs.';
        _loading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    await _load();
  }

  Future<void> _invalidate() async {
    await _load();
  }

  void _resetIntakeForm() {
    _intakeCustomer.clear();
    _intakePhone.clear();
    _intakeDevice.clear();
    _intakeIssue.clear();
    _intakeRepairCost.clear();
    _intakeCustomerCharge.clear();
    _intakeDate = todayIso();
    _intakeError = null;
  }

  Future<void> _createIntake() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() {
      _submitting = true;
      _intakeError = null;
    });
    try {
      await ref.read(apiServiceProvider).createRepairIntake(month.monthId!, {
        'date': _intakeDate,
        'customerName': _intakeCustomer.text.trim(),
        'customerPhone': _intakePhone.text.trim().isEmpty ? null : _intakePhone.text.trim(),
        'device': _intakeDevice.text.trim(),
        'issueDescription': _intakeIssue.text.trim(),
        'repairCost': parseMoney(_intakeRepairCost.text),
        'customerCharge': parseMoney(_intakeCustomerCharge.text),
      });
      if (!mounted) return;
      setState(() {
        _intakeOpen = false;
        _submitting = false;
      });
      _resetIntakeForm();
      await _invalidate();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _intakeError = e is ApiError ? e.message : 'Could not save intake.';
        _submitting = false;
      });
    }
  }

  Future<void> _updateStatus({
    required String jobId,
    required String status,
    double? repairCost,
    double? customerCharge,
    List<Map<String, dynamic>>? partsUsed,
    String? otherPartUsed,
    String? deliveredAt,
  }) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      final body = <String, dynamic>{'status': status};
      if (repairCost != null) body['repairCost'] = repairCost;
      if (customerCharge != null) body['customerCharge'] = customerCharge;
      if (partsUsed != null) body['partsUsed'] = partsUsed;
      if (otherPartUsed != null && otherPartUsed.isNotEmpty) {
        body['otherPartUsed'] = otherPartUsed;
      }
      if (deliveredAt != null) body['deliveredAt'] = deliveredAt;

      await ref.read(apiServiceProvider).updateRepairJob(month.monthId!, jobId, body);
      if (!mounted) return;
      setState(() {
        _actionJob = null;
        _actionKind = null;
        _submitting = false;
      });
      _completeRepairCost.clear();
      _completeCustomerCharge.clear();
      _selectedPartId = '';
      _otherPartName.clear();
      await _invalidate();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _actionError = e is ApiError ? e.message : 'Could not update job.';
        _submitting = false;
      });
    }
  }

  Future<void> _saveEdit() async {
    final job = _editingJob;
    final draft = _editDraft;
    if (job == null || draft == null) return;
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    final status = '${job['status']}';

    setState(() {
      _submitting = true;
      _editError = null;
    });
    try {
      final body = <String, dynamic>{
        'status': status,
        'date': draft.date,
        'customerName': draft.customerName.trim(),
        'customerPhone': draft.customerPhone.trim().isEmpty ? null : draft.customerPhone.trim(),
        'device': draft.device.trim(),
        'issueDescription': draft.issueDescription.trim(),
      };
      if (_canEditPricing(status)) {
        body['repairCost'] = parseMoney(draft.repairCost);
        body['customerCharge'] = parseMoney(draft.customerCharge);
      }
      await ref.read(apiServiceProvider).updateRepairJob(
            month.monthId!,
            job['id'] as String,
            body,
          );
      if (!mounted) return;
      setState(() {
        _editingJob = null;
        _editDraft = null;
        _submitting = false;
      });
      await _invalidate();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _editError = e is ApiError ? e.message : 'Could not save changes.';
        _submitting = false;
      });
    }
  }

  Future<void> _deleteJob(String id) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(apiServiceProvider).deleteRepairJob(month.monthId!, id);
      if (!mounted) return;
      setState(() => _submitting = false);
      await _invalidate();
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiError ? e.message : 'Could not delete job.')),
      );
    }
  }

  void _openComplete(Map<String, dynamic> job) {
    setState(() {
      _actionJob = job;
      _actionKind = 'complete';
      _actionError = null;
      _completeRepairCost.text = _moneyFieldValue(job['repairCost']);
      _completeCustomerCharge.text = _moneyFieldValue(job['customerCharge'] ?? job['salePrice']);
      final otherPart = job['otherPartUsed'];
      if (otherPart != null && '$otherPart'.isNotEmpty) {
        _selectedPartId = _partOther;
        _otherPartName.text = '$otherPart';
      } else {
        final partsUsed = job['partsUsed'] as List<dynamic>? ?? [];
        _selectedPartId = partsUsed.isNotEmpty ? '${partsUsed.first['productId']}' : '';
        _otherPartName.clear();
      }
    });
  }

  void _handlePartChange(String? partId) {
    final id = partId ?? '';
    setState(() {
      _selectedPartId = id;
      if (id == _partOther || id.isEmpty) {
        if (id.isEmpty) _otherPartName.clear();
        return;
      }
      _otherPartName.clear();
      for (final p in _repairParts) {
        if ('${p['id']}' == id) {
          _completeRepairCost.text = _moneyFieldValue(p['buyPrice']);
          break;
        }
      }
    });
  }

  void _openDeliver(Map<String, dynamic> job) {
    setState(() {
      _actionJob = job;
      _actionKind = 'deliver';
      _actionError = null;
      _deliveredAt = todayIso();
    });
  }

  void _startEdit(Map<String, dynamic> job) {
    final draft = _jobToEditDraft(job);
    _editCustomer.text = draft.customerName;
    _editPhone.text = draft.customerPhone;
    _editDevice.text = draft.device;
    _editIssue.text = draft.issueDescription;
    _editRepairCost.text = draft.repairCost;
    _editCustomerCharge.text = draft.customerCharge;
    setState(() {
      _editingJob = job;
      _editDraft = draft;
      _editError = null;
    });
  }

  List<RowActionMenuItem> _buildMenuItems(Map<String, dynamic> job) {
    final status = '${job['status']}';
    final items = <RowActionMenuItem>[];

    if (status == 'RECEIVED') {
      items.addAll([
        RowActionMenuItem(
          key: 'start',
          label: 'Start repair',
          onPress: () => _updateStatus(jobId: job['id'] as String, status: 'IN_PROGRESS'),
        ),
        RowActionMenuItem(
          key: 'unrepairable',
          label: 'Unrepairable',
          onPress: () =>
              _updateStatus(jobId: job['id'] as String, status: 'UNREPAIRABLE_RETURNED'),
        ),
      ]);
    } else if (status == 'IN_PROGRESS') {
      items.addAll([
        RowActionMenuItem(key: 'done', label: 'Repair done', onPress: () => _openComplete(job)),
        RowActionMenuItem(
          key: 'unrepairable',
          label: 'Unrepairable',
          onPress: () =>
              _updateStatus(jobId: job['id'] as String, status: 'UNREPAIRABLE_RETURNED'),
        ),
      ]);
    } else if (status == 'REPAIRED_PENDING_PICKUP') {
      items.add(RowActionMenuItem(
        key: 'pickup',
        label: 'Customer picked up',
        onPress: () => _openDeliver(job),
      ));
    }

    items.addAll([
      RowActionMenuItem(key: 'edit', label: 'Edit', onPress: () => _startEdit(job)),
      RowActionMenuItem(
        key: 'delete',
        label: 'Delete',
        danger: true,
        onPress: () => ConfirmDialog.show(
          context,
          title: 'Delete repair job?',
          message: 'Remove repair for ${job['device'] ?? 'device'}? Parts return to stock.',
          onConfirm: () => _deleteJob(job['id'] as String),
        ),
      ),
    ]);
    return items;
  }

  String _profitLine(Map<String, dynamic> job) {
    final status = '${job['status']}';
    if (repairCountsInProfit(status)) {
      return formatMoney(parseMoney('${job['profit']}'));
    }
    if (status == 'REPAIRED_PENDING_PICKUP') return 'On pickup';
    return '—';
  }

  @override
  Widget build(BuildContext context) {
    final today = _todayData;
    final pendingCount = today?['repairPendingCount'] ?? 0;
    final pendingBalance = parseMoney('${today?['repairPendingBalance'] ?? '0'}');
    final repairProfit = formatMoney(parseMoney('${today?['repairProfit'] ?? '0'}'));
    final deliveredToday = today?['repairDelivered'] ?? 0;

    return MonthGate(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ScreenShell(
              title: 'Repairs',
              subtitle: 'Intake → repair → pickup',
              titleFontSize: 24,
              refreshing: _refreshing,
              onRefresh: _refresh,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildToolbar(),
                  _buildMetrics(pendingCount, pendingBalance, repairProfit, deliveredToday),
                  _buildTabs(),
                  _buildFilterCard(),
                  if (_loading) const PageLoader(message: 'Loading jobs…'),
                  if (_error != null) _buildError(),
                  if (!_loading && _error == null && _filteredJobs.isEmpty) _buildEmpty(),
                  if (!_loading && _error == null && _filteredJobs.isNotEmpty)
                    ..._filteredJobs.map(_buildJobCard),
                ],
              ),
            ),
          ),
          FormModal(
            visible: _intakeOpen,
            title: 'New repair intake',
            subtitle: 'Register device dropped off for repair',
            onClose: () => setState(() => _intakeOpen = false),
            child: _buildIntakeModal(),
          ),
          FormModal(
            visible: _actionJob != null && _actionKind == 'complete',
            title: 'Repair completed',
            subtitle: 'Mark ready for pickup',
            onClose: () => setState(() {
              _actionJob = null;
              _actionKind = null;
            }),
            child: _buildCompleteModal(),
          ),
          FormModal(
            visible: _actionJob != null && _actionKind == 'deliver',
            title: 'Customer picked up',
            subtitle: 'Record delivery and count profit',
            onClose: () => setState(() {
              _actionJob = null;
              _actionKind = null;
            }),
            child: _buildDeliverModal(),
          ),
          FormModal(
            visible: _editingJob != null && _editDraft != null,
            title: 'Edit repair job',
            subtitle: 'Update details without changing status',
            onClose: () => setState(() {
              _editingJob = null;
              _editDraft = null;
              _editError = null;
            }),
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
                    value: _customerSearch,
                    onChanged: _onSearchChanged,
                    placeholder: 'Search customer…',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          PrimaryButton(
            label: '+ New intake',
            onPressed: () => setState(() {
              _intakeOpen = true;
              _intakeError = null;
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildMetrics(
    dynamic pendingCount,
    double pendingBalance,
    String repairProfit,
    dynamic deliveredToday,
  ) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.amber,
            icon: const Icon(AppIcons.clock, size: 18, color: AppColors.amber),
            label: 'Pending pickup',
            value: '$pendingCount',
            sub: 'Ready for customer',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.purple,
            icon: const Icon(AppIcons.indianRupee, size: 18, color: AppColors.purple),
            label: 'Pending balance',
            value: formatMoney(pendingBalance),
          ),
        ),
        MetricCell(
          fullWidth: true,
          child: GradientStatCard(
            tone: StatTone.green,
            icon: const Icon(AppIcons.wrench, size: 18, color: AppColors.green),
            label: "Today's profit",
            value: repairProfit,
            sub: '$deliveredToday delivered today',
          ),
        ),
      ],
    );
  }

  Widget _buildTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: _tabs.map((t) {
          final active = _tab == t.key;
          return Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: InkWell(
              onTap: () {
                setState(() => _tab = t.key);
                _load(jobsOnly: true);
              },
              borderRadius: BorderRadius.circular(AppRadii.pill),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: active ? AppColors.accentLight : AppColors.card,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  border: Border.all(color: active ? AppColors.accent : AppColors.border),
                ),
                child: Text(
                  t.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: active ? AppColors.accent : AppColors.muted,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildFilterCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DateField(
            label: 'Filter date',
            value: _filterDate,
            onChanged: (v) {
              setState(() => _filterDate = v);
              _load(jobsOnly: true);
            },
          ),
          if (_filterDate.isNotEmpty)
            TextButton(
              onPressed: () {
                setState(() => _filterDate = '');
                _load(jobsOnly: true);
              },
              child: const Text('All dates', style: TextStyle(fontWeight: FontWeight.w600)),
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
      child: Column(
        children: [
          const Text(
            'No repair jobs',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Register a device when the customer drops it off.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            label: 'New intake',
            onPressed: () => setState(() => _intakeOpen = true),
          ),
        ],
      ),
    );
  }

  Widget _buildJobCard(Map<String, dynamic> job) {
    final status = '${job['status']}';
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${job['device'] ?? '—'}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    AppBadge(
                      label: repairStatusLabel(status),
                      tone: repairStatusTone(status),
                    ),
                  ],
                ),
              ),
              RowActionMenu(items: _buildMenuItems(job), disabled: _submitting),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${job['customerName'] ?? '—'}',
            style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            '${job['issueDescription'] ?? '—'}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, color: AppColors.muted),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Charge: ${formatMoney(parseMoney('${job['customerCharge'] ?? job['salePrice']}'))} · Profit: ${_profitLine(job)}',
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
        ],
      ),
    );
  }

  Widget _buildIntakeModal() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date received',
          value: _intakeDate,
          onChanged: (v) => setState(() => _intakeDate = v),
        ),
        const FieldLabel('Customer name'),
        AppTextField(controller: _intakeCustomer, hint: 'Customer name'),
        const FieldLabel('Phone', optional: true),
        AppTextField(controller: _intakePhone, keyboardType: TextInputType.phone),
        const FieldLabel('Device / model'),
        AppTextField(controller: _intakeDevice, hint: 'e.g. Redmi Note 13'),
        const FieldLabel('Issue'),
        AppTextField(controller: _intakeIssue, maxLines: 3),
        const FieldLabel('Repair cost', optional: true),
        AppTextField(controller: _intakeRepairCost, keyboardType: TextInputType.number),
        const FieldLabel('Customer charge', optional: true),
        AppTextField(controller: _intakeCustomerCharge, keyboardType: TextInputType.number),
        if (_intakeError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_intakeError!, style: const TextStyle(color: AppColors.red)),
          ),
        ModalActions(
          onCancel: () => setState(() => _intakeOpen = false),
          onConfirm: () {
            if (_intakeCustomer.text.trim().isEmpty ||
                _intakeDevice.text.trim().isEmpty ||
                _intakeIssue.text.trim().isEmpty) {
              return;
            }
            _createIntake();
          },
          confirmLabel: 'Save intake',
          loading: _submitting,
        ),
      ],
    );
  }

  Widget _buildCompleteModal() {
    final job = _actionJob;
    if (job == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${job['device']} — ${job['customerName']}',
          style: const TextStyle(color: AppColors.muted, height: 20 / 14),
        ),
        const SizedBox(height: AppSpacing.md),
        const FieldLabel('Part from inventory'),
        Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.md),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.input),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: _selectedPartId.isEmpty ? null : _selectedPartId,
              hint: const Padding(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: Text('None — no part from stock'),
              ),
              items: [
                const DropdownMenuItem(value: '', child: Text('None — no part from stock')),
                for (final p in _repairParts)
                  DropdownMenuItem(
                    value: '${p['id']}',
                    child: Text('${p['name']} (${p['stockQty']} in stock)'),
                  ),
                const DropdownMenuItem(value: _partOther, child: Text('Other — not in stock')),
              ],
              onChanged: _handlePartChange,
            ),
          ),
        ),
        if (_selectedPartId == _partOther) ...[
          const FieldLabel('Other part used'),
          AppTextField(controller: _otherPartName),
        ],
        const FieldLabel('Repair cost'),
        AppTextField(controller: _completeRepairCost, keyboardType: TextInputType.number),
        const FieldLabel('Customer charge'),
        AppTextField(controller: _completeCustomerCharge, keyboardType: TextInputType.number),
        if (_actionError != null)
          Text(_actionError!, style: const TextStyle(color: AppColors.red)),
        ModalActions(
          onCancel: () => setState(() {
            _actionJob = null;
            _actionKind = null;
          }),
          onConfirm: () {
            final isOther = _selectedPartId == _partOther;
            _updateStatus(
              jobId: job['id'] as String,
              status: 'REPAIRED_PENDING_PICKUP',
              repairCost: parseMoney(_completeRepairCost.text),
              customerCharge: parseMoney(_completeCustomerCharge.text),
              partsUsed: _selectedPartId.isNotEmpty && !isOther
                  ? [
                      {'productId': _selectedPartId, 'quantity': 1},
                    ]
                  : [],
              otherPartUsed: isOther && _otherPartName.text.trim().isNotEmpty
                  ? _otherPartName.text.trim()
                  : null,
            );
          },
          confirmLabel: 'Mark ready',
          loading: _submitting,
        ),
      ],
    );
  }

  Widget _buildDeliverModal() {
    final job = _actionJob;
    if (job == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Charge ${formatMoney(parseMoney('${job['customerCharge'] ?? job['salePrice']}'))} will count in profit.',
          style: const TextStyle(color: AppColors.muted, height: 20 / 14),
        ),
        const SizedBox(height: AppSpacing.md),
        DateField(
          label: 'Delivery date',
          value: _deliveredAt,
          onChanged: (v) => setState(() => _deliveredAt = v),
        ),
        if (_actionError != null)
          Text(_actionError!, style: const TextStyle(color: AppColors.red)),
        ModalActions(
          onCancel: () => setState(() {
            _actionJob = null;
            _actionKind = null;
          }),
          onConfirm: () => _updateStatus(
            jobId: job['id'] as String,
            status: 'DELIVERED',
            deliveredAt: _deliveredAt,
          ),
          confirmLabel: 'Mark delivered',
          loading: _submitting,
        ),
      ],
    );
  }

  Widget _buildEditModal() {
    final job = _editingJob;
    final draft = _editDraft;
    if (job == null || draft == null) return const SizedBox.shrink();
    final status = '${job['status']}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DateField(
          label: 'Date received',
          value: draft.date,
          onChanged: (v) => setState(() => draft.date = v),
        ),
        const FieldLabel('Customer name'),
        AppTextField(
          controller: _editCustomer,
          onChanged: (v) => draft.customerName = v,
        ),
        const FieldLabel('Phone', optional: true),
        AppTextField(
          controller: _editPhone,
          onChanged: (v) => draft.customerPhone = v,
          keyboardType: TextInputType.phone,
        ),
        const FieldLabel('Device / model'),
        AppTextField(
          controller: _editDevice,
          onChanged: (v) => draft.device = v,
        ),
        const FieldLabel('Issue'),
        AppTextField(
          controller: _editIssue,
          onChanged: (v) => draft.issueDescription = v,
          maxLines: 3,
        ),
        if (_canEditPricing(status)) ...[
          const FieldLabel('Repair cost', optional: true),
          AppTextField(
            controller: _editRepairCost,
            onChanged: (v) => draft.repairCost = v,
            keyboardType: TextInputType.number,
          ),
          const FieldLabel('Customer charge', optional: true),
          AppTextField(
            controller: _editCustomerCharge,
            onChanged: (v) => draft.customerCharge = v,
            keyboardType: TextInputType.number,
          ),
        ] else
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.md),
            child: Text(
              'Pricing cannot be changed for delivered or unrepairable jobs.',
              style: TextStyle(color: AppColors.muted, height: 20 / 14),
            ),
          ),
        if (_editError != null)
          Text(_editError!, style: const TextStyle(color: AppColors.red)),
        ModalActions(
          onCancel: () => setState(() {
            _editingJob = null;
            _editDraft = null;
          }),
          onConfirm: _saveEdit,
          confirmLabel: 'Save changes',
          loading: _submitting,
          disabled: draft.customerName.trim().isEmpty || draft.device.trim().isEmpty,
        ),
      ],
    );
  }

}
