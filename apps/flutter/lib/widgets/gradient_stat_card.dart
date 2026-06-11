import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

enum StatTone { blue, green, amber, purple, teal, orange }

class GradientStatCard extends StatelessWidget {
  const GradientStatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.sub,
    this.tone = StatTone.blue,
  });

  final Widget icon;
  final String label;
  final String value;
  final String? sub;
  final StatTone tone;

  (List<Color>, Color) _colors() {
    switch (tone) {
      case StatTone.green:
        return (AppColors.gradientGreen, AppColors.statIconBgGreen);
      case StatTone.amber:
        return (AppColors.gradientAmber, AppColors.statIconBgAmber);
      case StatTone.purple:
        return (AppColors.gradientPurple, AppColors.statIconBgPurple);
      case StatTone.teal:
        return (AppColors.gradientTeal, AppColors.statIconBgTeal);
      case StatTone.orange:
        return (AppColors.gradientOrange, AppColors.statIconBgOrange);
      case StatTone.blue:
        return (AppColors.gradientBlue, AppColors.statIconBgBlue);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (gradient, iconBg) = _colors();
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: icon),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.muted,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text),
          ),
          SizedBox(
            height: 34,
            child: sub != null
                ? Align(
                    alignment: Alignment.topLeft,
                    child: Text(
                      sub!,
                      style: const TextStyle(fontSize: 12, height: 17 / 12, color: AppColors.muted),
                    ),
                  )
                : null,
          ),
        ],
      ),
    );
  }
}
