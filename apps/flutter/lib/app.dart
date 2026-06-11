import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'router/app_router.dart';
import 'widgets/offline_banner.dart';

class SkMobileApp extends ConsumerWidget {
  const SkMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pushSetupProvider);
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'SK Mobile Shop',
      theme: AppTheme.light,
      routerConfig: router,
      builder: (context, child) => Column(
        children: [
          const OfflineBanner(),
          Expanded(child: child ?? const SizedBox.shrink()),
        ],
      ),
    );
  }
}
