import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../domain/models/sale_invoice.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

const _maxLogoBytes = 400000;
const _shopName = 'SK Mobile Shop';

class InvoiceSettingsCard extends ConsumerStatefulWidget {
  const InvoiceSettingsCard({super.key});

  @override
  ConsumerState<InvoiceSettingsCard> createState() => _InvoiceSettingsCardState();
}

class _InvoiceSettingsCardState extends ConsumerState<InvoiceSettingsCard> {
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _warranty = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _saveMsg;
  String? _logoDataUrl;
  bool _logoDirty = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _address.dispose();
    _phone.dispose();
    _warranty.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiServiceProvider).getInvoiceSettings();
      final settings = InvoiceSettings.fromJson(res);
      if (!mounted) return;
      setState(() {
        _address.text = settings.address ?? '';
        _phone.text = settings.phone ?? '';
        _warranty.text = settings.warrantyText ?? '';
        if (!_logoDirty) _logoDataUrl = settings.logoDataUrl;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load invoice settings.';
        _loading = false;
      });
    }
  }

  Future<void> _pickLogo() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final file = result?.files.single;
    if (file == null) return;
    final bytes = file.bytes ?? (file.path != null ? await File(file.path!).readAsBytes() : null);
    if (bytes == null) return;
    if (bytes.length > _maxLogoBytes) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Logo must be under 400 KB')),
      );
      return;
    }
    final ext = (file.extension ?? 'png').toLowerCase();
    final mime = ext == 'jpg' || ext == 'jpeg' ? 'image/jpeg' : 'image/png';
    final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
    setState(() {
      _logoDataUrl = dataUrl;
      _logoDirty = true;
    });
  }

  void _removeLogo() {
    setState(() {
      _logoDataUrl = null;
      _logoDirty = true;
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
      _saveMsg = null;
    });
    try {
      final data = <String, dynamic>{
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'warrantyText': _warranty.text.trim().isEmpty ? null : _warranty.text.trim(),
      };
      if (_logoDirty) data['logoDataUrl'] = _logoDataUrl;
      await ref.read(apiServiceProvider).updateInvoiceSettings(data);
      if (!mounted) return;
      setState(() {
        _logoDirty = false;
        _saveMsg = 'Invoice settings saved.';
        _saving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not save settings.';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const _SettingsCardShell(
        child: Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
      );
    }

    return _SettingsCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Logo, address, and warranty text appear on every sale invoice. Shop name is fixed as $_shopName.',
            style: TextStyle(color: AppColors.muted, fontSize: 14),
          ),
          const SizedBox(height: AppSpacing.md),
          const FieldLabel('Shop name'),
          TextField(
            readOnly: true,
            controller: TextEditingController(text: _shopName),
            style: const TextStyle(color: AppColors.muted, fontSize: 16),
            decoration: const InputDecoration(),
          ),
          const SizedBox(height: AppSpacing.sm),
          const FieldLabel('Shop logo'),
          Row(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(8),
                  color: Colors.white,
                ),
                child: _logoDataUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          decodeDataUrlImage(_logoDataUrl!)!,
                          fit: BoxFit.contain,
                        ),
                      )
                    : const Icon(Icons.image_outlined, color: AppColors.muted),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.sm,
                  children: [
                    SecondaryButton(label: 'Upload logo', onPressed: _pickLogo),
                    if (_logoDataUrl != null)
                      SecondaryButton(label: 'Remove', onPressed: _removeLogo),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const FieldLabel('Shop address'),
          AppTextField(
            controller: _address,
            hint: 'Street, area, city, pin code',
            maxLines: 3,
          ),
          const SizedBox(height: AppSpacing.sm),
          const FieldLabel('Phone number'),
          AppTextField(controller: _phone, hint: '98XXXXXXXX', keyboardType: TextInputType.phone),
          const SizedBox(height: AppSpacing.sm),
          const FieldLabel('Default warranty / guarantee'),
          AppTextField(
            controller: _warranty,
            hint: 'e.g. Accessories: 6 months warranty…',
            maxLines: 4,
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
          ],
          if (_saveMsg != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_saveMsg!, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
          ],
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: _saving ? 'Saving…' : 'Save invoice settings',
            loading: _saving,
            onPressed: _save,
          ),
        ],
      ),
    );
  }
}

class _SettingsCardShell extends StatelessWidget {
  const _SettingsCardShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Invoice Settings', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
