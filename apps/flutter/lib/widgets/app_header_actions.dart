import 'package:flutter/material.dart';
import '../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_provider.dart';
import '../core/theme/app_colors.dart';

final unreadCountProvider = FutureProvider<int>((ref) async {
  final auth = ref.watch(authProvider);
  if (!auth.isAuthenticated) return 0;
  try {
    final api = ref.watch(apiServiceProvider);
    final res = await api.getNotifications(page: 1, limit: 1);
    return (res['unreadCount'] as int?) ?? 0;
  } catch (_) {
    return 0;
  }
});

class AppHeaderActions extends ConsumerWidget {
  const AppHeaderActions({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              onPressed: () => context.push('/notifications'),
              icon: const Icon(AppIcons.bell, color: AppColors.text, size: 22),
            ),
            if (unread > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: AppColors.red,
                    shape: BoxShape.circle,
                  ),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: Text(
                    unread > 9 ? '9+' : '$unread',
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
        IconButton(
          onPressed: () => context.push('/profile'),
          icon: const Icon(AppIcons.user, color: AppColors.text, size: 22),
        ),
      ],
    );
  }
}
