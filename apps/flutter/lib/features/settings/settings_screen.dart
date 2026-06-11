import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';
import '../../widgets/screen_shell.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  int _year = DateTime.now().year;
  int _month = DateTime.now().month;
  String? _fileName;
  bool _uploading = false;
  String? _message;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
    );
    if (result != null && result.files.single.path != null) {
      setState(() => _fileName = result.files.single.path);
    }
  }

  Future<void> _upload() async {
    if (_fileName == null) return;
    setState(() { _uploading = true; _message = null; });
    try {
      await ref.read(apiServiceProvider).importExcel(File(_fileName!), _year, _month);
      setState(() => _message = 'Import successful');
    } catch (e) {
      setState(() => _message = '$e');
    } finally {
      setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Settings',
      subtitle: 'Excel import',
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<int>(
            value: _year,
            decoration: const InputDecoration(labelText: 'Year'),
            items: List.generate(5, (i) => DateTime.now().year - 2 + i)
                .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                .toList(),
            onChanged: (v) => setState(() => _year = v ?? _year),
          ),
          DropdownButtonFormField<int>(
            value: _month,
            decoration: const InputDecoration(labelText: 'Month'),
            items: List.generate(12, (i) => i + 1)
                .map((m) => DropdownMenuItem(value: m, child: Text('$m')))
                .toList(),
            onChanged: (v) => setState(() => _month = v ?? _month),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(onPressed: _pickFile, child: Text(_fileName == null ? 'Pick Excel file' : _fileName!.split(RegExp(r'[/\\]')).last)),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(label: 'Import', loading: _uploading, disabled: _fileName == null, onPressed: _upload),
          if (_message != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(_message!, style: TextStyle(color: _message!.contains('successful') ? AppColors.green : AppColors.red)),
          ],
        ],
      ),
    );
  }
}
