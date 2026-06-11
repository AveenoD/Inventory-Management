import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

class NewProductScreen extends ConsumerStatefulWidget {
  const NewProductScreen({super.key});

  @override
  ConsumerState<NewProductScreen> createState() => _NewProductScreenState();
}

class _NewProductScreenState extends ConsumerState<NewProductScreen> {
  String _kind = 'MOBILE_COVER';
  final _name = TextEditingController();
  final _salePrice = TextEditingController();
  final _costPrice = TextEditingController();
  final _stockQty = TextEditingController(text: '0');
  final _minStock = TextEditingController(text: '0');
  String? _phoneModelId;
  String? _coverTypeId;
  List<Map<String, dynamic>> _phoneModels = [];
  List<Map<String, dynamic>> _coverTypes = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadModels();
  }

  @override
  void dispose() {
    _name.dispose();
    _salePrice.dispose();
    _costPrice.dispose();
    _stockQty.dispose();
    _minStock.dispose();
    super.dispose();
  }

  Future<void> _loadModels() async {
    final api = ref.read(apiServiceProvider);
    final res = await api.getPhoneModels();
    setState(() => _phoneModels = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>());
  }

  Future<void> _loadCoverTypes() async {
    if (_phoneModelId == null) return;
    final api = ref.read(apiServiceProvider);
    final res = await api.getCoverTypes(phoneModelId: _phoneModelId);
    setState(() => _coverTypes = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>());
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'kind': _kind,
        'salePrice': parseMoney(_salePrice.text),
        'costPrice': parseMoney(_costPrice.text),
        'stockQty': int.tryParse(_stockQty.text) ?? 0,
        'minStock': int.tryParse(_minStock.text) ?? 0,
      };
      if (_kind == 'MOBILE_COVER') {
        body['phoneModelId'] = _phoneModelId;
        body['coverTypeId'] = _coverTypeId;
      }
      await ref.read(apiServiceProvider).createProduct(body);
      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Add Product',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<String>(
            value: _kind,
            decoration: const InputDecoration(labelText: 'Product kind'),
            items: ['MOBILE_COVER', 'ACCESSORY', 'DEVICE', 'REPAIR_PART', 'SPEAKER', 'CHARGER']
                .map((k) => DropdownMenuItem(value: k, child: Text(k.replaceAll('_', ' '))))
                .toList(),
            onChanged: (v) => setState(() => _kind = v ?? 'MOBILE_COVER'),
          ),
          const FieldLabel('Name'),
          AppTextField(controller: _name),
          const FieldLabel('Sale price'),
          AppTextField(controller: _salePrice, keyboardType: TextInputType.number),
          const FieldLabel('Cost price'),
          AppTextField(controller: _costPrice, keyboardType: TextInputType.number),
          const FieldLabel('Stock qty'),
          AppTextField(controller: _stockQty, keyboardType: TextInputType.number),
          const FieldLabel('Min stock'),
          AppTextField(controller: _minStock, keyboardType: TextInputType.number),
          if (_kind == 'MOBILE_COVER') ...[
            DropdownButtonFormField<String>(
              value: _phoneModelId,
              decoration: const InputDecoration(labelText: 'Phone model'),
              items: _phoneModels.map((m) => DropdownMenuItem(value: m['id'] as String, child: Text('${m['name']}'))).toList(),
              onChanged: (v) { setState(() { _phoneModelId = v; _coverTypeId = null; }); _loadCoverTypes(); },
            ),
            DropdownButtonFormField<String>(
              value: _coverTypeId,
              decoration: const InputDecoration(labelText: 'Cover type'),
              items: _coverTypes.map((t) => DropdownMenuItem(value: t['id'] as String, child: Text('${t['name']}'))).toList(),
              onChanged: (v) => setState(() => _coverTypeId = v),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          PrimaryButton(label: 'Create product', loading: _saving, onPressed: _save),
        ],
      ),
    );
  }
}
