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
import '../../widgets/form_modal.dart';
import '../../widgets/page_loader.dart';
import '../../widgets/screen_shell.dart';

const _pageSize = 25;

const _filterTabs = <({String id, String label})>[
  (id: 'ALL', label: 'All'),
  (id: 'COVERS', label: 'Covers'),
  (id: 'OTHER_ACCESSORIES', label: 'Accessories'),
  (id: 'MOBILE', label: 'Mobile'),
  (id: 'REPAIR_PART', label: 'Repair'),
  (id: 'SPEAKERS_SOUND', label: 'Speakers'),
  (id: 'CHARGER_CABLE', label: 'Chargers'),
];

const _kindLabels = <String, String>{
  'MOBILE': 'Mobile',
  'MOBILE_ACCESSORY': 'Mobile Accessories',
  'REPAIR_PART': 'Repairing Accessory',
  'SPEAKERS_SOUND': 'Speakers / Sound',
  'CHARGER_CABLE': 'Charger & Cable',
};

class _EditDraft {
  _EditDraft({
    required this.name,
    required this.buyPrice,
    required this.sellPrice,
    required this.repairCharge,
    required this.minStock,
  });

  String name;
  String buyPrice;
  String sellPrice;
  String repairCharge;
  String minStock;
}

({String? kind, Map<String, String>? filters}) _queryForFilter(String filter) {
  switch (filter) {
    case 'COVERS':
      return (kind: 'MOBILE_ACCESSORY', filters: {'segment': 'covers'});
    case 'OTHER_ACCESSORIES':
      return (kind: 'MOBILE_ACCESSORY', filters: {'segment': 'other_accessories'});
    case 'ALL':
      return (kind: null, filters: null);
    default:
      return (kind: filter, filters: null);
  }
}

String? _addProductMode(String filter) {
  switch (filter) {
    case 'COVERS':
      return 'cover';
    case 'OTHER_ACCESSORIES':
      return 'accessory';
    case 'REPAIR_PART':
      return 'repair';
    case 'MOBILE':
    case 'SPEAKERS_SOUND':
    case 'CHARGER_CABLE':
      return 'device';
    default:
      return null;
  }
}

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  String _filter = 'ALL';
  int _page = 1;
  int _totalPages = 1;
  String _search = '';
  String _searchDebounced = '';
  String _coverPhoneModelId = '';
  String _coverTypeName = '';
  Timer? _searchDebounce;

  bool _initialLoading = true;
  bool _fetching = false;
  String? _error;
  bool _savingEdit = false;
  bool _deleting = false;

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _phoneModels = [];
  List<Map<String, dynamic>> _coverTypes = [];

  Map<String, dynamic>? _editTarget;
  ({String id, String name})? _deleteTarget;

  final _editName = TextEditingController();
  final _editBuyPrice = TextEditingController();
  final _editSellPrice = TextEditingController();
  final _editRepairCharge = TextEditingController();
  final _editMinStock = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _editName.dispose();
    _editBuyPrice.dispose();
    _editSellPrice.dispose();
    _editRepairCharge.dispose();
    _editMinStock.dispose();
    super.dispose();
  }

  String _kindLabel(String kind) => _kindLabels[kind] ?? kind;

  Map<String, String>? _productFilters() {
    if (_filter != 'COVERS') return _queryForFilter(_filter).filters;
    return {
      'segment': 'covers',
      if (_coverPhoneModelId.isNotEmpty) 'phoneModelId': _coverPhoneModelId,
      if (_coverTypeName.isNotEmpty) 'coverTypeName': _coverTypeName,
    };
  }

  String _sellPriceLabel(Map<String, dynamic> p) {
    if (_filter == 'REPAIR_PART' || p['kind'] == 'REPAIR_PART') {
      return formatMoney(parseMoney('${p['repairCharge'] ?? p['sellPrice']}'));
    }
    return formatMoney(parseMoney('${p['sellPrice']}'));
  }

  _EditDraft _productToDraft(Map<String, dynamic> p) => _EditDraft(
        name: '${p['name']}',
        buyPrice: '${p['buyPrice'] ?? '0'}',
        sellPrice: '${p['sellPrice'] ?? '0'}',
        repairCharge: '${p['repairCharge'] ?? ''}',
        minStock: '${p['minStock'] ?? 0}',
      );

  Future<void> _loadCoverMeta() async {
    if (_filter != 'COVERS') return;
    try {
      final api = ref.read(apiServiceProvider);
      final models = await api.getPhoneModels();
      final types = await api.getCoverTypes();
      if (!mounted) return;
      setState(() {
        _phoneModels = (models['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _coverTypes = (types['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (_) {
      // Optional filters — product list still works without these.
    }
  }

  Future<void> _loadProducts() async {
    if (!_initialLoading) setState(() => _fetching = true);
    if (_filter == 'COVERS' && _phoneModels.isEmpty) {
      await _loadCoverMeta();
    }
    try {
      final api = ref.read(apiServiceProvider);
      final query = _queryForFilter(_filter);
      final res = await api.getProducts(
        page: _page,
        search: _searchDebounced.isEmpty ? null : _searchDebounced,
        kind: query.kind,
        limit: _pageSize,
        filters: _productFilters(),
      );
      if (!mounted) return;
      final meta = res['meta'];
      setState(() {
        _products = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _totalPages = (meta is Map ? meta['totalPages'] : null) as int? ?? 1;
        _initialLoading = false;
        _fetching = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initialLoading = false;
        _fetching = false;
        _error = e is ApiError ? e.message : 'Could not load products.';
      });
    }
  }

  Future<void> _refresh() => _loadProducts();

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

  void _selectFilter(String id) {
    setState(() {
      _filter = id;
      _page = 1;
      if (id != 'COVERS') {
        _coverPhoneModelId = '';
        _coverTypeName = '';
      }
    });
    _loadProducts();
  }

  void _openAddProduct() {
    final mode = _addProductMode(_filter);
    if (mode != null) {
      context.push('/inventory/new?mode=$mode');
    } else {
      context.push('/inventory/new');
    }
  }

  void _openEdit(Map<String, dynamic> p) {
    final draft = _productToDraft(p);
    _editName.text = draft.name;
    _editBuyPrice.text = draft.buyPrice;
    _editSellPrice.text = draft.sellPrice;
    _editRepairCharge.text = draft.repairCharge;
    _editMinStock.text = draft.minStock;
    setState(() => _editTarget = p);
  }

  void _closeEdit() {
    setState(() => _editTarget = null);
  }

  Future<void> _saveEdit() async {
    final target = _editTarget;
    if (target == null) return;
    setState(() => _savingEdit = true);
    try {
      final api = ref.read(apiServiceProvider);
      final kind = '${target['kind']}';
      final minStock = int.tryParse(_editMinStock.text.trim()) ?? 0;
      final payload = <String, dynamic>{
        'name': _editName.text.trim(),
        'buyPrice': parseMoney(_editBuyPrice.text),
        'sellPrice': parseMoney(_editSellPrice.text),
        'minStock': minStock < 0 ? 0 : minStock,
      };
      if (kind == 'REPAIR_PART') {
        payload['repairCharge'] = parseMoney(_editRepairCharge.text);
      }
      await api.updateProduct('${target['id']}', payload);
      if (!mounted) return;
      setState(() => _savingEdit = false);
      _closeEdit();
      await _loadProducts();
    } catch (e) {
      if (!mounted) return;
      setState(() => _savingEdit = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiError ? e.message : 'Could not update product.')),
      );
    }
  }

  Future<void> _confirmDelete() async {
    final target = _deleteTarget;
    if (target == null) return;
    setState(() => _deleting = true);
    try {
      await ref.read(apiServiceProvider).deleteProduct(target.id);
      if (!mounted) return;
      setState(() {
        _deleteTarget = null;
        _deleting = false;
      });
      await _loadProducts();
    } catch (e) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiError ? e.message : 'Could not delete product.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: ScreenShell(
            title: 'Inventory',
            subtitle: 'Products & stock',
            showBack: true,
            hideHeaderActions: true,
            refreshing: _fetching && !_initialLoading,
            onRefresh: _refresh,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SearchField(
                  value: _search,
                  onChanged: _onSearchChanged,
                  placeholder: 'Search products…',
                ),
                const SizedBox(height: AppSpacing.sm),
                PrimaryButton(label: '+ Add product', onPressed: _openAddProduct),
                const SizedBox(height: AppSpacing.md),
                _buildFilterTabs(),
                if (_filter == 'COVERS') ...[
                  const SizedBox(height: AppSpacing.md),
                  _buildCoverFilters(),
                ],
                const SizedBox(height: AppSpacing.md),
                if (_initialLoading)
                  const PageLoader(message: 'Loading products…')
                else if (_error != null)
                  _buildError()
                else if (_products.isEmpty)
                  _buildEmpty()
                else ...[
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
                  ..._products.map(_buildProductCard),
                  _buildPagination(),
                ],
              ],
            ),
          ),
        ),
        FormModal(
          visible: _editTarget != null,
          title: 'Edit product',
          onClose: _closeEdit,
          child: _buildEditModal(),
        ),
        if (_deleteTarget != null)
          _DeleteOverlay(
            name: _deleteTarget!.name,
            loading: _deleting,
            onCancel: () => setState(() => _deleteTarget = null),
            onConfirm: _confirmDelete,
          ),
      ],
    );
  }

  Widget _buildFilterTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final tab in _filterTabs) ...[
            _FilterChip(
              label: tab.label,
              selected: _filter == tab.id,
              onTap: () => _selectFilter(tab.id),
            ),
            if (tab != _filterTabs.last) const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Widget _buildCoverFilters() {
    final coverTypeNames = <String>{
      for (final t in _coverTypes) '${t['name']}',
    }..remove('');

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Cover category', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
          const SizedBox(height: AppSpacing.sm),
          _picker(
            value: _coverTypeName,
            hint: 'All cover categories',
            items: ['', ...coverTypeNames],
            labelBuilder: (v) => v.isEmpty ? 'All cover categories' : v,
            onChanged: (v) {
              setState(() {
                _coverTypeName = v ?? '';
                _page = 1;
              });
              _loadProducts();
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          _picker(
            value: _coverPhoneModelId,
            hint: 'All phone models',
            items: ['', ..._phoneModels.map((m) => '${m['id']}')],
            labelBuilder: (v) {
              if (v.isEmpty) return 'All phone models';
              final match = _phoneModels.where((m) => '${m['id']}' == v).toList();
              return match.isEmpty ? v : '${match.first['name']}';
            },
            onChanged: (v) {
              setState(() {
                _coverPhoneModelId = v ?? '';
                _page = 1;
              });
              _loadProducts();
            },
          ),
        ],
      ),
    );
  }

  Widget _picker({
    required String value,
    required String hint,
    required List<String> items,
    required String Function(String) labelBuilder,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value.isEmpty ? '' : value,
          isExpanded: true,
          items: items
              .map((v) => DropdownMenuItem(value: v, child: Text(labelBuilder(v), style: const TextStyle(fontSize: 15))))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> p) {
    final stockQty = int.tryParse('${p['stockQty']}') ?? 0;
    final minStock = int.tryParse('${p['minStock']}') ?? 0;
    final low = stockQty <= minStock;
    final phoneModel = p['phoneModel']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${p['name']}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_kindLabel('${p['kind']}')}${phoneModel != null && phoneModel.isNotEmpty ? ' · $phoneModel' : ''}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: low ? const Color(0xFFFEF2F2) : AppColors.pageBg,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  border: Border.all(color: low ? const Color(0xFFFECACA) : AppColors.border),
                ),
                child: Text(
                  '$stockQty',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: low ? AppColors.red : AppColors.text,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text('Cost ${formatMoney(parseMoney('${p['buyPrice']}'))}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              const SizedBox(width: AppSpacing.lg),
              Text('Sell ${_sellPriceLabel(p)}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _SmallSecondaryButton(
                icon: AppIcons.pencil,
                label: 'Edit',
                onPressed: () => _openEdit(p),
              ),
              const SizedBox(width: AppSpacing.sm),
              _SmallPrimaryButton(
                icon: AppIcons.packagePlus,
                label: 'Stock',
                onPressed: () => context.push('/inventory/${p['id']}/stock'),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => setState(() => _deleteTarget = (id: '${p['id']}', name: '${p['name']}')),
                icon: const Icon(AppIcons.trash2, size: 18, color: AppColors.red),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPagination() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _PageButton(
            label: 'Prev',
            disabled: _page <= 1,
            onPressed: () {
              setState(() => _page = (_page - 1).clamp(1, _totalPages));
              _loadProducts();
            },
          ),
          const SizedBox(width: AppSpacing.md),
          Text('$_page / $_totalPages', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(width: AppSpacing.md),
          _PageButton(
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

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Text(_error!, style: const TextStyle(color: AppColors.red)),
          const SizedBox(height: AppSpacing.sm),
          GestureDetector(
            onTap: _loadProducts,
            child: const Text('Retry', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return EmptyState(
      title: 'No products',
      description: 'Add your first product to start tracking stock.',
      action: PrimaryButton(label: '+ Add product', onPressed: _openAddProduct),
    );
  }

  Widget _buildEditModal() {
    final target = _editTarget;
    if (target == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel('Name'),
        AppTextField(controller: _editName),
        const FieldLabel('Buy price'),
        AppTextField(
          controller: _editBuyPrice,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const FieldLabel('Sell price'),
        AppTextField(
          controller: _editSellPrice,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        if ('${target['kind']}' == 'REPAIR_PART') ...[
          const FieldLabel('Repair charge'),
          AppTextField(
            controller: _editRepairCharge,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ],
        const FieldLabel('Min stock alert'),
        AppTextField(controller: _editMinStock, keyboardType: TextInputType.number),
        ModalActions(
          onCancel: _closeEdit,
          onConfirm: _saveEdit,
          loading: _savingEdit,
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.accentLight : AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        side: BorderSide(color: selected ? AppColors.accent : AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
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
}

class _PageButton extends StatelessWidget {
  const _PageButton({required this.label, required this.onPressed, this.disabled = false});

  final String label;
  final VoidCallback onPressed;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: disabled ? null : onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Opacity(
          opacity: disabled ? 0.6 : 1,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text)),
          ),
        ),
      ),
    );
  }
}

class _SmallSecondaryButton extends StatelessWidget {
  const _SmallSecondaryButton({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: AppColors.text),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.text)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SmallPrimaryButton extends StatelessWidget {
  const _SmallPrimaryButton({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: Colors.white),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeleteOverlay extends StatelessWidget {
  const _DeleteOverlay({
    required this.name,
    required this.loading,
    required this.onCancel,
    required this.onConfirm,
  });

  final String name;
  final bool loading;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onCancel,
      child: Container(
        color: AppColors.modalOverlay,
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () {},
          child: Container(
            margin: const EdgeInsets.all(AppSpacing.xl),
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Delete product?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: AppSpacing.sm),
                Text('Remove "$name" permanently?', style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(child: SecondaryButton(label: 'Cancel', onPressed: onCancel)),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: PrimaryButton(
                        label: loading ? 'Deleting…' : 'Delete',
                        loading: loading,
                        onPressed: onConfirm,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
