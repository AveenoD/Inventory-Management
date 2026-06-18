import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../widgets/app_badge.dart';
import '../../core/utils/format.dart';
import '../../domain/models/sale_invoice.dart';

/// Vyapar-style sale invoice layout — mirrors web invoice design.
class SaleInvoiceView extends StatelessWidget {
  const SaleInvoiceView({super.key, required this.invoice});

  final SaleInvoiceData invoice;

  static const _headerColors = [Color(0xFF0F2744), Color(0xFF1E40AF), Color(0xFF2563EB)];

  @override
  Widget build(BuildContext context) {
    final sale = invoice.sale;
    final warranty = invoice.warrantyBody;
    final itemCount = sale.lines.fold<int>(0, (sum, l) => sum + l.quantity);
    final hasDiscount = parseMoney(sale.discount) > 0;
    final logoBytes = decodeDataUrlImage(invoice.logoDataUrl);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _HeaderBand(
            shopName: invoice.shopName,
            address: invoice.address,
            phone: invoice.phone,
            invoiceNo: sale.invoiceNo,
            logoBytes: logoBytes,
          ),
          _MetaGrid(
            customer: sale.customerName ?? 'Walk-in Customer',
            date: formatInvoiceDate(sale.date),
            payment: paymentLabel(sale.paymentMethod),
            itemCount: itemCount,
          ),
          _ItemsTable(lines: sale.lines),
          _BottomSection(
            words: amountInWords(parseMoney(sale.total)),
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            hasDiscount: hasDiscount,
          ),
          if (warranty != null) _WarrantyBox(text: warranty),
          _Footer(shopName: invoice.shopName),
          const _Watermark(),
        ],
      ),
    );
  }
}

class _HeaderBand extends StatelessWidget {
  const _HeaderBand({
    required this.shopName,
    required this.address,
    required this.phone,
    required this.invoiceNo,
    required this.logoBytes,
  });

  final String shopName;
  final String? address;
  final String? phone;
  final String? invoiceNo;
  final Uint8List? logoBytes;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: SaleInvoiceView._headerColors,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _BrandBlock(shopName: shopName, address: address, phone: phone, logoBytes: logoBytes)),
                const SizedBox(width: 12),
                _InvoiceBadge(invoiceNo: invoiceNo),
              ],
            ),
          ),
          Container(height: 4, color: const Color(0xFFF59E0B)),
        ],
      ),
    );
  }
}

class _BrandBlock extends StatelessWidget {
  const _BrandBlock({
    required this.shopName,
    required this.address,
    required this.phone,
    required this.logoBytes,
  });

  final String shopName;
  final String? address;
  final String? phone;
  final Uint8List? logoBytes;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 68,
          height: 68,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: logoBytes != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.memory(logoBytes!, fit: BoxFit.contain),
                )
              : const Center(
                  child: Text(
                    'SK',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.accent,
                    ),
                  ),
                ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                shopName,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  height: 1.2,
                ),
              ),
              if (address != null && address!.isNotEmpty) ...[
                const SizedBox(height: 6),
                _ContactLine(icon: Icons.location_on_outlined, text: address!),
              ],
              if (phone != null && phone!.isNotEmpty) ...[
                const SizedBox(height: 4),
                _ContactLine(icon: Icons.phone_outlined, text: phone!),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactLine extends StatelessWidget {
  const _ContactLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: Colors.white.withValues(alpha: 0.9)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.88), height: 1.4),
          ),
        ),
      ],
    );
  }
}

class _InvoiceBadge extends StatelessWidget {
  const _InvoiceBadge({required this.invoiceNo});

  final String? invoiceNo;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Text(
            'TAX INVOICE',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          invoiceNo ?? '—',
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: Color(0xFFFBBF24),
          ),
        ),
      ],
    );
  }
}

class _MetaGrid extends StatelessWidget {
  const _MetaGrid({
    required this.customer,
    required this.date,
    required this.payment,
    required this.itemCount,
  });

  final String customer;
  final String date;
  final String payment;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _MetaCell(label: 'Bill To', value: customer)),
          Expanded(child: _MetaCell(label: 'Invoice Date', value: date)),
          Expanded(
            child: _MetaCell(
              label: 'Payment Mode',
              value: payment,
              pill: true,
            ),
          ),
          Expanded(
            child: _MetaCell(
              label: 'Items',
              value: '$itemCount ${itemCount == 1 ? 'item' : 'items'}',
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaCell extends StatelessWidget {
  const _MetaCell({required this.label, required this.value, this.pill = false});

  final String label;
  final String value;
  final bool pill;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: const BoxDecoration(
        color: Color(0xFFFAFBFC),
        border: Border(right: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: Color(0xFF94A3B8),
            ),
          ),
          const SizedBox(height: 6),
          if (pill)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                value,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF15803D)),
              ),
            )
          else
            Text(
              value,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
            ),
        ],
      ),
    );
  }
}

class _ItemsTable extends StatelessWidget {
  const _ItemsTable({required this.lines});

  final List<SaleInvoiceLine> lines;

  String _plain(String money) => formatMoney(parseMoney(money)).replaceAll('₹', '').trim();

  @override
  Widget build(BuildContext context) {
    return Table(
      columnWidths: const {
        0: FixedColumnWidth(36),
        1: FlexColumnWidth(3),
        2: FixedColumnWidth(48),
        3: FixedColumnWidth(88),
        4: FixedColumnWidth(96),
      },
      border: const TableBorder(
        horizontalInside: BorderSide(color: Color(0xFFEEF2F6)),
      ),
      children: [
        TableRow(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFF1F5F9), Color(0xFFE8EDF3)],
            ),
            border: Border(bottom: BorderSide(color: AppColors.accent, width: 2)),
          ),
          children: [
            _th('#'),
            _th('Description'),
            _th('Qty', align: TextAlign.right),
            _th('Rate (₹)', align: TextAlign.right),
            _th('Amount (₹)', align: TextAlign.right),
          ],
        ),
        for (var i = 0; i < lines.length; i++)
          TableRow(
            decoration: BoxDecoration(color: i.isEven ? const Color(0xFFFAFBFC) : Colors.white),
            children: [
              _td('${i + 1}', muted: true),
              _td(lines[i].productName, bold: true),
              _td('${lines[i].quantity}', align: TextAlign.right),
              _td(_plain(lines[i].unitPrice), align: TextAlign.right),
              _td(_plain(lines[i].lineTotal), align: TextAlign.right, bold: true),
            ],
          ),
      ],
    );
  }

  Widget _th(String text, {TextAlign align = TextAlign.left}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Text(
          text.toUpperCase(),
          textAlign: align,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
            color: Color(0xFF475569),
          ),
        ),
      );

  Widget _td(String text, {TextAlign align = TextAlign.left, bool bold = false, bool muted = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        child: Text(
          text,
          textAlign: align,
          style: TextStyle(
            fontSize: 13,
            fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
            color: muted ? const Color(0xFF94A3B8) : const Color(0xFF334155),
          ),
        ),
      );
}

class _BottomSection extends StatelessWidget {
  const _BottomSection({
    required this.words,
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.hasDiscount,
  });

  final String words;
  final String subtotal;
  final String discount;
  final String total;
  final bool hasDiscount;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 3,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFE2E8F0)),
                  right: BorderSide(color: Color(0xFFE2E8F0)),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AMOUNT IN WORDS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    words,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      fontStyle: FontStyle.italic,
                      color: Color(0xFF334155),
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.all(14),
              color: const Color(0xFFF8FAFC),
              child: Column(
                children: [
                  _totalRow('Subtotal', formatMoney(parseMoney(subtotal))),
                  if (hasDiscount)
                    _totalRow('Discount', '- ${formatMoney(parseMoney(discount))}', discount: true),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
                      ),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Grand Total',
                          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 15),
                        ),
                        Text(
                          formatMoney(parseMoney(total)),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFFBBF24),
                            fontSize: 17,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value, {bool discount = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: discount ? AppColors.red : const Color(0xFF334155),
              ),
            ),
          ],
        ),
      );
}

class _WarrantyBox extends StatelessWidget {
  const _WarrantyBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFFBEB), Color(0xFFFEF9C3)],
        ),
        border: Border(
          top: BorderSide(color: Color(0xFFFDE68A)),
          bottom: BorderSide(color: Color(0xFFFDE68A)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('✦ ', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 14)),
              Text(
                'WARRANTY & GUARANTEE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: Color(0xFFB45309),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: const TextStyle(fontSize: 13, color: Color(0xFF78350F), height: 1.55),
          ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.shopName});

  final String shopName;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Thank you for your business!',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.accent),
                ),
                const SizedBox(height: 4),
                Text(
                  'We appreciate your trust in $shopName.',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          Column(
            children: [
              Container(width: 140, height: 1, color: const Color(0xFFCBD5E1)),
              const SizedBox(height: 6),
              const Text(
                'AUTHORIZED SIGNATORY',
                style: TextStyle(fontSize: 10, letterSpacing: 0.5, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Watermark extends StatelessWidget {
  const _Watermark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0), style: BorderStyle.solid)),
      ),
      child: const Text(
        'ORIGINAL COPY',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 2.5,
          color: Color(0xFFCBD5E1),
        ),
      ),
    );
  }
}
