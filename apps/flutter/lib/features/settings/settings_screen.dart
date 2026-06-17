import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/models/import_result.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

enum _ExportPeriod { month, day }

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  int _year = DateTime.now().year;
  int _month = DateTime.now().month;
  _ExportPeriod _exportPeriod = _ExportPeriod.month;
  String _exportDate = todayIso();

  String? _filePath;
  ImportResult? _preview;
  ImportResult? _result;

  bool _exporting = false;
  bool _templateLoading = false;
  bool _previewLoading = false;
  bool _importLoading = false;

  String? _exportError;
  String? _importError;

  String _errorMessage(Object e) => e is ApiError ? e.message : 'Something went wrong. Please try again.';

  Future<void> _shareFile(String path, String subject) async {
    await Share.shareXFiles([XFile(path)], subject: subject);
  }

  Future<void> _downloadTemplate() async {
    setState(() {
      _templateLoading = true;
      _importError = null;
    });
    try {
      final path = await ref.read(apiServiceProvider).downloadImportTemplate();
      await _shareFile(path, 'SK Mobile import template');
    } catch (e) {
      setState(() => _importError = _errorMessage(e));
    } finally {
      if (mounted) setState(() => _templateLoading = false);
    }
  }

  Future<void> _exportExcel() async {
    setState(() {
      _exporting = true;
      _exportError = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final String path;
      final String subject;
      if (_exportPeriod == _ExportPeriod.day) {
        path = await api.downloadExportExcel(date: _exportDate);
        subject = 'SK Mobile export $_exportDate';
      } else {
        path = await api.downloadExportExcel(year: _year, month: _month);
        subject = 'SK Mobile export $_year-${_month.toString().padLeft(2, '0')}';
      }
      await _shareFile(path, subject);
    } catch (e) {
      setState(() => _exportError = _errorMessage(e));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['xlsx', 'xls'],
    );
    final path = result?.files.single.path;
    if (path != null) {
      setState(() {
        _filePath = path;
        _preview = null;
        _result = null;
        _importError = null;
      });
    }
  }

  Future<void> _previewImport() async {
    if (_filePath == null) return;
    setState(() {
      _previewLoading = true;
      _importError = null;
    });
    try {
      final data = await ref.read(apiServiceProvider).importExcel(
            File(_filePath!),
            _year,
            _month,
            dryRun: true,
          );
      setState(() {
        _preview = data;
        _result = null;
      });
    } catch (e) {
      setState(() {
        _importError = _errorMessage(e);
        _preview = null;
      });
    } finally {
      if (mounted) setState(() => _previewLoading = false);
    }
  }

  Future<void> _importNow() async {
    if (_filePath == null) return;
    setState(() {
      _importLoading = true;
      _importError = null;
    });
    try {
      final data = await ref.read(apiServiceProvider).importExcel(
            File(_filePath!),
            _year,
            _month,
          );
      setState(() {
        _result = data;
        _preview = null;
      });
    } catch (e) {
      setState(() {
        _importError = _errorMessage(e);
        _result = null;
      });
    } finally {
      if (mounted) setState(() => _importLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _result ?? _preview;
    final fileLabel = _filePath == null
        ? 'Pick Excel file'
        : _filePath!.split(RegExp(r'[/\\]')).last;

    return ScreenShell(
      title: 'Settings',
      subtitle: 'Import and export business data',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SettingsCard(
            title: 'Export Excel',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Download sales, profit, inventory stock balance, and daily breakdown.',
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: RadioListTile<_ExportPeriod>(
                        title: const Text('Full month', style: TextStyle(fontSize: 14)),
                        value: _ExportPeriod.month,
                        groupValue: _exportPeriod,
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        onChanged: (v) => setState(() => _exportPeriod = v!),
                      ),
                    ),
                    Expanded(
                      child: RadioListTile<_ExportPeriod>(
                        title: const Text('Single day', style: TextStyle(fontSize: 14)),
                        value: _ExportPeriod.day,
                        groupValue: _exportPeriod,
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        onChanged: (v) => setState(() => _exportPeriod = v!),
                      ),
                    ),
                  ],
                ),
                if (_exportPeriod == _ExportPeriod.month) ...[
                  _YearMonthFields(
                    year: _year,
                    month: _month,
                    onYearChanged: (v) => setState(() => _year = v),
                    onMonthChanged: (v) => setState(() => _month = v),
                  ),
                ] else ...[
                  DateField(value: _exportDate, onChanged: (v) => setState(() => _exportDate = v)),
                ],
                if (_exportError != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(_exportError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
                ],
                const SizedBox(height: AppSpacing.md),
                PrimaryButton(
                  label: _exporting ? 'Preparing Excel…' : 'Download Excel',
                  loading: _exporting,
                  onPressed: _exportExcel,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _SettingsCard(
            title: 'Import Excel',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Upload your shop workbook (.xlsx). Supports Money Transfer, Recharge, Repair, and Mobile sheets. Preview first to verify row counts.',
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
                const SizedBox(height: AppSpacing.md),
                SecondaryButton(
                  label: _templateLoading ? 'Downloading…' : 'Download import template',
                  disabled: _templateLoading,
                  onPressed: _downloadTemplate,
                ),
                const SizedBox(height: AppSpacing.md),
                _YearMonthFields(
                  year: _year,
                  month: _month,
                  onYearChanged: (v) => setState(() => _year = v),
                  onMonthChanged: (v) => setState(() => _month = v),
                ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton(
                  onPressed: _pickFile,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.text,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(fileLabel),
                ),
                if (_importError != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(_importError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: SecondaryButton(
                        label: _previewLoading ? 'Checking…' : 'Preview import',
                        disabled: _filePath == null || _previewLoading || _importLoading,
                        onPressed: _previewImport,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: PrimaryButton(
                        label: _importLoading ? 'Importing…' : 'Import now',
                        loading: _importLoading,
                        disabled: _filePath == null || _previewLoading,
                        onPressed: _importNow,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (active != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ImportResultCard(result: active, isComplete: _result != null),
          ],
        ],
      ),
    );
  }
}

class _YearMonthFields extends StatelessWidget {
  const _YearMonthFields({
    required this.year,
    required this.month,
    required this.onYearChanged,
    required this.onMonthChanged,
  });

  final int year;
  final int month;
  final ValueChanged<int> onYearChanged;
  final ValueChanged<int> onMonthChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        DropdownButtonFormField<int>(
          value: year,
          decoration: const InputDecoration(labelText: 'Year'),
          items: List.generate(5, (i) => DateTime.now().year - 2 + i)
              .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
              .toList(),
          onChanged: (v) {
            if (v != null) onYearChanged(v);
          },
        ),
        DropdownButtonFormField<int>(
          value: month,
          decoration: const InputDecoration(labelText: 'Month'),
          items: List.generate(12, (i) => i + 1)
              .map((m) => DropdownMenuItem(value: m, child: Text(monthLabel(year, m))))
              .toList(),
          onChanged: (v) {
            if (v != null) onMonthChanged(v);
          },
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
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

class _ImportResultCard extends StatelessWidget {
  const _ImportResultCard({required this.result, required this.isComplete});

  final ImportResult result;
  final bool isComplete;

  @override
  Widget build(BuildContext context) {
    return _SettingsCard(
      title: isComplete ? 'Import complete' : 'Import preview',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (result.sheets.isNotEmpty)
            Text(
              'Sheets found: ${result.sheets.join(', ')}',
              style: const TextStyle(color: AppColors.muted, fontSize: 14),
            ),
          if (result.counts.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _CountRow(label: 'Money Transfer days', value: result.counts['moneyTransferDays'] ?? 0),
            _CountRow(label: 'Recharge days', value: result.counts['rechargeDays'] ?? 0),
            _CountRow(label: 'Repair days', value: result.counts['repairDays'] ?? 0),
            _CountRow(label: 'Mobile days', value: result.counts['mobileDays'] ?? 0),
          ],
          if (result.validation != null) ...[
            const SizedBox(height: AppSpacing.md),
            const Text('Dashboard totals after import', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.sm),
            _MoneyRow(
              label: 'Total income',
              value: result.validation!['totalIncome'] ?? '0',
            ),
            _MoneyRow(
              label: 'Net profit',
              value: result.validation!['netProfit'] ?? '0',
            ),
            _MoneyRow(
              label: 'Recharge + Transfer',
              value: result.validation!['rechargeTransferProfit'] ?? '0',
            ),
          ],
          if (result.warnings.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            const Text('Warnings', style: TextStyle(fontWeight: FontWeight.w600)),
            for (final w in result.warnings)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text('• $w', style: const TextStyle(color: AppColors.muted, fontSize: 14)),
              ),
          ],
          if (result.errors.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            const Text('Errors', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.red)),
            for (final e in result.errors)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text('• $e', style: const TextStyle(color: AppColors.red, fontSize: 14)),
              ),
          ],
        ],
      ),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.muted))),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _MoneyRow extends StatelessWidget {
  const _MoneyRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.muted))),
          Text(formatMoney(parseMoney(value)), style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
