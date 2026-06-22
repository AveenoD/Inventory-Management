import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/utils/format.dart';
import '../../domain/models/sale_invoice.dart';

class RepairInvoicePdfBuilder {
  static Future<Uint8List> build(Map<String, dynamic> job, InvoiceSettings settings) async {
    final logoBytes = decodeDataUrlImage(settings.logoDataUrl);
    final amount = parseMoney('${job['customerCharge'] ?? job['salePrice'] ?? 0}');

    final doc = pw.Document();
    final navy = PdfColor.fromInt(0xFF1E40AF);
    final gold = PdfColor.fromInt(0xFFFBBF24);
    final muted = PdfColor.fromInt(0xFF64748B);

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            pw.Container(
              padding: const pw.EdgeInsets.all(16),
              decoration: pw.BoxDecoration(
                color: navy,
                borderRadius: const pw.BorderRadius.vertical(top: pw.Radius.circular(4)),
              ),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Expanded(
                    child: pw.Row(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        if (logoBytes != null)
                          pw.Container(
                            width: 52,
                            height: 52,
                            margin: const pw.EdgeInsets.only(right: 12),
                            child: pw.Image(pw.MemoryImage(logoBytes), fit: pw.BoxFit.contain),
                          )
                        else
                          pw.Container(
                            width: 52,
                            height: 52,
                            margin: const pw.EdgeInsets.only(right: 12),
                            alignment: pw.Alignment.center,
                            decoration: pw.BoxDecoration(
                              color: PdfColors.white,
                              borderRadius: pw.BorderRadius.circular(6),
                            ),
                            child: pw.Text('SK', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: navy)),
                          ),
                        pw.Expanded(
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text(
                                settings.shopName,
                                style: pw.TextStyle(
                                  color: PdfColors.white,
                                  fontSize: 18,
                                  fontWeight: pw.FontWeight.bold,
                                ),
                              ),
                              if (settings.address != null && settings.address!.isNotEmpty)
                                pw.Text(settings.address!, style: pw.TextStyle(color: PdfColors.white, fontSize: 9)),
                              if (settings.phone != null && settings.phone!.isNotEmpty)
                                pw.Text('Ph: ${settings.phone}', style: pw.TextStyle(color: PdfColors.white, fontSize: 9)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text('REPAIR INVOICE', style: pw.TextStyle(color: PdfColors.white, fontSize: 9, letterSpacing: 1)),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        '${job['id']}'.substring(0, 8).toUpperCase(),
                        style: pw.TextStyle(color: gold, fontSize: 13, fontWeight: pw.FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            pw.Container(height: 3, color: PdfColor.fromInt(0xFFF59E0B)),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              decoration: const pw.BoxDecoration(
                border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300)),
                color: PdfColor.fromInt(0xFFFAFBFC),
              ),
              child: pw.Row(
                children: [
                  _metaCell('Bill To', '${job['customerName'] ?? 'Walk-in Customer'}'),
                  _metaCell('Date', formatInvoiceDate('${job['date']}')),
                  _metaCell('Device', '${job['device'] ?? '—'}'),
                  _metaCell('Status', job['status'] == 'DELIVERED' ? 'Delivered' : 'Pending Pickup'),
                ],
              ),
            ),
            pw.Table(
              border: pw.TableBorder(
                horizontalInside: const pw.BorderSide(color: PdfColors.grey200, width: 0.5),
              ),
              columnWidths: {
                0: const pw.FixedColumnWidth(24),
                1: const pw.FlexColumnWidth(2),
                2: const pw.FlexColumnWidth(2),
                3: const pw.FlexColumnWidth(3),
                4: const pw.FixedColumnWidth(80),
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF1F5F9)),
                  children: [
                    _th('#'),
                    _th('Device'),
                    _th('Customer Name'),
                    _th('Issue'),
                    _th('Amount', align: pw.TextAlign.right),
                  ],
                ),
                pw.TableRow(
                  children: [
                    _td('1'),
                    _td('${job['device'] ?? '—'}'),
                    _td('${job['customerName'] ?? 'Walk-in Customer'}'),
                    _td('${job['issueDescription'] ?? '—'}'),
                    _td(formatMoney(amount).replaceAll('₹', '').trim(), align: pw.TextAlign.right, bold: true),
                  ],
                ),
              ],
            ),
            pw.SizedBox(height: 12),
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Expanded(
                  flex: 3,
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('AMOUNT IN WORDS', style: pw.TextStyle(fontSize: 8, color: muted)),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        amountInWords(amount),
                        style: pw.TextStyle(fontSize: 10, fontStyle: pw.FontStyle.italic),
                      ),
                    ],
                  ),
                ),
                pw.SizedBox(width: 16),
                pw.Container(
                  width: 160,
                  child: pw.Column(
                    children: [
                      pw.Container(
                        padding: const pw.EdgeInsets.all(8),
                        decoration: pw.BoxDecoration(color: navy, borderRadius: pw.BorderRadius.circular(4)),
                        child: pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text('Grand Total', style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold)),
                            pw.Text(
                              formatMoney(amount),
                              style: pw.TextStyle(color: gold, fontWeight: pw.FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (settings.warrantyText != null && settings.warrantyText!.isNotEmpty) ...[
              pw.SizedBox(height: 14),
              pw.Container(
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFFFFFBEB),
                  border: pw.Border.all(color: PdfColor.fromInt(0xFFFDE68A)),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('WARRANTY & GUARANTEE', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColor.fromInt(0xFFB45309))),
                    pw.SizedBox(height: 4),
                    pw.Text(settings.warrantyText!, style: const pw.TextStyle(fontSize: 9)),
                  ],
                ),
              ),
            ],
            pw.Spacer(),
            pw.Divider(color: PdfColors.grey300),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Thank you for your business!', style: pw.TextStyle(color: navy, fontWeight: pw.FontWeight.bold)),
                    pw.Text('We appreciate your trust in ${settings.shopName}.', style: pw.TextStyle(fontSize: 8, color: muted)),
                  ],
                ),
                pw.Column(
                  children: [
                    pw.Container(width: 100, height: 1, color: PdfColors.grey400),
                    pw.SizedBox(height: 4),
                    pw.Text('Authorized Signatory', style: pw.TextStyle(fontSize: 8, color: muted)),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );

    return doc.save();
  }

  static pw.Widget _metaCell(String label, String value) => pw.Expanded(
        child: pw.Padding(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(label.toUpperCase(), style: pw.TextStyle(fontSize: 7, color: PdfColor.fromInt(0xFF94A3B8))),
              pw.SizedBox(height: 2),
              pw.Text(value, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
            ],
          ),
        ),
      );

  static pw.Widget _th(String text, {pw.TextAlign align = pw.TextAlign.left}) => pw.Padding(
        padding: const pw.EdgeInsets.all(6),
        child: pw.Text(text.toUpperCase(), textAlign: align, style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
      );

  static pw.Widget _td(String text, {pw.TextAlign align = pw.TextAlign.left, bool bold = false}) => pw.Padding(
        padding: const pw.EdgeInsets.all(6),
        child: pw.Text(text, textAlign: align, style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
      );
}
