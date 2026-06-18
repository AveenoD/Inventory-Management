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
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

const _pageSize = 20;

const _tabs = <({String key, String label})>[
  (key: 'ALL', label: 'All'),
  (key: 'MOBILE', label: 'Mobile'),
  (key: 'MOBILE_ACCESSORY', label: 'Accessories'),
  (key: 'SPEAKERS_SOUND', label: 'Speakers'),
  (key: 'CHARGER_CABLE', label: 'Charger'),
];

const _kindLabels = <String, String>{
  'MOBILE': 'Mobile',
  'MOBILE_ACCESSORY': 'Mobile Accessories',
  'REPAIR_PART': 'Repairing Accessory',
  'SPEAKERS_SOUND': 'Speakers / Sound',
  'CHARGER_CABLE': 'Charger & Cable',
};

class _CartLine {
  _CartLine({
    required this.productId,
    required this.name,
    required this.qty,
    required this.unitPrice,
    required this.maxStock,
    required this.kind,
  });

  final String productId;
  final String name;
  int qty;
  final double unitPrice;
  final int maxStock;
  final String kind;
}

class NewSaleScreen extends ConsumerStatefulWidget {
  const NewSaleScreen({super.key});

  @override
  ConsumerState<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends ConsumerState<NewSaleScreen> {
  String _tab = 'ALL';
  String _search = '';
  String _searchDebounced = '';
  int _page = 1;
  int _totalPages = 1;
  String _payment = 'CASH';
  String? _cartError;
  String? _loadError;
  String? _submitError;

  final _customer = TextEditingController();
  final _received = TextEditingController();
  final _discount = TextEditingController();
  final _warranty = TextEditingController();
  final List<_CartLine> _cart = [];
  List<Map<String, dynamic>> _products = [];

  bool _initialLoading = true;
  bool _fetching = false;
  bool _saving = false;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _customer.dispose();
    _received.dispose();
    _discount.dispose();
    _warranty.dispose();
    super.dispose();
  }

  double _unitSalePrice(Map<String, dynamic> p) => parseMoney('${p['sellPrice']}');

  String _kindLabel(String kind) => _kindLabels[kind] ?? kind;

  double get _subtotal => _cart.fold(0.0, (sum, c) => sum + c.qty * c.unitPrice);

  double get _discountValue => parseMoney(_discount.text);

  double get _total => (_subtotal - _discountValue).clamp(0, double.infinity);

  double get _change => (parseMoney(_received.text) - _total).clamp(0, double.infinity);

  Future<void> _loadProducts() async {
    if (!_initialLoading) {
      setState(() => _fetching = true);
    }
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getProducts(
        page: _page,
        search: _searchDebounced.isEmpty ? null : _searchDebounced,
        kind: _tab == 'ALL' ? null : _tab,
        excludeKinds: const ['REPAIR_PART'],
        limit: _pageSize,
      );
      if (!mounted) return;
      final meta = res['meta'];
      setState(() {
        _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _totalPages = (meta is Map ? meta['totalPages'] : null) as int? ?? 1;
        _initialLoading = false;
        _fetching = false;
        _loadError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initialLoading = false;
        _fetching = false;
        _loadError = e is ApiError ? e.message : 'Could not load products.';
      });
    }
  }

  void _onSearchChanged(String value) {
    setState(() {
      _search = value;
      _page = 1;
    });
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      setState(() => _searchDebounced = _search.trim());
      _loadProducts();
    });
  }

  void _selectTab(String key) {
    setState(() {
      _tab = key;
      _page = 1;
    });
    _loadProducts();
  }

  void _addToCart(Map<String, dynamic> p) {
    final stockQty = int.tryParse('${p['stockQty']}') ?? 0;
    final id = '${p['id']}';
    setState(() {
      _cartError = null;
      final existing = _cart.where((c) => c.productId == id).toList();
      final alreadyInCart = existing.isEmpty ? 0 : existing.first.qty;
      if (alreadyInCart + 1 > stockQty) {
        _cartError = 'Only $stockQty in stock for ${p['name']}';
        return;
      }
      if (existing.isNotEmpty) {
        existing.first.qty++;
      } else {
        _cart.add(
          _CartLine(
            productId: id,
            name: '${p['name']}',
            qty: 1,
            unitPrice: _unitSalePrice(p),
            maxStock: stockQty,
            kind: '${p['kind']}',
          ),
        );
      }
    });
  }

  Future<void> _complete() async {
    if (_cart.isEmpty) return;
    if (_discountValue > _subtotal) {
      setState(() => _cartError = 'Discount cannot exceed subtotal.');
      return;
    }
    setState(() {
      _cartError = null;
      _submitError = null;
      _saving = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final sale = await api.createSale({
        'date': todayIso(),
        'customerName': _customer.text.trim().isEmpty ? null : _customer.text.trim(),
        'paymentMethod': _payment,
        'discount': _discountValue,
        if (_warranty.text.trim().isNotEmpty) 'warrantyNote': _warranty.text.trim(),
        'lines': _cart
            .map((c) => {
                  'productId': c.productId,
                  'quantity': c.qty,
                  'unitPrice': c.unitPrice,
                })
            .toList(),
      });
      if (mounted) context.go('/sales/${sale['id']}/invoice');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitError = e is ApiError ? e.message : 'Could not complete sale.';
        _saving = false;
      });
      return;
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoading) {
      return const ScreenShell(
        title: 'New sale',
        subtitle: 'Point of sale billing',
        showBack: true,
        hideHeaderActions: true,
        child: PageLoader(message: 'Loading inventory…'),
      );
    }

    return ScreenShell(
      title: 'New sale',
      subtitle: 'Point of sale billing',
      showBack: true,
      hideHeaderActions: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_loadError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(_loadError!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
            ),
          _buildTabs(),
          const SizedBox(height: AppSpacing.md),
          SearchField(
            value: _search,
            onChanged: _onSearchChanged,
            placeholder: 'Search products…',
          ),
          const SizedBox(height: AppSpacing.md),
          if (_fetching)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                ),
              ),
            ),
          ..._products.map(_buildProductRow),
          _buildPagination(),
          _buildCartCard(),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final t in _tabs) ...[
            _buildTabChip(t.key, t.label),
            if (t != _tabs.last) const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Widget _buildTabChip(String key, String label) {
    final selected = _tab == key;
    return Material(
      color: selected ? AppColors.accentLight : AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        side: BorderSide(color: selected ? AppColors.accent : AppColors.border),
      ),
      child: InkWell(
        onTap: () => _selectTab(key),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.accent : AppColors.muted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductRow(Map<String, dynamic> p) {
    final stockQty = int.tryParse('${p['stockQty']}') ?? 0;
    final out = stockQty <= 0;
    final id = '${p['id']}';
    final inCart = _cart.where((c) => c.productId == id).toList();
    final inCartQty = inCart.isEmpty ? 0 : inCart.first.qty;
    final kind = '${p['kind']}';

    return Opacity(
      opacity: out ? 0.55 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.input),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${p['name']}',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_kindLabel(kind)} · ${out ? 'Out of stock' : '$stockQty in stock'}${inCartQty > 0 ? ' · In cart: $inCartQty' : ''}',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatMoney(_unitSalePrice(p)),
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text),
                ),
                const SizedBox(height: AppSpacing.sm),
                Material(
                  color: out ? AppColors.muted : AppColors.accent,
                  borderRadius: BorderRadius.circular(8),
                  child: InkWell(
                    onTap: out ? null : () => _addToCart(p),
                    borderRadius: BorderRadius.circular(8),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: Text(
                        '+ Add',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPagination() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _CompactSecondaryButton(
            label: 'Prev',
            disabled: _page <= 1,
            onPressed: () {
              setState(() => _page = (_page - 1).clamp(1, _totalPages));
              _loadProducts();
            },
          ),
          const SizedBox(width: AppSpacing.md),
          Text('$_page / $_totalPages', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text)),
          const SizedBox(width: AppSpacing.md),
          _CompactSecondaryButton(
            label: 'Next',
            disabled: _page >= _totalPages,
            onPressed: () {
              setState(() => _page = (_page + 1).clamp(1, _totalPages));
              _loadProducts();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCartCard() {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(AppIcons.shoppingBag, size: 18, color: AppColors.text),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Cart (${_cart.length})',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text),
                ),
              ),
              IconButton(
                onPressed: _cart.isEmpty ? null : () => setState(() => _cart.clear()),
                icon: Icon(AppIcons.trash2, size: 16, color: _cart.isEmpty ? AppColors.muted : AppColors.red),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_cartError != null || _submitError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                _cartError ?? _submitError!,
                style: const TextStyle(color: AppColors.red, fontSize: 14),
              ),
            ),
          if (_cart.isEmpty)
            const Text('No items in cart', style: TextStyle(color: AppColors.muted, fontSize: 14))
          else
            ..._cart.map(_buildCartLine),
          const SizedBox(height: AppSpacing.sm),
          _summaryRow('Subtotal', formatMoney(_subtotal)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Discount', style: TextStyle(color: AppColors.muted, fontSize: 14)),
              SizedBox(
                width: 160,
                child: TextField(
                  controller: _discount,
                  textAlign: TextAlign.right,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: AppColors.text, fontSize: 16),
                  decoration: const InputDecoration(hintText: '0'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.muted)),
              Text(
                formatMoney(_total),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.text),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _fieldLabel('Payment'),
          _buildPaymentRow(),
          _fieldLabel('Customer (optional)'),
          AppTextField(controller: _customer, hint: 'Walk-in', onChanged: (_) => setState(() {})),
          _fieldLabel('Warranty / guarantee (optional)'),
          AppTextField(
            controller: _warranty,
            hint: 'Leave blank for default from Settings',
            maxLines: 3,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _fieldLabel('Received'),
                    AppTextField(
                      controller: _received,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _fieldLabel('Change'),
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(
                        formatMoney(_change),
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: _saving ? 'Processing…' : 'Complete Sale',
            loading: _saving,
            disabled: _cart.isEmpty,
            onPressed: _complete,
          ),
        ],
      ),
    );
  }

  Widget _buildCartLine(_CartLine c) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text)),
                Text(_kindLabel(c.kind), style: const TextStyle(color: AppColors.muted, fontSize: 14)),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.remove, size: 18),
                onPressed: () => setState(() {
                  if (c.qty > 1) {
                    c.qty--;
                  } else {
                    _cart.remove(c);
                  }
                }),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
              SizedBox(
                width: 24,
                child: Text(
                  '${c.qty}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add, size: 18),
                onPressed: c.qty >= c.maxStock
                    ? null
                    : () => setState(() {
                          _cartError = null;
                          c.qty++;
                        }),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            formatMoney(c.qty * c.unitPrice),
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRow() {
    const methods = ['CASH', 'UPI', 'CARD'];
    const labels = {'CASH': 'Cash', 'UPI': 'UPI', 'CARD': 'Card'};
    return Row(
      children: [
        for (var i = 0; i < methods.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Material(
              color: _payment == methods[i] ? AppColors.accent : AppColors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.input),
                side: BorderSide(
                  color: _payment == methods[i] ? AppColors.accent : AppColors.border,
                ),
              ),
              child: InkWell(
                onTap: () => setState(() => _payment = methods[i]),
                borderRadius: BorderRadius.circular(AppRadii.input),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(
                    labels[methods[i]]!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _payment == methods[i] ? Colors.white : AppColors.text,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
          Text(value, style: const TextStyle(color: AppColors.text, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xs),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.muted,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _CompactSecondaryButton extends StatelessWidget {
  const _CompactSecondaryButton({
    required this.label,
    required this.onPressed,
    this.disabled = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.input),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: disabled ? null : onPressed,
        borderRadius: BorderRadius.circular(AppRadii.input),
        child: Opacity(
          opacity: disabled ? 0.6 : 1,
          child: Container(
            constraints: const BoxConstraints(minWidth: 88, minHeight: 42),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 10),
            alignment: Alignment.center,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.text),
            ),
          ),
        ),
      ),
    );
  }
}
