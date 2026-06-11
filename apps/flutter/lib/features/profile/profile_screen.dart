import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/screen_shell.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const menu = [
      _ProfileMenuItem(label: 'Inventory', route: '/inventory', icon: AppIcons.package),
      _ProfileMenuItem(label: 'Reports', route: '/reports', icon: AppIcons.receipt),
      _ProfileMenuItem(label: 'Expenses', route: '/expenses', icon: AppIcons.receipt),
      _ProfileMenuItem(label: 'Parties', route: '/parties', icon: AppIcons.users),
      _ProfileMenuItem(label: 'Business Months', route: '/months', icon: AppIcons.calendar),
      _ProfileMenuItem(label: 'Settings', route: '/settings', icon: AppIcons.settings),
    ];

    return ScreenShell(
      title: 'Profile',
      subtitle: 'Inventory, reports & settings',
      showBack: true,
      backLabel: 'Back to Dashboard',
      onBack: () => context.go('/'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            for (var i = 0; i < menu.length; i++)
              _MenuRow(
                item: menu[i],
                showDivider: i != menu.length - 1,
              ),
            _LogoutRow(
              onTap: () => ref.read(authProvider.notifier).logout(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileMenuItem {
  const _ProfileMenuItem({
    required this.label,
    required this.route,
    required this.icon,
  });

  final String label;
  final String route;
  final IconData icon;
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.item, required this.showDivider});

  final _ProfileMenuItem item;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push(item.route),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 14),
        decoration: BoxDecoration(
          border: showDivider
              ? const Border(bottom: BorderSide(color: AppColors.border))
              : null,
        ),
        child: Row(
          children: [
            Icon(item.icon, size: 20, color: AppColors.accent),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                item.label,
                style: const TextStyle(fontSize: 16, color: AppColors.text, fontWeight: FontWeight.w500),
              ),
            ),
            const Icon(AppIcons.chevronRight, size: 18, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}

class _LogoutRow extends StatelessWidget {
  const _LogoutRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 14),
        child: const Row(
          children: [
            Icon(AppIcons.arrowLeftRight, size: 20, color: AppColors.red),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                'Logout',
                style: TextStyle(fontSize: 16, color: AppColors.red, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
