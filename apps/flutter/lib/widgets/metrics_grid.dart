import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// 2-column metrics grid — mirrors apps/mobile/components/ui/metrics-grid.tsx
class MetricsGrid extends StatelessWidget {
  const MetricsGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final halfW = (maxW - AppSpacing.sm) / 2;
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final child in children)
                SizedBox(
                  width: child is MetricCell && child.fullWidth ? maxW : halfW,
                  child: child is MetricCell ? child.child : child,
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Cell wrapper for equal-height stretch inside [MetricsGrid].
class MetricCell extends StatelessWidget {
  const MetricCell({super.key, required this.child, this.fullWidth = false});

  final Widget child;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: double.infinity, child: child);
  }
}
