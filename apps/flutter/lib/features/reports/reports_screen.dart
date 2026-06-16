import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/fields.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/metrics_grid.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';
import '../../widgets/simple_bar_chart.dart';

const _serviceFilters = <({String value, String label})>[
  (value: 'ALL', label: 'All services'),
  (value: 'SALE', label: 'Sales'),
  (value: 'RECHARGE', label: 'Recharge'),
  (value: 'TRANSFER', label: 'Transfer'),
  (value: 'REPAIR', label: 'Repairs'),
];

String _calcMargin(String net, String income) {
  final n = parseMoney(net);
  final i = parseMoney(income);
  if (i <= 0) return '0%';
  return '${((n / i) * 100).round()}%';
}

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String _date = todayIso();
  String _serviceFilter = 'ALL';

  bool _dashLoading = true;
  bool _todayLoading = true;
  bool _refreshing = false;
  String? _dashError;

  Map<String, dynamic>? _dashboard;
  Map<String, dynamic>? _today;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll({bool refresh = false}) async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) {
      if (mounted) {
        setState(() {
          _dashLoading = false;
          _todayLoading = false;
          _refreshing = false;
          _dashError = 'No business month selected.';
        });
      }
      return;
    }

    if (refresh) {
      setState(() => _refreshing = true);
    } else {
      setState(() {
        _dashLoading = _dashboard == null;
        _todayLoading = _today == null;
        _dashError = null;
      });
    }

    await Future.wait([
      _loadDashboard(month.monthId!),
      _loadToday(),
    ]);

    if (mounted) setState(() => _refreshing = false);
  }

  Future<void> _loadDashboard(String monthId) async {
    try {
      final dash = await ref.read(apiServiceProvider).getDashboard(monthId);
      if (!mounted) return;
      setState(() {
        _dashboard = dash;
        _dashLoading = false;
        _dashError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _dashLoading = false;
        _dashError = e is ApiError ? e.message : 'Could not load report.';
      });
    }
  }

  Future<void> _loadToday() async {
    setState(() => _todayLoading = true);
    try {
      final today = await ref.read(apiServiceProvider).getToday(date: _date);
      if (!mounted) return;
      setState(() {
        _today = today;
        _todayLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _todayLoading = false);
    }
  }

  void _onDateChanged(String value) {
    setState(() => _date = value);
    _loadToday();
  }

  List<({String name, double value})> _breakdown() {
    final data = _dashboard;
    if (data == null) return [];
    final sw = data['serviceWise'];
    if (sw is! Map) return [];

    final items = <({String name, double value})>[
      (name: 'Recharge + Transfer', value: parseMoney('${sw['rechargeTransferProfit']}')),
      (name: 'Repairs', value: parseMoney('${sw['repairProfit']}')),
      (name: 'Mobile & Accessories', value: parseMoney('${sw['mobileProfit']}')),
      (name: 'Extra Income', value: parseMoney('${sw['extraIncome']}')),
    ];
    return items.where((i) => i.value > 0).toList();
  }

  List<Map<String, dynamic>> _recentActivity() {
    final items = (_today?['recentActivity'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (_serviceFilter == 'ALL') return items;
    return items.where((a) => '${a['type']}' == _serviceFilter).toList();
  }

  List<({String label, num value})> _chartData() {
    final series = (_today?['salesLast7Days'] as List<dynamic>? ?? []);
    return [
      for (final x in series)
        if (x is Map)
          (
            label: _chartLabel('${x['date']}'),
            value: parseMoney('${x['total']}'),
          ),
    ];
  }

  String _chartLabel(String date) {
    if (date.length >= 5) return date.substring(5);
    return date.isEmpty ? '-' : date;
  }

  Future<void> _exportCsv() async {
    final data = _dashboard;
    final month = ref.read(monthProvider).valueOrNull;
    if (data == null || month == null) return;

    final sw = data['serviceWise'];
    final csv = StringBuffer('Metric,Value\n');
    csv.writeln('Opening Balance,${data['openingBalance']}');
    csv.writeln('Total Income,${data['totalIncome']}');
    csv.writeln('Total Expense,${data['totalExpense']}');
    csv.writeln('Net Profit,${data['netProfit']}');
    if (sw is Map) {
      csv.writeln('Recharge+Transfer,${sw['rechargeTransferProfit']}');
      csv.writeln('Repair Profit,${sw['repairProfit']}');
      csv.writeln('Mobile Profit,${sw['mobileProfit']}');
    }

    await Share.share(
      csv.toString(),
      subject: 'sk-mobile-report-${month.year}-${month.month}.csv',
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (prev?.isAuthenticated != true && next.isAuthenticated && !next.isLoading) {
        _loadAll();
      }
    });

    ref.listen<AsyncValue<MonthState>>(monthProvider, (prev, next) {
      final id = next.valueOrNull?.monthId;
      final prevId = prev?.valueOrNull?.monthId;
      if (id != null && id != prevId) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _loadAll());
      }
    });

    final monthAsync = ref.watch(monthProvider);
    final month = monthAsync.valueOrNull;
    final subtitle = month == null ? null : monthLabel(month.year, month.month);
    final dashboard = _dashboard;
    final breakdown = _breakdown();
    final recent = _recentActivity();

    return ScreenShell(
      title: 'Reports',
      subtitle: subtitle,
      showBack: true,
      refreshing: _refreshing,
      onRefresh: () => _loadAll(refresh: true),
      child: monthAsync.when(
        loading: () => const PageLoader(message: 'Preparing business month…'),
        error: (e, _) => _MonthError(
          message: e is ApiError ? e.message : 'Could not load business month.',
          onRetry: () => ref.invalidate(monthProvider),
        ),
        data: (state) {
          if (state.isLoading) {
            return const PageLoader(message: 'Preparing business month…');
          }
          if (state.monthId == null) {
            return _NoMonth(onOpenMonths: () => context.push('/months'));
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildToolbar(dashboard != null),
              if (_dashLoading)
                const Center(child: PageLoader(message: 'Loading report…'))
              else if (_dashError != null)
                _ReportError(message: _dashError!, onRetry: () => _loadAll())
              else if (dashboard != null) ...[
                _buildMetrics(dashboard),
                _buildBreakdownCard(breakdown),
                _buildChartCard(),
                _buildActivityCard(recent),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildToolbar(bool canExport) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DateField(value: _date, onChanged: _onDateChanged),
          const SizedBox(height: AppSpacing.sm),
          FilterPicker<String>(
            value: _serviceFilter,
            items: _serviceFilters.map((f) => f.value).toList(),
            labelBuilder: (v) => _serviceFilters.firstWhere((f) => f.value == v).label,
            onChanged: (v) {
              if (v == null) return;
              setState(() => _serviceFilter = v);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: canExport ? _exportCsv : null,
              icon: const Icon(AppIcons.download, size: 16, color: AppColors.accent),
              label: const Text(
                'Export CSV',
                style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600),
              ),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetrics(Map<String, dynamic> data) {
    return MetricsGrid(
      children: [
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.blue,
            icon: const Text('₹', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.accent)),
            label: 'Total Income',
            value: formatMoney(parseMoney('${data['totalIncome']}')),
            sub: 'This month',
          ),
        ),
        MetricCell(
          child: GradientStatCard(
            tone: StatTone.green,
            icon: const Text('↗', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.accent)),
            label: 'Net Profit',
            value: formatMoney(parseMoney('${data['netProfit']}')),
            sub: 'Margin ${_calcMargin('${data['netProfit']}', '${data['totalIncome']}')}',
          ),
        ),
        MetricCell(
          fullWidth: true,
          child: Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: GradientStatCard(
              tone: StatTone.orange,
              icon: const Text('−', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.accent)),
              label: 'Total Expenses',
              value: formatMoney(parseMoney('${data['totalExpense']}')),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBreakdownCard(List<({String name, double value})> breakdown) {
    return _SectionCard(
      title: 'Income breakdown',
      child: breakdown.isEmpty
          ? const Text('No income recorded yet', style: TextStyle(color: AppColors.muted, fontSize: 14))
          : Column(
              children: [
                for (final row in breakdown) _BreakdownRow(name: row.name, value: formatMoney(row.value)),
              ],
            ),
    );
  }

  Widget _buildChartCard() {
    return _SectionCard(
      title: 'Sales — last 7 days',
      child: _todayLoading
          ? const Text('Loading chart…', style: TextStyle(color: AppColors.muted, fontSize: 14))
          : SimpleBarChart(data: _chartData()),
    );
  }

  Widget _buildActivityCard(List<Map<String, dynamic>> recent) {
    return _SectionCard(
      title: 'Recent activity ($_date)',
      child: recent.isEmpty
          ? const Text('No activity for filter', style: TextStyle(color: AppColors.muted, fontSize: 14))
          : Column(
              children: [
                for (final item in recent) _ActivityRow(item: item),
              ],
            ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({required this.name, required this.value});

  final String name;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(child: Text(name, style: const TextStyle(color: AppColors.muted))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text)),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});

  final Map<String, dynamic> item;

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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['title']?.toString() ?? 'Activity',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                ),
                if (subtitle != null && subtitle.isNotEmpty)
                  Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
              ],
            ),
          ),
          if (amount != null)
            Text(
              formatMoney(amount is num ? amount : parseMoney('$amount')),
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text),
            ),
        ],
      ),
    );
  }
}

class _ReportError extends StatelessWidget {
  const _ReportError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Could not load report',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: const TextStyle(fontSize: 14, color: AppColors.red)),
          const SizedBox(height: AppSpacing.md),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _MonthError extends StatelessWidget {
  const _MonthError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Could not load business month',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
          const SizedBox(height: AppSpacing.md),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _NoMonth extends StatelessWidget {
  const _NoMonth({required this.onOpenMonths});

  final VoidCallback onOpenMonths;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'No business month selected',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Create or select a business month to continue.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          onPressed: onOpenMonths,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
          child: const Text('Go to Business Months'),
        ),
      ],
    );
  }
}
