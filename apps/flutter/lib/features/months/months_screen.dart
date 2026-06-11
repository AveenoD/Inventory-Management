import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

class MonthsScreen extends ConsumerStatefulWidget {
  const MonthsScreen({super.key});

  @override
  ConsumerState<MonthsScreen> createState() => _MonthsScreenState();
}

class _MonthsScreenState extends ConsumerState<MonthsScreen> {
  bool _loading = true;
  bool _creating = false;
  bool _showCreate = false;
  String? _error;
  String? _createError;
  final TextEditingController _yearController =
      TextEditingController(text: DateTime.now().year.toString());
  final TextEditingController _monthController =
      TextEditingController(text: DateTime.now().month.toString());
  final TextEditingController _openingController = TextEditingController(text: '0');
  List<Map<String, dynamic>> _months = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMonths());
  }

  @override
  void dispose() {
    _yearController.dispose();
    _monthController.dispose();
    _openingController.dispose();
    super.dispose();
  }

  Future<void> _loadMonths() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getMonths(page: 1, limit: 24);
      final list = (res['data'] as List<dynamic>? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() {
        _months = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load business months.';
        _loading = false;
      });
    }
  }

  Future<void> _createMonth() async {
    final year = int.tryParse(_yearController.text.trim());
    final month = int.tryParse(_monthController.text.trim());
    if (year == null || month == null || month < 1 || month > 12) {
      setState(() => _createError = 'Enter a valid year and month (1-12).');
      return;
    }
    setState(() {
      _creating = true;
      _createError = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      await api.createMonth({
        'year': year,
        'month': month,
        'openingBalance': parseMoney(_openingController.text),
      });
      if (!mounted) return;
      setState(() {
        _showCreate = false;
        _creating = false;
      });
      await _loadMonths();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _creating = false;
        _createError = e is ApiError ? e.message : 'Could not create month.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Business Months',
      subtitle: 'Monthly books',
      showBack: true,
      refreshing: _loading && _months.isNotEmpty,
      onRefresh: _loadMonths,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PrimaryButton(
            label: _showCreate ? 'Cancel' : '+ New month',
            onPressed: () => setState(() => _showCreate = !_showCreate),
          ),
          if (_showCreate) ...[
            const SizedBox(height: AppSpacing.md),
            _buildCreateForm(),
          ],
          const SizedBox(height: AppSpacing.md),
          if (_loading && _months.isEmpty)
            const Center(child: CircularProgressIndicator())
          else if (_error != null)
            _ErrorCard(message: _error!, onRetry: _loadMonths)
          else if (_months.isEmpty)
            _EmptyState(onCreate: () => setState(() => _showCreate = true))
          else
            Column(
              children: [for (final m in _months) _MonthCard(month: m)],
            ),
        ],
      ),
    );
  }

  Widget _buildCreateForm() {
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
          const FieldLabel('Year'),
          AppTextField(controller: _yearController, keyboardType: TextInputType.number),
          const FieldLabel('Month (1-12)'),
          AppTextField(controller: _monthController, keyboardType: TextInputType.number),
          const FieldLabel('Opening balance'),
          AppTextField(
            controller: _openingController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          if (_createError != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(_createError!, style: const TextStyle(color: AppColors.red)),
            ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: 'Create month',
            loading: _creating,
            onPressed: _createMonth,
          ),
        ],
      ),
    );
  }
}

class _MonthCard extends StatelessWidget {
  const _MonthCard({required this.month});

  final Map<String, dynamic> month;

  @override
  Widget build(BuildContext context) {
    final year = int.tryParse(month['year']?.toString() ?? '') ?? 0;
    final monthNum = int.tryParse(month['month']?.toString() ?? '') ?? 1;
    final opening = month['openingBalance'];
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            monthLabel(year, monthNum),
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            'Opening ${formatMoney(opening is num ? opening : num.tryParse(opening?.toString() ?? '0') ?? 0)}',
            style: const TextStyle(color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Failed to load months', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: const TextStyle(color: AppColors.red)),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(label: 'Retry', onPressed: onRetry),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onCreate});

  final VoidCallback onCreate;

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
        children: [
          const Text(
            'No business months',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Create a month to track recharge, sales, and expenses.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(label: 'New month', onPressed: onCreate),
        ],
      ),
    );
  }
}
