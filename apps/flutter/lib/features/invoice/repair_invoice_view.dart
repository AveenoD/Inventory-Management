import 'dart:convert';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/models/sale_invoice.dart';

class RepairInvoiceView extends StatelessWidget {
  const RepairInvoiceView({
    super.key,
    required this.job,
    required this.settings,
  });

  final Map<String, dynamic> job;
  final InvoiceSettings settings;

  @override
  Widget build(BuildContext context) {
    final amount = parseMoney('${job['customerCharge'] ?? job['salePrice'] ?? 0}');
    final logoBytes = settings.logoDataUrl != null ? base64Decode(settings.logoDataUrl!.split(',').last) : null;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: const BoxDecoration(
              color: AppColors.primary,
              border: Border(bottom: BorderSide(color: AppColors.accent, width: 3)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (logoBytes != null)
                        Container(
                          width: 48,
                          height: 48,
                          margin: const EdgeInsets.only(right: AppSpacing.md),
                          child: Image.memory(logoBytes, fit: BoxFit.contain),
                        )
                      else
                        Container(
                          width: 48,
                          height: 48,
                          margin: const EdgeInsets.only(right: AppSpacing.md),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('SK', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 18)),
                        ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              settings.shopName,
                              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            if (settings.address != null && settings.address!.isNotEmpty)
                              Text(settings.address!, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11)),
                            if (settings.phone != null && settings.phone!.isNotEmpty)
                              Text('Ph: ${settings.phone}', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('REPAIR INVOICE', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 10, letterSpacing: 1)),
                    const SizedBox(height: 4),
                    Text(
                      '${job['id']}'.substring(0, 8).toUpperCase(),
                      style: const TextStyle(color: AppColors.amber, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Meta Box
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            decoration: const BoxDecoration(
              color: Color(0xFFFAFBFC),
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                _MetaCell(label: 'Bill To', value: '${job['customerName'] ?? 'Walk-in Customer'}'),
                _MetaCell(label: 'Date', value: formatInvoiceDate('${job['date']}')),
                _MetaCell(label: 'Device', value: '${job['device'] ?? '—'}'),
                _MetaCell(label: 'Status', value: job['status'] == 'DELIVERED' ? 'Delivered' : 'Pending Pickup'),
              ],
            ),
          ),
          // Table
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 400),
              child: Table(
                columnWidths: const {
                  0: FixedColumnWidth(40),
                  1: FlexColumnWidth(2),
                  2: FlexColumnWidth(2),
                  3: FlexColumnWidth(3),
                  4: FixedColumnWidth(100),
                },
                border: const TableBorder(
                  horizontalInside: BorderSide(color: AppColors.border),
                ),
                children: [
                  TableRow(
                    decoration: const BoxDecoration(color: Color(0xFFF1F5F9)),
                    children: [
                      _Th('#'),
                      _Th('Device'),
                      _Th('Customer Name'),
                      _Th('Issue'),
                      _Th('Amount', align: TextAlign.right),
                    ],
                  ),
                  TableRow(
                    children: [
                      _Td('1', color: AppColors.muted),
                      _Td('${job['device'] ?? '—'}'),
                      _Td('${job['customerName'] ?? 'Walk-in Customer'}'),
                      _Td('${job['issueDescription'] ?? '—'}'),
                      _Td(formatMoney(amount).replaceAll('₹', '').trim(), align: TextAlign.right, bold: true),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // Totals
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('AMOUNT IN WORDS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.muted)),
                      const SizedBox(height: 4),
                      Text(
                        amountInWords(amount),
                        style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, fontWeight: FontWeight.w600, color: AppColors.text),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                width: 180,
                color: const Color(0xFFF8FAFC),
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Grand Total', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(formatMoney(amount), style: const TextStyle(color: AppColors.amber, fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (settings.warrantyText != null && settings.warrantyText!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('WARRANTY & GUARANTEE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                    const SizedBox(height: 4),
                    Text(settings.warrantyText!, style: const TextStyle(fontSize: 11, color: AppColors.text)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
          const Divider(height: 1, color: AppColors.border),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Thank you for your business!', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 2),
                    Text('We appreciate your trust in ${settings.shopName}.', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                  ],
                ),
                Column(
                  children: [
                    Container(width: 120, height: 1, color: AppColors.muted),
                    const SizedBox(height: 6),
                    const Text('AUTHORIZED SIGNATORY', style: TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaCell extends StatelessWidget {
  const _MetaCell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.muted)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.text)),
          ],
        ),
      ),
    );
  }
}

class _Th extends StatelessWidget {
  const _Th(this.text, {this.align = TextAlign.left});

  final String text;
  final TextAlign align;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Text(text.toUpperCase(), textAlign: align, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.muted)),
    );
  }
}

class _Td extends StatelessWidget {
  const _Td(this.text, {this.align = TextAlign.left, this.bold = false, this.color = AppColors.text});

  final String text;
  final TextAlign align;
  final bool bold;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Text(text, textAlign: align, style: TextStyle(fontSize: 13, fontWeight: bold ? FontWeight.bold : FontWeight.normal, color: color)),
    );
  }
}
