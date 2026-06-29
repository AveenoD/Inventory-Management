import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_error.dart';
import '../../core/api/file_download.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/month/month_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../domain/models/sale_invoice.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';
import 'repair_invoice_pdf_builder.dart';
import 'repair_invoice_view.dart';

class RepairInvoiceScreen extends ConsumerStatefulWidget {
  const RepairInvoiceScreen({super.key, required this.jobId});

  final String jobId;

  @override
  ConsumerState<RepairInvoiceScreen> createState() => _RepairInvoiceScreenState();
}

class _RepairInvoiceScreenState extends ConsumerState<RepairInvoiceScreen> {
  Map<String, dynamic>? _job;
  InvoiceSettings? _settings;
  bool _loading = true;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final month = await ref.read(monthProvider.future);
      if (month.monthId == null) throw Exception('No active month found.');

      final api = ref.read(apiServiceProvider);
      final resJob = await api.getRepairJob(month.monthId!, widget.jobId);
      final resSettings = await api.getInvoiceSettings();

      if (!mounted) return;
      setState(() {
        _job = resJob;
        _settings = InvoiceSettings.fromJson(resSettings);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load invoice.';
        _loading = false;
      });
    }
  }

  Future<void> _withBusy(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _downloadPdf() async {
    if (_job == null || _settings == null) return;
    await _withBusy(() async {
      final bytes = await RepairInvoicePdfBuilder.build(_job!, _settings!);
      final no = '${_job!['id']}'.substring(0, 8);
      final path = await saveBytesToTempFile(bytes, 'repair-invoice-$no.pdf');
      await Share.shareXFiles([XFile(path)], subject: 'Repair Invoice $no');
    });
  }

  Future<void> _printPdf() async {
    if (_job == null || _settings == null) return;
    await _withBusy(() async {
      final bytes = await RepairInvoicePdfBuilder.build(_job!, _settings!);
      await Printing.layoutPdf(onLayout: (_) async => bytes);
    });
  }

  Future<void> _shareText() async {
    if (_job == null || _settings == null) return;
    final amount = '${_job!['customerCharge'] ?? _job!['salePrice'] ?? 0}';
    final text = [
      _settings!.shopName,
      'Repair Invoice: ${_job!['id'].substring(0, 8)}',
      'Date: ${_job!['date']}',
      'Customer: ${_job!['customerName'] ?? 'Walk-in'}',
      'Device: ${_job!['device'] ?? '—'}',
      'Issue: ${_job!['issueDescription'] ?? '—'}',
      '',
      'Total: ₹$amount',
      if (_settings!.warrantyText != null) '\nWarranty:\n${_settings!.warrantyText}',
    ].join('\n');
    await Share.share(text, subject: 'Repair Invoice ${_job!['id'].substring(0, 8)}');
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Repair Invoice',
      subtitle: _job != null ? 'ID: ${_job!['id'].substring(0, 8).toUpperCase()}' : 'Receipt',
      showBack: true,
      hideHeaderActions: true,
      child: _loading
          ? const PageLoader(message: 'Loading invoice…')
          : _error != null
              ? _ErrorBody(message: _error!, onRetry: _load)
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ActionBar(
                      busy: _busy,
                      onDownload: _downloadPdf,
                      onPrint: _printPdf,
                      onShare: _shareText,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        return SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minWidth: constraints.maxWidth > 600 ? constraints.maxWidth : 600,
                            ),
                            child: RepairInvoiceView(job: _job!, settings: _settings!),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.busy,
    required this.onDownload,
    required this.onPrint,
    required this.onShare,
  });

  final bool busy;
  final VoidCallback onDownload;
  final VoidCallback onPrint;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        _InvoiceActionButton(
          label: 'Download PDF',
          icon: AppIcons.download,
          primary: true,
          loading: busy,
          onPressed: onDownload,
        ),
        _InvoiceActionButton(
          label: 'Print',
          icon: AppIcons.printer,
          loading: busy,
          onPressed: onPrint,
        ),
        _InvoiceActionButton(
          label: 'Share',
          icon: AppIcons.share,
          loading: busy,
          onPressed: onShare,
        ),
      ],
    );
  }
}

class _InvoiceActionButton extends StatelessWidget {
  const _InvoiceActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.primary = false,
    this.loading = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool primary;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: primary ? AppColors.accent : AppColors.card,
      borderRadius: BorderRadius.circular(AppRadii.input),
      child: InkWell(
        onTap: loading ? null : onPressed,
        borderRadius: BorderRadius.circular(AppRadii.input),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.input),
            border: Border.all(color: primary ? AppColors.accent : AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: primary ? Colors.white : AppColors.accent,
                  ),
                )
              else
                Icon(icon, size: 16, color: primary ? Colors.white : AppColors.text),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: primary ? Colors.white : AppColors.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(message, style: const TextStyle(color: AppColors.red)),
        TextButton(onPressed: onRetry, child: const Text('Retry')),
        TextButton(onPressed: () => context.go('/repairs'), child: const Text('Back to repairs')),
      ],
    );
  }
}
