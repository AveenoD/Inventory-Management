import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/product_display.dart';
import '../../core/utils/format.dart';
import '../../core/utils/product_price.dart';
import '../../core/utils/product_qr.dart';
import '../../widgets/fields.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';
import 'product_label_widget.dart';

class QrLabelsScreen extends ConsumerStatefulWidget {
  const QrLabelsScreen({super.key});

  @override
  ConsumerState<QrLabelsScreen> createState() => _QrLabelsScreenState();
}

class _QrLabelsScreenState extends ConsumerState<QrLabelsScreen> {
  final _selected = <String, Map<String, dynamic>>{};
  List<Map<String, dynamic>> _products = [];
  String _search = '';
  String _searchDebounced = '';
  bool _loading = true;
  String? _error;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    setState(() => _search = value);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _searchDebounced = _search.trim());
      _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getProducts(
        page: 1,
        search: _searchDebounced.isEmpty ? null : _searchDebounced,
        limit: 100,
        excludeKinds: const ['REPAIR_PART'],
      );
      if (!mounted) return;
      setState(() {
        _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load products.';
      });
    }
  }

  void _toggle(Map<String, dynamic> p) {
    final id = '${p['id']}';
    setState(() {
      if (_selected.containsKey(id)) {
        _selected.remove(id);
      } else {
        _selected[id] = p;
      }
    });
  }

  Future<void> _printLabels() async {
    final items = _selected.values.toList();
    if (items.isEmpty) return;

    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (context) {
          return pw.Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items.map((p) => _pdfLabel(p)).toList(),
          );
        },
      ),
    );
    await Printing.layoutPdf(onLayout: (_) async => doc.save());
  }

  pw.Widget _pdfLabel(Map<String, dynamic> product) {
    final name = productDisplayName(product);
    final displayName = name.length > 28 ? '${name.substring(0, 26)}…' : name;
    final sku = '${product['sku'] ?? ''}'.trim();
    final mrp = productMrp(product);
    final price = effectiveSalePrice(product);
    final hasDiscount = productHasDiscount(product);
    final payload = barcodePayloadForProduct(product);

    return pw.Container(
      width: 150,
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey400),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Text(
            displayName,
            style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
            textAlign: pw.TextAlign.center,
          ),
          pw.SizedBox(height: 3),
          pw.BarcodeWidget(
            barcode: pw.Barcode.code128(),
            data: payload,
            width: 130,
            height: 34,
            drawText: false,
          ),
          if (sku.isNotEmpty) ...[
            pw.SizedBox(height: 2),
            pw.Text(sku, style: const pw.TextStyle(fontSize: 7), textAlign: pw.TextAlign.center),
          ],
          pw.SizedBox(height: 2),
          if (hasDiscount) ...[
            pw.Text(
              'MRP ${formatMoney(mrp)}',
              style: pw.TextStyle(
                fontSize: 7,
                decoration: pw.TextDecoration.lineThrough,
              ),
              textAlign: pw.TextAlign.center,
            ),
            pw.Text(
              formatMoney(price),
              style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
          ] else
            pw.Text(
              'MRP ${formatMoney(mrp)}',
              style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Barcode Labels',
      subtitle: 'Print ~2 inch stickers with name, barcode, SKU, and price',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: SearchField(
                  value: _search,
                  onChanged: _onSearchChanged,
                  placeholder: 'Search by name, model, SKU…',
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _selected.isEmpty ? null : _printLabels,
                child: Text('Print (${_selected.length})'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading) const PageLoader(message: 'Loading products…'),
          if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.red)),
          if (!_loading && _error == null && _products.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                _searchDebounced.isEmpty
                    ? 'No products in inventory yet.'
                    : 'No products match "${_searchDebounced}".',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
          if (!_loading && _error == null && _products.isNotEmpty)
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 260,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.72,
                ),
                itemCount: _products.length,
                itemBuilder: (context, i) {
                  final p = _products[i];
                  final id = '${p['id']}';
                  final selected = _selected.containsKey(id);
                  final title = productDisplayName(p);
                  final price = formatMoney(effectiveSalePrice(p));
                  return InkWell(
                    onTap: () => _toggle(p),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: selected ? AppColors.accent : AppColors.border,
                          width: selected ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(8),
                        color: AppColors.card,
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            selected ? 'Selected' : 'Tap to select',
                            style: const TextStyle(fontSize: 11, color: AppColors.muted),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            title,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '${p['sku'] ?? ''} · $price',
                            style: const TextStyle(fontSize: 11, color: AppColors.muted),
                          ),
                          const SizedBox(height: 6),
                          Center(child: ProductLabelWidget(product: p)),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
