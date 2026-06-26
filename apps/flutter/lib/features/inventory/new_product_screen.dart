import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

class CoverRowState {
  final TextEditingController buy = TextEditingController();
  final TextEditingController mrp = TextEditingController();
  final TextEditingController offer = TextEditingController();
  final TextEditingController qty = TextEditingController();

  void dispose() {
    buy.dispose();
    mrp.dispose();
    offer.dispose();
    qty.dispose();
  }
}

class NewProductScreen extends ConsumerStatefulWidget {
  const NewProductScreen({super.key});

  @override
  ConsumerState<NewProductScreen> createState() => _NewProductScreenState();
}

class _NewProductScreenState extends ConsumerState<NewProductScreen> {
  String _kind = 'MOBILE_COVER';
  
  // Single product fields
  final _name = TextEditingController();
  final _sellPrice = TextEditingController();
  final _offerPrice = TextEditingController();
  final _buyPrice = TextEditingController();
  final _openingStock = TextEditingController(text: '0');
  final _minStock = TextEditingController(text: '0');
  
  String? _phoneModelId;
  List<Map<String, dynamic>> _phoneModels = [];
  List<Map<String, dynamic>> _coverTypes = [];
  
  // Batch cover state
  final Map<String, CoverRowState> _coverRows = {};
  
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadModels();
  }

  @override
  void dispose() {
    _name.dispose();
    _sellPrice.dispose();
    _offerPrice.dispose();
    _buyPrice.dispose();
    _openingStock.dispose();
    _minStock.dispose();
    for (final row in _coverRows.values) {
      row.dispose();
    }
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
    setState(() {
      _coverTypes = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      for (final row in _coverRows.values) {
        row.dispose();
      }
      _coverRows.clear();
      for (final t in _coverTypes) {
        _coverRows[t['id']] = CoverRowState();
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      if (_kind == 'MOBILE_COVER') {
        if (_phoneModelId == null) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a phone model')));
          return;
        }

        final covers = [];
        for (final t in _coverTypes) {
          final id = t['id'] as String;
          final row = _coverRows[id];
          if (row == null) continue;

          final qty = int.tryParse(row.qty.text) ?? 0;
          if (qty <= 0) continue;

          final buy = parseMoney(row.buy.text);
          final sell = parseMoney(row.mrp.text);
          final offerRaw = row.offer.text.trim();
          final offer = offerRaw.isEmpty ? null : parseMoney(offerRaw);

          if (offer != null && offer > sell) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('${t['name']}: Offer price cannot exceed MRP'))
              );
            }
            return;
          }

          covers.add({
            'coverTypeId': id,
            'buyPrice': buy,
            'sellPrice': sell,
            if (offer != null) 'offerPrice': offer,
            'openingStock': qty,
          });
        }

        if (covers.isEmpty) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter quantity for at least one cover')));
          return;
        }

        await ref.read(apiServiceProvider).batchCreateCovers({
          'phoneModelId': _phoneModelId,
          'covers': covers,
        });
      } else {
        final mrp = parseMoney(_sellPrice.text);
        final offerRaw = _offerPrice.text.trim();
        final offer = offerRaw.isEmpty ? null : parseMoney(offerRaw);
        if (offer != null && offer > mrp) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Offer price cannot exceed MRP')),
            );
          }
          return;
        }

        final body = <String, dynamic>{
          'name': _name.text.trim(),
          'kind': _kind,
          'sellPrice': mrp,
          'buyPrice': parseMoney(_buyPrice.text),
          'openingStock': int.tryParse(_openingStock.text) ?? 0,
          'minStock': int.tryParse(_minStock.text) ?? 0,
          if (offer != null) 'offerPrice': offer,
        };
        await ref.read(apiServiceProvider).createProduct(body);
      }
      
      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: _kind == 'MOBILE_COVER' ? 'Add Covers (Batch)' : 'Add Product',
      showBack: true,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            value: _kind,
            decoration: const InputDecoration(labelText: 'Product kind'),
            items: ['MOBILE_COVER', 'ACCESSORY', 'DEVICE', 'REPAIR_PART', 'SPEAKER', 'CHARGER']
                .map((k) => DropdownMenuItem(value: k, child: Text(k.replaceAll('_', ' '))))
                .toList(),
            onChanged: (v) => setState(() => _kind = v ?? 'MOBILE_COVER'),
          ),
          const SizedBox(height: 16),
          
          if (_kind == 'MOBILE_COVER') ...[
            DropdownButtonFormField<String>(
              value: _phoneModelId,
              decoration: const InputDecoration(labelText: 'Phone model'),
              items: _phoneModels.map((m) => DropdownMenuItem(value: m['id'] as String, child: Text('${m['name']}', style: const TextStyle(fontWeight: FontWeight.bold)))).toList(),
              onChanged: (v) { setState(() => _phoneModelId = v); _loadCoverTypes(); },
            ),
            const SizedBox(height: 16),
            if (_phoneModelId != null && _coverTypes.isEmpty)
              const Center(child: Text('Loading categories...'))
            else if (_phoneModelId != null) ...[
              const Text('Categories & Stock', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              for (final t in _coverTypes)
                if (_coverRows.containsKey(t['id']))
                  Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(t['name'], style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(child: TextField(controller: _coverRows[t['id']]!.buy, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Buy', isDense: true))),
                              const SizedBox(width: 12),
                              Expanded(child: TextField(controller: _coverRows[t['id']]!.mrp, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'MRP', isDense: true))),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(child: TextField(controller: _coverRows[t['id']]!.offer, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Offer', isDense: true))),
                              const SizedBox(width: 12),
                              Expanded(child: TextField(controller: _coverRows[t['id']]!.qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty', isDense: true))),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
            ]
          ] else ...[
            const FieldLabel('Name'),
            AppTextField(controller: _name),
            const FieldLabel('MRP (sell price)'),
            AppTextField(controller: _sellPrice, keyboardType: TextInputType.number),
            const FieldLabel('Offer price (optional)'),
            AppTextField(controller: _offerPrice, keyboardType: TextInputType.number),
            const FieldLabel('Buy price'),
            AppTextField(controller: _buyPrice, keyboardType: TextInputType.number),
            const FieldLabel('Opening stock'),
            AppTextField(controller: _openingStock, keyboardType: TextInputType.number),
            const FieldLabel('Min stock'),
            AppTextField(controller: _minStock, keyboardType: TextInputType.number),
          ],
          
          const SizedBox(height: 32),
          PrimaryButton(label: _kind == 'MOBILE_COVER' ? 'Save all covers' : 'Create product', loading: _saving, onPressed: _save),
        ],
      ),
    );
  }
}
