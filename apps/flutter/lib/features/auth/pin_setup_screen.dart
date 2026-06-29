import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key, required this.email, required this.password});
  
  final String email;
  final String password;

  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  final _pinController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pin = _pinController.text.trim();
    if (pin.length < 4) return;
    
    setState(() => _loading = true);
    try {
      final store = ref.read(tokenStoreProvider);
      await store.setPinAndCredentials(pin, widget.email, widget.password);
      await ref.read(authProvider.notifier).refreshPinStatus();
      if (mounted) context.go('/');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
  
  void _skip() {
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.pageBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.lock_outline, size: 48, color: AppColors.accent),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Quick Login PIN',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.text),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Set a 4-digit PIN so you don\'t have to enter your email and password every time.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 14),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  const FieldLabel('Enter 4-Digit PIN'),
                  AppTextField(
                    controller: _pinController,
                    hint: '1234',
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  PrimaryButton(
                    label: 'Save PIN',
                    loading: _loading,
                    disabled: _pinController.text.trim().length < 4,
                    onPressed: _submit,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextButton(
                    onPressed: _skip,
                    child: const Text('Skip for now', style: TextStyle(color: AppColors.muted)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
