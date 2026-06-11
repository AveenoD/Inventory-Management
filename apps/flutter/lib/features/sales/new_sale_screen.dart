import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

class _CartLine {
  _CartLine({required this.product, this.qty = 1});
  final Map<String, dynamic> product;
  int qty;
  double get lineTotal => parseMoney('${product['salePrice']}') * qty;
}

class NewSaleScreen extends ConsumerStatefulWidget {
  const NewSaleScreen({super.key});

  @override
  ConsumerState<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends ConsumerState<NewSaleScreen> {
  String _kind = 'ALL';
  String _search = '';
  String _payment = 'CASH';
  String _discount = '0';
  final _customer = TextEditingController();
  final _received = TextEditingController();
  final List<_CartLine> _cart = [];
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  bool _saving = false;

  static const _kinds = ['ALL', 'MOBILE_COVER', 'ACCESSORY', 'DEVICE', 'SPEAKER', 'CHARGER'];

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _customer.dispose();
    _received.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getProducts(
        page: 1,
        search: _search.isEmpty ? null : _search,
        kind: _kind == 'ALL' ? null : _kind,
        excludeKinds: const ['REPAIR_PART'],
        limit: 100,
      );
      if (mounted) {
        setState(() {
          _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _subtotal => _cart.fold(0.0, (s, l) => s + l.lineTotal);
  double get _total => (_subtotal - parseMoney(_discount)).clamp(0, double.infinity);
  double get _change => (parseMoney(_received.text) - _total).clamp(0, double.infinity);

  void _addToCart(Map<String, dynamic> p) {
    final existing = _cart.where((c) => c.product['id'] == p['id']).toList();
    setState(() {
      if (existing.isNotEmpty) {
        existing.first.qty++;
      } else {
        _cart.add(_CartLine(product: p));
      }
    });
  }

  Future<void> _complete() async {
    if (_cart.isEmpty) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.createSale({
        'date': todayIso(),
        'customerName': _customer.text.trim().isEmpty ? null : _customer.text.trim(),
        'paymentMethod': _payment,
        'discount': parseMoney(_discount),
        'lines': _cart.map((c) => {
              'productId': c.product['id'],
              'quantity': c.qty,
              'unitPrice': parseMoney('${c.product['salePrice']}'),
            }).toList(),
      });
      if (mounted) context.go('/sales');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'New Sale',
      subtitle: 'Point of sale',
      showBack: true,
      scroll: false,
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _kinds.map((k) {
                        final sel = _kind == k;
                        return Padding(
                          padding: const EdgeInsets.only(right: AppSpacing.sm),
                          child: ChoiceChip(
                            label: Text(k == 'ALL' ? 'All' : k.replaceAll('_', ' ')),
                            selected: sel,
                            onSelected: (_) { setState(() => _kind = k); _loadProducts(); },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppTextField(hint: 'Search products…', onChanged: (v) { _search = v; _loadProducts(); }),
                  const SizedBox(height: AppSpacing.sm),
                  if (_loading) const LinearProgressIndicator(),
                  ..._products.map((p) => ListTile(
                        title: Text('${p['name']}'),
                        subtitle: Text('${formatMoney(parseMoney('${p['salePrice']}'))} · Stock ${p['stockQty']}'),
                        trailing: TextButton(onPressed: () => _addToCart(p), child: const Text('+ Add')),
                      )),
                  const Divider(height: 32),
                  const Text('Cart', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  if (_cart.isEmpty) const Text('No items yet', style: TextStyle(color: AppColors.muted))
                  else ..._cart.map((c) => ListTile(
                        title: Text('${c.product['name']}'),
                        subtitle: Text(formatMoney(c.lineTotal)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(icon: const Icon(Icons.remove), onPressed: () => setState(() { if (c.qty > 1) c.qty--; else _cart.remove(c); })),
                            Text('${c.qty}'),
                            IconButton(icon: const Icon(Icons.add), onPressed: () => setState(() => c.qty++)),
                          ],
                        ),
                      )),
                  const FieldLabel('Discount'),
                  AppTextField(controller: TextEditingController(text: _discount), keyboardType: TextInputType.number, onChanged: (v) => setState(() => _discount = v)),
                  const FieldLabel('Customer (optional)'),
                  AppTextField(controller: _customer),
                  const FieldLabel('Payment method'),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'CASH', label: Text('Cash')),
                      ButtonSegment(value: 'UPI', label: Text('UPI')),
                      ButtonSegment(value: 'CARD', label: Text('Card')),
                    ],
                    selected: {_payment},
                    onSelectionChanged: (s) => setState(() => _payment = s.first),
                  ),
                  const FieldLabel('Amount received'),
                  AppTextField(controller: _received, keyboardType: TextInputType.number, onChanged: (_) => setState(() {})),
                  Text('Total: ${formatMoney(_total)} · Change: ${formatMoney(_change)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
          PrimaryButton(label: 'Complete Sale', loading: _saving, disabled: _cart.isEmpty, onPressed: _complete),
        ],
      ),
    );
  }
}
