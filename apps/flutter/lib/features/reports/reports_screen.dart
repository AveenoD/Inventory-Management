import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/gradient_stat_card.dart';
import '../../widgets/month_gate.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  bool _loading = true;
  Map<String, dynamic>? _dashboard;
  Map<String, dynamic>? _today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = await ref.read(monthProvider.future);
    if (month.monthId == null) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final dash = await api.getDashboard(month.monthId!);
      final today = await api.getToday();
      if (mounted) setState(() { _dashboard = dash; _today = today; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _exportCsv() async {
    final d = _dashboard;
    if (d == null) return;
    final csv = StringBuffer('Metric,Value\n');
    csv.writeln('Net Profit,${d['netProfit']}');
    csv.writeln('Total Sales,${d['totalSales']}');
    csv.writeln('Repair Profit,${d['repairProfit']}');
    await Share.share(csv.toString(), subject: 'SK Mobile Report');
  }

  @override
  Widget build(BuildContext context) {
    final chart = (_today?['salesChart'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return MonthGate(
      child: ScreenShell(
        title: 'Reports',
        showBack: true,
        onRefresh: _load,
        child: _loading
            ? const PageLoader()
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: GradientStatCard(
                          icon: const Icon(Icons.trending_up, size: 18),
                          label: 'Net Profit',
                          value: formatMoney(parseMoney('${_dashboard?['netProfit']}')),
                          tone: StatTone.green,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: GradientStatCard(
                          icon: const Icon(Icons.shopping_cart, size: 18),
                          label: 'Sales',
                          value: formatMoney(parseMoney('${_dashboard?['totalSales']}')),
                          tone: StatTone.blue,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const Text('7-day sales', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    height: 180,
                    child: BarChart(
                      BarChartData(
                        borderData: FlBorderData(show: false),
                        gridData: const FlGridData(show: false),
                        titlesData: FlTitlesData(
                          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (v, _) {
                                final i = v.toInt();
                                if (i < 0 || i >= chart.length) return const SizedBox.shrink();
                                final d = '${chart[i]['date'] ?? ''}';
                                return Text(d.length >= 5 ? d.substring(5) : d, style: const TextStyle(fontSize: 10));
                              },
                            ),
                          ),
                        ),
                        barGroups: [
                          for (var i = 0; i < chart.length; i++)
                            BarChartGroupData(
                              x: i,
                              barRods: [
                                BarChartRodData(
                                  toY: parseMoney('${chart[i]['total']}'),
                                  color: AppColors.accent,
                                  width: 14,
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  OutlinedButton(onPressed: _exportCsv, child: const Text('Export CSV')),
                ],
              ),
      ),
    );
  }
}
