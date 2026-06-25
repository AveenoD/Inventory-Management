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

class _QueueItem {
  _QueueItem(this.product, this.qty);
  final Map<String, dynamic> product;
  int qty;
}

class _QrLabelsScreenState extends ConsumerState<QrLabelsScreen> {
  final _queue = <String, _QueueItem>{};
  List<Map<String, dynamic>> _products = [];
  String _search = '';
  String _searchDebounced = '';
  bool _loading = true;
  String? _error;
  Timer? _searchDebounce;
  LabelSize _labelSize = LabelSize.s48x24;

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

  void _addToQueue(Map<String, dynamic> p) {
    final id = '${p['id']}';
    setState(() {
      if (_queue.containsKey(id)) {
        _queue[id]!.qty++;
      } else {
        _queue[id] = _QueueItem(p, 1);
      }
    });
  }

  void _setQty(String id, int qty) {
    setState(() {
      if (qty <= 0) {
        _queue.remove(id);
      } else {
        if (_queue.containsKey(id)) {
          _queue[id]!.qty = qty;
        }
      }
    });
  }

  void _removeFromQueue(String id) {
    setState(() => _queue.remove(id));
  }

  Future<void> _printLabels() async {
    final items = _queue.values.toList();
    if (items.isEmpty) return;

    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(12),
        build: (context) {
          final labels = <pw.Widget>[];
          for (final item in items) {
            for (var i = 0; i < item.qty; i++) {
              labels.add(_pdfLabel(item.product));
            }
          }
          return pw.Wrap(
            spacing: 8,
            runSpacing: 8,
            children: labels,
          );
        },
      ),
    );
    await Printing.layoutPdf(onLayout: (_) async => doc.save());
  }

  pw.Widget _pdfLabel(Map<String, dynamic> product) {
    final cfg = _pdfLabelConfigs[_labelSize]!;
    
    final payload = barcodePayloadForProduct(product);
    final rawName = '${product['name'] ?? 'Product'}'.trim();
    final name = rawName.length > cfg.nameTrunc
        ? '${rawName.substring(0, cfg.nameTrunc - 1)}…'
        : rawName;

    final mrp = productMrp(product);
    final salePrice = effectiveSalePrice(product);
    final hasDifferentSalePrice = salePrice < mrp;

    return pw.Container(
      width: cfg.width,
      height: cfg.height,
      padding: pw.EdgeInsets.symmetric(horizontal: cfg.hPad, vertical: cfg.vPad),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey400, style: pw.BorderStyle.dashed),
      ),
      child: pw.Column(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        children: [
          pw.Text(
            'SK MOBILE SHOP',
            style: pw.TextStyle(fontSize: cfg.shopFontSize, fontWeight: pw.FontWeight.bold),
            textAlign: pw.TextAlign.center,
          ),
          pw.SizedBox(height: cfg.gap),
          pw.BarcodeWidget(
            barcode: pw.Barcode.code128(),
            data: payload,
            width: cfg.barcodeWidth,
            height: cfg.barcodeHeight,
            drawText: false,
          ),
          pw.SizedBox(height: cfg.gap),
          pw.Text(
            name,
            style: pw.TextStyle(fontSize: cfg.nameFontSize, fontWeight: pw.FontWeight.bold),
            maxLines: 1,
            textAlign: pw.TextAlign.center,
          ),
          pw.SizedBox(height: cfg.gap * 0.5),
          pw.Text(
            'MRP-${formatMoney(mrp)}',
            style: pw.TextStyle(fontSize: cfg.priceFontSize, fontWeight: pw.FontWeight.bold),
            textAlign: pw.TextAlign.center,
          ),
          if (hasDifferentSalePrice)
            pw.Text(
              'Sale Price: ${formatMoney(salePrice)}',
              style: pw.TextStyle(fontSize: cfg.priceFontSize, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalLabels = _queue.values.fold<int>(0, (sum, q) => sum + q.qty);

    return ScreenShell(
      title: 'Barcode Labels',
      subtitle: 'Select products, set quantities, choose size, then print',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Size Selector
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Label Size', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _SizeButton(
                        label: '65 Labels', desc: '38×21mm',
                        selected: _labelSize == LabelSize.s38x21,
                        onTap: () => setState(() => _labelSize = LabelSize.s38x21),
                      ),
                      _SizeButton(
                        label: '48 Labels', desc: '48×24mm',
                        selected: _labelSize == LabelSize.s48x24,
                        onTap: () => setState(() => _labelSize = LabelSize.s48x24),
                      ),
                      _SizeButton(
                        label: '24 Labels', desc: '64×34mm',
                        selected: _labelSize == LabelSize.s64x34,
                        onTap: () => setState(() => _labelSize = LabelSize.s64x34),
                      ),
                      _SizeButton(
                        label: '12 Labels', desc: '100×44mm',
                        selected: _labelSize == LabelSize.s100x44,
                        onTap: () => setState(() => _labelSize = LabelSize.s100x44),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Print Queue
          if (_queue.isNotEmpty) ...[
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.print, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Print Queue (${_queue.length} items, $totalLabels labels)',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                        ),
                        const Spacer(),
                        FilledButton.icon(
                          onPressed: _printLabels,
                          icon: const Icon(Icons.print, size: 16),
                          label: Text('Print $totalLabels'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ..._queue.values.map((q) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${q.product['name'] ?? 'Product'}',
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${q.product['sku'] ?? '—'}',
                                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                  ),
                                ],
                              ),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove, size: 16),
                                  onPressed: () => _setQty('${q.product['id']}', q.qty - 1),
                                  style: IconButton.styleFrom(
                                    backgroundColor: AppColors.scaffold,
                                    padding: EdgeInsets.zero,
                                    minimumSize: const Size(32, 32),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text('${q.qty}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.add, size: 16),
                                  onPressed: () => _setQty('${q.product['id']}', q.qty + 1),
                                  style: IconButton.styleFrom(
                                    backgroundColor: AppColors.scaffold,
                                    padding: EdgeInsets.zero,
                                    minimumSize: const Size(32, 32),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.delete, size: 16, color: AppColors.red),
                                  onPressed: () => _removeFromQueue('${q.product['id']}'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    )),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          Row(
            children: [
              Expanded(
                child: SearchField(
                  value: _search,
                  onChanged: _onSearchChanged,
                  placeholder: 'Search by name, model, SKU…',
                ),
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
                    : 'No products match "$_searchDebounced".',
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
                  final inQueue = _queue.containsKey(id);
                  final qty = inQueue ? _queue[id]!.qty : 0;
                  final title = productDisplayName(p);
                  final price = formatMoney(effectiveSalePrice(p));
                  return InkWell(
                    onTap: () => _addToQueue(p),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: inQueue ? AppColors.accent : AppColors.border,
                          width: inQueue ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(8),
                        color: AppColors.card,
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            inQueue ? 'In queue ($qty)' : 'Tap to add',
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
                          Center(child: ProductLabelWidget(product: p, labelSize: _labelSize)),
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

class _SizeButton extends StatelessWidget {
  const _SizeButton({required this.label, required this.desc, required this.selected, required this.onTap});
  final String label;
  final String desc;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: selected ? AppColors.accent : AppColors.border, width: 2),
          borderRadius: BorderRadius.circular(8),
          color: selected ? AppColors.accent.withOpacity(0.1) : Colors.transparent,
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text(desc, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
        ),
      ),
    );
  }
}

class _PdfLabelConfig {
  const _PdfLabelConfig({
    required this.width,
    required this.height,
    required this.hPad,
    required this.vPad,
    required this.gap,
    required this.shopFontSize,
    required this.nameFontSize,
    required this.priceFontSize,
    required this.barcodeWidth,
    required this.barcodeHeight,
    required this.nameTrunc,
  });

  final double width;
  final double height;
  final double hPad;
  final double vPad;
  final double gap;
  final double shopFontSize;
  final double nameFontSize;
  final double priceFontSize;
  final double barcodeWidth;
  final double barcodeHeight;
  final int nameTrunc;
}

// PDF uses Points (1 mm = 2.83465 points)
// 38x21mm = 107.7 x 59.5 pt
// 48x24mm = 136.1 x 68.0 pt
// 64x34mm = 181.4 x 96.4 pt
// 100x44mm = 283.5 x 124.7 pt

const _pdfLabelConfigs = <LabelSize, _PdfLabelConfig>{
  LabelSize.s38x21: _PdfLabelConfig(
    width: 107, height: 59, hPad: 3, vPad: 2, gap: 1,
    shopFontSize: 5, nameFontSize: 5, priceFontSize: 4.5,
    barcodeWidth: 95, barcodeHeight: 15, nameTrunc: 20,
  ),
  LabelSize.s48x24: _PdfLabelConfig(
    width: 136, height: 68, hPad: 4, vPad: 3, gap: 1.5,
    shopFontSize: 6, nameFontSize: 6, priceFontSize: 5.5,
    barcodeWidth: 120, barcodeHeight: 20, nameTrunc: 28,
  ),
  LabelSize.s64x34: _PdfLabelConfig(
    width: 181, height: 96, hPad: 6, vPad: 4, gap: 2,
    shopFontSize: 8, nameFontSize: 8, priceFontSize: 7,
    barcodeWidth: 160, barcodeHeight: 28, nameTrunc: 40,
  ),
  LabelSize.s100x44: _PdfLabelConfig(
    width: 283, height: 124, hPad: 8, vPad: 6, gap: 3,
    shopFontSize: 11, nameFontSize: 11, priceFontSize: 10,
    barcodeWidth: 250, barcodeHeight: 38, nameTrunc: 60,
  ),
};
