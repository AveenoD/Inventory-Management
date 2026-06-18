import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

enum _LineMode { cover, product }

class _PurchaseCartLine {
  _PurchaseCartLine.product({
    required this.productId,
    required this.displayName,
    required this.qty,
    required this.unitCost,
  }) : phoneModelId = null,
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
  final double unitCost;
  final double? sellPrice;
}

class NewPurchaseScreen extends ConsumerStatefulWidget {
  const NewPurchaseScreen({super.key});

  @override
  ConsumerState<NewPurchaseScreen> createState() => _NewPurchaseScreenState();
}

class _NewPurchaseScreenState extends ConsumerState<NewPurchaseScreen> {
  _LineMode _mode = _LineMode.cover;
  String _date = todayIso();
  String _payment = 'CASH';
  String? _partyId;
  String? _phoneModelId;
  String? _coverTypeId;

  final _invoice = TextEditingController();
  final _note = TextEditingController();
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
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _invoice.dispose();
    _note.dispose();
    _variant.dispose();
    _lineQty.dispose();
    _lineCost.dispose();
    _lineSell.dispose();
    _discount.dispose();
    _paid.dispose();
    super.dispose();
  }

  double get _subtotal => _cart.fold(0.0, (sum, c) => sum + c.qty * c.unitCost);

  double get _discountValue => parseMoney(_discount.text);

  double get _total => (_subtotal - _discountValue).clamp(0, double.infinity);

  double get _balance => (_total - parseMoney(_paid.text)).clamp(0, double.infinity);

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
      if (_coverTypeId != null &&
          !_coverTypes.any((t) => t['id'] == _coverTypeId)) {
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
    final qty = int.tryParse(_lineQty.text) ?? 0;
    final cost = parseMoney(_lineCost.text);
    if (qty <= 0 || cost < 0) {
      setState(() => _cartError = 'Enter valid quantity and buy rate.');
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
  }

  void _addProductLine(Map<String, dynamic> p) {
    final qty = int.tryParse(_lineQty.text) ?? 1;
    final cost = _lineCost.text.trim().isEmpty
        ? parseMoney('${p['buyPrice']}')
        : parseMoney(_lineCost.text);
    if (qty <= 0) {
      setState(() => _cartError = 'Enter valid quantity.');
      return;
    }
    final id = '${p['id']}';
    setState(() {
      _cartError = null;
      final existing = _cart.where((c) => c.productId == id).toList();
      if (existing.isNotEmpty) {
        existing.first.qty += qty;
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
      _lineCost.clear();
    });
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
    final paid = parseMoney(_paid.text);
    if (paid > _total) {
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
        'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
        'discount': _discountValue,
        'paidAmount': paid,
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
        child: PageLoader(message: 'Loading…'),
      );
    }

    return ScreenShell(
      title: 'New purchase',
      subtitle: 'Stock in from supplier',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(_error!, style: const TextStyle(color: AppColors.red)),
            ),
          if (_parties.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                'No suppliers yet — add one in Parties first.',
                style: TextStyle(color: AppColors.amber, fontSize: 14),
              ),
            ),
          DropdownButtonFormField<String>(
            value: _partyId,
            decoration: const InputDecoration(labelText: 'Supplier'),
            items: _parties
                .map((p) => DropdownMenuItem(value: p['id'] as String, child: Text('${p['name']}')))
                .toList(),
            onChanged: (v) => setState(() => _partyId = v),
          ),
          DateField(value: _date, onChanged: (v) => setState(() => _date = v)),
          const FieldLabel('Invoice # (optional)'),
          AppTextField(controller: _invoice),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Text('Cover'),
                  selected: _mode == _LineMode.cover,
                  onSelected: (_) => setState(() => _mode = _LineMode.cover),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: ChoiceChip(
                  label: const Text('Other product'),
                  selected: _mode == _LineMode.product,
                  onSelected: (_) => setState(() => _mode = _LineMode.product),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (_mode == _LineMode.cover) ...[
            DropdownButtonFormField<String>(
              value: _phoneModelId,
              decoration: const InputDecoration(labelText: 'Phone model'),
              items: _phoneModels
                  .map((m) => DropdownMenuItem(value: m['id'] as String, child: Text('${m['name']}')))
                  .toList(),
              onChanged: (v) {
                setState(() {
                  _phoneModelId = v;
                  _coverTypeId = null;
                });
                _loadCoverTypes();
              },
            ),
            DropdownButtonFormField<String>(
              value: _coverTypeId,
              decoration: const InputDecoration(labelText: 'Cover category'),
              items: _coverTypes
                  .map((t) => DropdownMenuItem(value: t['id'] as String, child: Text('${t['name']}')))
                  .toList(),
              onChanged: _phoneModelId == null ? null : (v) => setState(() => _coverTypeId = v),
            ),
            const FieldLabel('Design / variant'),
            AppTextField(controller: _variant),
            const FieldLabel('Sell price (optional)'),
            AppTextField(controller: _lineSell, keyboardType: TextInputType.number),
          ] else ...[
            SearchField(
              value: _search,
              onChanged: (v) {
                setState(() => _search = v);
                _onSearchChanged(v);
              },
              placeholder: 'Search products…',
            ),
            const SizedBox(height: AppSpacing.sm),
            ..._products.take(8).map(
                  (p) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${p['name']}'),
                    subtitle: Text('Stock ${p['stockQty']} · Buy ${p['buyPrice']}'),
                    trailing: TextButton(onPressed: () => _addProductLine(p), child: const Text('Add')),
                  ),
                ),
          ],
          const FieldLabel('Quantity'),
          AppTextField(controller: _lineQty, keyboardType: TextInputType.number),
          const FieldLabel('Buy rate (per piece)'),
          AppTextField(controller: _lineCost, keyboardType: TextInputType.number),
          if (_mode == _LineMode.cover) ...[
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(label: 'Add cover to bill', onPressed: _addCoverLine),
          ],
          if (_cartError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_cartError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
          ],
          const SizedBox(height: AppSpacing.md),
          _buildCart(),
          const SizedBox(height: AppSpacing.md),
          const FieldLabel('Discount'),
          AppTextField(controller: _discount, keyboardType: TextInputType.number),
          const FieldLabel('Paid now'),
          AppTextField(controller: _paid, keyboardType: TextInputType.number),
          DropdownButtonFormField<String>(
            value: _payment,
            decoration: const InputDecoration(labelText: 'Payment method'),
            items: ['CASH', 'UPI', 'CARD', 'BANK']
                .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                .toList(),
            onChanged: (v) => setState(() => _payment = v ?? 'CASH'),
          ),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Subtotal', formatMoney(_subtotal)),
          _summaryRow('Total', formatMoney(_total)),
          _summaryRow('Balance due', formatMoney(_balance)),
          if (_submitError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_submitError!, style: const TextStyle(color: AppColors.red)),
          ],
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: _saving ? 'Saving…' : 'Save purchase',
            loading: _saving,
            disabled: _cart.isEmpty,
            onPressed: _save,
          ),
        ],
      ),
    );
  }

  Widget _buildCart() {
    if (_cart.isEmpty) {
      return const Text('No items yet', style: TextStyle(color: AppColors.muted));
    }
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (var i = 0; i < _cart.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_cart[i].displayName} ×${_cart[i].qty}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(formatMoney(_cart[i].qty * _cart[i].unitCost)),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => setState(() => _cart.removeAt(i)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.muted))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
