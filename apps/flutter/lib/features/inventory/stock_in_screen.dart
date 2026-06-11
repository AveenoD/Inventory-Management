import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

class StockInScreen extends ConsumerStatefulWidget {
  const StockInScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<StockInScreen> createState() => _StockInScreenState();
}

class _StockInScreenState extends ConsumerState<StockInScreen> {
  Map<String, dynamic>? _product;
  final _qty = TextEditingController(text: '1');
  final _note = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _qty.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final res = await ref.read(apiServiceProvider).getProduct(widget.productId);
    if (mounted) setState(() { _product = res; _loading = false; });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(apiServiceProvider).stockIn({
        'productId': widget.productId,
        'quantity': int.tryParse(_qty.text) ?? 1,
        'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
      });
      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: PageLoader(message: 'Loading product…'));
    return ScreenShell(
      title: 'Stock In',
      subtitle: '${_product?['name']}',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Current stock: ${_product?['stockQty']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const FieldLabel('Quantity to add'),
          AppTextField(controller: _qty, keyboardType: TextInputType.number),
          const FieldLabel('Note (optional)'),
          AppTextField(controller: _note),
          const SizedBox(height: AppSpacing.xl),
          PrimaryButton(label: 'Add stock', loading: _saving, onPressed: _save),
        ],
      ),
    );
  }
}
