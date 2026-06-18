import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/filter_picker.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

enum _LineMode { cover, product }

class _PurchaseCartLine {
  _PurchaseCartLine.product({
    required this.productId,
    required this.displayName,
    required this.qty,
    required this.unitCost,
  })  : phoneModelId = null,
        coverTypeId = null,
        variantName = null,
        sellPrice = null;

  _PurchaseCartLine.cover({
    required this.phoneModelId,
    required this.coverTypeId,
    required this.variantName,
    required this.displayName,
    required this.qty,
    required this.unitCost,
    this.sellPrice,
  }) : productId = null;

  final String? productId;
  final String? phoneModelId;
  final String? coverTypeId;
  final String? variantName;
  final String displayName;
  int qty;
  double unitCost;
  final double? sellPrice;

  double get lineTotal => qty * unitCost;
}

class NewPurchaseScreen extends ConsumerStatefulWidget {
  const NewPurchaseScreen({super.key});

  @override
  ConsumerState<NewPurchaseScreen> createState() => _NewPurchaseScreenState();
}

class _NewPurchaseScreenState extends ConsumerState<NewPurchaseScreen> {
  _LineMode _mode = _LineMode.product;
  String _date = todayIso();
  String _payment = 'CASH';
  String? _partyId;
  String? _phoneModelId;
  String? _coverTypeId;
  String? _selectedProductId;

  final _invoice = TextEditingController();
  final _variant = TextEditingController();
  final _lineQty = TextEditingController(text: '1');
  final _lineCost = TextEditingController();
  final _lineSell = TextEditingController();
  final _discount = TextEditingController();
  final _paid = TextEditingController();
  String _search = '';
  String _searchDebounced = '';
  Timer? _searchDebounce;

  List<Map<String, dynamic>> _parties = [];
  List<Map<String, dynamic>> _phoneModels = [];
  List<Map<String, dynamic>> _coverTypes = [];
  List<Map<String, dynamic>> _products = [];
  final List<_PurchaseCartLine> _cart = [];

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _cartError;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _discount.addListener(_onTotalsChanged);
    _paid.addListener(_onTotalsChanged);
    _lineQty.addListener(() => setState(() {}));
    _lineCost.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _invoice.dispose();
    _variant.dispose();
    _lineQty.dispose();
    _lineCost.dispose();
    _lineSell.dispose();
    _discount.dispose();
    _paid.dispose();
    super.dispose();
  }

  void _onTotalsChanged() => setState(() {});

  double get _subtotal => _cart.fold(0.0, (sum, c) => sum + c.lineTotal);

  double get _discountValue => parseMoney(_discount.text);

  double get _total => (_subtotal - _discountValue).clamp(0, double.infinity);

  double get _paidValue => parseMoney(_paid.text);

  double get _balance => (_total - _paidValue).clamp(0, double.infinity);

  int get _lineQtyValue {
    final n = int.tryParse(_lineQty.text.trim());
    return n == null || n < 1 ? 1 : n;
  }

  double get _lineCostValue => parseMoney(_lineCost.text);

  double get _linePreviewTotal => _lineQtyValue * _lineCostValue;

  Future<void> _bootstrap() async {
    try {
      final api = ref.read(apiServiceProvider);
      final partiesRes = await api.getPartyList();
      final modelsRes = await api.getPhoneModels();
      if (!mounted) return;
      setState(() {
        _parties = (partiesRes['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _phoneModels = (modelsRes['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
      await _loadProducts();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiError ? e.message : 'Could not load purchase form.';
      });
    }
  }

  Future<void> _loadCoverTypes() async {
    if (_phoneModelId == null) {
      setState(() => _coverTypes = []);
      return;
    }
    final res = await ref.read(apiServiceProvider).getCoverTypes(phoneModelId: _phoneModelId);
    if (!mounted) return;
    setState(() {
      _coverTypes = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      if (_coverTypeId != null && !_coverTypes.any((t) => t['id'] == _coverTypeId)) {
        _coverTypeId = null;
      }
    });
  }

  Future<void> _loadProducts() async {
    final res = await ref.read(apiServiceProvider).getProducts(
          search: _searchDebounced.isEmpty ? null : _searchDebounced,
          excludeKinds: const ['REPAIR_PART'],
          limit: 30,
        );
    if (!mounted) return;
    setState(() {
      _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    });
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      setState(() => _searchDebounced = value.trim());
      _loadProducts();
    });
  }

  void _selectProduct(Map<String, dynamic> p) {
    setState(() {
      _selectedProductId = '${p['id']}';
      _lineCost.text = '${parseMoney('${p['buyPrice']}')}';
      _cartError = null;
    });
  }

  void _syncPaidToTotalIfEmpty() {
    if (_paid.text.trim().isEmpty && _total > 0) {
      _paid.text = _total.toStringAsFixed(2);
    }
  }

  void _addCoverLine() {
    if (_phoneModelId == null || _coverTypeId == null) {
      setState(() => _cartError = 'Select phone model and cover category.');
      return;
    }
    final variant = _variant.text.trim();
    if (variant.isEmpty) {
      setState(() => _cartError = 'Enter design / variant name.');
      return;
    }
    final qty = _lineQtyValue;
    final cost = _lineCostValue;
    if (cost < 0) {
      setState(() => _cartError = 'Enter valid buy rate.');
      return;
    }
    final modelName = _phoneModels.firstWhere((m) => m['id'] == _phoneModelId)['name'];
    final typeName = _coverTypes.firstWhere((t) => t['id'] == _coverTypeId)['name'];
    final sell = _lineSell.text.trim().isEmpty ? null : parseMoney(_lineSell.text);
    setState(() {
      _cartError = null;
      _cart.add(
        _PurchaseCartLine.cover(
          phoneModelId: _phoneModelId,
          coverTypeId: _coverTypeId,
          variantName: variant,
          displayName: '$modelName – $typeName – $variant',
          qty: qty,
          unitCost: cost,
          sellPrice: sell,
        ),
      );
      _variant.clear();
      _lineQty.text = '1';
      _lineCost.clear();
      _lineSell.clear();
    });
    _syncPaidToTotalIfEmpty();
  }

  void _addProductLine() {
    if (_selectedProductId == null) {
      setState(() => _cartError = 'Select a product first, then set quantity and tap Add to bill.');
      return;
    }
    final p = _products.cast<Map<String, dynamic>?>().firstWhere(
          (x) => x?['id'] == _selectedProductId,
          orElse: () => null,
        );
    if (p == null) {
      setState(() => _cartError = 'Selected product not found. Search again.');
      return;
    }
    final qty = _lineQtyValue;
    final cost = _lineCost.text.trim().isEmpty ? parseMoney('${p['buyPrice']}') : _lineCostValue;
    if (cost < 0) {
      setState(() => _cartError = 'Enter valid buy rate.');
      return;
    }
    final id = '${p['id']}';
    setState(() {
      _cartError = null;
      final existing = _cart.where((c) => c.productId == id).toList();
      if (existing.isNotEmpty) {
        existing.first.qty = qty;
        existing.first.unitCost = cost;
      } else {
        _cart.add(
          _PurchaseCartLine.product(
            productId: id,
            displayName: '${p['name']}',
            qty: qty,
            unitCost: cost,
          ),
        );
      }
      _lineQty.text = '1';
      _selectedProductId = null;
      _lineCost.clear();
    });
    _syncPaidToTotalIfEmpty();
  }

  void _adjustCartQty(_PurchaseCartLine line, int delta) {
    setState(() {
      _cartError = null;
      final next = line.qty + delta;
      if (next <= 0) {
        _cart.remove(line);
      } else {
        line.qty = next;
      }
    });
    _syncPaidToTotalIfEmpty();
  }

  Future<void> _save() async {
    if (_partyId == null) {
      setState(() => _submitError = 'Select a supplier.');
      return;
    }
    if (_cart.isEmpty) {
      setState(() => _submitError = 'Add at least one item.');
      return;
    }
    if (_discountValue > _subtotal) {
      setState(() => _submitError = 'Discount cannot exceed subtotal.');
      return;
    }
    if (_paidValue > _total) {
      setState(() => _submitError = 'Paid amount cannot exceed total.');
      return;
    }

    setState(() {
      _submitError = null;
      _saving = true;
    });

    try {
      await ref.read(apiServiceProvider).createPurchase({
        'partyId': _partyId,
        'date': _date,
        'invoiceNo': _invoice.text.trim().isEmpty ? null : _invoice.text.trim(),
        'discount': _discountValue,
        'paidAmount': _paidValue,
        'paymentMethod': _payment,
        'lines': _cart.map((c) {
          if (c.productId != null) {
            return {
              'productId': c.productId,
              'quantity': c.qty,
              'unitCost': c.unitCost,
            };
          }
          return {
            'phoneModelId': c.phoneModelId,
            'coverTypeId': c.coverTypeId,
            'variantName': c.variantName,
            'quantity': c.qty,
            'unitCost': c.unitCost,
            if (c.sellPrice != null) 'sellPrice': c.sellPrice,
          };
        }).toList(),
      });
      if (mounted) context.go('/purchases');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitError = e is ApiError ? e.message : 'Could not save purchase.';
        _saving = false;
      });
      return;
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const ScreenShell(
        title: 'New purchase',
        subtitle: 'Stock in from supplier',
        showBack: true,
        hideHeaderActions: true,
        child: PageLoader(message: 'Loading…'),
      );
    }

    return ScreenShell(
      title: 'New purchase',
      subtitle: 'Stock in from supplier',
      showBack: true,
      hideHeaderActions: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) _errorBanner(_error!),
          if (_parties.isEmpty)
            _infoBanner('No suppliers yet — add one in Parties first.'),
          _sectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const FieldLabel('Supplier'),
                if (_parties.isEmpty)
                  const Text('No parties available', style: TextStyle(color: AppColors.muted))
                else
                  FilterPicker<String?>(
                    value: _partyId,
                    items: [null, ..._parties.map((p) => p['id'] as String)],
                    labelBuilder: (id) {
                      if (id == null) return 'Select supplier';
                      final party = _parties.firstWhere((p) => p['id'] == id);
                      return '${party['name']}';
                    },
                    onChanged: (v) => setState(() => _partyId = v),
                  ),
                const SizedBox(height: AppSpacing.md),
                DateField(value: _date, onChanged: (v) => setState(() => _date = v)),
                const FieldLabel('Invoice # (optional)'),
                AppTextField(controller: _invoice),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _buildModeTabs(),
          const SizedBox(height: AppSpacing.md),
          _sectionCard(child: _mode == _LineMode.cover ? _buildCoverForm() : _buildProductForm()),
          const SizedBox(height: AppSpacing.md),
          _buildCartCard(),
          const SizedBox(height: AppSpacing.md),
          _buildSummaryCard(),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: _saving ? 'Saving…' : 'Save purchase',
            loading: _saving,
            disabled: _cart.isEmpty || _partyId == null,
            onPressed: _save,
          ),
        ],
      ),
    );
  }

  Widget _buildModeTabs() {
    return Row(
      children: [
        Expanded(child: _modeChip('Other product', _LineMode.product)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: _modeChip('Cover', _LineMode.cover)),
      ],
    );
  }

  Widget _modeChip(String label, _LineMode mode) {
    final selected = _mode == mode;
    return Material(
      color: selected ? AppColors.accentLight : AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        side: BorderSide(color: selected ? AppColors.accent : AppColors.border),
      ),
      child: InkWell(
        onTap: () => setState(() => _mode = mode),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.accent : AppColors.muted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCoverForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel('Phone model'),
        FilterPicker<String?>(
          value: _phoneModelId,
          items: [null, ..._phoneModels.map((m) => m['id'] as String)],
          labelBuilder: (id) {
            if (id == null) return 'Select model';
            return '${_phoneModels.firstWhere((m) => m['id'] == id)['name']}';
          },
          onChanged: (v) {
            setState(() {
              _phoneModelId = v;
              _coverTypeId = null;
            });
            _loadCoverTypes();
          },
        ),
        const FieldLabel('Cover category'),
        FilterPicker<String?>(
          value: _coverTypeId,
          items: [null, ..._coverTypes.map((t) => t['id'] as String)],
          labelBuilder: (id) {
            if (id == null) return 'Select category';
            return '${_coverTypes.firstWhere((t) => t['id'] == id)['name']}';
          },
          onChanged: (v) {
            if (_phoneModelId == null) return;
            setState(() => _coverTypeId = v);
          },
        ),
        const FieldLabel('Design / variant'),
        AppTextField(controller: _variant),
        _qtyRateFields(),
        const FieldLabel('Sell price (optional)'),
        AppTextField(controller: _lineSell, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
        const SizedBox(height: AppSpacing.sm),
        SecondaryButton(label: 'Add to bill', onPressed: _addCoverLine),
      ],
    );
  }

  Widget _buildProductForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SearchField(
          value: _search,
          onChanged: (v) {
            setState(() => _search = v);
            _onSearchChanged(v);
          },
          placeholder: 'Search products…',
        ),
        const SizedBox(height: AppSpacing.sm),
        ..._products.take(8).map(_buildProductRow),
        const SizedBox(height: AppSpacing.md),
        _qtyRateFields(),
        const SizedBox(height: AppSpacing.sm),
        PrimaryButton(
          label: 'Add to bill',
          disabled: _selectedProductId == null,
          onPressed: _addProductLine,
        ),
        if (_cartError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_cartError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
        ],
      ],
    );
  }

  Widget _buildProductRow(Map<String, dynamic> p) {
    final id = '${p['id']}';
    final selected = _selectedProductId == id;
    final stock = int.tryParse('${p['stockQty']}') ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: selected ? AppColors.accentLight : AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: selected ? AppColors.accent : AppColors.border),
      ),
      child: ListTile(
        dense: true,
        title: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Stock $stock · Buy ${formatMoney(parseMoney('${p['buyPrice']}'))}'),
        trailing: selected
            ? const Icon(Icons.check_circle, color: AppColors.accent, size: 20)
            : const Text('Select', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600)),
        onTap: () => _selectProduct(p),
      ),
    );
  }

  Widget _qtyRateFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FieldLabel('Quantity'),
                  AppTextField(
                    controller: _lineQty,
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FieldLabel('Buy rate (per piece)'),
                  AppTextField(
                    controller: _lineCost,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (_lineCost.text.isNotEmpty || _selectedProductId != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'Line total: ${formatMoney(_linePreviewTotal)} ($_lineQtyValue × ${formatMoney(_lineCostValue)})',
              style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.accent),
            ),
          ),
      ],
    );
  }

  Widget _buildCartCard() {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(AppIcons.shoppingBag, size: 18, color: AppColors.text),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Bill items (${_cart.length})',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              if (_cart.isNotEmpty)
                TextButton(onPressed: () => setState(() => _cart.clear()), child: const Text('Clear')),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_cart.isEmpty)
            const Text('No items yet', style: TextStyle(color: AppColors.muted))
          else
            ..._cart.map(_buildCartLine),
        ],
      ),
    );
  }

  Widget _buildCartLine(_PurchaseCartLine line) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.displayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  '${formatMoney(line.unitCost)} each',
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.remove, size: 18),
                onPressed: () => _adjustCartQty(line, -1),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
              SizedBox(
                width: 28,
                child: Text('${line.qty}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              IconButton(
                icon: const Icon(Icons.add, size: 18),
                onPressed: () => _adjustCartQty(line, 1),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(formatMoney(line.lineTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildSummaryCard() {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _summaryRow('Subtotal', formatMoney(_subtotal)),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              const Expanded(child: Text('Discount', style: TextStyle(color: AppColors.muted))),
              SizedBox(
                width: 140,
                child: AppTextField(
                  controller: _discount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Total', formatMoney(_total), bold: true),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              const Expanded(child: Text('Paid now', style: TextStyle(color: AppColors.muted))),
              SizedBox(
                width: 140,
                child: AppTextField(
                  controller: _paid,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const FieldLabel('Payment method'),
          FilterPicker<String>(
            value: _payment,
            items: const ['CASH', 'UPI', 'CARD', 'BANK'],
            labelBuilder: paymentLabel,
            onChanged: (v) => setState(() => _payment = v ?? 'CASH'),
          ),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Balance due', formatMoney(_balance), color: _balance > 0 ? AppColors.amber : AppColors.green),
          if (_submitError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_submitError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
          ],
        ],
      ),
    );
  }

  Widget _sectionCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false, Color? color}) {
    return Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(color: AppColors.muted, fontWeight: bold ? FontWeight.w600 : null))),
        Text(
          value,
          style: TextStyle(
            fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
            fontSize: bold ? 18 : 15,
            color: color ?? AppColors.text,
          ),
        ),
      ],
    );
  }

  Widget _errorBanner(String message) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(message, style: const TextStyle(color: AppColors.red, fontSize: 14)),
    );
  }

  Widget _infoBanner(String message) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.amberBg,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Text(message, style: const TextStyle(color: AppColors.amber, fontSize: 14)),
    );
  }
}

String paymentLabel(String method) {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'UPI':
      return 'UPI';
    case 'CARD':
      return 'Card';
    case 'BANK':
      return 'Bank';
    default:
      return method;
  }
}
