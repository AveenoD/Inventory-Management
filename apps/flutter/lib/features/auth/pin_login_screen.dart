import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class PinLoginScreen extends ConsumerStatefulWidget {
  const PinLoginScreen({super.key});

  @override
  ConsumerState<PinLoginScreen> createState() => _PinLoginScreenState();
}

class _PinLoginScreenState extends ConsumerState<PinLoginScreen> {
  final _pinController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pin = _pinController.text.trim();
    if (pin.length < 4) return;
    
    setState(() {
      _loading = true;
      _error = null;
    });
    
    try {
      final store = ref.read(tokenStoreProvider);
      final savedPin = await store.getPin();
      
      if (savedPin != pin) {
        setState(() => _error = 'Incorrect PIN');
        return;
      }
      
      final email = await store.getEmail();
      final password = await store.getPassword();
      
      if (email == null || password == null) {
        setState(() => _error = 'Credentials not found. Please login normally.');
        return;
      }
      
      final api = ref.read(apiServiceProvider);
      final res = await api.login({
        'email': email,
        'password': password,
      });
      
      await ref.read(authProvider.notifier).login(res['token'] as String);
    } catch (e) {
      setState(() => _error = e is ApiError ? e.message : 'Login failed');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
  
  Future<void> _resetLogin() async {
    await ref.read(authProvider.notifier).clearAll();
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
                    'Welcome Back',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.text),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Enter your 4-digit PIN to unlock the app',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 14),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  const FieldLabel('PIN'),
                  AppTextField(
                    controller: _pinController,
                    hint: '••••',
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  PrimaryButton(
                    label: 'Unlock',
                    loading: _loading,
                    disabled: _pinController.text.trim().length < 4,
                    onPressed: _submit,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextButton(
                    onPressed: _resetLogin,
                    child: const Text('Forgot PIN? / Login with Password', style: TextStyle(color: AppColors.muted)),
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
