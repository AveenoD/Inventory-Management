import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'router/app_router.dart';
import 'widgets/offline_banner.dart';

/// Root app shell — must not [ref.watch] auth/router here.
/// Rebuilding [MaterialApp.router] when auth finishes breaks
/// [StatefulShellRoute.indexedStack] (blank dashboard body + bottom nav only).
class SkMobileApp extends ConsumerStatefulWidget {
  const SkMobileApp({super.key});

  @override
  ConsumerState<SkMobileApp> createState() => _SkMobileAppState();
}

class _SkMobileAppState extends ConsumerState<SkMobileApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    ref.read(pushSetupProvider);
    _router = ref.read(routerProvider);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'SK Mobile Shop',
      theme: AppTheme.light,
      routerConfig: _router,
      builder: (context, child) => Column(
        children: [
          const OfflineBanner(),
          Expanded(child: child ?? const SizedBox.shrink()),
        ],
      ),
    );
  }
}
