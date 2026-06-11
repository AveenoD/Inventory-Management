import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/buttons.dart';
import '../../widgets/fields.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.login({
        'email': _email.text.trim(),
        'password': _password.text,
      });
      await ref.read(authProvider.notifier).login(res['token'] as String);
    } catch (e) {
      setState(() => _error = e is ApiError ? e.message : 'Login failed');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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
                  const Text(
                    'SK Mobile Shop',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.text),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Sign in to your dashboard',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 15),
                  ),
                  const FieldLabel('Email'),
                  AppTextField(
                    controller: _email,
                    hint: 'owner@skmobile.local',
                    keyboardType: TextInputType.emailAddress,
                    onChanged: (_) => setState(() {}),
                  ),
                  const FieldLabel('Password'),
                  AppTextField(
                    controller: _password,
                    hint: '••••••••',
                    obscureText: !_showPassword,
                    onChanged: (_) => setState(() {}),
                    suffix: IconButton(
                      icon: Icon(_showPassword ? AppIcons.eyeOff : AppIcons.eye, color: AppColors.muted),
                      onPressed: () => setState(() => _showPassword = !_showPassword),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 14)),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  PrimaryButton(
                    label: 'Sign in',
                    loading: _loading,
                    disabled: _email.text.isEmpty || _password.text.isEmpty,
                    onPressed: _submit,
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
