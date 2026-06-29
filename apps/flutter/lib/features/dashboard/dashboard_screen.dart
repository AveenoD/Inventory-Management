import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/app_header_actions.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/form_modal.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';
import '../../widgets/simple_bar_chart.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  String _date = todayIso();
  bool _monthSummaryOpen = false;
  bool _editOpeningOpen = false;
  bool _day1PromptOpen = false;
  bool _loading = true;
  bool _savingOpening = false;
  String? _error;
  String? _openingError;
  String _openingInput = '';
  Map<String, dynamic>? _data;
  final TextEditingController _openingController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  @override
  void dispose() {
    _openingController.dispose();
    super.dispose();
  }

  String _dismissKey(int year, int month) => 'sk-opening-dismissed-$year-$month';

  Future<void> _loadDashboard({String? date}) async {
    final queryDate = date ?? _date;

    if (!mounted) return;
    setState(() {
      _loading = _data == null;
      _error = null;
    });

    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getToday(date: queryDate);
      if (!mounted) return;
      setState(() {
        _data = res;
        _loading = false;
      });
      await _handleDayOnePrompt(res);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load dashboard.';
        _loading = false;
      });
    }
  }

  Future<void> _handleDayOnePrompt(Map<String, dynamic> payload) async {
    final isFirst = payload['isFirstDayOfMonth'] == true;
    if (!isFirst) {
      if (mounted) {
        setState(() => _day1PromptOpen = false);
      }
      return;
    }
    final year = _asInt(payload['year']);
    final month = _asInt(payload['month']);
    if (year == null || month == null) return;
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getString(_dismissKey(year, month));
    if (dismissed != null) return;
    final showPrompt = payload['showOpeningBalancePrompt'] == true;
    final opening = _stringNum(payload['openingBalance']);
    if (!showPrompt && opening != '0.00') return;
    final suggested = _stringNum(payload['suggestedOpeningBalance']);
    if (!mounted) return;
    setState(() {
      _openingInput = suggested.isNotEmpty ? suggested : opening;
      _openingController.text = _openingInput;
      _day1PromptOpen = true;
    });
  }

  Future<void> _dismissDayOnePrompt() async {
    final raw = _data;
    if (raw == null) return;
    final year = _asInt(raw['year']);
    final month = _asInt(raw['month']);
    if (year == null || month == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dismissKey(year, month), '1');
    if (!mounted) return;
    setState(() => _day1PromptOpen = false);
  }

  Future<void> _saveOpeningBalance() async {
    final amount = parseMoney(_openingController.text);
    if (amount < 0) {
      setState(() => _openingError = 'Amount must be non-negative.');
      return;
    }
    final raw = _data;
    final monthId = _asString(raw?['monthId']) ?? ref.read(monthProvider).valueOrNull?.monthId;
    if (monthId == null) {
      setState(() => _openingError = 'Month not loaded.');
      return;
    }

    setState(() {
      _openingError = null;
      _savingOpening = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      await api.updateMonth(monthId, {'openingBalance': amount});
      await _dismissDayOnePrompt();
      if (!mounted) return;
      setState(() {
        _savingOpening = false;
        _editOpeningOpen = false;
      });
      await _loadDashboard();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _savingOpening = false;
        _openingError = e is ApiError ? e.message : 'Could not update opening balance.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (prev?.isAuthenticated != true && next.isAuthenticated && !next.isLoading) {
        _loadDashboard();
      }
    });

    final monthState = ref.watch(monthProvider).valueOrNull;
    final data = _data;
    final year = _asInt(data?['year']) ?? monthState?.year ?? DateTime.now().year;
    final month = _asInt(data?['month']) ?? monthState?.month ?? DateTime.now().month;
    final monthLbl = monthLabel(year, month);
    final isRefreshing = _loading && data != null;

    return Stack(
      fit: StackFit.expand,
      children: [
        ScreenShell(
          title: 'Dashboard',
          subtitle: monthLbl,
          titleFontSize: 24,
          refreshing: isRefreshing,
          onRefresh: _loadDashboard,
          headerAction: const AppHeaderActions(),
          child: _buildContent(context),
        ),
        if (data != null) ...[
        FormModal(
          visible: _editOpeningOpen,
          title: 'Edit Opening Balance',
          subtitle: 'Opening balance for $monthLbl',
          onClose: () => setState(() => _editOpeningOpen = false),
          child: _buildOpeningModalBody(
            confirmLabel: 'Save',
            onCancel: () => setState(() => _editOpeningOpen = false),
          ),
        ),
        FormModal(
          visible: _day1PromptOpen,
          title: 'Set Opening Balance',
          subtitle: 'New month started ($monthLbl)',
          onClose: _dismissDayOnePrompt,
          child: _buildOpeningModalBody(
            confirmLabel: 'Set Balance',
            cancelLabel: 'Later',
            hint: _stringNum(data['suggestedOpeningBalance']).isEmpty
                ? null
                : 'Previous month closing: ${formatMoney(_asNum(data['suggestedOpeningBalance']))}',
            onCancel: _dismissDayOnePrompt,
          ),
        ),
        ],
      ],
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_loading && _data == null) {
      return const Center(child: PageLoader(message: 'Loading dashboard…'));
    }
    if (_data == null) {
      return _ErrorCard(
        message: _error ?? 'Could not load dashboard.',
        onRetry: _loadDashboard,
      );
    }

    final raw = _data!;
    final activity = _asList(raw['recentActivity']);
    final lowStock = _asList(raw['lowStockItems']);
    final sales7Days = _asList(raw['salesLast7Days']);
    final dateText = _asString(raw['date']) ?? _date;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DateField(
          value: _date,
          onChanged: (v) {
            setState(() => _date = v);
            _loadDashboard(date: v);
          },
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Today — $dateText'.toUpperCase(),
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.muted,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _todayMetrics(raw),
        const SizedBox(height: AppSpacing.md),
        _monthSummaryToggle(),
        if (_monthSummaryOpen) ...[
          const SizedBox(height: AppSpacing.sm),
          _monthMetrics(raw),
        ],
        const SizedBox(height: AppSpacing.md),
        _quickActions(context),
        const SizedBox(height: AppSpacing.md),
        _activityCard(context, activity),
        const SizedBox(height: AppSpacing.md),
        _lowStockCard(context, lowStock),
        const SizedBox(height: AppSpacing.md),
        _salesOverviewCard(sales7Days),
        const SizedBox(height: AppSpacing.xl * 3),
      ],
    );
  }

  Widget _buildOpeningModalBody({
    required String confirmLabel,
    required VoidCallback onCancel,
    String cancelLabel = 'Cancel',
    String? hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hint != null)
          Text(hint, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
        if (hint != null) const SizedBox(height: AppSpacing.sm),
        const FieldLabel('Opening balance'),
        AppTextField(
          controller: _openingController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          hint: 'Amount',
          onChanged: (v) => _openingInput = v,
        ),
        if (_openingError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              _openingError!,
              style: const TextStyle(color: AppColors.red, fontSize: 13),
            ),
          ),
        ModalActions(
          onCancel: () => onCancel(),
          onConfirm: _saveOpeningBalance,
          confirmLabel: confirmLabel,
          cancelLabel: cancelLabel,
          loading: _savingOpening,
        ),
      ],
    );
  }

  Widget _todayMetrics(Map<String, dynamic> raw) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Icon(AppIcons.circleDollarSign, color: AppColors.accent, size: 18),
            label: "Today's Sales",
            value: '${_asInt(raw['salesCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.purple,
            icon: const Icon(AppIcons.smartphone, color: AppColors.purple, size: 18),
            label: "Today's Recharges",
            value: '${_asInt(raw['rechargeCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.teal,
            icon: const Icon(AppIcons.arrowLeftRight, color: Color(0xFF0D9488), size: 18),
            label: "Today's Transfers",
            value: '${_asInt(raw['transferCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.orange,
            icon: const Icon(AppIcons.wrench, color: AppColors.amber, size: 18),
            label: 'Today\'s Repairs',
            value: '${(_asInt(raw['repairDelivered']) ?? 0) + (_asInt(raw['repairUndeliveredCount']) ?? 0)}',
            sub: '${_asInt(raw['repairDelivered']) ?? 0} delivered · ${_asInt(raw['repairUndeliveredCount']) ?? 0} pending',
          ),
        ),
      ],
    );
  }

  Widget _monthSummaryToggle() {
    return InkWell(
      onTap: () => setState(() => _monthSummaryOpen = !_monthSummaryOpen),
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _monthSummaryOpen ? 'Hide month summary' : 'View month summary',
                style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
              ),
            ),
            Transform.rotate(
              angle: _monthSummaryOpen ? 3.14159 : 0,
              child: const Icon(AppIcons.chevronDown, color: AppColors.muted, size: 16),
            ),
          ],
        ),
      ),
    );
  }

  Widget _monthMetrics(Map<String, dynamic> raw) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Icon(AppIcons.circleDollarSign, color: AppColors.accent, size: 18),
            label: 'Total Sales',
            value: '${_asInt(raw['monthSalesCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.purple,
            icon: const Icon(AppIcons.smartphone, color: AppColors.purple, size: 18),
            label: 'Total Recharges',
            value: '${_asInt(raw['monthRechargeCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.teal,
            icon: const Icon(AppIcons.arrowLeftRight, color: Color(0xFF0D9488), size: 18),
            label: 'Total Transfers',
            value: '${_asInt(raw['monthTransferCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.orange,
            icon: const Icon(AppIcons.wrench, color: AppColors.amber, size: 18),
            label: 'Total Repairs',
            value: '${_asInt(raw['monthRepairCount']) ?? 0}',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.purple,
            icon: const Icon(AppIcons.package, color: AppColors.purple, size: 18),
            label: 'Stock Value',
            value: formatMoney(_asNum(raw['stockValue'])),
          ),
        ),
        MetricCell(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.card),
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                GradientStatCard(
                  tone: StatTone.teal,
                  icon: const Icon(AppIcons.wallet, color: Color(0xFF0D9488), size: 18),
                  label: 'Opening Balance',
                  value: formatMoney(_asNum(raw['openingBalance'])),
                  sub: 'Tap edit to change',
                ),
                Positioned(
                  top: AppSpacing.md,
                  right: AppSpacing.md,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        _openingController.text = _stringNum(raw['openingBalance']);
                        setState(() => _editOpeningOpen = true);
                      },
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(AppIcons.pencil, size: 12, color: AppColors.accent),
                          SizedBox(width: 4),
                          Text(
                            'Edit',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Icon(AppIcons.banknote, color: AppColors.accent, size: 18),
            label: 'Month Net Profit',
            value: formatMoney(_asNum(raw['monthNetProfit'])),
          ),
        ),
      ],
    );
  }

  Widget _quickActions(BuildContext context) {
    return _SectionCard(
      title: 'Quick Actions',
      subtitle: 'Shortcuts for common tasks',
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _QuickActionTile(title: '+ New Sale', sub: 'Create invoice', tone: StatTone.blue, route: '/sales/new'),
              _QuickActionTile(title: 'Barcode Labels', sub: 'Print stickers', tone: StatTone.purple, route: '/qr-labels'),
              _QuickActionTile(title: 'Scan Sale', sub: 'Camera scan', tone: StatTone.green, route: '/sales/new?scan=1'),
              _QuickActionTile(title: '+ Purchase', sub: 'Stock from supplier', tone: StatTone.teal, route: '/purchases/new'),
              _QuickActionTile(title: '+ Recharge', sub: 'Add recharge', tone: StatTone.green, route: '/recharge'),
              _QuickActionTile(title: '+ Repair', sub: 'New intake', tone: StatTone.orange, route: '/repair?intake=1'),
              _QuickActionTile(title: '+ Product', sub: 'Inventory', tone: StatTone.purple, route: '/inventory'),
              _QuickActionTile(title: '+ Transfer', sub: 'Money transfer', tone: StatTone.teal, route: '/transfer'),
            ],
          );
        },
      ),
    );
  }

  Widget _activityCard(BuildContext context, List<Map<String, dynamic>> activity) {
    return _SectionCard(
      title: "Today's Activity",
      action: GestureDetector(
        onTap: () => context.push('/sales'),
        child: const Text(
          'View all',
          style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      child: activity.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Center(
                child: Text(
                  'No activity today yet',
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
              ),
            )
          : Column(
              children: [
                for (final item in activity) _ActivityRow(item: item),
              ],
            ),
    );
  }

  Widget _lowStockCard(BuildContext context, List<Map<String, dynamic>> lowStock) {
    return _SectionCard(
      title: 'Low Stock Alerts',
      action: GestureDetector(
        onTap: () => context.push('/inventory'),
        child: const Text(
          'View all',
          style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      child: lowStock.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(AppIcons.alertTriangle, color: AppColors.muted, size: 16),
                  SizedBox(width: AppSpacing.sm),
                  Text('No low stock items', style: TextStyle(color: AppColors.muted)),
                ],
              ),
            )
          : Column(
              children: [
                for (final item in lowStock) _LowStockRow(item: item),
              ],
            ),
    );
  }

  Widget _salesOverviewCard(List<Map<String, dynamic>> series) {
    final points = <({String label, num value})>[
      for (final x in series)
        (
          label: (_asString(x['date']) ?? '').length >= 5
              ? (_asString(x['date']) ?? '').substring(5)
              : (_asString(x['date']) ?? '-'),
          value: _asNum(x['total']),
        ),
    ];
    return _SectionCard(
      title: 'Sales Overview',
      subtitle: 'Last 7 days',
      child: SimpleBarChart(data: points),
    );
  }

  static num _asNum(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int? _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '');
  }

  static String? _asString(dynamic value) {
    if (value == null) return null;
    final s = value.toString();
    return s.isEmpty ? null : s;
  }

  static String _stringNum(dynamic value) => value?.toString() ?? '';

  static List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is List) {
      return value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Could not load dashboard',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: const TextStyle(color: AppColors.red, fontSize: 14)),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(label: 'Retry', onPressed: onRetry),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    this.subtitle,
    this.action,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final Widget? action;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
                ),
              ),
              if (action != null) action!,
            ],
          ),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: AppSpacing.md),
              child: Text(subtitle!, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            )
          else
            const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.title,
    required this.sub,
    required this.tone,
    required this.route,
  });

  final String title;
  final String sub;
  final StatTone tone;
  final String route;

  Color _bgColor() {
    switch (tone) {
      case StatTone.green:
        return AppColors.actionBgGreen;
      case StatTone.orange:
        return AppColors.actionBgOrange;
      case StatTone.purple:
        return AppColors.actionBgPurple;
      case StatTone.teal:
        return AppColors.actionBgTeal;
      case StatTone.amber:
        return AppColors.actionBgOrange;
      case StatTone.blue:
        return AppColors.actionBgBlue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - AppSpacing.sm) / 2;
        return SizedBox(
          width: width,
          child: Material(
            color: _bgColor(),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.input),
              side: const BorderSide(color: AppColors.border),
            ),
            child: InkWell(
              onTap: () => context.push(route),
              borderRadius: BorderRadius.circular(AppRadii.input),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});

  final Map<String, dynamic> item;

  Color _dotColor() {
    switch (item['type']) {
      case 'RECHARGE':
        return AppColors.green;
      case 'TRANSFER':
        return const Color(0xFF0D9488);
      case 'REPAIR':
        return AppColors.amber;
      case 'SALE':
      default:
        return AppColors.accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = item['subtitle']?.toString();
    final amount = item['amount'];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(color: _dotColor(), shape: BoxShape.circle),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['title']?.toString() ?? 'Activity',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text, fontSize: 14),
                ),
                if (subtitle != null && subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ),
              ],
            ),
          ),
          if (amount != null)
            Text(
              formatMoney(amount is num ? amount : num.tryParse(amount.toString()) ?? 0),
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text, fontSize: 14),
            ),
        ],
      ),
    );
  }
}

class _LowStockRow extends StatelessWidget {
  const _LowStockRow({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final qty = int.tryParse(item['stockQty']?.toString() ?? '') ?? 0;
    final min = item['minStock']?.toString() ?? '-';
    final out = qty <= 0;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['name']?.toString() ?? 'Unnamed',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                ),
                Text('Min $min', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: out ? const Color(0xFFFEF2F2) : AppColors.amberBg,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              out ? 'Out of stock' : '$qty left',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: out ? AppColors.red : AppColors.amber,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

