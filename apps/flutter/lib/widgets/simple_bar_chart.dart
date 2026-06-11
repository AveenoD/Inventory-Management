import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Bar chart — mirrors apps/mobile/components/ui/simple-bar-chart.tsx
class SimpleBarChart extends StatelessWidget {
  const SimpleBarChart({super.key, required this.data});

  final List<({String label, num value})> data;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const SizedBox(
        height: 160,
        child: Center(child: Text('No chart data', style: TextStyle(color: AppColors.muted))),
      );
    }

    final max = data.map((d) => d.value.toDouble()).fold<double>(0, (a, b) => a > b ? a : b);
    final scale = max <= 0 ? 1.0 : max;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: SizedBox(
        height: 160,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final point in data) ...[
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      SizedBox(
                        height: 130,
                        width: double.infinity,
                        child: Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.pageBg,
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            FractionallySizedBox(
                              heightFactor: (point.value.toDouble() / scale).clamp(0.03, 1.0),
                              widthFactor: 1,
                              child: Container(
                                decoration: const BoxDecoration(
                                  color: AppColors.accent,
                                  borderRadius: BorderRadius.vertical(top: Radius.circular(6)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        point.label,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.muted,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
