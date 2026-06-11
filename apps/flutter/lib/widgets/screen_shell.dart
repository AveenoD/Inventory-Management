import 'package:flutter/material.dart';
import '../core/theme/app_icons.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_colors.dart';
import 'app_header_actions.dart';
import 'page_header.dart';

class ScreenShell extends StatelessWidget {
  const ScreenShell({
    super.key,
    required this.title,
    this.subtitle,
    required this.child,
    this.scroll = true,
    this.refreshing = false,
    this.onRefresh,
    this.showBack = false,
    this.backLabel = 'Back',
    this.onBack,
    this.hideHeaderActions = false,
    this.headerAction,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final bool scroll;
  final bool refreshing;
  final Future<void> Function()? onRefresh;
  final bool showBack;
  final String backLabel;
  final VoidCallback? onBack;
  final bool hideHeaderActions;
  final Widget? headerAction;

  @override
  Widget build(BuildContext context) {
    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showBack)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: InkWell(
              onTap: onBack ?? () => context.pop(),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(AppIcons.chevronLeft, color: AppColors.accent, size: 22),
                  const SizedBox(width: 4),
                  Text(
                    backLabel,
                    style: const TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        PageHeader(
          title: title,
          subtitle: subtitle,
          action: headerAction ??
              (showBack || hideHeaderActions ? null : const AppHeaderActions()),
        ),
      ],
    );

    return Scaffold(
      backgroundColor: AppColors.pageBg,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 0),
              child: header,
            ),
            Expanded(
              child: scroll
                  ? RefreshIndicator(
                      onRefresh: onRefresh ?? () async {},
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          0,
                          AppSpacing.lg,
                          AppSpacing.xl * 2,
                        ),
                        child: child,
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                      child: child,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
